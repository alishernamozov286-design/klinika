/**
 * B1.8 (TZ §12): two-factor sign-in. Adds user_mfa — one row per user who has
 * switched on an authenticator app.
 *
 *   npm run db:mfa
 *
 * Additive only, safe to run again. Until it has run nobody can enrol, but
 * sign-in works exactly as before, and the "2FA is mandatory for role X"
 * setting cannot be saved (it would send staff to an enrolment screen that
 * has nowhere to store the result).
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
  CREATE TABLE IF NOT EXISTS user_mfa (
    user_id         varchar     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret          text        NOT NULL,
    last_used_step  integer     NOT NULL DEFAULT 0,
    recovery_codes  text[]      NOT NULL DEFAULT '{}'::text[],
    enabled_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz,
    updated_by      varchar
  )`);
console.log("  ok  user_mfa");

await pool.end();
console.log("\nTayyor.");
