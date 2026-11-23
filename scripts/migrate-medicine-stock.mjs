/**
 * B6.6b (TZ §8.2 "Dori tayinlovlari ombor bilan bog'lanadi"): a stocked
 * medicine's dose, given on the ward, leaves the warehouse — posted like a lab
 * consumption (B5.6: FEFO, a shortage for the storekeeper), as kind
 * "inpatient" on its procedure task; put back when the dose's mark is.
 *
 *   npm run db:medicine-stock
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: the nurse's list and the consumption journal name these columns.
 *
 *   inpatient_orders.issue_qty            units of the item one dose takes
 *   lab_consumptions.procedure_task_id    the dose an "inpatient" consumption is for
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
  console.log("Ustunlar:");
  await client.query(`ALTER TABLE inpatient_orders ADD COLUMN IF NOT EXISTS issue_qty double precision`);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_inpatient_orders_issue') THEN
        ALTER TABLE inpatient_orders ADD CONSTRAINT "CK_inpatient_orders_issue"
          CHECK (issue_qty IS NULL OR (issue_qty > 0 AND item_id IS NOT NULL));
      END IF;
    END $$`);
  console.log("  ok  inpatient_orders.issue_qty");
  await client.query(`ALTER TABLE lab_consumptions ADD COLUMN IF NOT EXISTS procedure_task_id varchar REFERENCES procedure_tasks (id)`);
  // The kind list and its shape rule now know the ward's doses.
  await client.query(`ALTER TABLE lab_consumptions DROP CONSTRAINT IF EXISTS "lab_consumptions_kind_check"`);
  await client.query(`ALTER TABLE lab_consumptions DROP CONSTRAINT IF EXISTS "CK_lab_consumptions_kind"`);
  await client.query(`ALTER TABLE lab_consumptions ADD CONSTRAINT "CK_lab_consumptions_kind" CHECK (
        (kind = 'norm' AND order_test_id IS NOT NULL AND norm_id IS NOT NULL AND cancelled_at IS NULL) OR
        (kind = 'extra' AND reason IS NOT NULL) OR
        (kind = 'inpatient' AND procedure_task_id IS NOT NULL)
      )`);
  // A dose takes from the shelf once while its mark stands (put back and given again — a new row).
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lab_consumptions_dose" ON lab_consumptions (procedure_task_id) WHERE kind = 'inpatient' AND cancelled_at IS NULL`);
  console.log("  ok  lab_consumptions.procedure_task_id, CK_lab_consumptions_kind, UQ_lab_consumptions_dose");

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
