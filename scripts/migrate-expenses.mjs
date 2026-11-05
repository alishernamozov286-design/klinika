/**
 * Expenses, finished: payment method, payee, cancel-instead-of-delete
 * (TZ §10) and the edit stamp.
 *
 *   npm run db:expenses
 *
 * Adds columns only (ADD COLUMN IF NOT EXISTS), every one either nullable or
 * with a default that is true of the rows already there: they were all paid in
 * cash and are all active. Safe to run repeatedly.
 *
 * Unlike the earlier migrations this one must run BEFORE the new server code
 * starts: the app selects these columns, so the expenses and reports screens
 * fail until they exist.
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

const columns = [
  ["method", "text NOT NULL DEFAULT 'naqd'"],
  ["payee", "text"],
  ["status", "text NOT NULL DEFAULT 'active'"],
  ["cancelled_at", "timestamptz"],
  ["cancelled_by", "varchar"],
  ["cancelled_by_name", "text"],
  ["cancel_reason", "text"],
  ["updated_at", "timestamptz"],
  ["updated_by", "varchar"],
];

console.log("expenses ustunlari:");
for (const [name, type] of columns) {
  await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ${name} ${type}`);
  console.log(`  ok  ${name}`);
}
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_expenses_spent_on" ON expenses (spent_on)`);
console.log("  ok  spent_on index");

const { rows } = await pool.query(`SELECT count(*)::int AS n FROM expenses`);
console.log(`\nTayyor. ${rows[0].n} ta mavjud xarajat o'zgarishsiz qoldi (naqd, faol).`);
await pool.end();
