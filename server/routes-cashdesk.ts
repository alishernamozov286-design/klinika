/**
 * Kassa smenasi (B7.5, TZ §9.2 "Kassa smenasini yopish").
 *
 *   payments.create                     open, read and close one's own shift
 *   shifts.read                         every cashier's shifts and reports
 *   shifts.manage                       close a shift someone left open
 *   payments.create | finance.view      the desk's home page and daily takings (B7.7)
 *
 * Every route that moves money asks `tillActor` first: no open shift, no
 * money. Rules: shared/cash-shift.ts.
 */
import type { Express, Request, Response } from "express";
import { closeShiftSchema, openShiftSchema, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type ShiftReport } from "@shared/schema";
import { COUNT_OUTCOME_LABELS, SHIFT_REQUIRED, closeProblem, countOutcome } from "@shared/cash-shift";
import { hasPermission, requirePermission } from "./rbac";
import { actorOf, audit, dayRange, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";
import { todayKey, type Actor } from "./storage-types";
import { cashDays, cashTotal, type CashOverview } from "@shared/cash-report";

const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

/**
 * The acting user with their open shift, for a write that moves money — or
 * null, having answered 409 SHIFT_REQUIRED. The storage locks the shift again
 * inside the write, so a shift closed in between is still refused.
 */
export async function tillActor(req: Request, res: Response): Promise<Actor | null> {
  const shift = req.user ? await storage.getOpenShift(req.user.id).catch((e) => emptyIfMissing(e, undefined)) : undefined;
  if (!shift) {
    res.status(409).json({ message: SHIFT_REQUIRED, code: "SHIFT_REQUIRED" });
    return null;
  }
  return { ...actorOf(req), shiftId: shift.id };
}

// Since B7.4 payments.refund only approves; money moves through payments.create alone.
const handlesMoney = (req: Request) => hasPermission(req, "payments.create");

/** Own shifts for whoever handles money; everyone's with shifts.read. */
function mayRead(req: Request, shift: { cashierId: string }) {
  return hasPermission(req, "shifts.read") || (shift.cashierId === req.user?.id && handlesMoney(req));
}

function describeClose(r: ShiftReport): string {
  const t = r.totals;
  const diff = r.difference ?? 0;
  const methods = PAYMENT_METHODS.filter((m) => t.byMethod[m].taken || t.byMethod[m].refunded)
    .map((m) => `${PAYMENT_METHOD_LABELS[m]} ${sum(t.byMethod[m].net)}`)
    .join(", ");
  return (
    `Smena №${r.number} (${r.cashierName}) yopildi: kutilgan ${sum(r.expectedCash ?? 0)}, sanalgan ${sum(r.countedCash ?? 0)}` +
    (diff ? `, ${COUNT_OUTCOME_LABELS[countOutcome(diff)].toLowerCase()} ${sum(Math.abs(diff))}` : ", mos") +
    `; topshirildi ${sum((r.countedCash ?? 0) - (r.carriedCash ?? 0))}, kassada qoldi ${sum(r.carriedCash ?? 0)}` +
    `; ${t.payments} ta to'lov${t.refunds ? `, ${t.refunds} ta qaytarish` : ""}${methods ? ` (${methods})` : ""}` +
    (r.closingNote ? `. Izoh: ${r.closingNote}` : "")
  );
}

/** YYYY-MM-DD moved by whole days (calendar arithmetic, no clock involved). */
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function registerCashDeskRoutes(app: Express) {
  /** B7.7 Kassa bosh sahifasi: today, the month, 30 days, today's debts, refunds waiting, open shifts — one round. */
  app.get(
    "/api/cashier/overview",
    requirePermission("payments.create", "payments.refund", "finance.view", "shifts.read"),
    handle(async (req, res) => {
      const today = todayKey();
      const monthStart = `${today.slice(0, 8)}01`;
      const first = [addDays(today, -29), monthStart].sort()[0];
      const range = dayRange(first, today) as { from: string; to: string };
      const seesShifts = hasPermission(req, "shifts.read") || handlesMoney(req);
      const [rows, bills, requested, approved, shifts] = await Promise.all([
        storage.cashDayTotals(range),
        storage.listBills({ from: today, to: today }).catch((e) => emptyIfMissing(e, [])),
        storage.listRefunds({ status: "requested" }).catch((e) => emptyIfMissing(e, [])),
        storage.listRefunds({ status: "approved" }).catch((e) => emptyIfMissing(e, [])),
        seesShifts
          ? storage.listShifts({ open: true, cashierId: hasPermission(req, "shifts.read") ? undefined : req.user!.id }).catch((e) => emptyIfMissing(e, []))
          : Promise.resolve([]),
      ]);
      const all = cashDays(rows, first, today);
      const byDate = new Map(all.map((d) => [d.date, d]));
      const sumOf = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
      const overview: CashOverview = {
        today: byDate.get(today)!,
        weekAgo: byDate.get(addDays(today, -7)) ?? cashDays([], addDays(today, -7), addDays(today, -7))[0],
        month: { ...cashTotal(all.filter((d) => d.date >= monthStart)), from: monthStart },
        days: all.filter((d) => d.date >= addDays(today, -29)),
        bills: {
          count: bills.length,
          amount: bills.reduce((s, b) => s + b.totals.amount, 0),
          paid: bills.reduce((s, b) => s + b.totals.paid, 0),
          due: bills.reduce((s, b) => s + b.totals.due, 0),
          debtors: bills
            .filter((b) => b.totals.due > 0)
            .sort((a, b) => b.totals.due - a.totals.due)
            .slice(0, 6)
            .map((b) => ({ visitId: b.visitId, patientName: b.patientName, patientNumber: b.patientNumber, due: b.totals.due })),
        },
        refunds: { requested: { count: requested.length, amount: sumOf(requested) }, approved: { count: approved.length, amount: sumOf(approved) } },
        openShifts: shifts.map((x) => ({ id: x.id, number: x.number, cashierName: x.cashierName, openedAt: x.openedAt, hours: x.hours, expectedCash: x.totals.expectedCash, net: x.totals.net })),
      };
      res.json(overview);
    }),
  );

  /** B7.7 Kunlik tushum: every day of a period (YYYY-MM-DD, inclusive), with the period's total. */
  app.get(
    "/api/cashier/daily",
    requirePermission("payments.create", "payments.refund", "finance.view", "shifts.read"),
    handle(async (req, res) => {
      const today = todayKey();
      const from = stringParam(req.query.from) ?? `${today.slice(0, 8)}01`;
      const to = stringParam(req.query.to) ?? today;
      const range = dayRange(from, to);
      if ("error" in range) return res.status(400).json({ message: range.error });
      if (addDays(from, 366) < to) return res.status(400).json({ message: "Davr ko'pi bilan bir yil bo'lishi mumkin" });
      const days = cashDays(await storage.cashDayTotals(range), from, to);
      res.json({ from, to, days, total: cashTotal(days) });
    }),
  );

  /** The person at the desk: their open shift with its live report, and what the last one left. */
  app.get(
    "/api/cash-shifts/current",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      res.json(await storage.getCashDesk(req.user!.id).catch((e) => emptyIfMissing(e, { shift: null, last: null })));
    }),
  );

  app.post(
    "/api/cash-shifts",
    requirePermission("payments.create"),
    handle(async (req, res) => {
      const input = openShiftSchema.parse(req.body);
      const desk = await storage.getCashDesk(req.user!.id);
      const shift = await storage.openShift(input, actorOf(req));
      const left = desk.last?.carriedCash ?? null;
      await audit(
        req,
        "create",
        "cash_shift",
        shift.id,
        `Smena №${shift.number} ochildi: kassada ${sum(shift.openingCash)}` +
          (left !== null && left !== shift.openingCash ? ` (oldingi Smena №${desk.last!.number} ${sum(left)} qoldirgan edi)` : "") +
          (shift.openingNote ? `. Izoh: ${shift.openingNote}` : ""),
      );
      res.status(201).json(shift);
    }),
  );

  /** Shifts opened in a period (open ones always), or only those still open. */
  app.get(
    "/api/cash-shifts",
    requirePermission("payments.create", "shifts.read"),
    handle(async (req, res) => {
      const from = stringParam(req.query.from);
      const to = stringParam(req.query.to);
      let range: { from?: string; to?: string } = {};
      if (from || to) {
        const r = dayRange(from ?? "2000-01-01", to ?? "2999-12-31");
        if ("error" in r) return res.status(400).json({ message: r.error });
        range = r;
      }
      const all = hasPermission(req, "shifts.read");
      const cashierId = all ? stringParam(req.query.cashierId) : req.user!.id;
      const rows = await storage.listShifts({ ...range, cashierId, open: req.query.status === "open" }).catch((e) => emptyIfMissing(e, []));
      res.json(rows);
    }),
  );

  app.get(
    "/api/cash-shifts/:id",
    requirePermission("payments.create", "shifts.read"),
    handle(async (req, res) => {
      const shift = await storage.getShift(req.params.id);
      if (!shift || !mayRead(req, shift)) return res.status(404).json({ message: "Smena topilmadi" });
      res.json(shift);
    }),
  );

  /** Counts the drawer and freezes the report. Someone else's shift needs shifts.manage. */
  app.post(
    "/api/cash-shifts/:id/close",
    requirePermission("payments.create", "shifts.manage"),
    handle(async (req, res) => {
      const input = closeShiftSchema.parse(req.body);
      const before = await storage.getShift(req.params.id);
      if (!before || !mayRead(req, before)) return res.status(404).json({ message: "Smena topilmadi" });
      const own = before.cashierId === req.user!.id;
      if (own ? !handlesMoney(req) : !hasPermission(req, "shifts.manage")) {
        return res.status(403).json({ message: "Boshqa kassirning smenasini yopish uchun ruxsatingiz yo'q" });
      }
      if (!before.closedAt) {
        // Checked here for a clean 400; the storage checks again on the locked shift.
        const problem = closeProblem(input, input.expectedCash);
        if (problem) return res.status(400).json({ message: problem });
      }
      const shift = (await storage.closeShift(req.params.id, input, actorOf(req)))!;
      await audit(req, "close", "cash_shift", shift.id, describeClose(shift) + (own ? "" : ` — ${actorOf(req).name} yopdi`));
      res.json(shift);
    }),
  );
}
