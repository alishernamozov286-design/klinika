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
 */
export const BILL_SOURCES = ["appointment", "order"] as const;
export type BillSource = (typeof BILL_SOURCES)[number];

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
  /** What is owed for it, so'm (0 for something cancelled that still holds money). */
  amount: number;
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

type OrderForBill = { id: string; orderNumber: number; status: string; totalAmount: number; paidAmount: number; createdAt: string; tests: number };
type AppointmentForBill = {
  id: string;
  status: string;
  price: number;
  paid: number;
  startTime: string;
  createdAt: string;
  serviceName: string | null;
  doctorName: string;
  specialty: string;
};

/**
 * The visit's lines. A service rendered is billed at its price; something
 * cancelled after money was taken stays on the bill at 0 so the money it
 * holds shows as credit to refund — never silently disappears.
 */
export function buildBillLines(orders: readonly OrderForBill[], appointments: readonly AppointmentForBill[]): BillLine[] {
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
      amount: live ? a.price : 0,
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
      paid: o.paidAmount,
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
