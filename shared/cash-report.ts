/**
 * Kassa bosh sahifasi va kunlik tushum (B7.7, TZ §9.1 "Kassa bosh sahifasi",
 * "Kunlik tushum").
 *
 * Every figure comes from the money ledger (`payments`, voided rows left out)
 * on the day the money moved: a receipt's shares, a payment taken on an order,
 * a refund handed out (negative). So the desk's takings always agree with the
 * cash shifts (B7.5), the refunds (B7.4) and the lab's own order ledger.
 * Storages only total per day and method; shaping lives here, shared.
 */
import type { PaymentMethod } from "./schema";
import { PAYMENT_METHODS } from "./schema";

/** One day × method, as the storages total it. */
export type CashDayRow = { date: string; method: PaymentMethod; taken: number; refunded: number; payments: number; refunds: number };

export type MethodFigures = { taken: number; refunded: number; net: number };
export type CashDay = {
  date: string;
  byMethod: Record<PaymentMethod, MethodFigures>;
  taken: number;
  refunded: number;
  /** Takings less refunds. */
  net: number;
  /** Receipts and order payments (a receipt counts once, however many services it paid). */
  payments: number;
  refunds: number;
};

const blankMethods = (): Record<PaymentMethod, MethodFigures> =>
  Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { taken: 0, refunded: 0, net: 0 }])) as Record<PaymentMethod, MethodFigures>;

export const blankDay = (date: string): CashDay => ({ date, byMethod: blankMethods(), taken: 0, refunded: 0, net: 0, payments: 0, refunds: 0 });

/** Every day from `from` to `to` (YYYY-MM-DD, inclusive), quiet days at zero. */
export function cashDays(rows: CashDayRow[], from: string, to: string): CashDay[] {
  const byDate = new Map<string, CashDay>();
  for (const r of rows) {
    const d = byDate.get(r.date) ?? blankDay(r.date);
    const m = d.byMethod[r.method] ?? d.byMethod.naqd;
    m.taken += r.taken;
    m.refunded += r.refunded;
    m.net = m.taken - m.refunded;
    d.taken += r.taken;
    d.refunded += r.refunded;
    d.net = d.taken - d.refunded;
    d.payments += r.payments;
    d.refunds += r.refunds;
    byDate.set(r.date, d);
  }
  const out: CashDay[] = [];
  const cur = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (let i = 0; cur <= end && i < 400; i++) {
    const key = cur.toISOString().slice(0, 10);
    out.push(byDate.get(key) ?? blankDay(key));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** The period's total, shaped like a day. */
export function cashTotal(days: CashDay[], label = "jami"): CashDay {
  const t = blankDay(label);
  for (const d of days) {
    for (const m of PAYMENT_METHODS) {
      t.byMethod[m].taken += d.byMethod[m].taken;
      t.byMethod[m].refunded += d.byMethod[m].refunded;
      t.byMethod[m].net += d.byMethod[m].net;
    }
    t.taken += d.taken;
    t.refunded += d.refunded;
    t.net += d.net;
    t.payments += d.payments;
    t.refunds += d.refunds;
  }
  return t;
}

/** Share of the period's net takings by method, for the "how was it paid" meter. */
export function methodShares(t: CashDay): { method: PaymentMethod; net: number; share: number }[] {
  const pos = PAYMENT_METHODS.reduce((s, m) => s + Math.max(0, t.byMethod[m].net), 0);
  return PAYMENT_METHODS.map((m) => ({ method: m, net: t.byMethod[m].net, share: pos ? Math.max(0, t.byMethod[m].net) / pos : 0 }));
}

/** Change against a comparison figure, rounded to whole percent; null when there is nothing to compare with. */
export function changePercent(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}

/** The desk's home page (B7.7). */
export type CashOverview = {
  today: CashDay;
  /** The same weekday a week earlier, for the trend under today's takings. */
  weekAgo: CashDay;
  month: CashDay & { from: string };
  /** The last 30 days, oldest first. */
  days: CashDay[];
  /** Today's bills: how much was billed and what is still owed, with the largest debts. */
  bills: { count: number; amount: number; paid: number; due: number; debtors: { visitId: string; patientName: string; patientNumber: number; due: number }[] };
  refunds: { requested: { count: number; amount: number }; approved: { count: number; amount: number } };
  /** Shifts still open: everyone's for those who read all shifts, else one's own. */
  openShifts: { id: string; number: number; cashierName: string; openedAt: string; hours: number; expectedCash: number; net: number }[];
};
