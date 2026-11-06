import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import { BLOCKING_TABLES, PATIENT_LINKS, patientHistoryProblem } from "./patient-links";

/** Every table in the schema that points at a patient. */
const linked = Object.values(schema)
  .filter((v): v is PgTable => v instanceof PgTable)
  .map((t) => getTableConfig(t))
  .filter((c) => c.columns.some((col) => col.name === "patient_id"))
  .map((c) => c.name)
  .sort();

describe("single patient identity (TZ §4.2, §16.1, B1.9)", () => {
  it("finds the patient-linked tables at all", () => {
    expect(linked).toContain("orders");
    expect(linked.length).toBeGreaterThanOrEqual(6);
  });

  it("registers every table with a patient_id, so merge and delete cover it", () => {
    // A new module's table lands here first. Add it to PATIENT_LINKS and to
    // mergePatients / deletePatient in both stores.
    expect(linked).toEqual(Object.keys(PATIENT_LINKS).sort());
  });

  it("links through the uuid and never through the printed number", () => {
    const offenders = Object.values(schema)
      .filter((v): v is PgTable => v instanceof PgTable)
      .map((t) => getTableConfig(t))
      .filter((c) => c.name !== "patients" && c.columns.some((col) => col.name === "patient_number"))
      .map((c) => c.name);
    expect(offenders).toEqual([]);
  });

  it("explains which history keeps a card from being deleted", () => {
    expect(patientHistoryProblem({})).toBeNull();
    expect(patientHistoryProblem({ orders: 0, appointments: 0 })).toBeNull();
    const msg = patientHistoryProblem({ orders: 2, patient_allergies: 1 });
    expect(msg).toMatch(/laboratoriya buyurtmalari, allergiyalar/);
    expect(msg).toMatch(/birlashtiring/);
    expect(BLOCKING_TABLES).toEqual(["orders", "appointments", "medical_records", "patient_allergies", "referrals"]);
  });
});
