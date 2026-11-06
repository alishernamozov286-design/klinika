import { describe, expect, it } from "vitest";
import { changedFields, diagnosisHistory, fieldList, isRecordEmpty, pickFields, signProblem } from "./medical-record";
import { recordFieldsSchema, type MedicalRecordWithDetails } from "./schema";

const record = (over: Partial<MedicalRecordWithDetails>): MedicalRecordWithDetails => ({
  id: "r1",
  patientId: "p1",
  appointmentId: "a1",
  doctorId: "d1",
  visitId: null,
  status: "signed",
  version: 1,
  revision: 3,
  complaints: "Bosh og'rig'i",
  anamnesis: null,
  examination: null,
  preliminaryDiagnosis: null,
  finalDiagnosis: null,
  recommendations: null,
  signedAt: "2026-11-01T10:00:00.000Z",
  signedBy: "u1",
  amendedAt: null,
  amendReason: null,
  createdAt: "2026-11-01T09:00:00.000Z",
  createdBy: "u1",
  updatedAt: null,
  updatedBy: null,
  patientNumber: 1,
  patientName: "Aliyev Vali",
  doctorName: "Karimov Anvar",
  doctorUserId: "u1",
  specialty: "Nevrolog",
  date: "2026-11-01",
  startTime: "09:00",
  signedByName: "Karimov Anvar",
  ...over,
});

describe("signing rules", () => {
  it("needs complaints and at least one diagnosis", () => {
    expect(signProblem({})).toMatch(/Shikoyat/);
    expect(signProblem({ complaints: "  " })).toMatch(/Shikoyat/);
    expect(signProblem({ complaints: "Yo'tal" })).toMatch(/tashxis/);
    expect(signProblem({ complaints: "Yo'tal", preliminaryDiagnosis: "ORVI" })).toBeNull();
    expect(signProblem({ complaints: "Yo'tal", finalDiagnosis: "Bronxit" })).toBeNull();
  });

  it("knows an empty record", () => {
    expect(isRecordEmpty({})).toBe(true);
    expect(isRecordEmpty({ anamnesis: "  " })).toBe(true);
    expect(isRecordEmpty({ anamnesis: "x" })).toBe(false);
  });
});

describe("changes between versions", () => {
  it("lists changed fields in form order, ignoring surrounding space", () => {
    const before = { complaints: "A", finalDiagnosis: "B", recommendations: null };
    const after = { complaints: " A ", finalDiagnosis: "C", recommendations: "Dam olish" };
    const changed = changedFields(before, after);
    expect(changed).toEqual(["finalDiagnosis", "recommendations"]);
    expect(fieldList(changed)).toBe("Yakuniy tashxis, Tavsiyalar");
  });

  it("picks the six texts and the two MKB-10 codes", () => {
    expect(Object.keys(pickFields({ complaints: "x" }))).toHaveLength(8);
    expect(pickFields({ finalDiagnosisCode: "I10" }).finalDiagnosisCode).toBe("I10");
  });

  it("a changed MKB-10 code is a change, named in the log (B3.4)", () => {
    const changed = changedFields({ finalDiagnosis: "Gipertoniya", finalDiagnosisCode: null }, { finalDiagnosis: "Gipertoniya", finalDiagnosisCode: "I10" });
    expect(changed).toEqual(["finalDiagnosisCode"]);
    expect(fieldList(changed)).toBe("Yakuniy tashxis MKB-10 kodi");
  });

  it("a coded diagnosis without text still allows signing", () => {
    expect(signProblem({ complaints: "Bosh og'rig'i", finalDiagnosisCode: "G43.9" })).toBeNull();
  });
});

describe("diagnosis history", () => {
  it("carries the code, and keeps a coded diagnosis with no text", () => {
    const list = diagnosisHistory([
      record({ id: "a", date: "2026-10-01", finalDiagnosis: "Gipertoniya", finalDiagnosisCode: "I10" }),
      record({ id: "b", date: "2026-10-02", preliminaryDiagnosisCode: "J06.9" }),
    ]);
    expect(list.map((d) => [d.recordId, d.kind, d.code, d.text])).toEqual([
      ["b", "preliminary", "J06.9", ""],
      ["a", "final", "I10", "Gipertoniya"],
    ]);
  });

  it("takes the final diagnosis, else the preliminary, from signed records only, newest first", () => {
    const list = diagnosisHistory([
      record({ id: "old", date: "2026-10-01", finalDiagnosis: "Migren" }),
      record({ id: "draft", status: "draft", date: "2026-11-05", finalDiagnosis: "Qoralama tashxis" }),
      record({ id: "new", date: "2026-11-03", preliminaryDiagnosis: "Gipertoniya?" }),
      record({ id: "none", date: "2026-11-04" }),
    ]);
    expect(list.map((d) => [d.recordId, d.kind, d.text])).toEqual([
      ["new", "preliminary", "Gipertoniya?"],
      ["old", "final", "Migren"],
    ]);
  });
});

describe("field validation", () => {
  it("trims, turns blanks into null, and caps length", () => {
    const parsed = recordFieldsSchema.parse({ complaints: "  Yo'tal  ", anamnesis: "   " });
    expect(parsed.complaints).toBe("Yo'tal");
    expect(parsed.anamnesis).toBeNull();
    expect(recordFieldsSchema.safeParse({ examination: "x".repeat(4001) }).success).toBe(false);
  });
});
