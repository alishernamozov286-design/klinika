import { describe, expect, it } from "vitest";
import { blankLine, describeLine, lineDirections, prescriptionProblem, sameTreatment, treatmentHistory, treatmentSummary } from "./prescription";
import { changedFields, fieldList, signProblem } from "./medical-record";
import { prescriptionLineSchema, recordFieldsSchema, saveRecordSchema, type PrescriptionLine } from "./schema";

const med = (over: Partial<PrescriptionLine> = {}): PrescriptionLine => ({
  ...blankLine("medicine"),
  id: "m1",
  name: "Paratsetamol",
  dose: "500 mg",
  regimen: "Kuniga 3 marta",
  days: 5,
  ...over,
});
const proc = (over: Partial<PrescriptionLine> = {}): PrescriptionLine => ({ ...blankLine("procedure"), id: "p1", name: "Fizioterapiya", regimen: "Har kuni", sessions: 10, ...over });

describe("treatment and prescription (B3.6, TZ §5.1.5)", () => {
  it("a draft may hold half-written lines; signing needs each one complete", () => {
    expect(prescriptionProblem([])).toBeNull();
    expect(prescriptionProblem([med(), proc()])).toBeNull();
    expect(prescriptionProblem([med({ name: " " })])).toBe("Davolash, 1-qator: dori nomini kiriting");
    expect(prescriptionProblem([med(), med({ id: "m2", dose: null })])).toBe("Davolash, 2-qator (Paratsetamol): dozani kiriting");
    expect(prescriptionProblem([proc({ regimen: "" })])).toMatch(/qabul qilish tartibini/);
    // A procedure has no dose.
    expect(prescriptionProblem([proc({ dose: null })])).toBeNull();
    // Duration is optional: "kerak bo'lganda" has none.
    expect(prescriptionProblem([med({ days: null, regimen: "Kerak bo'lganda" })])).toBeNull();
  });

  it("signing a record checks its treatment too", () => {
    const base = { complaints: "Isitma", preliminaryDiagnosis: "O'RVI" };
    expect(signProblem({ ...base, prescriptions: [med()] })).toBeNull();
    expect(signProblem({ ...base, prescriptions: [med({ dose: "" })] })).toMatch(/dozani/);
  });

  it("a changed treatment is a change, named in the log; ids and spacing are not", () => {
    expect(sameTreatment([med()], [med({ id: "other", name: " Paratsetamol " })])).toBe(true);
    expect(sameTreatment([med()], [med({ days: 7 })])).toBe(false);
    expect(sameTreatment([med(), proc()], [proc(), med()])).toBe(false);
    const changed = changedFields({ recommendations: "Ko'p suyuqlik", prescriptions: [] }, { recommendations: "Ko'p suyuqlik ichish", prescriptions: [med()] });
    expect(changed).toEqual(["prescriptions", "recommendations"]);
    expect(fieldList(changed)).toBe("Davolash (retsept), Tavsiyalar");
    // A text-only save says nothing about the treatment.
    expect(changedFields({ complaints: "a", prescriptions: [med()] }, { complaints: "b" })).toEqual(["complaints"]);
  });

  it("reads like a prescription", () => {
    expect(lineDirections(med())).toBe("500 mg · Ichishga · Kuniga 3 marta · 5 kun");
    expect(describeLine(proc())).toBe("Fizioterapiya — Har kuni · 10 seans");
    expect(treatmentSummary([med(), med({ id: "m2" }), proc()])).toBe("2 ta dori, 1 ta muolaja");
    expect(treatmentSummary([])).toBe("davolash belgilanmagan");
  });

  it("the history takes signed records only, newest first", () => {
    const r = (id: string, status: string, date: string, prescriptions: PrescriptionLine[]) => ({ id, status, date, doctorName: "Dr", specialty: "Terapevt", version: 1, prescriptions });
    const h = treatmentHistory([r("a", "signed", "2026-11-01", [med()]), r("b", "draft", "2026-11-10", [med()]), r("c", "signed", "2026-11-05", [proc()]), r("d", "signed", "2026-11-07", [])]);
    expect(h.map((e) => e.recordId)).toEqual(["c", "a"]);
  });

  it("validates a line and caps the list", () => {
    expect(prescriptionLineSchema.parse({ id: "x", kind: "medicine", name: " Ibuprofen ", dose: "  ", days: 3 })).toMatchObject({ name: "Ibuprofen", dose: null, itemId: null, days: 3 });
    expect(prescriptionLineSchema.safeParse({ id: "x", kind: "medicine", name: "A", days: 0 }).success).toBe(false);
    expect(prescriptionLineSchema.safeParse({ id: "x", kind: "pill", name: "A" }).success).toBe(false);
    expect(prescriptionLineSchema.safeParse({ id: "x", kind: "medicine", name: "A", route: "nose" }).success).toBe(false);
    expect(recordFieldsSchema.safeParse({ prescriptions: Array.from({ length: 31 }, (_, i) => ({ id: `l${i}`, kind: "medicine", name: "A" })) }).success).toBe(false);
    // A draft save without the treatment leaves it alone.
    expect(saveRecordSchema.parse({ revision: 0, complaints: "x" })).not.toHaveProperty("prescriptions");
    expect(recordFieldsSchema.parse({}).prescriptions).toEqual([]);
  });
});
