/**
 * B6.6 (TZ §8.2 "Xizmatlar kassa hisobiga yuboriladi"): an inpatient stay on
 * the patient's bill — bed-days at each ward's frozen price, procedures done
 * at their ordered price — and lab orders placed from the case history.
 *
 *   npm run db:stay-billing
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every bill and the debtors list read these columns.
 *
 *   admissions.visit_id, admissions.discount   the bill the stay is on; its discount
 *   admission_beds.day_price                   the ward's price when the period opened
 *   inpatient_orders.unit_price                a procedure's price when ordered
 *   payments.admission_id                      a share paid on the stay line
 *   orders.admission_id                        a lab order placed for the stay
 *
 * Existing stays get the visit of their admission day (made if missing), their
 * periods the ward's present price, their procedure orders the service's
 * present price. CK_payments_target now allows exactly one of three targets.
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
// The clinic's day, as the app cuts it (server/storage-pg.ts SERVER_TZ).
const TZ = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Ustunlar:");
  await client.query(`ALTER TABLE admissions ADD COLUMN IF NOT EXISTS visit_id varchar REFERENCES visits (id)`);
  await client.query(`ALTER TABLE admissions ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0`);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_admissions_discount') THEN
        ALTER TABLE admissions ADD CONSTRAINT "CK_admissions_discount" CHECK (discount >= 0);
      END IF;
    END $$`);
  await client.query(`ALTER TABLE admission_beds ADD COLUMN IF NOT EXISTS day_price integer CHECK (day_price >= 0)`);
  await client.query(`ALTER TABLE inpatient_orders ADD COLUMN IF NOT EXISTS unit_price integer CHECK (unit_price >= 0)`);
  await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS admission_id varchar REFERENCES admissions (id)`);
  await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS admission_id varchar REFERENCES admissions (id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_admission" ON payments (admission_id) WHERE admission_id IS NOT NULL`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_admissions_visit" ON admissions (visit_id)`);
  // A payment pays exactly one thing: an order, an appointment or a stay.
  await client.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS "CK_payments_target"`);
  await client.query(`ALTER TABLE payments ADD CONSTRAINT "CK_payments_target"
    CHECK ((order_id IS NOT NULL)::int + (appointment_id IS NOT NULL)::int + (admission_id IS NOT NULL)::int = 1)`);
  console.log("  ok  admissions.visit_id, discount · admission_beds.day_price · inpatient_orders.unit_price · payments.admission_id · orders.admission_id");

  console.log("\nMavjud yozuvlar:");
  const { rowCount: prices } = await client.query(`
    UPDATE admission_beds ab SET day_price = w.day_price FROM wards w WHERE w.id = ab.ward_id AND ab.day_price IS NULL`);
  console.log(`  ok  yotoq davrlari narxi: ${prices}`);
  const { rowCount: unit } = await client.query(`
    UPDATE inpatient_orders o SET unit_price = s.price FROM services s
     WHERE s.id = o.service_id AND o.kind = 'procedure' AND o.unit_price IS NULL`);
  console.log(`  ok  muolaja narxi: ${unit}`);
  await client.query(
    `INSERT INTO visits (patient_id, visit_date, created_by)
     SELECT DISTINCT a.patient_id, (a.admitted_at AT TIME ZONE $1)::date::text, a.created_by
       FROM admissions a WHERE a.visit_id IS NULL
     ON CONFLICT (patient_id, visit_date) DO NOTHING`,
    [TZ],
  );
  const { rowCount: linked } = await client.query(
    `UPDATE admissions a SET visit_id = v.id FROM visits v
      WHERE a.visit_id IS NULL AND v.patient_id = a.patient_id AND v.visit_date = (a.admitted_at AT TIME ZONE $1)::date::text`,
    [TZ],
  );
  console.log(`  ok  hisobvaraqqa bog'langan yotqizishlar: ${linked} (kun: ${TZ})`);

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
