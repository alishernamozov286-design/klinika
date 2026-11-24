/**
 * B8.1 (TZ §14): the real-time change feed — one version number per topic,
 * moved on by every successful write, read by each open tab every few seconds.
 * It holds no patient data: topic names, numbers and a time.
 *
 *   npm run db:realtime
 *
 * Additive and safe to run again. Until it runs, the app works as before: the
 * feed answers "not available" and the pages refresh on their own timers.
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

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS change_topics (
      topic       text        PRIMARY KEY,
      version     bigint      NOT NULL DEFAULT 0 CHECK (version >= 0),
      changed_at  timestamptz NOT NULL DEFAULT now()
    )`);
  console.log("  ok  change_topics (o'zgarishlar versiyasi)");
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
