/**
 * Sifat nazorati (B4.8, TZ §6.5): internal QC with Westgard multirules,
 * calibration history, analyzer maintenance and external (interlaboratory)
 * QC. The rules are pure functions here so the server, the tests and the
 * screen all judge a run the same way.
 *
 * A control series is one material level, for one test, on one device
 * (`qc_targets`). Each result is judged against that series' own history at
 * the moment it is entered, and the verdict is stored with it: changing the
 * target mean/SD later, or voiding a result, never rewrites what an earlier
 * run was told.
 */

/** The classic Westgard multirule set, in the order a lab reads them. */
export const WESTGARD_RULES = ["1-2s", "1-3s", "2-2s", "R-4s", "4-1s", "10x"] as const;
export type WestgardRule = (typeof WESTGARD_RULES)[number];

export const WESTGARD_RULE_INFO: Record<WestgardRule, { label: string; description: string; reject: boolean }> = {
  "1-2s": { label: "1₂s", description: "Bitta natija o'rtachadan 2 SD dan uzoq — ogohlantirish", reject: false },
  "1-3s": { label: "1₃s", description: "Bitta natija o'rtachadan 3 SD dan uzoq — tasodifiy xato", reject: true },
  "2-2s": { label: "2₂s", description: "Ketma-ket 2 ta natija bir tomonda 2 SD dan uzoq — tizimli xato", reject: true },
  "R-4s": { label: "R₄s", description: "Ketma-ket 2 natija orasidagi farq 4 SD dan katta — tasodifiy xato", reject: true },
  "4-1s": { label: "4₁s", description: "Ketma-ket 4 ta natija bir tomonda 1 SD dan uzoq — tizimli xato", reject: true },
  "10x": { label: "10x̄", description: "Ketma-ket 10 ta natija o'rtachaning bir tomonida — siljish", reject: true },
};

export const QC_STATUSES = ["ok", "warning", "reject"] as const;
export type QcStatus = (typeof QC_STATUSES)[number];
export const QC_STATUS_LABELS: Record<QcStatus, string> = {
  ok: "Qabul qilindi",
  warning: "Ogohlantirish",
  reject: "Rad etildi",
};

export function zScore(value: number, mean: number, sd: number): number {
  if (!(sd > 0)) return 0;
  return (value - mean) / sd;
}

/** Rounds for storage and display: z to two places is what a lab reads. */
export const roundZ = (z: number) => Math.round(z * 100) / 100;

/**
 * Judges the newest point of a series. `zs` is the series oldest → newest,
 * the new point last. Rules look back from the new point only, so a rule is
 * raised by the run that completes it.
 *
 * R-4s is applied to consecutive runs of the same series (the within-series
 * form); with one control level per series that is the only form available.
 */
export function evaluateWestgard(zs: number[]): { rules: WestgardRule[]; status: QcStatus } {
  const rules: WestgardRule[] = [];
  const n = zs.length;
  if (n === 0) return { rules, status: "ok" };
  const z = zs[n - 1];
  const tail = (k: number) => (n >= k ? zs.slice(n - k) : null);
  const sameSide = (xs: number[], beyond: number) => xs.every((x) => x > beyond) || xs.every((x) => x < -beyond);

  if (Math.abs(z) > 2) rules.push("1-2s");
  if (Math.abs(z) > 3) rules.push("1-3s");
  const two = tail(2);
  if (two && sameSide(two, 2)) rules.push("2-2s");
  if (two && Math.abs(two[1] - two[0]) > 4 && Math.max(...two) > 2 && Math.min(...two) < -2) rules.push("R-4s");
  const four = tail(4);
  if (four && sameSide(four, 1)) rules.push("4-1s");
  const ten = tail(10);
  if (ten && sameSide(ten, 0)) rules.push("10x");

  const status: QcStatus = rules.some((r) => WESTGARD_RULE_INFO[r].reject) ? "reject" : rules.length ? "warning" : "ok";
  return { rules, status };
}

/** Mean, SD (sample) and CV% of a set of values — to set a target from a run of data. */
export function seriesStats(values: number[]): { n: number; mean: number; sd: number; cv: number } | null {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, cv: mean !== 0 ? (sd / Math.abs(mean)) * 100 : 0 };
}

// ------------------------------------------------------------ external QC

export const EQA_EVALUATIONS = ["acceptable", "questionable", "unacceptable"] as const;
export type EqaEvaluation = (typeof EQA_EVALUATIONS)[number];
export const EQA_EVALUATION_LABELS: Record<EqaEvaluation, string> = {
  acceptable: "Qoniqarli",
  questionable: "Shubhali",
  unacceptable: "Qoniqarsiz",
};

/** ISO 13528 z-score reading: |z| ≤ 2 acceptable, 2–3 questionable, > 3 unacceptable. */
export function eqaEvaluation(z: number): EqaEvaluation {
  const a = Math.abs(z);
  return a <= 2 ? "acceptable" : a <= 3 ? "questionable" : "unacceptable";
}

// ----------------------------------------------------- calibration, service

export const CALIBRATION_RESULTS = ["passed", "failed"] as const;
export type CalibrationResult = (typeof CALIBRATION_RESULTS)[number];
export const CALIBRATION_RESULT_LABELS: Record<CalibrationResult, string> = {
  passed: "Muvaffaqiyatli",
  failed: "O'tmadi",
};

export const MAINTENANCE_KINDS = ["daily", "weekly", "monthly", "preventive", "repair", "service"] as const;
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];
export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  daily: "Kundalik",
  weekly: "Haftalik",
  monthly: "Oylik",
  preventive: "Profilaktik",
  repair: "Ta'mirlash",
  service: "Servis muhandisi",
};

/** A calendar day (YYYY-MM-DD) is past when it is before `today`. */
export const isExpired = (day: string | null | undefined, today: string) => !!day && day < today;

/** Days from `today` to `day`; negative when past. */
export function daysUntil(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export const QC_RESULT_ALREADY_REVIEWED = "Bu natijaga chora allaqachon yozilgan";
export const QC_RESULT_ALREADY_VOIDED = "Bu natija allaqachon bekor qilingan";
export const QC_TARGET_EXISTS = "Bu material, tahlil va qurilma uchun nazorat seriyasi allaqachon bor";

/** How many earlier runs the rules can look back over (10x needs nine). */
export const QC_LOOKBACK = 9;

/**
 * Judges a new run against the series' earlier z-scores (oldest → newest,
 * voided runs left out). Both storages call this, so they agree by construction.
 */
export function judgeQcRun(previousZs: number[], value: number, mean: number, sd: number) {
  const z = roundZ(zScore(value, mean, sd));
  const { rules, status } = evaluateWestgard([...previousZs.slice(-QC_LOOKBACK), z]);
  return { z, rules, status };
}
