/**
 * B4.8 (TZ §6.5): quality control — control materials and series, QC runs
 * with their Westgard verdict, calibration history, analyzer maintenance and
 * external (interlaboratory) QC.
 *
 *   npm run db:qc
 *
 * Additive and safe to run again: six new tables, their indexes, and the new
 * permissions added to the built-in roles (nothing else in a role is touched).
 * Until it runs the Sifat nazorati screen is empty and saving answers 503.
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
  laborant: ["qc.read", "qc.enter"],
  lab_mudiri: ["qc.read", "qc.enter", "qc.manage"],
  rahbar: ["qc.read"],
  auditor: ["qc.read"],
};

const TABLES = {
  qc_materials: `
    CREATE TABLE IF NOT EXISTS qc_materials (
      id            varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      name          text        NOT NULL,
      manufacturer  text,
      lot_number    text        NOT NULL,
      level         text        NOT NULL,
      expires_on    text        NOT NULL,
      is_active     boolean     NOT NULL DEFAULT true,
      notes         text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      created_by    varchar,
      updated_at    timestamptz,
      updated_by    varchar
    )`,
  qc_targets: `
    CREATE TABLE IF NOT EXISTS qc_targets (
      id           varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id  varchar          NOT NULL,
      test_id      varchar          NOT NULL,
      device_id    varchar,
      mean         double precision NOT NULL,
      sd           double precision NOT NULL CHECK (sd > 0),
      unit         text,
      is_active    boolean          NOT NULL DEFAULT true,
      created_at   timestamptz      NOT NULL DEFAULT now(),
      created_by   varchar,
      updated_at   timestamptz,
      updated_by   varchar
    )`,
  qc_results: `
    CREATE TABLE IF NOT EXISTS qc_results (
      id                  varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      target_id           varchar          NOT NULL,
      value               double precision NOT NULL,
      mean                double precision NOT NULL,
      sd                  double precision NOT NULL,
      z                   double precision NOT NULL,
      rules               text[]           NOT NULL DEFAULT '{}'::text[],
      status              text             NOT NULL,
      measured_at         timestamptz      NOT NULL,
      reagent_lot         text,
      reagent_expires_on  text,
      comment             text,
      entered_by          varchar,
      entered_by_name     text,
      created_at          timestamptz      NOT NULL DEFAULT now(),
      reviewed_at         timestamptz,
      reviewed_by         varchar,
      reviewed_by_name    text,
      corrective_action   text,
      voided_at           timestamptz,
      voided_by           varchar,
      voided_by_name      text,
      void_reason         text
    )`,
  calibrations: `
    CREATE TABLE IF NOT EXISTS calibrations (
      id                     varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id              varchar     NOT NULL,
      test_id                varchar,
      performed_at           timestamptz NOT NULL,
      calibrator_name        text        NOT NULL,
      calibrator_lot         text,
      calibrator_expires_on  text,
      reagent_lot            text,
      reagent_expires_on     text,
      result                 text        NOT NULL,
      notes                  text,
      performed_by           varchar,
      performed_by_name      text,
      created_at             timestamptz NOT NULL DEFAULT now()
    )`,
  device_maintenance: `
    CREATE TABLE IF NOT EXISTS device_maintenance (
      id                 varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id          varchar     NOT NULL,
      performed_at       timestamptz NOT NULL,
      kind               text        NOT NULL,
      description        text        NOT NULL,
      next_due_on        text,
      performed_by       varchar,
      performed_by_name  text,
      created_at         timestamptz NOT NULL DEFAULT now()
    )`,
  eqa_results: `
    CREATE TABLE IF NOT EXISTS eqa_results (
      id               varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      provider         text             NOT NULL,
      cycle            text             NOT NULL,
      sample_code      text,
      test_id          varchar          NOT NULL,
      device_id        varchar,
      sample_date      text             NOT NULL,
      reported_value   double precision NOT NULL,
      assigned_value   double precision NOT NULL,
      sdpa             double precision NOT NULL CHECK (sdpa > 0),
      z                double precision NOT NULL,
      evaluation       text             NOT NULL,
      notes            text,
      entered_by       varchar,
      entered_by_name  text,
      created_at       timestamptz      NOT NULL DEFAULT now(),
      voided_at        timestamptz,
      voided_by        varchar,
      voided_by_name   text,
      void_reason      text
    )`,
};

const INDEXES = [
  // One series per material, test and device (a missing device counts as one value).
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_qc_targets_series" ON qc_targets (material_id, test_id, coalesce(device_id, ''))`,
  `CREATE INDEX IF NOT EXISTS "IDX_qc_results_target" ON qc_results (target_id, measured_at)`,
  `CREATE INDEX IF NOT EXISTS "IDX_calibrations_device" ON calibrations (device_id, performed_at)`,
  `CREATE INDEX IF NOT EXISTS "IDX_device_maintenance_device" ON device_maintenance (device_id, performed_at)`,
];

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  for (const [name, ddl] of Object.entries(TABLES)) {
    await client.query(ddl);
    console.log(`  ok  ${name}`);
  }
  for (const ddl of INDEXES) await client.query(ddl);
  console.log("  ok  indekslar");

  console.log("\nRuxsatlar:");
  const hasRoles = (await client.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ok`)).rows[0].ok;
  if (!hasRoles) {
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
