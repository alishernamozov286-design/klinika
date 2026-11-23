import { describe, expect, it } from "vitest";
import {
  DISCHARGE_BEFORE_ADMISSION,
  DISCHARGE_IN_FUTURE,
  EPICRISIS_EMPTY,
  EPICRISIS_UNCHANGED,
  buildEpicrisisDraft,
  dischargeProblem,
  dischargeTimeProblem,
  epicrisisChanges,
  epicrisisSaveProblem,
  normalizeEpicrisis,
} from "./epicrisis";

describe("epicrisis text", () => {
  it("names what changed, refuses an empty first or unchanged save", () => {
    const v1 = normalizeEpicrisis({ finalDiagnosis: " Pnevmoniya ", finalDiagnosisCode: "j18.9" });
    expect(v1).toMatchObject({ finalDiagnosis: "Pnevmoniya", finalDiagnosisCode: "J18.9", epicrisis: null });
    expect(epicrisisChanges(null, v1)).toEqual(["Yakuniy tashxis", "MKB-10 kodi"]);
    expect(epicrisisSaveProblem(null, normalizeEpicrisis({}))).toBe(EPICRISIS_EMPTY);
    expect(epicrisisSaveProblem(v1, { ...v1 })).toBe(EPICRISIS_UNCHANGED);
    expect(epicrisisSaveProblem(v1, { ...v1, recommendations: "Parhez" })).toBeNull();
  });

  it("discharge needs a diagnosis (text or code), the epicrisis and recommendations", () => {
    expect(dischargeProblem(null)).toMatch(/Yakuniy tashxis, Epikriz, Tavsiyalar/);
    expect(dischargeProblem(normalizeEpicrisis({ finalDiagnosisCode: "J18.9", epicrisis: "x" }))).toMatch(/: Tavsiyalar/);
    expect(dischargeProblem(normalizeEpicrisis({ finalDiagnosis: "Pnevmoniya", epicrisis: "x", recommendations: "y" }))).toBeNull();
  });

  it("discharge time lies within the stay, not ahead of now", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(dischargeTimeProblem("2026-11-23T11:00:00Z", "2026-11-20T08:00:00Z", now)).toBeNull();
    expect(dischargeTimeProblem("2026-11-19T11:00:00Z", "2026-11-20T08:00:00Z", now)).toBe(DISCHARGE_BEFORE_ADMISSION);
    expect(dischargeTimeProblem("2026-11-23T13:00:00Z", "2026-11-20T08:00:00Z", now)).toBe(DISCHARGE_IN_FUTURE);
  });
});

describe("the draft", () => {
  it("tells the stay from its records — nothing invented", () => {
    const d = buildEpicrisisDraft({
      patient: { name: "Normatov Aziz", age: 50 },
      admittedAt: "2026-11-20T08:00:00Z",
      until: "2026-11-25T09:00:00Z",
      days: 5,
      departmentName: "Terapiya statsionari",
      places: ["palata 102"],
      reason: "Pnevmoniya",
      caseText: { complaints: "Yo'tal, isitma", anamnesis: "3 kun kasal", examination: "O'pkada xirillash", diagnosis: "O'ng tomonlama pnevmoniya", diagnosisCode: "J18.9", treatmentPlan: null },
      observations: [
        { observedAt: "2026-11-20T09:00:00Z", temperature: 38.6, pulse: 104, systolic: 130, diastolic: 85, spo2: 93, note: null },
        { observedAt: "2026-11-25T08:00:00Z", temperature: 36.7, pulse: 76, systolic: 120, diastolic: 80, spo2: 98, note: "Holati qoniqarli" },
      ],
      treatments: [
        { name: "Seftriakson", dose: "1 g", route: "Vena ichiga", kind: "medicine", done: 10, stopped: false },
        { name: "Massaj", dose: null, route: null, kind: "procedure", done: 0, stopped: false },
      ],
      labs: [
        { testName: "Leykotsitlar", result: "14.2", unit: "10^9/l", flag: "high", date: "2026-11-20" },
        { testName: "Glyukoza", result: "5.1", unit: "mmol/l", flag: "normal", date: "2026-11-20" },
      ],
      exams: [],
      dayLabel: (iso) => iso.slice(0, 10),
    });
    expect(d).toMatchObject({ finalDiagnosis: "O'ng tomonlama pnevmoniya", finalDiagnosisCode: "J18.9", recommendations: null });
    expect(d.treatmentSummary).toContain("Statsionarda 5 kun (2026-11-20 – 2026-11-25), Terapiya statsionari, palata 102.");
    expect(d.treatmentSummary).toContain("- Seftriakson 1 g, vena ichiga — 10 marta");
    expect(d.treatmentSummary).not.toContain("Massaj");
    expect(d.epicrisis).toContain("Bemor Normatov Aziz, 50 yosh, 2026-11-20 kuni Terapiya statsionariga shikoyatlari bilan yotqizildi: Yo'tal, isitma.");
    expect(d.epicrisis).toContain("me'yordan tashqari: Leykotsitlar 14.2 10^9/l ↑");
    expect(d.epicrisis).toContain("harorat 38.6 → 36.7 °C");
    expect(d.epicrisis).toContain("AQB 130/85 → 120/80");
    expect(d.epicrisis).toContain("Oxirgi kuzatuv: Holati qoniqarli");
  });
});
