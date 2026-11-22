/**
 * B6.1 (TZ §8, §10 "beds"): wards of inpatient departments and their beds.
 *
 *   npm run db:inpatient
 *
 * Additive and safe to run again. Nothing else reads these tables yet, so it
 * can run before or after the code. Grants the new "Statsionar" permissions
 * to the system roles (only ever adds).
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
  rahbar: ["inpatient.read", "beds.manage", "beds.state"],
  shifokor: ["inpatient.read"],
  registrator: ["inpatient.read"],
  hamshira: ["inpatient.read", "beds.state"],
  auditor: ["inpatient.read"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS wards (
      id             varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      department_id  varchar     NOT NULL REFERENCES departments (id),
      name           text        NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
      floor          integer,
      gender         text        NOT NULL DEFAULT 'mixed' CHECK (gender IN ('mixed', 'male', 'female')),
      day_price      integer     NOT NULL DEFAULT 0 CHECK (day_price >= 0),
      note           text,
      is_active      boolean     NOT NULL DEFAULT true,
      created_at     timestamptz NOT NULL DEFAULT now(),
      created_by     varchar,
      updated_at     timestamptz,
      updated_by     varchar
    )`);
  // Case and spacing do not make a different ward (shared/inpatient.ts labelKey).
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wards_name" ON wards (department_id, lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')))`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_wards_department" ON wards (department_id)`);
  console.log("  ok  wards");
  await client.query(`
    CREATE TABLE IF NOT EXISTS beds (
      id                     varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      ward_id                varchar     NOT NULL REFERENCES wards (id),
      label                  text        NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 10),
      state                  text        NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'cleaning', 'maintenance')),
      state_note             text,
      state_changed_at       timestamptz,
      state_changed_by       varchar,
      state_changed_by_name  text,
      note                   text,
      is_active              boolean     NOT NULL DEFAULT true,
      created_at             timestamptz NOT NULL DEFAULT now(),
      created_by             varchar,
      updated_at             timestamptz,
      updated_by             varchar,
      -- Out of service always says why.
      CONSTRAINT "CK_beds_maintenance" CHECK (state <> 'maintenance' OR state_note IS NOT NULL)
    )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_beds_label" ON beds (ward_id, lower(btrim(label)))`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_beds_ward" ON beds (ward_id)`);
  console.log("  ok  beds");

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
