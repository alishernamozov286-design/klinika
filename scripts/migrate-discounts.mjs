/**
 * B7.2 (TZ §9.2 "Chegirmalar"): discounts on bills — an appointment's own
 * discount (its charge = frozen price − discount), and the record of every
 * discount given on a bill.
 *
 *   npm run db:discounts
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every bill and the debtors list read appointments.discount.
 * Existing appointments get discount 0 (nothing changes for them). Grants
 * payments.discount to rahbar and registrator (only ever adds).
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

// Kept in step with SYSTEM_ROLES in shared/permissions.ts.
const GRANTS = {
  rahbar: ["payments.discount"],
  registrator: ["payments.discount"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Qabullar:");
  await client.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0`);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_appointments_discount') THEN
        ALTER TABLE appointments ADD CONSTRAINT "CK_appointments_discount" CHECK (discount >= 0 AND discount <= price);
      END IF;
    END $$`);
  console.log("  ok  appointments.discount (0 ≤ chegirma ≤ narx)");

  console.log("\nJadval:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS bill_discounts (
      id               varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       varchar     NOT NULL,
      visit_id         varchar     NOT NULL,
      mode             text        NOT NULL CHECK (mode IN ('percent', 'amount')),
      value            integer     NOT NULL CHECK (value > 0 AND (mode <> 'percent' OR value <= 100)),
      total            integer     NOT NULL CHECK (total > 0),
      lines            json        NOT NULL,
      reason           text        NOT NULL CHECK (length(btrim(reason)) >= 5),
      created_at       timestamptz NOT NULL DEFAULT now(),
      created_by       varchar,
      created_by_name  text
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_bill_discounts_visit" ON bill_discounts (visit_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_bill_discounts_patient" ON bill_discounts (patient_id)`);
  console.log("  ok  bill_discounts");

  console.log("\nRuxsatlar:");
  const { rows: hasRoles } = await client.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ok`);
  if (!hasRoles[0].ok) {
    console.log("  —   roles jadvali yo'q (avval npm run db:roles); standart rollar koddan olinadi");
  } else {
    for (const [key, perms] of Object.entries(GRANTS)) {
      const { rows } = await client.query(
        `UPDATE roles
            SET permissions = ARRAY(SELECT DISTINCT unnest(permissions || $2::text[]) ORDER BY 1)
          WHERE key = $1 AND is_system AND NOT (permissions @> $2::text[])
          RETURNING key`,
        [key, perms],
      );
      console.log(`  ${rows.length ? "ok " : "—  "} ${key}: ${perms.join(", ")}${rows.length ? "" : " (allaqachon bor)"}`);
    }
  }

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
