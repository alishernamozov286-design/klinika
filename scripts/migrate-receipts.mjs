/**
 * B7.6 (TZ §15.7 "Chek"): what a receipt's chek prints beyond the receipt
 * itself — the cash handed over (for the change), the debt left right after
 * it, and how many times the chek was printed (every print after the first
 * is marked "NUSXA").
 *
 *   npm run db:receipts
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every receipt insert now names these columns. Existing receipts
 * keep tendered / due_after NULL (unknown, the chek leaves them out) and
 * print_count 0. No new permissions.
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
  console.log("Kvitansiyalar:");
  await client.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS tendered integer`);
  await client.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS due_after integer`);
  await client.query(`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS print_count integer NOT NULL DEFAULT 0`);
  // What was handed over is never less than what was taken; the debt left and the print count never negative.
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_invoice_payments_slip') THEN
        ALTER TABLE invoice_payments ADD CONSTRAINT "CK_invoice_payments_slip"
          CHECK ((tendered IS NULL OR tendered >= amount) AND (due_after IS NULL OR due_after >= 0) AND print_count >= 0);
      END IF;
    END $$`);
  console.log("  ok  tendered, due_after, print_count, CK_invoice_payments_slip");

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
