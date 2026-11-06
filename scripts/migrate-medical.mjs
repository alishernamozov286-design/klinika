/**
 * B3.2–B3.3 (TZ §5): examination records, their replaced versions, and
 * patient allergies — plus the permissions that open them.
 *
 *   npm run db:medical
 *
 * Additive and safe to run again. It only ever adds permissions to the
 * built-in roles; a permission the clinic removed from a role on purpose is
 * not put back, and nothing else in a role is touched.
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

console.log("Jadvallar:");
await pool.query(`
  CREATE TABLE IF NOT EXISTS medical_records (
    id                     varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             varchar     NOT NULL,
    appointment_id         varchar     NOT NULL,
    doctor_id              varchar     NOT NULL,
    visit_id               varchar,
    status                 text        NOT NULL DEFAULT 'draft',
    version                integer     NOT NULL DEFAULT 1,
    revision               integer     NOT NULL DEFAULT 0,
    complaints             text,
    anamnesis              text,
    examination            text,
    preliminary_diagnosis  text,
    final_diagnosis        text,
    recommendations        text,
    signed_at              timestamptz,
    signed_by              varchar,
    amended_at             timestamptz,
    amend_reason           text,
    created_at             timestamptz NOT NULL DEFAULT now(),
    created_by             varchar,
    updated_at             timestamptz,
    updated_by             varchar
  )`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medical_records_appointment" ON medical_records (appointment_id)`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_medical_records_patient" ON medical_records (patient_id)`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_medical_records_doctor_status" ON medical_records (doctor_id, status)`);
console.log("  ok  medical_records");

await pool.query(`
  CREATE TABLE IF NOT EXISTS medical_record_versions (
    id                     varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id              varchar     NOT NULL,
    version                integer     NOT NULL,
    complaints             text,
    anamnesis              text,
    examination            text,
    preliminary_diagnosis  text,
    final_diagnosis        text,
    recommendations        text,
    signed_at              timestamptz,
    signed_by              varchar,
    replaced_at            timestamptz NOT NULL DEFAULT now(),
    replaced_by            varchar,
    replace_reason         text        NOT NULL
  )`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medical_record_versions" ON medical_record_versions (record_id, version)`);
console.log("  ok  medical_record_versions");

await pool.query(`
  CREATE TABLE IF NOT EXISTS patient_allergies (
    id             varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     varchar     NOT NULL,
    allergen       text        NOT NULL,
    reaction       text,
    is_active      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    created_by     varchar,
    removed_at     timestamptz,
    removed_by     varchar,
    remove_reason  text
  )`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_patient" ON patient_allergies (patient_id)`);
console.log("  ok  patient_allergies");

// Kept in step with SYSTEM_ROLES in shared/permissions.ts.
const GRANTS = {
  shifokor: ["records.read", "records.write", "records.sign", "records.amend"],
  rahbar: ["records.read"],
};

console.log("\nRuxsatlar:");
const hasRoles = (await pool.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ok`)).rows[0].ok;
if (!hasRoles) {
  console.log("  —   roles jadvali yo'q (avval npm run db:roles); standart rollar koddan olinadi");
} else {
  for (const [key, perms] of Object.entries(GRANTS)) {
    const { rows } = await pool.query(
      `UPDATE roles
          SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || $2::text[]) ORDER BY 1)
        WHERE key = $1 AND is_system AND NOT (permissions @> $2::text[])
        RETURNING key`,
      [key, perms],
    );
    console.log(`  ${rows.length ? "ok " : "—  "} ${key}: ${perms.join(", ")}${rows.length ? "" : " (allaqachon bor)"}`);
  }
}

await pool.end();
console.log("\nTayyor.");
