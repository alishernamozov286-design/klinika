/**
 * B1.7 (TZ §12): adds app_settings, the key-value table that holds the
 * session policy (and, later, other system-wide settings).
 *
 *   npm run db:security
 *
 * Additive only. Until it has run, the app enforces the default policy
 * (30 minutes idle, 12 hours absolute); only saving a different policy needs
 * the table.
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

console.log("Jadval:");
await pool.query(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key         varchar PRIMARY KEY,
    value       json    NOT NULL,
    updated_at  timestamptz,
    updated_by  varchar
  )`);
console.log("  ok  app_settings");

await pool.end();
console.log("\nTayyor.");
