import { describe, expect, it } from "vitest";
import {
  CASE_HISTORY_EMPTY,
  CASE_HISTORY_UNCHANGED,
  OBSERVATION_BEFORE_ADMISSION,
  OBSERVATION_EMPTY,
  OBSERVATION_IN_FUTURE,
  caseChanges,
  caseSaveProblem,
  formatVital,
  normalizeCase,
  observationProblem,
  observationTimeProblem,
  vitalFlag,
  vitalsProblem,
  type Vitals,
} from "./case-history";

const none: Vitals = { temperature: null, pulse: null, systolic: null, diastolic: null, respiration: null, spo2: null };

describe("case history text", () => {
  it("trims, blanks to null, upper-cases the code", () => {
    expect(normalizeCase({ complaints: "  Bosh og'rig'i \r\n", diagnosis: "   ", diagnosisCode: " i10 " })).toEqual({
      complaints: "Bosh og'rig'i",
      anamnesis: null,
      examination: null,
      diagnosis: null,
      diagnosisCode: "I10",
      treatmentPlan: null,
    });
  });

  it("names what a save changed, and refuses an empty first or an unchanged save", () => {
    const v1 = normalizeCase({ complaints: "Yo'tal", diagnosis: "Bronxit" });
    expect(caseChanges(null, v1)).toEqual(["Shikoyatlar", "Tashxis"]);
    const v2 = normalizeCase({ ...v1, diagnosis: "Pnevmoniya", diagnosisCode: "J18.9", treatmentPlan: "Antibiotik" });
    expect(caseChanges(v1, v2)).toEqual(["Tashxis", "Davolash rejasi", "MKB-10 kodi"]);
    expect(caseSaveProblem(null, normalizeCase({}))).toBe(CASE_HISTORY_EMPTY);
    expect(caseSaveProblem(v1, { ...v1 })).toBe(CASE_HISTORY_UNCHANGED);
    expect(caseSaveProblem(v1, v2)).toBeNull();
    // Clearing a part is a change too (the old text stays in the earlier version).
    expect(caseSaveProblem(v1, { ...v1, complaints: null })).toBeNull();
  });
});

describe("observations", () => {
  it("accepts sensible readings and refuses typos", () => {
    expect(vitalsProblem({ ...none, temperature: 36.6, systolic: 120, diastolic: 80, pulse: 72, respiration: 16, spo2: 98 })).toBeNull();
    expect(vitalsProblem({ ...none, temperature: 366 })).toMatch(/Harorat: 30–45/);
    expect(vitalsProblem({ ...none, pulse: 72.5 })).toMatch(/butun son/);
    expect(vitalsProblem({ ...none, diastolic: 80 })).toMatch(/ikkala raqami/);
    expect(vitalsProblem({ ...none, systolic: 80, diastolic: 120 })).toMatch(/kichik/);
    expect(vitalsProblem({ ...none, spo2: 101 })).toMatch(/Saturatsiya/);
  });

  it("needs a figure or a note", () => {
    expect(observationProblem(none, "  ")).toBe(OBSERVATION_EMPTY);
    expect(observationProblem(none, "Holati yaxshi")).toBeNull();
    expect(observationProblem({ ...none, pulse: 70 }, null)).toBeNull();
  });

  it("falls within the stay, not ahead of now", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    expect(observationTimeProblem("2026-11-22T09:00:00Z", "2026-11-21T08:00:00Z", now)).toBeNull();
    expect(observationTimeProblem("2026-11-21T07:59:00Z", "2026-11-21T08:00:00Z", now)).toBe(OBSERVATION_BEFORE_ADMISSION);
    expect(observationTimeProblem("2026-11-22T10:00:30Z", "2026-11-21T08:00:00Z", now)).toBeNull();
    expect(observationTimeProblem("2026-11-22T10:05:00Z", "2026-11-21T08:00:00Z", now)).toBe(OBSERVATION_IN_FUTURE);
  });

  it("marks readings outside the usual adult range", () => {
    expect(vitalFlag("temperature", 36.6)).toBeNull();
    expect(vitalFlag("temperature", 37.4)).toBeNull();
    expect(vitalFlag("temperature", 38.2)).toBe("high");
    expect(vitalFlag("temperature", 35.0)).toBe("low");
    expect(vitalFlag("systolic", 150)).toBe("high");
    expect(vitalFlag("spo2", 91)).toBe("low");
    expect(vitalFlag("spo2", 100)).toBeNull();
    expect(vitalFlag("pulse", null)).toBeNull();
    expect(formatVital("temperature", 37)).toBe("37.0");
  });
});
