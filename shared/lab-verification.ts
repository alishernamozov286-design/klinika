/**
 * Result verification (TZ §6.1.5, B4.5): the laborant enters, the lab head
 * checks, and only a verified value leaves the lab. One set of rules for both
 * storage backends, the queues, Telegram, the blank and the screens.
 */

type Line = {
  result: string | null;
  verifiedAt?: string | null;
  returnedAt?: string | null;
};

/**
 * - empty: nothing entered yet (the laborant's work)
 * - returned: sent back by the lab head (the laborant's work again)
 * - review: entered, waiting for the lab head
 * - verified: checked and released
 */
export type LineState = "empty" | "returned" | "review" | "verified";

export function lineState(l: Line): LineState {
  if (l.verifiedAt) return "verified";
  if (!l.result || !l.result.trim()) return "empty";
  if (l.returnedAt) return "returned";
  return "review";
}

export type LabProgress = Record<LineState, number> & {
  total: number;
  /** Every line verified: the order may go to the patient and the doctor. */
  released: boolean;
};

export function labProgress(items: Line[]): LabProgress {
  const p: LabProgress = { total: items.length, empty: 0, returned: 0, review: 0, verified: 0, released: false };
  for (const i of items) p[lineState(i)]++;
  p.released = p.total > 0 && p.verified === p.total;
  return p;
}

/** The order is fully verified — the rule for Telegram, the doctor and "ready". */
export const isOrderReleased = (order: { items: Line[] }) => labProgress(order.items).released;

/** Lines that may be shown outside the lab (blank, medical card, trends). */
export const releasedLines = <T extends Line>(items: T[]): T[] => items.filter((i) => lineState(i) === "verified");

/** The laborant's queue: something to enter or to fix. */
export const needsEntry = (items: Line[]) => items.some((i) => {
  const s = lineState(i);
  return s === "empty" || s === "returned";
});

/** The lab head's queue: something entered and not yet checked. */
export const needsReview = (items: Line[]) => items.some((i) => lineState(i) === "review");

export const LINE_STATE_LABELS: Record<LineState, string> = {
  empty: "Kiritilmagan",
  returned: "Qaytarilgan",
  review: "Tasdiqlash kutilmoqda",
  verified: "Tasdiqlangan",
};

/** Marks results that predate verification, so the blank does not invent a verifier. */
export const LEGACY_VERIFIER = "Tasdiqlash joriy etilishidan oldingi natija";
