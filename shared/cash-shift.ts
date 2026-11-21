/**
 * Kassa smenasi (B7.5, TZ §9.2 "Kassa smenasini yopish").
 *
 * A shift is one person's till from opening to closing. Every money movement
 * that person records while it is open (a bill receipt, a payment or refund on
 * a lab order, the opening payment of a new order) carries the shift's id, so
 * the shift is the answer to "how much cash should be in this drawer?":
 *
 *   expected cash = cash in the drawer at opening + cash taken − cash refunded
 *
 * Terminal and bank payments are reported beside it (they are reconciled with
 * the terminal's own report and the bank statement) but never counted in the
 * drawer. At closing the cashier counts the drawer; the difference against the
 * expected figure is written down with a reason, and the report is frozen.
 *
 * A payment that belongs to a closed shift is never voided: the shift's report
 * was signed off with it. A correction after that is a refund, which lands in
 * the shift that hands the money back.
 */
import type { PaymentMethod } from "./schema";
import { PAYMENT_METHODS } from "./schema";

export const SHIFT_REQUIRED = "Pul bilan ishlash uchun kassa smenasini oching (Kassa → Smenani ochish)";
export const SHIFT_ALREADY_OPEN = "Sizda ochiq smena bor — yangisini ochishdan oldin uni yoping";
export const SHIFT_CLOSED = "Smena yopilgan — to'lovni qabul qilish uchun yangi smena oching";
export const SHIFT_ALREADY_CLOSED = "Bu smena allaqachon yopilgan";
export const SHIFT_MOVED = "Smena davomida yangi to'lov qayd etildi — hisobot yangilandi, kassani qayta sanang";
export const paymentInClosedShift = (n: number) =>
  `Bu to'lov yopilgan Smena №${n} hisobotiga kirgan — uni bekor qilib bo'lmaydi. Xatoni pulni qaytarish orqali tuzating`;

/** A shift open this long is flagged: someone forgot to close it. */
export const LONG_SHIFT_HOURS = 14;

/**
 * Uzbek so'm notes and coins in circulation, largest first — the counting aid
 * at closing. The count itself is what is saved; the breakdown is kept beside
 * it for the record.
 */
export const UZS_DENOMINATIONS = [200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100] as const;
export type Denominations = Partial<Record<string, number>>;

export function sumDenominations(d: Denominations | null | undefined): number {
  if (!d) return 0;
  let total = 0;
  for (const value of UZS_DENOMINATIONS) total += value * Math.max(0, Math.trunc(d[String(value)] ?? 0));
  return total;
}

