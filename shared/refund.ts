/**
 * To'lovni qaytarish (B7.4, TZ §9.2: "To'lov qaytarish faqat vakolatli shaxs
 * tasdig'i bilan bajariladi"; §9.1 "Qaytarilgan to'lovlar").
 *
 * What can be refunded is what a bill holds beyond what it owes: money paid
 * on a service later cancelled or made cheaper (`lineCredit`). To refund a
 * service, it is cancelled first (by whoever may cancel it); the bill then
 * shows the money as credit, and only that is returned.
 *
 *   requested ──approve──▶ approved ──pay──▶ paid
 *       │ reject               │ cancel
 *       ▼                      ▼
 *   rejected               cancelled        (requested can be cancelled too)
 *
 * The cashier asks (payments.create), someone else who holds payments.refund
 * approves — never the person who asked — and a cashier hands the money out
 * of an open cash shift (B7.5). The payout is negative `payments` rows on the
 * lines that held the credit, oldest first, so every ledger (order, bill,
 * shift, reports) follows by itself. Nothing is deleted.
 */
import { lineCredit, type BillLine, type BillSource } from "./invoice";

export const REFUND_STATUSES = ["requested", "approved", "paid", "rejected", "cancelled"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Tasdiq kutmoqda",
  approved: "Tasdiqlangan — to'lanmagan",
  paid: "Qaytarildi",
  rejected: "Rad etilgan",
  cancelled: "Bekor qilingan",
};
/** Still holding part of the bill's credit: a new request cannot take it too. */
export const OPEN_REFUND_STATUSES: readonly RefundStatus[] = ["requested", "approved"];
export const isOpenRefund = (s: RefundStatus) => OPEN_REFUND_STATUSES.includes(s);

export const REFUND_NOTHING = "Bu hisobvaraqda qaytariladigan ortiqcha to'lov yo'q — avval xizmatni bekor qiling yoki narxini o'zgartiring";
export const refundTooMuch = (available: number) =>
  `Qaytarish mumkin bo'lgan summa: ${String(available).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm (ortiqcha to'lov, ochiq so'rovlarsiz)`;
export const REFUND_SELF_APPROVAL = "O'zingiz so'ragan qaytarishni tasdiqlay olmaysiz — uni boshqa vakolatli xodim tasdiqlaydi (TZ §9.2)";
export const REFUND_BILL_CHANGED = "Hisobvaraq o'zgargan: ortiqcha to'lov endi so'ralgan summadan kam — qaytarishni bekor qilib, yangisini so'rang";
export const PAYMENT_IS_REFUND = "Bu yozuv qaytarishning bir qismi — pul bemorga berilgan, uni bekor qilib bo'lmaydi";
export const REFUNDS_BY_REQUEST = "Pulni qaytarish Kassa orqali: hisobvaraq → \"Qaytarish so'rovi\", vakolatli xodim tasdiqlaydi (TZ §9.2)";
export const refundNotIn = (status: RefundStatus, action: string) => `Bu qaytarish "${REFUND_STATUS_LABELS[status]}" holatida — ${action} mumkin emas`;

/** One line of a payout, frozen when the money is handed out. */
export type RefundLine = { source: BillSource; sourceId: string; title: string; amount: number };

/** What a bill can still refund: its credit less what open requests already hold. */
export function refundAvailable(lines: BillLine[], open: { amount: number; status: RefundStatus }[]): number {
  const credit = lines.reduce((s, l) => s + lineCredit(l), 0);
  const held = open.filter((r) => isOpenRefund(r.status)).reduce((s, r) => s + r.amount, 0);
  return Math.max(0, credit - held);
}

/** Splits a payout across the lines holding credit, oldest first; `taken` short of `amount` means the bill changed. */
export function allocateRefund(lines: BillLine[], amount: number): { lines: RefundLine[]; taken: number } {
  const out: RefundLine[] = [];
  let left = Math.max(0, Math.trunc(amount));
  const credited = lines.filter((l) => lineCredit(l) > 0).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  for (const l of credited) {
    if (!left) break;
    const take = Math.min(left, lineCredit(l));
    out.push({ source: l.source, sourceId: l.sourceId, title: l.title, amount: take });
    left -= take;
  }
  return { lines: out, taken: Math.max(0, Math.trunc(amount)) - left };
}

export type RefundAction = "approve" | "reject" | "pay" | "cancel";
const FROM: Record<RefundAction, readonly RefundStatus[]> = {
  approve: ["requested"],
  reject: ["requested"],
  pay: ["approved"],
  cancel: ["requested", "approved"],
};
const ACTION_WORD: Record<RefundAction, string> = { approve: "tasdiqlash", reject: "rad etish", pay: "pulni berish", cancel: "bekor qilish" };
/** Why `action` cannot be done on a refund in `status`, or null. */
export function refundActionProblem(status: RefundStatus, action: RefundAction): string | null {
  return FROM[action].includes(status) ? null : refundNotIn(status, ACTION_WORD[action]);
}
