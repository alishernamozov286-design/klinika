/**
 * Chiqarish va epikriz (B6.7, TZ §8.1.5): "Yakuniy tashxis. Davolash xulosasi.
 * Epikriz. Tavsiyalar. Chiqarilgan sana." TZ §8.2: "Bemor chiqarilganda yakuniy
 * epikriz yaratiladi".
 *
 * The epicrisis is append-only, like the case history (B6.4): every save is a
 * new version and the newest is the document. While the patient is in
 * hospital the doctor drafts it — filled from the stay (case history,
 * observations, procedures given, lab results) and then edited. Discharge
 * needs it complete, and closes the stay in one step. After discharge it is a
 * signed document: a correction is a new version with a reason, by someone
 * allowed to amend records.
 */
import { VITAL_SPEC, cleanText } from "./case-history";

export const EPICRISIS_FIELDS = ["finalDiagnosis", "treatmentSummary", "epicrisis", "recommendations"] as const;
export type EpicrisisField = (typeof EPICRISIS_FIELDS)[number];
export const EPICRISIS_FIELD_LABELS: Record<EpicrisisField, string> = {
  finalDiagnosis: "Yakuniy tashxis",
  treatmentSummary: "Davolash xulosasi",
  epicrisis: "Epikriz",
  recommendations: "Tavsiyalar",
};
export const EPICRISIS_FIELD_HINTS: Record<EpicrisisField, string> = {
  finalDiagnosis: "Asosiy kasallik, asoratlari, yo'ldosh kasalliklar",
  treatmentSummary: "Qanday davolash o'tkazildi va natijasi",
  epicrisis: "Yotqizilishdan chiqishgacha kasallik kechishi: holat, tekshiruvlar, dinamika",
  recommendations: "Rejim, parhez, dori-darmonlar, nazorat muddatlari, kimga murojaat qilish",
};
export const EPICRISIS_MAX: Record<EpicrisisField, number> = { finalDiagnosis: 2000, treatmentSummary: 6000, epicrisis: 10000, recommendations: 4000 };

export type EpicrisisText = Record<EpicrisisField, string | null> & { finalDiagnosisCode: string | null };

export const EPICRISIS_STALE = "Epikriz boshqa oynada o'zgartirildi — oxirgi holatni yuklang";
export const EPICRISIS_UNCHANGED = "O'zgarish yo'q — saqlanadigan narsa yo'q";
export const EPICRISIS_EMPTY = "Epikrizning kamida bitta bo'limini to'ldiring";
export const EPICRISIS_REASON = "Chiqarilgan bemorning epikrizini tuzatish sababini yozing";
export const EPICRISIS_CANCELLED = "Bekor qilingan yotqizishga epikriz yozilmaydi";
export const DISCHARGE_NOT_ACTIVE = "Bemor statsionarda emas — chiqarib bo'lmaydi";
export const DISCHARGE_BEFORE_ADMISSION = "Chiqarish vaqti yotqizilgan vaqtdan oldin bo'lmaydi";
export const DISCHARGE_IN_FUTURE = "Chiqarish vaqti kelajakda bo'lmaydi";

export function normalizeEpicrisis(input: Partial<EpicrisisText>): EpicrisisText {
  const out = { finalDiagnosisCode: cleanText(input.finalDiagnosisCode)?.toUpperCase() ?? null } as EpicrisisText;
  for (const f of EPICRISIS_FIELDS) out[f] = cleanText(input[f]);
  return out;
}

export function epicrisisTextOf(row: EpicrisisText): EpicrisisText {
  return {
    finalDiagnosis: row.finalDiagnosis,
    finalDiagnosisCode: row.finalDiagnosisCode,
    treatmentSummary: row.treatmentSummary,
    epicrisis: row.epicrisis,
    recommendations: row.recommendations,
  };
}

/** The labels of the parts a save changed. */
export function epicrisisChanges(before: EpicrisisText | null, after: EpicrisisText): string[] {
  const out: string[] = [];
  for (const f of EPICRISIS_FIELDS) if ((before?.[f] ?? null) !== after[f]) out.push(EPICRISIS_FIELD_LABELS[f]);
  if ((before?.finalDiagnosisCode ?? null) !== after.finalDiagnosisCode) out.push("MKB-10 kodi");
  return out;
}

export function epicrisisSaveProblem(before: EpicrisisText | null, after: EpicrisisText): string | null {
  if (!before && EPICRISIS_FIELDS.every((f) => !after[f]) && !after.finalDiagnosisCode) return EPICRISIS_EMPTY;
  if (epicrisisChanges(before, after).length === 0) return EPICRISIS_UNCHANGED;
  return null;
}

/** What discharge needs written first, naming the missing parts; null when complete. */
export function dischargeProblem(t: EpicrisisText | null): string | null {
  const missing: string[] = [];
  if (!t?.finalDiagnosis && !t?.finalDiagnosisCode) missing.push(EPICRISIS_FIELD_LABELS.finalDiagnosis);
  if (!t?.epicrisis) missing.push(EPICRISIS_FIELD_LABELS.epicrisis);
  if (!t?.recommendations) missing.push(EPICRISIS_FIELD_LABELS.recommendations);
  return missing.length ? `Chiqarishdan oldin epikrizda to'ldiring: ${missing.join(", ")} (saqlang)` : null;
}

export function dischargeTimeProblem(at: string, admittedAt: string, now = new Date()): string | null {
  const t = Date.parse(at);
  if (t > now.getTime() + 60_000) return DISCHARGE_IN_FUTURE;
  if (t < Date.parse(admittedAt)) return DISCHARGE_BEFORE_ADMISSION;
  return null;
}