/** Only the notes that were counted, so the saved breakdown stays short. */
export function cleanDenominations(d: Denominations | null | undefined): Record<string, number> | null {
  if (!d) return null;
  const out: Record<string, number> = {};
  for (const value of UZS_DENOMINATIONS) {
    const n = Math.max(0, Math.trunc(d[String(value)] ?? 0));
    if (n) out[String(value)] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** One payments row recorded in a shift, with what it paid. */
export type ShiftPaymentRow = {
  id: string;
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  /** The bill receipt this row is a share of, if any. */
  receiptId: string | null;
  /** B7.4: the refund this (negative) row pays out, if any. */
  refundId: string | null;
  refundNumber: number | null;
  receiptNumber: number | null;
  invoiceNumber: number | null;
  orderNumber: number | null;
  patientName: string | null;
  patientNumber: number | null;
};

export type ShiftEntryKind = "receipt" | "payment" | "refund";
export const SHIFT_ENTRY_LABELS: Record<ShiftEntryKind, string> = {
  receipt: "Kvitansiya",
  payment: "Buyurtma to'lovi",
  refund: "Qaytarish",
};

/** What the cashier did, as they did it: a receipt is one entry however many services it paid. */
export type ShiftEntry = {
  key: string;
  kind: ShiftEntryKind;
  /** "Kvitansiya №12 · Hisobvaraq №8" / "Buyurtma #1042" */
  title: string;
  patientName: string | null;
  patientNumber: number | null;
  /** Signed: a refund is negative. */
  amount: number;
  method: PaymentMethod;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export function shiftEntries(rows: ShiftPaymentRow[]): ShiftEntry[] {
  const byKey = new Map<string, ShiftEntry>();
  for (const r of rows) {
    const key = r.receiptId ?? r.refundId ?? r.id;
    const seen = byKey.get(key);
    if (seen) {
      seen.amount += r.amount;
      continue;
    }
    const kind: ShiftEntryKind = r.receiptId ? "receipt" : r.amount < 0 ? "refund" : "payment";
    byKey.set(key, {
      key,
      kind,
      title: r.receiptId
        ? `Kvitansiya №${r.receiptNumber ?? "—"}${r.invoiceNumber ? ` · Hisobvaraq №${r.invoiceNumber}` : ""}`
        : r.refundId
          ? `Qaytarish №${r.refundNumber ?? "—"}`
          : `Buyurtma #${r.orderNumber ?? "—"}`,
      patientName: r.patientName,
      patientNumber: r.patientNumber,
      amount: r.amount,
      method: r.method,
      createdAt: r.createdAt,
      voidedAt: r.voidedAt,
      voidReason: r.voidReason,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export type MethodTotals = { taken: number; refunded: number; net: number };

/** The shift report's figures — frozen onto the shift when it closes. */
export type ShiftTotals = {
  byMethod: Record<PaymentMethod, MethodTotals>;
  taken: number;
  refunded: number;
  net: number;
  /** Payments and receipts (not shares), not voided. */
  payments: number;
  refunds: number;
  voided: { count: number; amount: number };
  openingCash: number;
  /** In the drawer by now: opening cash + net cash. */
  expectedCash: number;
};

export function summarizeShift(rows: ShiftPaymentRow[], openingCash: number): ShiftTotals {
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { taken: 0, refunded: 0, net: 0 }])) as Record<PaymentMethod, MethodTotals>;
  let payments = 0;
  let refunds = 0;
  let voidedCount = 0;
  let voidedAmount = 0;
  for (const e of shiftEntries(rows)) {
    if (e.voidedAt) {
      voidedCount++;
      voidedAmount += e.amount;
      continue;
    }
    const m = byMethod[e.method] ?? byMethod.naqd;
    if (e.amount >= 0) {
      m.taken += e.amount;
      payments++;
    } else {
      m.refunded += -e.amount;
      refunds++;
    }
    m.net = m.taken - m.refunded;
  }
  const taken = PAYMENT_METHODS.reduce((s, m) => s + byMethod[m].taken, 0);
  const refunded = PAYMENT_METHODS.reduce((s, m) => s + byMethod[m].refunded, 0);
  return {
    byMethod,
    taken,
    refunded,
    net: taken - refunded,
    payments,
    refunds,
    voided: { count: voidedCount, amount: voidedAmount },
    openingCash,
    expectedCash: openingCash + byMethod.naqd.net,
  };
}

export type CountOutcome = "match" | "short" | "over";
export const COUNT_OUTCOME_LABELS: Record<CountOutcome, string> = { match: "Mos", short: "Kamomad", over: "Ortiqcha" };
export const countOutcome = (difference: number): CountOutcome => (difference === 0 ? "match" : difference < 0 ? "short" : "over");

/**
 * Why a closing cannot be saved, or null. A drawer that does not match is
 * closed all the same — the shortage or surplus is the record — but never
 * without a word on why.
 */
export function closeProblem(input: { countedCash: number; carriedCash: number; note?: string | null }, expectedCash: number): string | null {
  if (!Number.isInteger(input.countedCash) || input.countedCash < 0) return "Kassadagi naqd pulni kiriting";
  if (!Number.isInteger(input.carriedCash) || input.carriedCash < 0) return "Qoldiriladigan summa manfiy bo'lishi mumkin emas";
  if (input.carriedCash > input.countedCash) return "Kassada sanalganidan ko'p pul qoldirib bo'lmaydi";
  if (input.countedCash !== expectedCash && !input.note?.trim()) {
    return `${COUNT_OUTCOME_LABELS[countOutcome(input.countedCash - expectedCash)]} bor — sababini yozing`;
  }
  return null;
}

/** Hours a shift has been (or was) open. */
export function shiftHours(openedAt: string, closedAt: string | null, now = new Date()): number {
  const end = closedAt ? new Date(closedAt) : now;
  return Math.max(0, (end.getTime() - new Date(openedAt).getTime()) / 3_600_000);
}

/** "3 soat 20 daqiqa" */
export function describeDuration(hours: number): string {
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} daqiqa`;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
}
