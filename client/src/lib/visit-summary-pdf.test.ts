import { describe, expect, it } from "vitest";
import type { VisitSummary } from "@shared/schema";
import { buildVisitSummaryPdf, visitSummaryFilename } from "./visit-summary-pdf";

function summary(overrides: Partial<VisitSummary["record"]> = {}): VisitSummary {
  const record = {
    id: "r1",
    patientId: "p1",
    appointmentId: "a1",
    doctorId: "d1",
    visitId: null,
    status: "signed",
    version: 1,
    revision: 3,
    complaints: "Bosh og'rig'i, holsizlik",
    anamnesis: "Ikki haftadan beri.",
    examination: "AQB 140/90",
    preliminaryDiagnosis: "Gipertoniya?",
    finalDiagnosis: "Arterial gipertenziya, 1-daraja",
    recommendations: "Tuzni kamaytirish, 2 haftadan keyin qayta ko'rik",
    signedAt: "2026-11-06T10:30:00.000Z",
    signedBy: "u1",
    amendedAt: null,
    amendReason: null,
    createdAt: "2026-11-06T10:00:00.000Z",
    createdBy: "u1",
    updatedAt: null,
    updatedBy: null,
    patientNumber: 14,
    // Cyrillic on purpose: the embedded font must carry it.
    patientName: "Каримова Зарина",
    doctorName: "Rasulov Jamshid",
    doctorUserId: "u1",
    specialty: "Terapevt",
    date: "2026-11-06",
    startTime: "10:00",
    signedByName: "Rasulov Jamshid",
    ...overrides,
  } as VisitSummary["record"];
  return {
    record,
    appointment: null,
    allergies: [{ id: "al1", patientId: "p1", allergen: "Penitsillin", reaction: "toshma", isActive: true } as VisitSummary["allergies"][number]],
    referrals: [
      {
        id: "ref1",
        referralNumber: 7,
        kind: "lab",
        status: "active",
        stage: "done",
        note: "Och qoringa",
        serviceName: null,
        targetSpecialty: null,
        targetDoctorName: null,
        booking: null,
        order: {
          id: "o1",
          orderNumber: 1001,
          status: "completed",
          totalAmount: 1,
          paidAmount: 1,
          tests: 2,
          done: 2,
          verified: 2,
          testNames: ["Glyukoza", "Gemoglobin"],
          results: [
            { testName: "Glyukoza", result: "7.4", unit: "mmol/l", referenceRange: "3.9-6.1", flag: "high" },
            { testName: "Gemoglobin", result: "130", unit: "g/l", referenceRange: "120-150", flag: "normal" },
          ],
        },
      } as unknown as VisitSummary["referrals"][number],
    ],
    clinic: { id: "default", labName: "NEOGEN CLINIC", tagline: "Klinika", address: "Toshkent", phone: "+998 71 200 00 00", director: null, licenseNumber: "L-1" },
    generatedAt: "2026-11-06T11:00:00.000Z",
    generatedBy: "Rasulov Jamshid",
  };
}

describe("visit summary PDF (B3.8)", () => {
  it("builds a one-page document for an ordinary visit", async () => {
    const pdf = await buildVisitSummaryPdf(summary());
    expect(pdf.getNumberOfPages()).toBe(1);
    const bytes = pdf.output("arraybuffer");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("runs long notes over as many pages as they need", async () => {
    const long = "Bemorning shikoyatlari batafsil yozilgan matn. ".repeat(400);
    const pdf = await buildVisitSummaryPdf(summary({ anamnesis: long, version: 2, amendReason: "Tashxis aniqlashtirildi", amendedAt: "2026-11-06T12:00:00.000Z" }));
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it("names the file after the patient and the day", () => {
    expect(visitSummaryFilename(summary())).toBe("xulosa-14-2026-11-06.pdf");
  });
});