// ---------------------------------------------------------------- the draft

type DraftInput = {
  patient: { name: string; age: number | null };
  admittedAt: string;
  until: string;
  days: number;
  departmentName: string;
  places: string[];
  reason: string | null;
  caseText: { complaints: string | null; anamnesis: string | null; examination: string | null; diagnosis: string | null; diagnosisCode: string | null; treatmentPlan: string | null } | null;
  /** Live observations, oldest first. */
  observations: { observedAt: string; temperature: number | null; pulse: number | null; systolic: number | null; diastolic: number | null; spo2: number | null; note: string | null }[];
  /** Orders with what was given. */
  treatments: { name: string; dose: string | null; route: string | null; kind: "medicine" | "procedure"; done: number; stopped: boolean }[];
  labs: { testName: string; result: string; unit: string | null; flag: string | null; date: string }[];
  exams: { title: string; date: string; diagnosis: string | null }[];
  dayLabel: (iso: string) => string;
};

const first = <T,>(rows: T[], pick: (r: T) => number | null) => rows.find((r) => pick(r) !== null);
const last = <T,>(rows: T[], pick: (r: T) => number | null) => [...rows].reverse().find((r) => pick(r) !== null);

/** "Harorat 38.6 → 36.7 °C" — where a reading went over the stay. */
function vitalTrend(rows: DraftInput["observations"]): string[] {
  const out: string[] = [];
  for (const v of ["temperature", "pulse", "spo2"] as const) {
    const a = first(rows, (r) => r[v]);
    const b = last(rows, (r) => r[v]);
    if (!a || !b) continue;
    const fmt = (x: number) => (v === "temperature" ? x.toFixed(1) : String(x));
    out.push(a === b ? `${VITAL_SPEC[v].label.toLowerCase()} ${fmt(a[v]!)} ${VITAL_SPEC[v].unit}` : `${VITAL_SPEC[v].label.toLowerCase()} ${fmt(a[v]!)} → ${fmt(b[v]!)} ${VITAL_SPEC[v].unit}`);
  }
  const bpA = rows.find((r) => r.systolic !== null);
  const bpB = [...rows].reverse().find((r) => r.systolic !== null);
  if (bpA && bpB) out.push(bpA === bpB ? `AQB ${bpA.systolic}/${bpA.diastolic}` : `AQB ${bpA.systolic}/${bpA.diastolic} → ${bpB.systolic}/${bpB.diastolic} mm sm.ust.`);
  return out;
}

/**
 * The epicrisis as the stay already tells it — a starting point the doctor
 * edits. Nothing is invented: every sentence comes from a record of the stay.
 */
export function buildEpicrisisDraft(d: DraftInput): EpicrisisText {
  const c = d.caseText;
  const from = d.dayLabel(d.admittedAt);
  const to = d.dayLabel(d.until);
  const given = d.treatments.filter((t) => t.done > 0);
  const treatmentLines = given.map((t) => `- ${t.name}${t.dose ? ` ${t.dose}` : ""}${t.route ? `, ${t.route.toLowerCase()}` : ""} — ${t.done} marta${t.stopped ? " (muddatidan oldin to'xtatilgan)" : ""}`);
  const treatmentSummary = [
    `Statsionarda ${d.days} kun (${from} – ${to}), ${d.departmentName}${d.places.length ? `, ${d.places.join(" → ")}` : ""}.`,
    given.length ? `O'tkazilgan davolash:\n${treatmentLines.join("\n")}` : null,
    c?.treatmentPlan ? `Davolash rejasi: ${c.treatmentPlan}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const abnormal = d.labs.filter((l) => l.flag && l.flag !== "normal");
  const trend = vitalTrend(d.observations);
  const lastNote = [...d.observations].reverse().find((o) => o.note)?.note ?? null;
  const epicrisis = [
    `Bemor ${d.patient.name}${d.patient.age !== null ? `, ${d.patient.age} yosh` : ""}, ${from} kuni ${d.departmentName}ga ${c?.complaints ? `shikoyatlari bilan yotqizildi: ${c.complaints}` : d.reason ? `yotqizildi: ${d.reason}` : "yotqizildi"}.`,
    c?.anamnesis ? `Anamnez: ${c.anamnesis}` : null,
    c?.examination ? `Qabuldagi holati: ${c.examination}` : null,
    d.labs.length
      ? `Laboratoriya tekshiruvlari (${d.labs.length} ta natija)${abnormal.length ? `, me'yordan tashqari: ${abnormal.map((l) => `${l.testName} ${l.result}${l.unit ? ` ${l.unit}` : ""}${l.flag === "high" ? " ↑" : l.flag === "low" ? " ↓" : ""} (${d.dayLabel(l.date)})`).join("; ")}.` : ", me'yor doirasida."}`
      : null,
    d.exams.length ? `Tekshiruvlar va konsultatsiyalar: ${d.exams.map((e) => `${e.title} (${d.dayLabel(e.date)})${e.diagnosis ? ` — ${e.diagnosis}` : ""}`).join("; ")}.` : null,
    trend.length ? `Dinamikada: ${trend.join(", ")}.` : null,
    lastNote ? `Oxirgi kuzatuv: ${lastNote}` : null,
    c?.diagnosis ? `Klinik tashxis: ${c.diagnosis}.` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    finalDiagnosis: c?.diagnosis ?? null,
    finalDiagnosisCode: c?.diagnosisCode ?? null,
    treatmentSummary: treatmentSummary || null,
    epicrisis: epicrisis || null,
    recommendations: null,
  };
}
