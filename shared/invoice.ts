/**
 * Bemor hisobvarag'i (B7.1, TZ §9.1, §9.2, §11 "Barcha modullar → Kassa").
 *
 * A bill is one patient visit (patient + day, B2.5): everything the clinic did
 * for them that day — lab orders and appointments (consultation, UZI,
 * procedure) — on one sheet, paid with one payment ("bir nechta xizmat uchun
 * umumiy to'lov"). Its lines are read live from those records, never copied,
 * so a changed price or a cancelled order can never leave the bill stale.
 *
 * A payment taken on the bill is a receipt (`invoice_payments`) split across
 * the lines that still owe, oldest first; each share is an ordinary
 * `payments` row on its order or appointment, so the lab's own payment
 * logic, the order window and the reports keep working as they are.
 * A receipt is voided whole, with a reason — never edited, never deleted.
 *
 * B6.6: an inpatient stay is a third source ("stay") — one line on the bill of
 * its admission day, its amount read from shared/stay-bill.ts.
 */
import { stayLineText, type StayCharge } from "./stay-bill";

export const BILL_SOURCES = ["appointment", "order", "stay"] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

/** Which line a `payments` row pays — the one of its three targets that is set. */
export function paymentSource(p: { orderId: string | null; appointmentId: string | null; admissionId?: string | null }): { source: BillSource; sourceId: string } {
  if (p.orderId) return { source: "order", sourceId: p.orderId };
  if (p.appointmentId) return { source: "appointment", sourceId: p.appointmentId };
  return { source: "stay", sourceId: p.admissionId! };
}

/** The `payments` columns for a share of a line (exactly one is set — CK_payments_target). */
export function paymentTarget(source: BillSource, sourceId: string): { orderId: string | null; appointmentId: string | null; admissionId: string | null } {
  return {
    orderId: source === "order" ? sourceId : null,
    appointmentId: source === "appointment" ? sourceId : null,
    admissionId: source === "stay" ? sourceId : null,
  };
}

/** Appointment statuses that are a service rendered (or under way) — billable. */
export const BILLABLE_APPOINTMENT_STATUSES = ["arrived", "in_progress", "completed"] as const;

export type BillStatus = "empty" | "unpaid" | "partial" | "paid" | "overpaid";
export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  empty: "Xizmat yo'q",
  unpaid: "To'lanmagan",
  partial: "Qisman to'langan",
  paid: "To'langan",
  overpaid: "Ortiqcha to'langan",
};

export const BILL_PAID = "Hisobvaraq to'liq to'langan — qabul qilinadigan qarz yo'q";
export const RECEIPT_ALREADY_VOIDED = "Bu kvitansiya allaqachon bekor qilingan";
export const PAYMENT_IS_RECEIPT_SHARE =
  "Bu to'lov hisobvaraq orqali qabul qilingan kvitansiyaning bir qismi — kvitansiyani butunligicha bekor qiling (Kassa → hisobvaraq)";

/** The cash desk's filters: every bill, those still owing (qarzdorlik), those settled. */
export const BILL_FILTERS = ["all", "due", "settled"] as const;
export type BillFilter = (typeof BILL_FILTERS)[number];
export function filterBills<T extends { totals: { due: number; status: BillStatus } }>(rows: T[], filter: BillFilter | undefined): T[] {
  if (filter === "due") return rows.filter((r) => r.totals.due > 0);
  if (filter === "settled") return rows.filter((r) => r.totals.due === 0 && (r.totals.status === "paid" || r.totals.status === "overpaid"));
  return rows;
}

/** One line of a bill: what it is, what it costs, what has been paid on it. */
export type BillLine = {
  source: BillSource;
  sourceId: string;
  /** "Terapevt ko'rigi · Rahimova D." / "Laboratoriya #1042" */
  title: string;
  /** "10:00 · 2 ta tahlil" etc. */
  detail: string;
  createdAt: string;
  /** What is owed for it, so'm (0 for something cancelled that still holds money). Already net of its discount. */
  amount: number;
  /** B7.2: the discount already taken off it (lab order or appointment). */
  discount: number;
  paid: number;
  cancelled: boolean;
};

/** What a line still owes (never negative). */
export const lineDue = (l: Pick<BillLine, "amount" | "paid">) => Math.max(0, l.amount - l.paid);
/** Money a line holds beyond its price — a cancelled service or a lowered price; to be refunded. */
export const lineCredit = (l: Pick<BillLine, "amount" | "paid">) => Math.max(0, l.paid - l.amount);

export type BillTotals = { amount: number; paid: number; due: number; credit: number; status: BillStatus };

/** The bill's state from its sums (also used where a storage sums lines in SQL). */
export function billStatus(t: { amount: number; paid: number; due: number; credit: number }, lineCount: number): BillStatus {
  if (lineCount === 0 || (t.amount === 0 && t.paid === 0)) return "empty";
  if (t.due === 0) return t.credit > 0 ? "overpaid" : "paid";
  return t.paid > 0 ? "partial" : "unpaid";
}

export function billTotals(lines: readonly Pick<BillLine, "amount" | "paid">[]): BillTotals {
  const sums = {
    amount: lines.reduce((s, l) => s + l.amount, 0),
    paid: lines.reduce((s, l) => s + l.paid, 0),
    due: lines.reduce((s, l) => s + lineDue(l), 0),
    credit: lines.reduce((s, l) => s + lineCredit(l), 0),
  };
  return { ...sums, status: billStatus(sums, lines.length) };
}

