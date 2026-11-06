/**
 * B2.6–B2.7, B3.1: the service catalogue, the appointment book, and the
 * permissions that open them.
 *
 *   npm run db:appointments
 *
 * Additive and safe to run again:
 * - creates `services` and `appointments` with their indexes;
 * - adds the new permissions to the built-in roles that should have them.
 *   It only ever adds: a permission the clinic removed from a role on purpose
 *   is not removed again here, and nothing else in a role is touched.
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
  CREATE TABLE IF NOT EXISTS services (
    id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text        NOT NULL,
    kind              text        NOT NULL DEFAULT 'konsultatsiya',
    department_id     varchar,
    price             integer     NOT NULL DEFAULT 0,
    duration_minutes  integer,
    description       text,
    is_active         boolean     NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        varchar,
    updated_at        timestamptz,
    updated_by        varchar
  )`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_services_department" ON services (department_id)`);
console.log("  ok  services");

await pool.query(`
  CREATE TABLE IF NOT EXISTS appointments (
    id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        varchar     NOT NULL,
    doctor_id         varchar     NOT NULL,
    service_id        varchar,
    visit_id          varchar,
    date              text        NOT NULL,
    start_time        text        NOT NULL,
    duration_minutes  integer     NOT NULL,
    queue_number      integer     NOT NULL,
    status            text        NOT NULL DEFAULT 'scheduled',
    price             integer     NOT NULL DEFAULT 0,
    reason            text,
    arrived_at        timestamptz,
    started_at        timestamptz,
    completed_at      timestamptz,
    cancelled_at      timestamptz,
    cancelled_by      varchar,
    cancel_reason     text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        varchar,
    updated_at        timestamptz,
    updated_by        varchar
  )`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_appointments_date_doctor" ON appointments (date, doctor_id)`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_appointments_patient" ON appointments (patient_id)`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_appointments_queue" ON appointments (doctor_id, date, queue_number)`);
// One live booking per doctor and start time: the last line of defence
// against two registrars taking the same slot at the same moment.
await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS "UQ_appointments_slot" ON appointments (doctor_id, date, start_time)
  WHERE status NOT IN ('cancelled', 'no_show')`);
console.log("  ok  appointments");

// Kept in step with SYSTEM_ROLES in shared/permissions.ts.
const GRANTS = {
  rahbar: ["services.manage", "appointments.read"],
  registrator: ["appointments.read", "appointments.manage"],
  shifokor: ["appointments.serve"],
  kassir: ["appointments.read"],
  auditor: ["appointments.read"],
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
