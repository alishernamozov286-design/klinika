/**
 * Qarzdorlik nazorati (B7.3, TZ §9.1 "Qarzdorlik"): what every patient still
 * owes across all their visits, largest first, with how old the oldest unpaid
 * bill is. A bill's debt is its lines' dues (shared/invoice.ts), read live —
 * so a payment, a cancelled service or a discount changes it at once.
 */
export type DebtorRow = {
  patientId: string;
  patientNumber: number;
  patientName: string;
  phone: string | null;
  /** Visits (bills) still owing. */
  bills: number;
  due: number;
  /** The oldest and the latest owing visit day (YYYY-MM-DD). */
  oldest: string;
  latest: string;
};

export const DEBT_AGES = ["week", "month", "quarter", "older"] as const;
export type DebtAge = (typeof DEBT_AGES)[number];
export const DEBT_AGE_LABELS: Record<DebtAge, string> = {
  week: "7 kungacha",
  month: "8–30 kun",
  quarter: "31–90 kun",
  older: "90 kundan ortiq",
};

/** Whole days from `day` to `today` (both YYYY-MM-DD; calendar arithmetic). */
export function daysSince(day: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000));
}

/** How old a debt is, by its oldest unpaid visit. */
export function debtAge(oldest: string, today: string): DebtAge {
  const d = daysSince(oldest, today);
  return d <= 7 ? "week" : d <= 30 ? "month" : d <= 90 ? "quarter" : "older";
}

export type DebtSummary = { debtors: number; due: number; bills: number; byAge: Record<DebtAge, { debtors: number; due: number }> };

export function summarizeDebt(rows: DebtorRow[], today: string): DebtSummary {
  const byAge = Object.fromEntries(DEBT_AGES.map((a) => [a, { debtors: 0, due: 0 }])) as DebtSummary["byAge"];
  let due = 0;
  let bills = 0;
  for (const r of rows) {
    const a = byAge[debtAge(r.oldest, today)];
    a.debtors++;
    a.due += r.due;
    due += r.due;
    bills += r.bills;
  }
  return { debtors: rows.length, due, bills, byAge };
}

/** Patients owing, largest debt first (then the oldest debt first). */
export function sortDebtors(rows: DebtorRow[]): DebtorRow[] {
  return [...rows].sort((a, b) => b.due - a.due || a.oldest.localeCompare(b.oldest) || a.patientName.localeCompare(b.patientName));
}
