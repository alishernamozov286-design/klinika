/**
 * B2.1–B2.3 (TZ §4.1.2, §10): birth date, passport, JShShIR and the edit stamp
 * on patients, plus the patient_contacts table for the emergency contact.
 *
 *   npm run db:patients
 *
 * Additive only: new nullable columns, a new table, indexes. Existing patients
 * are untouched. Must run BEFORE the new server code starts, which selects
 * these columns.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — nothing to load
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. Mahalliy JSON store o'zi yangilanadi.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("patients ustunlari:");
for (const [name, type] of [
  ["birth_date", "text"],
  ["passport", "text"],
  ["pinfl", "text"],
  ["updated_at", "timestamptz"],
  ["updated_by", "varchar"],
]) {
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS ${name} ${type}`);
  console.log(`  ok  ${name}`);
}
// Duplicate checks look these up on every registration.
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_patients_pinfl" ON patients (pinfl) WHERE pinfl IS NOT NULL`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_patients_passport" ON patients (passport) WHERE passport IS NOT NULL`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_patient" ON orders (patient_id)`);
console.log("  ok  indekslar");

console.log("Jadval:");
await pool.query(`
  CREATE TABLE IF NOT EXISTS patient_contacts (
    id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id    varchar NOT NULL,
    name          text    NOT NULL,
    relation      text,
    phone         text    NOT NULL,
    is_emergency  boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
  )`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_contacts_patient" ON patient_contacts (patient_id)`);
console.log("  ok  patient_contacts");

const { rows } = await pool.query(`SELECT count(*)::int AS n FROM patients`);
console.log(`\nTayyor. ${rows[0].n} ta mavjud bemor o'zgarishsiz qoldi.`);
await pool.end();
