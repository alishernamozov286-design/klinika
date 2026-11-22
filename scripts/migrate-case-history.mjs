/**
 * B6.4 (TZ §8.1.3 "Kasallik tarixi"): the case history of a stay — every save
 * a new version — and the daily observations of doctors and nurses.
 *
 *   npm run db:case-history
 *
 * Additive and safe to run again. Run it before deploying the code that reads
 * it (the case history page reads both tables). Grants inpatient.history and
 * inpatient.observe to shifokor, inpatient.observe to hamshira (only ever adds).
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

// Kept in step with SYSTEM_ROLES in shared/permissions.ts.
const GRANTS = {
  shifokor: ["inpatient.history", "inpatient.observe"],
  hamshira: ["inpatient.observe"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS case_history_versions (
      id              varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    varchar     NOT NULL REFERENCES admissions (id),
      version         integer     NOT NULL CHECK (version >= 1),
      complaints      text        CHECK (length(complaints) <= 4000),
      anamnesis       text        CHECK (length(anamnesis) <= 4000),
      examination     text        CHECK (length(examination) <= 4000),
      diagnosis       text        CHECK (length(diagnosis) <= 4000),
      diagnosis_code  varchar,
      treatment_plan  text        CHECK (length(treatment_plan) <= 4000),
      saved_at        timestamptz NOT NULL DEFAULT now(),
      saved_by        varchar,
      saved_by_name   text
    )`);
  // Two saves on the same version: one wins, the other is told to reload.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_case_history_versions" ON case_history_versions (admission_id, version)`);
  console.log("  ok  case_history_versions (har saqlash — yangi versiya)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS admission_observations (
      id              varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id    varchar          NOT NULL REFERENCES admissions (id),
      observed_at     timestamptz      NOT NULL,
      temperature     double precision CHECK (temperature BETWEEN 30 AND 45),
      pulse           integer          CHECK (pulse BETWEEN 20 AND 250),
      systolic        integer          CHECK (systolic BETWEEN 50 AND 300),
      diastolic       integer          CHECK (diastolic BETWEEN 20 AND 200),
      respiration     integer          CHECK (respiration BETWEEN 4 AND 80),
      spo2            integer          CHECK (spo2 BETWEEN 50 AND 100),
      note            text             CHECK (length(note) <= 4000),
      author_id       varchar,
      author_name     text,
      author_role     text,
      created_at      timestamptz      NOT NULL DEFAULT now(),
      voided_at       timestamptz,
      voided_by       varchar,
      voided_by_name  text,
      void_reason     text,
      -- Something was observed; blood pressure is both numbers or none.
      CONSTRAINT "CK_admission_observations_content" CHECK (
        coalesce(temperature::text, pulse::text, systolic::text, respiration::text, spo2::text, note) IS NOT NULL
        AND (systolic IS NULL) = (diastolic IS NULL)
        AND (diastolic IS NULL OR diastolic < systolic)
      ),
      -- A struck-out reading says when, by whom and why.
      CONSTRAINT "CK_admission_observations_void" CHECK ((voided_at IS NULL) = (void_reason IS NULL))
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_admission_observations_admission" ON admission_observations (admission_id, observed_at)`);
  console.log("  ok  admission_observations (kundalik kuzatuv)");

  console.log("\nRuxsatlar:");
  const { rows: hasRoles } = await client.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ok`);
  if (!hasRoles[0].ok) {
    console.log("  —   roles jadvali yo'q (avval npm run db:roles); standart rollar koddan olinadi");
  } else {
    for (const [key, perms] of Object.entries(GRANTS)) {
      const { rows } = await client.query(
        `UPDATE roles
            SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || $2::text[]) ORDER BY 1)
          WHERE key = $1 AND is_system AND NOT (permissions @> $2::text[])
          RETURNING key`,
        [key, perms],
      );
      console.log(`  ${rows.length ? "ok " : "—  "} ${key}: ${perms.join(", ")}${rows.length ? "" : " (allaqachon bor)"}`);
    }
  }

  await client.query("COMMIT");
  console.log("\nTayyor.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Xato, hech narsa o'zgarmadi:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
