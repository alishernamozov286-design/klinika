import { describe, expect, it } from "vitest";
import { buildPatientFlowReport } from "./patient-flow";

const startOfDay = (day: string) => Date.parse(`${day}T00:00:00Z`);
const endOfDay = (day: string) => Date.parse(`${day}T23:59:59.999Z`);

describe("patient flow (R.2)", () => {
  it("counts each patient once a day, breaks the day down by kind, and the period once per person", () => {
    const r = buildPatientFlowReport({
      from: "2026-11-01",
      to: "2026-11-03",
      today: "2026-11-30",
      events: [
        // Ali: a consultation and a lab order the same day — one patient that day, in both kinds.
        { day: "2026-11-01", patientId: "ali", kind: "visit" },
        { day: "2026-11-01", patientId: "ali", kind: "lab" },
        { day: "2026-11-01", patientId: "vali", kind: "lab" },
        { day: "2026-11-02", patientId: "ali", kind: "lab" },
        // Outside the period: ignored.
        { day: "2026-10-31", patientId: "gani", kind: "visit" },
      ],
      stays: [
        // In hospital from the 2nd evening, discharged the 3rd morning: both days.
        { patientId: "sobir", status: "discharged", admittedAt: "2026-11-02T20:00:00Z", dischargedAt: "2026-11-03T08:00:00Z" },
        // A mistake: nowhere.
        { patientId: "xato", status: "cancelled", admittedAt: "2026-11-01T09:00:00Z", dischargedAt: null },
        // Gone before the period: nowhere.
        { patientId: "eski", status: "discharged", admittedAt: "2026-10-20T09:00:00Z", dischargedAt: "2026-10-30T09:00:00Z" },
      ],
      newPatients: [{ day: "2026-11-01", count: 2 }],
      tests: [
        { day: "2026-11-01", ordered: 5, verified: 0 },
        { day: "2026-11-02", ordered: 2, verified: 6 },
      ],
      startOfDay,
      endOfDay,
    });
    expect(r.days).toEqual([
      { day: "2026-11-01", patients: 2, outpatients: 1, labPatients: 2, inpatients: 0, newPatients: 2, testsOrdered: 5, testsVerified: 0 },
      { day: "2026-11-02", patients: 2, outpatients: 0, labPatients: 1, inpatients: 1, newPatients: 0, testsOrdered: 2, testsVerified: 6 },
      { day: "2026-11-03", patients: 1, outpatients: 0, labPatients: 0, inpatients: 1, newPatients: 0, testsOrdered: 0, testsVerified: 0 },
    ]);
    expect(r.totals).toEqual({
      uniquePatients: 3,
      avgPerDay: 1.7,
      newPatients: 2,
      outpatients: 1,
      labPatients: 2,
      inpatients: 1,
      testsOrdered: 7,
      testsVerified: 6,
      busiest: { day: "2026-11-01", patients: 2 },
    });
  });

  it("stops at today", () => {
    const r = buildPatientFlowReport({ from: "2026-11-29", to: "2026-12-03", today: "2026-11-30", events: [], stays: [], newPatients: [], tests: [], startOfDay, endOfDay });
    expect(r.days.map((d) => d.day)).toEqual(["2026-11-29", "2026-11-30"]);
    expect(r.totals.busiest).toBeNull();
  });
});
