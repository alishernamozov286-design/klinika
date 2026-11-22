/**
 * Kasallik tarixi (B6.4, TZ §8.1.3): the doctor's history of an inpatient stay
 * and the daily observations of doctors and nurses.
 *
 * The history is append-only: every save is a new version (1, 2, …) and the
 * newest is the current text, so nothing written is ever overwritten. A save
 * names the version it was based on; two tabs saving at once make one version
 * and the other is told to reload (UQ_case_history_versions).
 *
 * Observations are never edited or deleted either: a mistaken one is struck
 * out with a reason and stays in the history.
 */

export const CASE_FIELDS = ["complaints", "anamnesis", "examination", "diagnosis", "treatmentPlan"] as const;
export type CaseField = (typeof CASE_FIELDS)[number];
export const CASE_FIELD_LABELS: Record<CaseField, string> = {
  complaints: "Shikoyatlar",
  anamnesis: "Anamnez",
  examination: "Obyektiv holat",
  diagnosis: "Tashxis",
  treatmentPlan: "Davolash rejasi",
};
export const CASE_FIELD_HINTS: Record<CaseField, string> = {
  complaints: "Bemor nimadan shikoyat qilmoqda",
  anamnesis: "Kasallik va hayot anamnezi, allergiya, avvalgi davolash",
  examination: "Qabuldagi ko'rik: umumiy holat, a'zolar tizimlari",
  diagnosis: "Klinik tashxis (MKB-10 kodi ixtiyoriy)",
  treatmentPlan: "Tekshiruvlar, dori va muolajalar rejasi, parhez, rejim",
};
export const CASE_FIELD_MAX = 4000;

export type CaseText = Record<CaseField, string | null> & { diagnosisCode: string | null };

export const CASE_HISTORY_STALE = "Kasallik tarixi boshqa oynada o'zgartirildi — oxirgi holatni yuklang";
export const CASE_HISTORY_UNCHANGED = "O'zgarish yo'q — saqlanadigan narsa yo'q";
export const CASE_HISTORY_EMPTY = "Kasallik tarixining kamida bitta bo'limini to'ldiring";
export const CASE_CLOSED = "Statsionar karta yopilgan — kasallik tarixiga yozib bo'lmaydi";
export const OBSERVATION_EMPTY = "Kamida bitta ko'rsatkich yoki izoh yozing";
export const OBSERVATION_BEFORE_ADMISSION = "Kuzatuv vaqti yotqizilgan vaqtdan oldin bo'lmaydi";
export const OBSERVATION_IN_FUTURE = "Kuzatuv vaqti kelajakda bo'lmaydi";
export const OBSERVATION_VOIDED = "Kuzatuv allaqachon bekor qilingan";
export const OBSERVATION_NOT_YOURS = "Boshqa xodimning kuzatuvini faqat tuzatish huquqi bor shifokor bekor qiladi";

/** Text as stored: trimmed, blank is null. */
export const cleanText = (v: string | null | undefined): string | null => {
  const t = (v ?? "").replace(/\r\n/g, "\n").trim();
  return t ? t : null;
};

export function normalizeCase(input: Partial<CaseText>): CaseText {
  const out = { diagnosisCode: cleanText(input.diagnosisCode)?.toUpperCase() ?? null } as CaseText;
  for (const f of CASE_FIELDS) out[f] = cleanText(input[f]);
  return out;
}

/** The text of a stored version. */
export function caseTextOf(row: CaseText): CaseText {
  return {
    complaints: row.complaints,
    anamnesis: row.anamnesis,
    examination: row.examination,
    diagnosis: row.diagnosis,
    diagnosisCode: row.diagnosisCode,
    treatmentPlan: row.treatmentPlan,
  };
}

/** The labels of the parts that differ — what a save changed (for the audit and the history dialog). */
export function caseChanges(before: CaseText | null, after: CaseText): string[] {
  const out: string[] = [];
  for (const f of CASE_FIELDS) if ((before?.[f] ?? null) !== after[f]) out.push(CASE_FIELD_LABELS[f]);
  if ((before?.diagnosisCode ?? null) !== after.diagnosisCode) out.push("MKB-10 kodi");
  return out;
}

