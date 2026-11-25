/**
 * Side-effect module: loads .env into process.env and fixes the clinic's
 * time zone.
 *
 * ESM evaluates imports before any module body, so this must be imported
 * FIRST in server/index.ts and server/serverless.ts — otherwise storage.ts
 * would read DATABASE_URL before it exists and silently fall back to the JSON
 * store, and days would be cut on the wrong clock.
 *
 * Uses Node's built-in loader (>=20.6), so no dotenv dependency.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — that is fine, the app falls back to .data/db.json
}

/**
 * Every "today", every local day in a report and Postgres' day cuts
 * (SERVER_TZ in storage-pg) follow this process's clock. Hosting does not
 * run on the clinic's: Vercel's functions are on UTC, which put a 01:00
 * payment on the day before. The clinic's zone is set here, before anything
 * reads the clock. CLINIC_TZ overrides it (an IANA name, e.g. Asia/Samarkand).
 */
const zone = process.env.CLINIC_TZ?.trim() || "Asia/Tashkent";
process.env.TZ = /^[A-Za-z0-9_+\-/]+$/.test(zone) ? zone : "Asia/Tashkent";

export {};
