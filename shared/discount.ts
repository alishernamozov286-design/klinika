/**
 * Chegirmalar (B7.2, TZ §9.2 "Chegirmalar").
 *
 * A discount is given on a bill (shared/invoice.ts) — on the whole of it or on
 * one service — as a percent or a sum, always with a reason. It lowers what a
 * line owes: a lab order's `discount` (its total follows) or an appointment's
 * `discount` (its charge = frozen price − discount). It is given only on what
 * is still unpaid: money already taken is handed back through a refund (B7.4,
 * approved by someone else), so a discount can never become a way round it.
 * Every discount is kept on the bill (`bill_discounts`); nothing is deleted.
 */
import { lineDue, type BillLine, type BillSource } from "./invoice";

export const DISCOUNT_MODES = ["percent", "amount"] as const;
export type DiscountMode = (typeof DISCOUNT_MODES)[number];
export const DISCOUNT_MODE_LABELS: Record<DiscountMode, string> = { percent: "Foiz", amount: "Summa" };

export const DISCOUNT_NOTHING = "Chegirma qilinadigan to'lanmagan summa yo'q — to'langan pulni qaytarish orqali bering (vakolatli xodim tasdig'i bilan)";
export const DISCOUNT_LINE_GONE = "Bu xizmat hisobvaraqda yo'q yoki to'liq to'langan";

export type DiscountTarget = { source: BillSource; sourceId: string } | null;
export type DiscountLine = { source: BillSource; sourceId: string; title: string; amount: number };

/**
 * What a discount takes off each line. Percent: of the line's charge, cut to
 * what it still owes. Sum: shared across the targeted lines in proportion to
 * what each owes (largest remainder, whole so'm), never past the debt.
 */
export function planDiscount(lines: readonly BillLine[], mode: DiscountMode, value: number, target: DiscountTarget): { lines: DiscountLine[]; total: number } {
  const owing = lines.filter((l) => lineDue(l) > 0 && (!target || (l.source === target.source && l.sourceId === target.sourceId)));
  const v = Math.max(0, Math.trunc(value));
  let parts: number[];
  if (mode === "percent") {
    const pct = Math.min(100, v);
    parts = owing.map((l) => Math.min(lineDue(l), Math.round((l.amount * pct) / 100)));
  } else {
    const debt = owing.reduce((s, l) => s + lineDue(l), 0);
    const total = Math.min(v, debt);
    const exact = owing.map((l) => (debt ? (total * lineDue(l)) / debt : 0));
    parts = exact.map(Math.floor);
    let left = total - parts.reduce((s, p) => s + p, 0);
    const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
    for (const { i } of order) {
      if (!left) break;
      if (parts[i] < lineDue(owing[i])) {
        parts[i]++;
        left--;
      }
    }
  }
  const out = owing.map((l, i) => ({ source: l.source, sourceId: l.sourceId, title: l.title, amount: parts[i] })).filter((x) => x.amount > 0);
  return { lines: out, total: out.reduce((s, x) => s + x.amount, 0) };
}

/** "10% (25 000 so'm)" / "15 000 so'm" */
export function describeDiscount(mode: DiscountMode, value: number, total: number): string {
  const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
  return mode === "percent" ? `${value}% (${sum(total)})` : sum(total);
}