/** Why a save is refused, before the storage is asked; null when it may go. */
export function caseSaveProblem(before: CaseText | null, after: CaseText): string | null {
  if (!before && CASE_FIELDS.every((f) => !after[f]) && !after.diagnosisCode) return CASE_HISTORY_EMPTY;
  if (caseChanges(before, after).length === 0) return CASE_HISTORY_UNCHANGED;
  return null;
}

// ---------------------------------------------------------------- observations

export const VITALS = ["temperature", "pulse", "systolic", "diastolic", "respiration", "spo2"] as const;
export type Vital = (typeof VITALS)[number];
export type Vitals = Record<Vital, number | null>;

/** What may be entered at all (min–max, a typo guard), and the usual adult range (low–high) outside which a reading is marked. */
export const VITAL_SPEC: Record<Vital, { label: string; short: string; unit: string; min: number; max: number; step: number; low: number; high: number }> = {
  temperature: { label: "Harorat", short: "T°", unit: "°C", min: 30, max: 45, step: 0.1, low: 35.5, high: 37.4 },
  pulse: { label: "Puls", short: "Puls", unit: "/min", min: 20, max: 250, step: 1, low: 50, high: 100 },
  systolic: { label: "Sistolik bosim", short: "AQB", unit: "mm sm.ust.", min: 50, max: 300, step: 1, low: 90, high: 140 },
  diastolic: { label: "Diastolik bosim", short: "AQB", unit: "mm sm.ust.", min: 20, max: 200, step: 1, low: 60, high: 90 },
  respiration: { label: "Nafas soni", short: "NS", unit: "/min", min: 4, max: 80, step: 1, low: 12, high: 24 },
  spo2: { label: "Saturatsiya", short: "SpO₂", unit: "%", min: 50, max: 100, step: 1, low: 94, high: 100 },
};

export type VitalFlag = "low" | "high";
export function vitalFlag(v: Vital, value: number | null): VitalFlag | null {
  if (value === null) return null;
  const s = VITAL_SPEC[v];
  if (value < s.low) return "low";
  if (value > s.high) return "high";
  return null;
}

/** Why the figures cannot be stored; null when they can. */
export function vitalsProblem(v: Vitals): string | null {
  for (const k of VITALS) {
    const x = v[k];
    if (x === null) continue;
    const s = VITAL_SPEC[k];
    if (!Number.isFinite(x) || x < s.min || x > s.max) return `${s.label}: ${s.min}–${s.max} ${s.unit} oralig'ida bo'lsin`;
    if (s.step === 1 && !Number.isInteger(x)) return `${s.label} butun son bo'lsin`;
  }
  if ((v.systolic === null) !== (v.diastolic === null)) return "Qon bosimini ikkala raqami bilan yozing (masalan 120/80)";
  if (v.systolic !== null && v.diastolic !== null && v.diastolic >= v.systolic) return "Diastolik bosim sistolikdan kichik bo'lsin";
  return null;
}

/** Why an observation cannot be stored: bad figures, or nothing at all. */
export function observationProblem(v: Vitals, note: string | null): string | null {
  if (VITALS.every((k) => v[k] === null) && !cleanText(note)) return OBSERVATION_EMPTY;
  return vitalsProblem(v);
}

/** The time of an observation must fall within the stay, and not ahead of now (a minute's clock drift allowed). */
export function observationTimeProblem(observedAt: string, admittedAt: string, now = new Date()): string | null {
  const t = Date.parse(observedAt);
  if (t > now.getTime() + 60_000) return OBSERVATION_IN_FUTURE;
  if (t < Date.parse(admittedAt)) return OBSERVATION_BEFORE_ADMISSION;
  return null;
}

/** "120/80", "36.6 °C" — a reading as the list shows it. */
export function formatVital(v: Vital, value: number | null): string {
  if (value === null) return "—";
  return v === "temperature" ? value.toFixed(1) : String(value);
}
