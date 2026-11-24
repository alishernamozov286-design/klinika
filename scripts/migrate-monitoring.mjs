/**
 * B8.4 (TZ §14): monitoring — request stats per hour and route, and the
 * error log grouped by where and what. Nothing in them identifies a patient.
 *
 *   npm run db:monitoring
 *
 * Additive and safe to run again. Run it before deploying the code that
 * writes them (every request adds to request_stats). Grants system.monitor to
 * rahbar (only ever adds).
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — nothing to load
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. Mahalliy JSON store xotirada yuritadi.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Kept in step with SYSTEM_ROLES in shared/permissions.ts.
const GRANTS = { rahbar: ["system.monitor"] };

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS request_stats (
      hour       timestamptz NOT NULL,
      method     text        NOT NULL,
      route      text        NOT NULL,
      count      integer     NOT NULL CHECK (count >= 0),
      total_ms   bigint      NOT NULL CHECK (total_ms >= 0),
      max_ms     integer     NOT NULL CHECK (max_ms >= 0),
      errors     integer     NOT NULL DEFAULT 0 CHECK (errors >= 0),
      histogram  integer[]   NOT NULL,
      PRIMARY KEY (hour, method, route)
    )`);
  console.log("  ok  request_stats (soat va yo'l bo'yicha)");
  await client.query(`
    CREATE TABLE IF NOT EXISTS error_groups (
      id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      fingerprint       text        NOT NULL,
      source            text        NOT NULL CHECK (source IN ('server', 'client')),
      location          text        NOT NULL,
      name              text        NOT NULL,
      message           text        NOT NULL,
      stack             text,
      count             integer     NOT NULL CHECK (count >= 1),
      first_seen        timestamptz NOT NULL,
      last_seen         timestamptz NOT NULL,
      last_status       integer,
      last_role         text,
      resolved_at       timestamptz,
      resolved_by       varchar,
      resolved_by_name  text
    )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_error_groups_fingerprint" ON error_groups (fingerprint)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_error_groups_last_seen" ON error_groups (last_seen DESC)`);
  console.log("  ok  error_groups (xatolar jurnali)");

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
