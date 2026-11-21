/**
 * Kassa: bemor hisobvarag'i (B7.1, TZ §9.1, §9.2, §11).
 *
 *   payments.create | finance.view   read bills, the debtors list and debt per patient (B7.3)
 *   payments.create                  open a bill (its number), take a payment on it (in an open cash shift, B7.5)
 *   payments.delete                  void a receipt, whole, with a reason
 *   payments.discount                a discount on the unpaid part of a bill, with a reason (B7.2)
 *   payments.create | finance.view   read a receipt's chek (B7.6); printing it is payments.create
 *
 * A refund is not taken here: it stays with payments.refund (B7.4).
 * Rules: shared/invoice.ts.
 */
import type { Express } from "express";
import { discountBillSchema, payBillSchema, voidPaymentSchema, PAYMENT_METHOD_LABELS, type ReceiptSlipView } from "@shared/schema";
import { describeDiscount } from "@shared/discount";
import { BILL_FILTERS, describeShares, type BillFilter } from "@shared/invoice";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";
import { todayKey } from "./storage-types";
import { summarizeDebt } from "@shared/debt";
import { tillActor } from "./routes-cashdesk";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function registerBillingRoutes(app: Express) {
  /** The cash desk's list: bills of a period (visit days), or every bill still owing. */
  app.get(
    "/api/bills",
    requirePermission("payments.create", "finance.view"),
    handle(async (req, res) => {
      const from = stringParam(req.query.from);
      const to = stringParam(req.query.to);
      if ((from && !DAY.test(from)) || (to && !DAY.test(to))) return res.status(400).json({ message: "Sanani YYYY-MM-DD ko'rinishida kiriting" });
      if (from && to && from > to) return res.status(400).json({ message: "Davr boshi oxiridan keyin bo'lishi mumkin emas" });
      const status = stringParam(req.query.status) as BillFilter | undefined;
      if (status && !BILL_FILTERS.includes(status)) return res.status(400).json({ message: "Noma'lum filtr" });
      res.json(await storage.listBills({ from, to, status, patientId: stringParam(req.query.patientId) }).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  /** B7.3 Qarzdorlik: patients owing across all visits, largest first, with the age of the debt. */
  app.get(
    "/api/debtors",
    requirePermission("payments.create", "finance.view"),
    handle(async (_req, res) => {
      const today = todayKey();
      const rows = await storage.listDebtors().catch((e) => emptyIfMissing(e, []));
      res.json({ today, rows, summary: summarizeDebt(rows, today) });
    }),
  );

  app.get(
    "/api/bills/:visitId",
    requirePermission("payments.create", "finance.view"),
    handle(async (req, res) => {
      const bill = await storage.getBill(req.params.visitId);
      if (!bill) return res.status(404).json({ message: "Tashrif topilmadi" });
      res.json(bill);
    }),
  );

  /** Gives the bill its number before it is printed (idempotent). */
  app.post(
    "/api/bills/:visitId/open",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const before = await storage.getBill(req.params.visitId);
      if (!before) return res.status(404).json({ message: "Tashrif topilmadi" });
      const bill = (await storage.openInvoice(req.params.visitId, actorOf(req)))!;
      if (!before.invoice && bill.invoice) {
        await audit(req, "create", "invoice", bill.invoice.id, `Hisobvaraq №${bill.invoice.number} ochildi: №${bill.patient.patientNumber} ${bill.patient.fullName}, ${bill.visitDate}`);
      }
      res.json(bill);
    }),
  );

  /** One payment for several services (TZ §9.2): split across the lines that owe, oldest first. */
  app.post(
    "/api/bills/:visitId/payments",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const input = payBillSchema.parse(req.body);
      const before = await storage.getBill(req.params.visitId);
      if (!before) return res.status(404).json({ message: "Tashrif topilmadi" });
      // The receipt lands in the cashier's open shift (B7.5).
      const till = await tillActor(req, res);
      if (!till) return;
      // Nothing owed is refused inside the storage too, on locked rows (409).
      const out = (await storage.payBill(req.params.visitId, input, till))!;
      const receipt = out.bill.receipts.find((r) => r.id === out.receiptId)!;
      await audit(
        req,
        "payment",
        "invoice",
        out.bill.invoice!.id,
        `Hisobvaraq №${out.bill.invoice!.number}, kvitansiya №${receipt.number}: ${sum(out.taken)} (${PAYMENT_METHOD_LABELS[input.method]}) — ${describeShares(receipt.shares, out.bill.lines)}` +
          `${input.amount > out.taken ? `; qarzdan ortig'i ${sum(input.amount - out.taken)} qaytim` : ""}${out.bill.totals.due ? `; qoldi ${sum(out.bill.totals.due)}` : "; to'liq to'landi"}`,
      );
      res.status(201).json({ bill: out.bill, receiptId: out.receiptId, taken: out.taken, change: input.amount - out.taken });
    }),
  );

  /** B7.6: the chek of a receipt — what it paid, for whom, by whom, and the clinic that issued it. */
  app.get(
    "/api/receipts/:id/slip",
    requirePermission("payments.create", "finance.view"),
    handle(async (req, res) => {
      const [slip, clinic, logo] = await Promise.all([storage.getReceiptSlip(req.params.id), storage.getSettings(), storage.getLogo()]);
      if (!slip) return res.status(404).json({ message: "Kvitansiya topilmadi" });
      res.json({ ...slip, clinic, logo: logo?.dataUrl ?? null } satisfies ReceiptSlipView);
    }),
  );

  /** Counts a print before it happens: every print after the first comes out marked "NUSXA". */
  app.post(
    "/api/receipts/:id/print",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const slip = await storage.getReceiptSlip(req.params.id);
      if (!slip) return res.status(404).json({ message: "Kvitansiya topilmadi" });
      const printCount = (await storage.markReceiptPrinted(req.params.id))!;
      const r = slip.receipt;
      await audit(
        req,
        "print",
        "invoice",
        r.invoiceId,
        `Hisobvaraq №${slip.invoiceNumber}, kvitansiya №${r.number} (${sum(r.amount)}) cheki ${printCount > 1 ? `qayta chop etildi — nusxa (${printCount}-marta)` : "chop etildi"}${r.voidedAt ? ", bekor qilingan kvitansiya" : ""}`,
      );
      res.json({ printCount });
    }),
  );

  /** B7.2: a discount on the whole bill or one service, percent or sum, only on what is unpaid. */
  app.post(
    "/api/bills/:visitId/discounts",
    requirePermission("payments.discount"),
    handle(async (req, res) => {
      const input = discountBillSchema.parse(req.body);
      const before = await storage.getBill(req.params.visitId);
      if (!before) return res.status(404).json({ message: "Tashrif topilmadi" });
      const out = (await storage.discountBill(req.params.visitId, input, actorOf(req)))!;
      const d = out.discount;
      await audit(
        req,
        "discount",
        "invoice",
        out.bill.invoice?.id ?? req.params.visitId,
        `№${out.bill.patient.patientNumber} ${out.bill.patient.fullName}, ${out.bill.visitDate}: chegirma ${describeDiscount(d.mode, d.value, d.total)} — ` +
          `${d.lines.map((l) => `${l.title} ${sum(l.amount)}`).join(" + ")}; qarz ${sum(before.totals.due)} → ${sum(out.bill.totals.due)}. Sabab: ${d.reason}`,
      );
      res.status(201).json(out);
    }),
  );

  /** A receipt taken by mistake is voided whole, with a reason; it stays on the bill struck out. */
  app.post(
    "/api/receipts/:id/void",
    requirePermission("payments.delete"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const bill = await storage.voidReceipt(req.params.id, reason, actorOf(req));
      if (!bill) return res.status(404).json({ message: "Kvitansiya topilmadi" });
      const r = bill.receipts.find((x) => x.id === req.params.id)!;
      await audit(req, "void", "invoice", bill.invoice!.id, `Hisobvaraq №${bill.invoice!.number}, kvitansiya №${r.number} (${sum(r.amount)}) bekor qilindi: ${reason}`);
      res.json(bill);
    }),
  );
}
