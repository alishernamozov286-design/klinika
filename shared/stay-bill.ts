/**
 * Statsionar hisobi (B6.6, TZ §8.2 "Xizmatlar kassa hisobiga yuboriladi"):
 * what a stay charges — its bed-days at each ward's price and the procedures
 * done at the price they were ordered at.
 *
 * The stay is one line on the patient's bill (the visit of the admission day,
 * source "stay"), read live like every other line: it grows as days pass and
 * doses are given, so the desk can take an advance and settle at discharge.
 * Lab orders placed from the case history land on the same bill as ordinary
 * order lines.
 *
 * Bed-days: each bed period counts the calendar days from its first local day
 * to its last (the day of leaving is not counted — the next ward's, or none);
 * a stay shorter than a day still costs one day, at its first ward's price.
 * A period's price is frozen when it opens, so a later price change does not
 * reprice a stay. A cancelled (mistaken) stay charges nothing.
 *
 * Mirrored in SQL by STAY_AMOUNT_SQL (server/storage-pg.ts); both are checked
 * against each other on Neon.
 */

export type StayPeriodForBill = { fromAt: string; toAt: string | null; dayPrice: number; wardName: string; bedLabel: string };
export type StayOrderForBill = { id: string; name: string; unitPrice: number | null; done: number };

export type StayBedLine = { wardName: string; bedLabel: string; from: string; to: string; days: number; dayPrice: number; amount: number };
export type StayProcedureLine = { orderId: string; name: string; done: number; unitPrice: number; amount: number };
export type StayCharge = {
  bedDays: StayBedLine[];
  days: number;
  bedAmount: number;
  procedures: StayProcedureLine[];
  procedureAmount: number;
  /** Ordered without a catalogue price (written by hand) — given, but not billed. */
  unpriced: { name: string; done: number }[];
  gross: number;
  discount: number;
  /** What the stay line owes: gross less discount, never negative; 0 for a cancelled stay. */
  amount: number;
};

/** Whole days between two YYYY-MM-DD days. */
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function stayCharge(input: {
  status: "active" | "discharged" | "cancelled";
  periods: readonly StayPeriodForBill[];
  orders: readonly StayOrderForBill[];
  discount: number;
  /** When an open period ends for the count: now for a stay in hospital. */
  now: string;
  dayOf: (iso: string) => string;
}): StayCharge {
  const sorted = [...input.periods].sort((a, b) => a.fromAt.localeCompare(b.fromAt));
  const bedDays: StayBedLine[] = sorted.map((p) => {
    const from = input.dayOf(p.fromAt);
    const to = input.dayOf(p.toAt ?? input.now);
    const days = Math.max(0, dayDiff(from, to));
    return { wardName: p.wardName, bedLabel: p.bedLabel, from, to, days, dayPrice: p.dayPrice, amount: days * p.dayPrice };
  });
  // Shorter than a day: one day at the first ward.
  if (bedDays.length > 0 && bedDays.every((b) => b.days === 0)) {
    bedDays[0] = { ...bedDays[0], days: 1, amount: bedDays[0].dayPrice };
  }
  const procedures: StayProcedureLine[] = input.orders
    .filter((o) => o.done > 0 && o.unitPrice !== null)
    .map((o) => ({ orderId: o.id, name: o.name, done: o.done, unitPrice: o.unitPrice!, amount: o.done * o.unitPrice! }));
  const unpriced = input.orders.filter((o) => o.done > 0 && o.unitPrice === null).map((o) => ({ name: o.name, done: o.done }));
  const bedAmount = bedDays.reduce((s, b) => s + b.amount, 0);
  const procedureAmount = procedures.reduce((s, p) => s + p.amount, 0);
  const gross = bedAmount + procedureAmount;
  return {
    bedDays,
    days: bedDays.reduce((s, b) => s + b.days, 0),
    bedAmount,
    procedures,
    procedureAmount,
    unpriced,
    gross,
    discount: input.discount,
    amount: input.status === "cancelled" ? 0 : Math.max(0, gross - input.discount),
  };
}

/** The bill line's wording: "Statsionar karta №12" / "4 yotoq-kun · 6 muolaja". */
export function stayLineText(number: number, c: Pick<StayCharge, "days" | "procedures">): { title: string; detail: string } {
  const doses = c.procedures.reduce((s, p) => s + p.done, 0);
  return { title: `Statsionar karta №${number}`, detail: [`${c.days} yotoq-kun`, doses ? `${doses} muolaja` : null].filter(Boolean).join(" · ") };
}
