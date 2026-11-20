/**
 * B3.6 (TZ §5.1.5): the treatment — medicines and procedures — on the
 * examination record and on every replaced version of it.
 *
 *   npm run db:prescriptions
 *
 * Additive and safe to run again. **Run it before deploying the code that
 * reads it**: every record and version read and insert names `prescriptions`.
 * Existing records get none (NULL, read as an empty treatment); nothing is
 * invented for them. No new permissions: writing the treatment is part of
 * writing the record (records.write / records.sign / records.amend).
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
  for (const table of ["medical_records", "medical_record_versions"]) {
    const exists = (await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${table}`])).rows[0].ok;
    if (!exists) {
      console.log(`  —   ${table} jadvali yo'q (avval npm run db:medical)`);
      continue;
    }
    await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS prescriptions json`);
    // A treatment is a list of lines; anything else is refused at the door.
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_${table}_prescriptions') THEN
          ALTER TABLE ${table} ADD CONSTRAINT "CK_${table}_prescriptions"
            CHECK (prescriptions IS NULL OR (json_typeof(prescriptions) = 'array' AND json_array_length(prescriptions) <= 30));
        END IF;
      END $$`);
    console.log(`  ok  ${table}.prescriptions`);
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
