/**
 * B8.3: the record of automatic backups — when, where, how big, and whether
 * the restore check passed. Written by `npm run db:backup -- --record` (the
 * nightly GitHub Actions job); Sozlamalar → Zaxira reads it.
 *
 *   npm run db:backup-runs
 *
 * Additive and safe to run again. Run it before the first recorded backup.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — nothing to load
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id               varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      started_at       timestamptz NOT NULL,
      finished_at      timestamptz,
      status           text        NOT NULL CHECK (status IN ('ok', 'failed')),
      location         text,
      file_name        text,
      size_bytes       bigint,
      tables           integer,
      rows             integer,
      restore_checked  boolean     NOT NULL DEFAULT false,
      restore_ok       boolean,
      restore_details  jsonb,
      error            text,
      CONSTRAINT "CK_backup_runs_failed" CHECK (status = 'ok' OR error IS NOT NULL)
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_backup_runs_started" ON backup_runs (started_at DESC)`);
  await client.query("COMMIT");
  console.log("  ok  backup_runs\n\nTayyor.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Xato, hech narsa o'zgarmadi:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