/** B7.2: what an appointment charges — its price frozen at booking less its discount. */
export const appointmentCharge = (a: { price: number; discount?: number | null }) => Math.max(0, a.price - (a.discount ?? 0));

type OrderForBill = { id: string; orderNumber: number; status: string; totalAmount: number; paidAmount: number; createdAt: string; tests: number; discount?: number | null };
type AppointmentForBill = {
  id: string;
  status: string;
  price: number;
  discount?: number | null;
  paid: number;
  startTime: string;
  createdAt: string;
  serviceName: string | null;
  doctorName: string;
  specialty: string;
};

type StayForBill = { id: string; number: number; status: string; admittedAt: string; charge: StayCharge; paid: number };

/**
 * The visit's lines. A service rendered is billed at its price; something
 * cancelled after money was taken stays on the bill at 0 so the money it
 * holds shows as credit to refund — never silently disappears.
 */
export function buildBillLines(orders: readonly OrderForBill[], appointments: readonly AppointmentForBill[], stays: readonly StayForBill[] = []): BillLine[] {
  const billable = new Set<string>(BILLABLE_APPOINTMENT_STATUSES);
  const lines: BillLine[] = [];
  for (const a of appointments) {
    const live = billable.has(a.status);
    if (!live && a.paid === 0) continue;
    lines.push({
      source: "appointment",
      sourceId: a.id,
      title: a.serviceName ?? `${a.specialty} ko'rigi`,
      detail: `${a.startTime} · ${a.doctorName}${a.serviceName ? ` (${a.specialty})` : ""}`,
      createdAt: a.createdAt,
      amount: live ? appointmentCharge(a) : 0,
      discount: live ? (a.discount ?? 0) : 0,
      paid: a.paid,
      cancelled: !live,
    });
  }
  for (const o of orders) {
    const live = o.status !== "cancelled";
    if (!live && o.paidAmount === 0) continue;
    lines.push({
      source: "order",
      sourceId: o.id,
      title: `Laboratoriya #${o.orderNumber}`,
      detail: `${o.tests} ta tahlil`,
      createdAt: o.createdAt,
      amount: live ? o.totalAmount : 0,
      discount: live ? (o.discount ?? 0) : 0,
      paid: o.paidAmount,
      cancelled: !live,
    });
  }
  for (const s of stays) {
    const live = s.status !== "cancelled";
    if (!live && s.paid === 0) continue;
    const text = stayLineText(s.number, s.charge);
    lines.push({
      source: "stay",
      sourceId: s.id,
      title: text.title,
      detail: text.detail,
      createdAt: s.admittedAt,
      amount: s.charge.amount,
      discount: live ? s.charge.discount : 0,
      paid: s.paid,
      cancelled: !live,
    });
  }
  return lines.sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

export type Allocation = { source: BillSource; sourceId: string; amount: number };

/**
 * Splits a payment across the lines that owe, oldest first, never past what a
 * line owes. Returns the shares and what was taken in total (a payment larger
 * than the debt is cut to the debt — the cashier gives change, not credit).
 */
export function allocatePayment(lines: readonly BillLine[], amount: number): { shares: Allocation[]; taken: number } {
  let left = Math.max(0, Math.floor(amount));
  const shares: Allocation[] = [];
  const owing = [...lines].filter((l) => lineDue(l) > 0).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.source.localeCompare(b.source));
  for (const l of owing) {
    if (left <= 0) break;
    const take = Math.min(left, lineDue(l));
    shares.push({ source: l.source, sourceId: l.sourceId, amount: take });
    left -= take;
  }
  return { shares, taken: shares.reduce((s, x) => s + x.amount, 0) };
}

/** "Ko'rik 80 000 + Laboratoriya #1042 45 000" — for the audit log. */
export function describeShares(shares: readonly Allocation[], lines: readonly BillLine[]): string {
  return shares
    .map((s) => {
      const l = lines.find((x) => x.source === s.source && x.sourceId === s.sourceId);
      return `${l?.title ?? s.source} ${String(s.amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
    })
    .join(" + ");
}

/**
 * What a receipt's chek (B7.6) says beyond the receipt itself: the change
 * handed back for cash, whether this print is a copy, and where the bill
 * stood once it was paid. Receipts taken before B7.6 know neither what was
 * handed over nor what was left, and say nothing rather than guess.
 */
export type SlipFigures = {
  /** Handed over, when it was more than the receipt (cash only); else null. */
  tendered: number | null;
  change: number;
  /** Null when unknown (receipts before B7.6). */
  dueAfter: number | null;
  paidInFull: boolean;
  /** The print this figure is for, 1-based; anything after the first is "NUSXA". */
  copy: boolean;
};

export function slipFigures(r: { amount: number; method: string; tendered: number | null; dueAfter: number | null }, printNumber: number): SlipFigures {
  const change = r.method === "naqd" && r.tendered !== null && r.tendered > r.amount ? r.tendered - r.amount : 0;
  return {
    tendered: change ? r.tendered : null,
    change,
    dueAfter: r.dueAfter,
    paidInFull: r.dueAfter === 0,
    copy: printNumber > 1,
  };
}
