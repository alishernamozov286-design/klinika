/**
 * Moliyaviy hisobot (B7.8, TZ §9.1 "Moliyaviy hisobotlar", §13 "xizmatlar
 * daromadi", "shifokorlar faoliyati", "qarzdorlik", "xarajatlar").
 *
 * Two views of the same period, never mixed:
 *  - accrual — the services rendered in the period (attended appointments by
 *    their day, live lab orders by theirs): count, price before discount, the
 *    discount, what was billed, and how much of it has been paid so far;
 *  - cash — the money that moved in the period (the payments ledger, B7.7):
 *    taken by method, refunded, net.
 * Profit is cash net less expenses: unpaid bills are not money in hand. The
 * two differ by what is still owed and by money taken for other periods.
 */
import type { PriceListKind } from "./schema";
import { SERVICE_KIND_LABELS } from "./schema";

/** A line of the report: a price-list kind, or B6.6 inpatient stays. */
export type FinanceKind = PriceListKind | "statsionar";
export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = { ...SERVICE_KIND_LABELS, statsionar: "Statsionar" };
import type { CashDay } from "./cash-report";

/** One group of services rendered, as the storages total it. */
export type FinanceServiceRow = {
  kind: FinanceKind;
  /** "Terapevt ko'rigi", "Qorin bo'shlig'i UZI", "Laboratoriya tahlillari". */
  name: string;
  doctorName: string | null;
  count: number;
  /** Before discount. */
  gross: number;
  discount: number;
  /** Billed: gross − discount. */
  net: number;
  /** Paid so far on these services (refunds taken off). */
  paid: number;
};

export type FinanceFigures = { count: number; gross: number; discount: number; net: number; paid: number; due: number };
const blank = (): FinanceFigures => ({ count: 0, gross: 0, discount: 0, net: 0, paid: 0, due: 0 });
function add(t: FinanceFigures, r: FinanceServiceRow) {
  t.count += r.count;
  t.gross += r.gross;
  t.discount += r.discount;
  t.net += r.net;
  t.paid += r.paid;
  t.due += Math.max(0, r.net - r.paid);
}

/** The order the report shows service kinds in. */
export const FINANCE_KINDS: readonly FinanceKind[] = ["konsultatsiya", "uzi", "muolaja", "boshqa", "laboratoriya", "statsionar"];

export type FinanceReport = {
  range: { from: string; to: string };
  services: {
    total: FinanceFigures;
    byKind: ({ kind: FinanceKind; label: string } & FinanceFigures)[];
    /** Biggest earners first. */
    byService: ({ kind: FinanceKind; name: string } & FinanceFigures)[];
    /** Appointments only — lab work is not a doctor's. Biggest first. */
    byDoctor: ({ doctorName: string } & FinanceFigures)[];
  };
  cash: CashDay;
  /** Every day of the period, for the in/out chart. */
  days: CashDay[];
  discounts: { total: number; given: number };
  expenses: { total: number; count: number; byCategory: { category: string; amount: number; count: number }[] };
  result: { collected: number; expenses: number; profit: number; margin: number | null };
  /** As of now (not the period's end): what patients owe across all visits. */
  debt: { due: number; debtors: number };
};

export function buildFinanceReport(input: {
  range: { from: string; to: string };
  services: FinanceServiceRow[];
  cash: CashDay;
  days: CashDay[];
  discountsGiven: number;
  expenses: FinanceReport["expenses"];
  debt: FinanceReport["debt"];
}): FinanceReport {
  const total = blank();
  const kinds = new Map<FinanceKind, FinanceFigures>();
  const services = new Map<string, { kind: FinanceKind; name: string } & FinanceFigures>();
  const doctors = new Map<string, { doctorName: string } & FinanceFigures>();
  for (const r of input.services) {
    add(total, r);
    const k = kinds.get(r.kind) ?? blank();
    add(k, r);
    kinds.set(r.kind, k);
    const sKey = `${r.kind}|${r.name}`;
    const s = services.get(sKey) ?? { kind: r.kind, name: r.name, ...blank() };
    add(s, r);
    services.set(sKey, s);
    if (r.kind !== "laboratoriya" && r.doctorName) {
      const d = doctors.get(r.doctorName) ?? { doctorName: r.doctorName, ...blank() };
      add(d, r);
      doctors.set(r.doctorName, d);
    }
  }
  const collected = input.cash.net;
  const profit = collected - input.expenses.total;
  return {
    range: input.range,
    services: {
      total,
      byKind: FINANCE_KINDS.filter((k) => kinds.has(k)).map((k) => ({ kind: k, label: FINANCE_KIND_LABELS[k], ...kinds.get(k)! })),
      byService: [...services.values()].sort((a, b) => b.net - a.net || b.count - a.count || a.name.localeCompare(b.name)),
      byDoctor: [...doctors.values()].sort((a, b) => b.net - a.net || b.count - a.count),
    },
    cash: input.cash,
    days: input.days,
    discounts: { total: total.discount, given: input.discountsGiven },
    expenses: input.expenses,
    result: { collected, expenses: input.expenses.total, profit, margin: collected > 0 ? Math.round((profit / collected) * 100) : null },
    debt: input.debt,
  };
}
