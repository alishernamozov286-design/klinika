/**
 * To'lovni qaytarish (B7.4, TZ §9.2 "To'lov qaytarish faqat vakolatli shaxs
 * tasdig'i bilan bajariladi", §9.1 "Qaytarilgan to'lovlar").
 *
 *   payments.create | payments.refund | finance.view   read refunds
 *   payments.create                                    ask; hand out an approved refund (open cash shift)
 *   payments.refund                                    approve or reject — never one's own request
 *   requester or payments.refund                       cancel an open request
 *
 * Rules: shared/refund.ts. Approvers are told of a new request, the requester
 * of the decision (notifications; never blocking the write).
 */
import type { Express, Request } from "express";
import { decideRefundSchema, requestRefundSchema, voidPaymentSchema, PAYMENT_METHOD_LABELS, type RefundSlipView, type RefundView } from "@shared/schema";
import { REFUND_STATUSES, REFUND_STATUS_LABELS, type RefundStatus } from "@shared/refund";
import { hasPermission, requirePermission, toSessionUser } from "./rbac";
import { actorOf, audit, dayRange, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { tillActor } from "./routes-cashdesk";
import { storage } from "./storage";
import { log } from "./logger";

const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
const who = (r: RefundView) => `Qaytarish №${r.number} (${sum(r.amount)}, ${PAYMENT_METHOD_LABELS[r.method]}) — №${r.patientNumber} ${r.patientName}`;
const LINK = "/cashier?tab=refunds";

/** Tells everyone else who may approve; a failure is logged, never thrown. */
async function notifyApprovers(r: RefundView, requesterId: string | null) {
  try {
    const users = (await storage.listUsers()).filter((u) => u.isActive && u.id !== requesterId);
    for (const u of users) {
      const session = await toSessionUser(u);
      if (!session.permissions.includes("payments.refund")) continue;
      await storage.createNotification({
        userId: u.id,
        kind: "refund_request",
        title: `Qaytarish tasdiq kutmoqda: ${sum(r.amount)}`,
        body: `№${r.patientNumber} ${r.patientName} · ${r.requestedByName ?? "—"}: ${r.reason}`,
        link: LINK,
        entityId: r.id,
        important: true,
        dedupeKey: `refund_request:${r.id}:${u.id}`,
      });
    }
  } catch (err) {
    log(`[refund] tasdiqlovchilarga xabar yuborilmadi — ${err instanceof Error ? err.message : err}`);
  }
}

async function notifyRequester(r: RefundView) {
  if (!r.requestedBy) return;
  try {
    const approved = r.status === "approved";
    await storage.createNotification({
      userId: r.requestedBy,
      kind: "refund_decision",
      title: `Qaytarish №${r.number} ${approved ? "tasdiqlandi" : "rad etildi"}`,
      body: `${sum(r.amount)} · №${r.patientNumber} ${r.patientName} · ${r.decidedByName ?? "—"}${r.decisionNote ? `: ${r.decisionNote}` : ""}${approved ? " — pulni Kassada bering" : ""}`,
      link: LINK,
      entityId: r.id,
      important: !approved,
      dedupeKey: `refund_decision:${r.id}`,
    });
  } catch (err) {
    log(`[refund] so'ragan xodimga xabar yuborilmadi — ${err instanceof Error ? err.message : err}`);
  }
}

const mayCancel = (req: Request, r: RefundView) => hasPermission(req, "payments.refund") || (r.requestedBy === req.user?.id && hasPermission(req, "payments.create"));

export function registerRefundRoutes(app: Express) {
  /** "Qaytarilgan to'lovlar": by status (open ones whenever asked) and request day. */
  app.get(
    "/api/refunds",
    requirePermission("payments.create", "payments.refund", "finance.view"),
    handle(async (req, res) => {
      const status = stringParam(req.query.status) as RefundStatus | undefined;
      if (status && !REFUND_STATUSES.includes(status)) return res.status(400).json({ message: "Noma'lum holat" });
      const from = stringParam(req.query.from);
      const to = stringParam(req.query.to);
      let range: { from?: string; to?: string } = {};
      if (from || to) {
        const r = dayRange(from ?? "2000-01-01", to ?? "2999-12-31");
        if ("error" in r) return res.status(400).json({ message: r.error });
        range = r;
      }
      res.json(await storage.listRefunds({ status, ...range }).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.get(
    "/api/refunds/:id",
    requirePermission("payments.create", "payments.refund", "finance.view"),
    handle(async (req, res) => {
      const r = await storage.getRefund(req.params.id);
      if (!r) return res.status(404).json({ message: "Qaytarish topilmadi" });
      res.json(r);
    }),
  );

  app.post(
    "/api/bills/:visitId/refunds",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const input = requestRefundSchema.parse(req.body);
      const r = await storage.requestRefund(req.params.visitId, input, actorOf(req));
      if (!r) return res.status(404).json({ message: "Tashrif topilmadi" });
      await audit(req, "create", "refund", r.id, `${who(r)} so'raldi. Sabab: ${r.reason}`);
      await notifyApprovers(r, req.user?.id ?? null);
      res.status(201).json(r);
    }),
  );

  for (const approve of [true, false]) {
    app.post(
      `/api/refunds/:id/${approve ? "approve" : "reject"}`,
      requirePermission("payments.refund"),
      handle(async (req, res) => {
        const { note } = decideRefundSchema.parse(req.body ?? {});
        if (!approve && !note) return res.status(400).json({ message: "Rad etish sababini yozing" });
        const r = await storage.decideRefund(req.params.id, approve, note, actorOf(req));
        if (!r) return res.status(404).json({ message: "Qaytarish topilmadi" });
        await audit(req, approve ? "verify" : "return", "refund", r.id, `${who(r)} ${approve ? "tasdiqlandi" : "rad etildi"}${note ? `: ${note}` : ""}`);
        await notifyRequester(r);
        res.json(r);
      }),
    );
  }

  /** The money leaves the drawer: only from an open cash shift (B7.5). */
  app.post(
    "/api/refunds/:id/pay",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const before = await storage.getRefund(req.params.id);
      if (!before) return res.status(404).json({ message: "Qaytarish topilmadi" });
      const till = await tillActor(req, res);
      if (!till) return;
      const r = (await storage.payRefund(req.params.id, till))!;
      await audit(req, "refund", "refund", r.id, `${who(r)} bemorga berildi (Smena №${r.shiftNumber ?? "—"}): ${(r.lines ?? []).map((l) => `${l.title} ${sum(l.amount)}`).join(" + ")}`);
      res.json(r);
    }),
  );

  app.post(
    "/api/refunds/:id/cancel",
    requirePermission("payments.create", "payments.refund"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const before = await storage.getRefund(req.params.id);
      if (!before) return res.status(404).json({ message: "Qaytarish topilmadi" });
      if (!mayCancel(req, before)) return res.status(403).json({ message: "Bu qaytarishni faqat so'ragan xodim yoki vakolatli shaxs bekor qiladi" });
      const r = (await storage.cancelRefund(req.params.id, reason, actorOf(req)))!;
      await audit(req, "void", "refund", r.id, `${who(r)} bekor qilindi (${REFUND_STATUS_LABELS[before.status].toLowerCase()} edi). Sabab: ${reason}`);
      res.json(r);
    }),
  );

  /** The chek of a refund handed out (B7.6 rules: prints counted, later ones "NUSXA"). */
  app.get(
    "/api/refunds/:id/slip",
    requirePermission("payments.create", "payments.refund", "finance.view"),
    handle(async (req, res) => {
      const [refund, clinic, logo] = await Promise.all([storage.getRefund(req.params.id), storage.getSettings(), storage.getLogo()]);
      if (!refund) return res.status(404).json({ message: "Qaytarish topilmadi" });
      res.json({ refund, clinic, logo: logo?.dataUrl ?? null } satisfies RefundSlipView);
    }),
  );

  app.post(
    "/api/refunds/:id/print",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const r = await storage.getRefund(req.params.id);
      if (!r) return res.status(404).json({ message: "Qaytarish topilmadi" });
      if (r.status !== "paid") return res.status(409).json({ message: "Chek faqat bemorga berilgan qaytarish uchun chiqadi" });
      const printCount = (await storage.markRefundPrinted(req.params.id))!;
      await audit(req, "print", "refund", r.id, `Qaytarish №${r.number} (${sum(r.amount)}) cheki ${printCount > 1 ? `qayta chop etildi — nusxa (${printCount}-marta)` : "chop etildi"}`);
      res.json({ printCount });
    }),
  );
}
