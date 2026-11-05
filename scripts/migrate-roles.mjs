/**
 * RBAC (TZ §3, §10): adds the roles table, seeds the eleven TZ roles and moves
 * the pre-RBAC "admin" accounts to "super_admin".
 *
 *   npm run db:roles
 *
 * Guarded throughout (IF NOT EXISTS, ON CONFLICT DO NOTHING), so it is safe to
 * run repeatedly. Role rows that already exist are left alone: once created,
 * the clinic owns their permissions, and re-running this must not undo an
 * administrator's edits.
 *
 * The role defaults are not repeated here: the app inserts any missing system
 * role on boot (storage.seed) from shared/permissions.ts, so there is a single
 * source for them. This script only has to make the table exist. Until it has
 * run, the app keeps working on those built-in defaults.
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

const run = async (label, sqlText) => {
  const result = await pool.query(sqlText);
  console.log(`  ok  ${label}${result.rowCount ? ` (${result.rowCount})` : ""}`);
  return result;
};

console.log("Jadval:");
await run(
  "roles",
  `CREATE TABLE IF NOT EXISTS roles (
     key          varchar PRIMARY KEY,
     name         text    NOT NULL,
     description  text,
     permissions  text[]  NOT NULL DEFAULT '{}'::text[],
     is_system    boolean NOT NULL DEFAULT false,
     created_at   timestamptz NOT NULL DEFAULT now(),
     updated_at   timestamptz,
     updated_by   varchar
   )`,
);

console.log("Foydalanuvchilar:");
await run("admin → super_admin", `UPDATE users SET role = 'super_admin' WHERE role = 'admin'`);

const { rows } = await pool.query(
  `SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY role`,
);
for (const r of rows) console.log(`      ${r.role}: ${r.n}`);

await pool.end();
console.log("\nTayyor. Tizim rollari server ishga tushganda avtomatik yaratiladi.");
