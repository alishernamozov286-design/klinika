/**
 * Examination record rules (B3.3, TZ §5.1.3, §5.2) shared by the server and
 * the screens: what makes a record signable, which fields a save or a
 * correction changed, and the diagnosis history drawn from signed records.
 */
import { prescriptionProblem, sameTreatment } from "./prescription";
import {
  RECORD_CODE_FIELDS,
  RECORD_CODE_LABELS,
  RECORD_FIELDS,
  RECORD_FIELD_LABELS,
  type DiagnosisEntry,
  type MedicalRecordWithDetails,
  type PrescriptionLine,
  type RecordCodeField,
  type RecordField,
} from "./schema";

type Fields = Partial<Record<RecordField | RecordCodeField, string | null>> & { prescriptions?: readonly PrescriptionLine[] | null };

/** Every field a save or a correction carries: the six texts, the two MKB-10 codes and the treatment (B3.6). */
export type AnyRecordField = RecordField | RecordCodeField | "prescriptions";
type TextField = RecordField | RecordCodeField;
const TEXT_FIELDS: readonly TextField[] = [...RECORD_FIELDS, ...RECORD_CODE_FIELDS];
export const TREATMENT_LABEL = "Davolash (retsept)";

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
  if (!norm(fields.preliminaryDiagnosis) && !norm(fields.finalDiagnosis) && !fields.preliminaryDiagnosisCode && !fields.finalDiagnosisCode) {
    return "Dastlabki yoki yakuniy tashxisni kiriting";
  }
  // A half-written prescription is fine in a draft, never in a signed record.
  return prescriptionProblem(fields.prescriptions);
}

/**
 * Fields whose value differs between two versions, in form order — a changed
 * MKB-10 code counts, and so does any change to the treatment lines. A field
 * one side does not carry is not compared (a text-only save leaves the treatment alone).
 */
export function changedFields(before: Fields, after: Fields): AnyRecordField[] {
  const out: AnyRecordField[] = TEXT_FIELDS.filter((f) => norm(before[f]) !== norm(after[f]));
  if (before.prescriptions !== undefined && after.prescriptions !== undefined && !sameTreatment(before.prescriptions, after.prescriptions)) {
    // Treatment sits between the diagnoses and the recommendations on the form.
    const at = out.indexOf("recommendations");
    out.splice(at === -1 ? out.length : at, 0, "prescriptions");
  }
  return out;
}

const labelOf = (f: AnyRecordField) =>
  f === "prescriptions" ? TREATMENT_LABEL : ((RECORD_FIELD_LABELS as Record<string, string>)[f] ?? (RECORD_CODE_LABELS as Record<string, string>)[f]);

/** "Shikoyatlar, Yakuniy tashxis" — for the audit line. */
export const fieldList = (fields: AnyRecordField[]) => fields.map(labelOf).join(", ");

/**
 * The patient's diagnosis history (TZ §5.2 "tashxislar tarixi"), newest
 * first, from signed records only — a draft is not yet a diagnosis.
 */
export function diagnosisHistory(records: MedicalRecordWithDetails[]): DiagnosisEntry[] {
  const out: DiagnosisEntry[] = [];
  for (const r of records) {
    if (r.status !== "signed") continue;
    const base = { recordId: r.id, date: r.date, doctorName: r.doctorName, specialty: r.specialty };
    // A final diagnosis wins over the preliminary one; a code without text still counts.
    if (norm(r.finalDiagnosis) || r.finalDiagnosisCode) {
      out.push({ ...base, kind: "final", text: norm(r.finalDiagnosis), code: r.finalDiagnosisCode ?? null });
    } else if (norm(r.preliminaryDiagnosis) || r.preliminaryDiagnosisCode) {
      out.push({ ...base, kind: "preliminary", text: norm(r.preliminaryDiagnosis), code: r.preliminaryDiagnosisCode ?? null });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Picks the six texts, two codes and the treatment out of anything that has them. */
export function pickFields(source: Fields): Record<TextField, string | null> & { prescriptions: PrescriptionLine[] } {
  return {
    ...(Object.fromEntries(TEXT_FIELDS.map((f) => [f, source[f] ?? null])) as Record<TextField, string | null>),
    prescriptions: [...(source.prescriptions ?? [])],
  };
}
