/**
 * B3.9 (TZ §11, acceptance 16.4): in-app notifications — a verified lab
 * result reaches the doctor who referred the patient.
 *
 *   npm run db:notifications
 *
 * Additive and safe to run again. Until it runs the bell stays empty and
 * releasing an order simply tells nobody; nothing else is affected.
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

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     varchar     NOT NULL,
      kind        text        NOT NULL,
      title       text        NOT NULL,
      body        text,
      link        text,
      entity_id   varchar,
      important   boolean     NOT NULL DEFAULT false,
      dedupe_key  text        UNIQUE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      read_at     timestamptz
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_user" ON notifications (user_id, created_at)`);
  await client.query("COMMIT");
  console.log("  ok  notifications\nTayyor.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Xato, hech narsa o'zgarmadi:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
