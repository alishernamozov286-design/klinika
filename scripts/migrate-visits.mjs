/**
 * B2.5 (TZ §10 `visits`): one visit per patient per day, and orders.visit_id.
 *
 *   npm run db:visits
 *
 * Adds the table and the column, then gives every existing order the visit of
 * its own day, in the database's local time zone — the same day the reports
 * already count it under. Re-running is harmless: visits are unique per
 * patient and day, and only orders without a visit are touched.
 *
 * Must run BEFORE the new server code starts, which writes and reads
 * orders.visit_id.
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
  CREATE TABLE IF NOT EXISTS visits (
    id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  varchar NOT NULL,
    visit_date  text    NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  varchar
  )`);
await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_visits_patient_day" ON visits (patient_id, visit_date)`);
console.log("  ok  visits");

await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS visit_id varchar`);
await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_visit" ON orders (visit_id)`);
console.log("  ok  orders.visit_id");

console.log("Eski buyurtmalar:");
const day = `to_char((o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date, 'YYYY-MM-DD')`;
const created = await pool.query(`
  INSERT INTO visits (patient_id, visit_date, created_at, created_by)
  SELECT o.patient_id, ${day}, min(o.created_at), (array_agg(o.created_by ORDER BY o.created_at))[1]
  FROM orders o
  WHERE o.visit_id IS NULL
  GROUP BY o.patient_id, ${day}
  ON CONFLICT (patient_id, visit_date) DO NOTHING`);
const linked = await pool.query(`
  UPDATE orders o SET visit_id = v.id
  FROM visits v
  WHERE o.visit_id IS NULL AND v.patient_id = o.patient_id AND v.visit_date = ${day}`);
console.log(`  ok  ${created.rowCount} ta tashrif yaratildi, ${linked.rowCount} ta buyurtma bog'landi`);

await pool.end();
console.log("\nTayyor.");
