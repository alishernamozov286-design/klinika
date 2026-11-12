/**
 * B5.6 (TZ §7.3, §11 Laboratoriya → Ombor): reagent consumption norms, the
 * consumption journal, and the link from each stock movement to it.
 *
 *   npm run db:consumption
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every stock movement insert now names `consumption_id`, and
 * verifying a result writes to lab_consumptions. Grants are only added.
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
  lab_mudiri: ["consumption.norms", "consumption.approve", "consumption.record"],
  laborant: ["inventory.read", "consumption.record"],
  omborchi: ["consumption.norms"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS consumption_norms (
      id                varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      test_id           varchar          NOT NULL,
      item_id           varchar          NOT NULL,
      quantity          double precision NOT NULL CHECK (quantity > 0),
      status            text             NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'retired')),
      notes             text,
      created_at        timestamptz      NOT NULL DEFAULT now(),
      created_by        varchar,
      created_by_name   text,
      updated_at        timestamptz,
      updated_by        varchar,
      approved_at       timestamptz,
      approved_by       varchar,
      approved_by_name  text,
      retired_at        timestamptz,
      retired_by        varchar,
      retired_by_name   text,
      retire_reason     text,
      CONSTRAINT "CK_consumption_norms_state" CHECK (
        (status = 'draft' AND approved_at IS NULL AND retired_at IS NULL) OR
        (status = 'approved' AND approved_at IS NOT NULL AND retired_at IS NULL) OR
        (status = 'retired' AND retired_at IS NOT NULL AND retire_reason IS NOT NULL)
      )
    )`);
  // One draft and one norm in force per test and item.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_consumption_norms_live" ON consumption_norms (test_id, item_id, status) WHERE status IN ('draft', 'approved')`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_consumption_norms_test" ON consumption_norms (test_id)`);
  console.log("  ok  consumption_norms");
  await client.query(`
    CREATE TABLE IF NOT EXISTS lab_consumptions (
      id                 varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      kind               text             NOT NULL CHECK (kind IN ('norm', 'extra')),
      order_id           varchar,
      order_test_id      varchar,
      test_id            varchar,
      item_id            varchar          NOT NULL,
      norm_id            varchar,
      quantity           double precision NOT NULL CHECK (quantity > 0),
      posted             double precision NOT NULL DEFAULT 0,
      reason             text,
      note               text,
      created_at         timestamptz      NOT NULL DEFAULT now(),
      created_by         varchar,
      created_by_name    text,
      settled_at         timestamptz,
      settled_by_name    text,
      cancelled_at       timestamptz,
      cancelled_by       varchar,
      cancelled_by_name  text,
      cancel_reason      text,
      CONSTRAINT "CK_lab_consumptions_posted" CHECK (posted >= 0 AND posted <= quantity + 1e-9),
      CONSTRAINT "CK_lab_consumptions_kind" CHECK (
        (kind = 'norm' AND order_test_id IS NOT NULL AND norm_id IS NOT NULL AND cancelled_at IS NULL) OR
        (kind = 'extra' AND reason IS NOT NULL)
      )
    )`);
  // A verified line consumes each item once, whichever path (verification or reconcile) gets there first.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lab_consumptions_norm" ON lab_consumptions (order_test_id, item_id) WHERE kind = 'norm'`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_lab_consumptions_created" ON lab_consumptions (created_at)`);
  console.log("  ok  lab_consumptions");
  await client.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS consumption_id varchar`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_movements_consumption" ON stock_movements (consumption_id) WHERE consumption_id IS NOT NULL`);
  console.log("  ok  stock_movements.consumption_id");

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
