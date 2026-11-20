/**
 * Davolash va retsept (B3.6, TZ §5.1.5): "Dori nomi. Doza. Qabul qilish
 * tartibi. Davomiyligi. Muolajalar."
 *
 * The treatment is part of the examination record: written in the same
 * window, saved with the draft, signed with it, and corrected only as a new
 * version — the replaced treatment stays in medical_record_versions with the
 * rest of the text. A medicine is chosen from the warehouse catalogue (TZ: "dori nomi
 * ombor katalogidan") or written by hand when the clinic does not stock it;
 * a procedure comes from the service catalogue's "muolaja" type.
 *
 * A draft may hold half-written lines while the doctor types; signing (and a
 * correction) needs every line complete. Server, form and PDF share these rules.
 */
import type { PrescriptionLine } from "./schema";

export const PRESCRIPTION_KINDS = ["medicine", "procedure"] as const;
export type PrescriptionKind = (typeof PRESCRIPTION_KINDS)[number];
export const PRESCRIPTION_KIND_LABELS: Record<PrescriptionKind, string> = {
  medicine: "Dori vositasi",
  procedure: "Muolaja",
};

/** How a medicine is given — printed on the prescription next to the regimen. */
export const ADMIN_ROUTES = ["oral", "sublingual", "im", "iv", "sc", "topical", "inhalation", "rectal", "eye_ear_nose", "other"] as const;
export type AdminRoute = (typeof ADMIN_ROUTES)[number];
export const ADMIN_ROUTE_LABELS: Record<AdminRoute, string> = {
  oral: "Ichishga",
  sublingual: "Til ostiga",
  im: "Mushak ichiga",
  iv: "Vena ichiga",
  sc: "Teri ostiga",
  topical: "Tashqi (surtish)",
  inhalation: "Ingalyatsiya",
  rectal: "Rektal",
  eye_ear_nose: "Ko'z / quloq / burun",
  other: "Boshqa",
};

/** Offered in the form; the field takes any text. */
export const REGIMEN_SUGGESTIONS = [
  "Kuniga 1 marta",
  "Kuniga 2 marta",
  "Kuniga 3 marta",
  "Har 8 soatda",
  "Har 12 soatda",
  "Ertalab, nahorga",
  "Kechqurun, uxlashdan oldin",
  "Ovqatdan keyin, kuniga 3 marta",
  "Kerak bo'lganda",
  "Har kuni",
  "Kunora",
] as const;

export const MAX_PRESCRIPTION_LINES = 30;

const t = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Why the treatment cannot be signed, naming the line, or null. A medicine
 * needs its name, dose and regimen; a procedure its name and regimen.
 * Duration is optional ("kerak bo'lganda" has none), but never zero.
 */
export function prescriptionProblem(lines: readonly PrescriptionLine[] | null | undefined): string | null {
  for (const [i, l] of (lines ?? []).entries()) {
    const at = `Davolash, ${i + 1}-qator`;
    if (!t(l.name)) return `${at}: ${l.kind === "medicine" ? "dori nomini" : "muolajani"} kiriting`;
    if (l.kind === "medicine" && !t(l.dose)) return `${at} (${t(l.name)}): dozani kiriting`;
    if (!t(l.regimen)) return `${at} (${t(l.name)}): qabul qilish tartibini kiriting`;
  }
  return null;
}

/** The lines as they matter to a reader — ids and spacing aside — to tell whether a save changed anything. */
const canonical = (lines: readonly PrescriptionLine[] | null | undefined) =>
  JSON.stringify(
    (lines ?? []).map((l) => [l.kind, l.itemId ?? null, l.serviceId ?? null, t(l.name), t(l.dose), l.route ?? null, t(l.regimen), l.days ?? null, l.sessions ?? null, t(l.notes)]),
  );

export function sameTreatment(a: readonly PrescriptionLine[] | null | undefined, b: readonly PrescriptionLine[] | null | undefined): boolean {
  return canonical(a) === canonical(b);
}

/** "500 mg · Ichishga · Kuniga 3 marta · 5 kun" — the line as the patient reads it. */
export function lineDirections(l: PrescriptionLine): string {
  const parts = [t(l.dose), l.route ? ADMIN_ROUTE_LABELS[l.route] : "", t(l.regimen)];
  if (l.days) parts.push(`${l.days} kun`);
  if (l.sessions) parts.push(`${l.sessions} seans`);
  return parts.filter(Boolean).join(" · ");
}

/** "Paratsetamol 500 mg · Ichishga · Kuniga 3 marta · 5 kun" — for the audit log and plain-text places. */
export const describeLine = (l: PrescriptionLine) => [t(l.name), lineDirections(l)].filter(Boolean).join(" — ");

/** "2 ta dori, 1 ta muolaja" */
export function treatmentSummary(lines: readonly PrescriptionLine[] | null | undefined): string {
  const m = (lines ?? []).filter((l) => l.kind === "medicine").length;
  const p = (lines ?? []).filter((l) => l.kind === "procedure").length;
  return [m ? `${m} ta dori` : "", p ? `${p} ta muolaja` : ""].filter(Boolean).join(", ") || "davolash belgilanmagan";
}

type HistoryRecord = {
  id: string;
  status: string;
  date: string;
  doctorName: string;
  specialty: string;
  version: number;
  prescriptions: readonly PrescriptionLine[];
};
export type TreatmentEntry = { recordId: string; date: string; doctorName: string; specialty: string; version: number; lines: PrescriptionLine[] };

/**
 * The patient's treatment history (TZ §5.1.2 "Davolash tarixi"): what was
 * prescribed at each signed examination, newest first. Drafts are not a
 * prescription yet.
 */
export function treatmentHistory(records: readonly HistoryRecord[]): TreatmentEntry[] {
  return records
    .filter((r) => r.status === "signed" && r.prescriptions.length > 0)
    .map((r) => ({ recordId: r.id, date: r.date, doctorName: r.doctorName, specialty: r.specialty, version: r.version, lines: [...r.prescriptions] }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** A fresh line for the form. */
export function blankLine(kind: PrescriptionKind): PrescriptionLine {
  return {
    id: `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    itemId: null,
    serviceId: null,
    name: "",
    dose: null,
    route: kind === "medicine" ? "oral" : null,
    regimen: null,
    days: null,
    sessions: null,
    notes: null,
  };
}
