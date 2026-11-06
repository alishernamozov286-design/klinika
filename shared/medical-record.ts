/**
 * Examination record rules (B3.3, TZ §5.1.3, §5.2) shared by the server and
 * the screens: what makes a record signable, which fields a save or a
 * correction changed, and the diagnosis history drawn from signed records.
 */
import {
  RECORD_FIELDS,
  RECORD_FIELD_LABELS,
  type DiagnosisEntry,
  type MedicalRecordWithDetails,
  type RecordField,
} from "./schema";

type Fields = Partial<Record<RecordField, string | null>>;

const norm = (v: string | null | undefined) => (v ?? "").trim();

/** Nothing written yet. */
export function isRecordEmpty(fields: Fields): boolean {
  return RECORD_FIELDS.every((f) => norm(fields[f]) === "");
}

/**
 * Why the record cannot be signed yet, or null. A signed examination must
 * say what the patient came with and what the doctor concluded.
 */
export function signProblem(fields: Fields): string | null {
  if (!norm(fields.complaints)) return "Shikoyatlarni kiriting";
  if (!norm(fields.preliminaryDiagnosis) && !norm(fields.finalDiagnosis)) {
    return "Dastlabki yoki yakuniy tashxisni kiriting";
  }
  return null;
}

/** Fields whose text differs between two versions, in form order. */
export function changedFields(before: Fields, after: Fields): RecordField[] {
  return RECORD_FIELDS.filter((f) => norm(before[f]) !== norm(after[f]));
}

/** "Shikoyatlar, Yakuniy tashxis" — for the audit line. */
export const fieldList = (fields: RecordField[]) => fields.map((f) => RECORD_FIELD_LABELS[f]).join(", ");

/**
 * The patient's diagnosis history (TZ §5.2 "tashxislar tarixi"), newest
 * first, from signed records only — a draft is not yet a diagnosis.
 */
export function diagnosisHistory(records: MedicalRecordWithDetails[]): DiagnosisEntry[] {
  const out: DiagnosisEntry[] = [];
  for (const r of records) {
    if (r.status !== "signed") continue;
    const base = { recordId: r.id, date: r.date, doctorName: r.doctorName, specialty: r.specialty };
    if (norm(r.finalDiagnosis)) out.push({ ...base, kind: "final", text: norm(r.finalDiagnosis) });
    else if (norm(r.preliminaryDiagnosis)) out.push({ ...base, kind: "preliminary", text: norm(r.preliminaryDiagnosis) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Picks the six fields out of anything that has them. */
export function pickFields(source: Fields): Record<RecordField, string | null> {
  return Object.fromEntries(RECORD_FIELDS.map((f) => [f, source[f] ?? null])) as Record<RecordField, string | null>;
}
