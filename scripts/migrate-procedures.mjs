/**
 * B6.5 (TZ §8.1.4 "Muolajalar"): doctors' orders for a stay and their
 * schedule — one row per dose, marked by the nurse.
 *
 *   npm run db:procedures
 *
 * Additive and safe to run again. Run it before deploying the code that reads
 * it (the case history page and the nurse's list read both tables; cancelling
 * a stay writes them). Grants procedures.prescribe to shifokor and
 * procedures.perform to hamshira (only ever adds).
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
  shifokor: ["procedures.prescribe"],
  hamshira: ["procedures.perform"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS inpatient_orders (
      id                  varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id        varchar     NOT NULL REFERENCES admissions (id),
      kind                text        NOT NULL CHECK (kind IN ('medicine', 'procedure')),
      item_id             varchar     REFERENCES inventory_items (id),
      service_id          varchar     REFERENCES services (id),
      name                text        NOT NULL CHECK (length(btrim(name)) > 0),
      dose                text,
      route               text,
      times               text[]      NOT NULL CHECK (cardinality(times) BETWEEN 1 AND 8),
      start_on            text        NOT NULL CHECK (start_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
      days                integer     NOT NULL CHECK (days BETWEEN 1 AND 60),
      note                text,
      status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stopped')),
      prescribed_by       varchar,
      prescribed_by_name  text,
      created_at          timestamptz NOT NULL DEFAULT now(),
      stopped_at          timestamptz,
      stopped_by          varchar,
      stopped_by_name     text,
      stop_reason         text,
      -- A medicine has a dose and no service; a procedure no warehouse item.
      CONSTRAINT "CK_inpatient_orders_kind" CHECK (
        (kind = 'medicine' AND service_id IS NULL AND dose IS NOT NULL) OR (kind = 'procedure' AND item_id IS NULL)
      ),
      -- A stopped order says when and why.
      CONSTRAINT "CK_inpatient_orders_stop" CHECK ((status = 'stopped') = (stopped_at IS NOT NULL) AND (stopped_at IS NULL OR stop_reason IS NOT NULL))
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_inpatient_orders_admission" ON inpatient_orders (admission_id)`);
  console.log("  ok  inpatient_orders (tayinlovlar)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS procedure_tasks (
      id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id          varchar     NOT NULL REFERENCES inpatient_orders (id),
      admission_id      varchar     NOT NULL REFERENCES admissions (id),
      planned_at        timestamptz NOT NULL,
      status            text        NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'missed', 'cancelled')),
      done_at           timestamptz,
      done_by           varchar,
      done_by_name      text,
      note              text,
      reverted_at       timestamptz,
      reverted_by_name  text,
      revert_reason     text,
      -- Marked doses say when and by whom; a missed one, why.
      CONSTRAINT "CK_procedure_tasks_mark" CHECK (
        (status IN ('done', 'missed')) = (done_at IS NOT NULL)
        AND (status <> 'missed' OR note IS NOT NULL)
      ),
      CONSTRAINT "CK_procedure_tasks_revert" CHECK ((reverted_at IS NULL) = (revert_reason IS NULL))
    )`);
  // One dose per order and moment: a retried prescribe cannot double the schedule.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_procedure_tasks_slot" ON procedure_tasks (order_id, planned_at)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_procedure_tasks_planned" ON procedure_tasks (planned_at)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_procedure_tasks_admission" ON procedure_tasks (admission_id)`);
  console.log("  ok  procedure_tasks (jadval: har doza alohida)");

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
