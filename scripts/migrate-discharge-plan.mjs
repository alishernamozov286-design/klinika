/**
 * B6.3 (TZ §8.1.1 "Chiqarilayotgan bemorlar"): the planned discharge day of a
 * stay, set by the doctor; the inpatient home page lists who leaves today and
 * tomorrow.
 *
 *   npm run db:discharge-plan
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every admission read names the column. Existing stays get NULL
 * (no plan). No new permissions.
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
  console.log("Yotqizishlar:");
  await client.query(`ALTER TABLE admissions ADD COLUMN IF NOT EXISTS planned_discharge_on text`);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_admissions_discharge_plan') THEN
        ALTER TABLE admissions ADD CONSTRAINT "CK_admissions_discharge_plan"
          CHECK (planned_discharge_on IS NULL OR planned_discharge_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
      END IF;
    END $$`);
  console.log("  ok  admissions.planned_discharge_on");
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
