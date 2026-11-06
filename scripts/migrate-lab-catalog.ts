/**
 * B4.6 + B4.3 (TZ §6.2, §6.1.3): the eight TZ groups and the specimen type on
 * every catalogue test, the specimen snapshot on order lines, and the
 * reception quality of a sample.
 *
 *   npm run db:lab-catalog
 *
 * Existing tests are classified once — on the run that adds the columns —
 * from their name and heading (shared/lab-catalogue.ts). Later runs never
 * touch a test again, so the lab's own corrections in the catalogue screen
 * stand. Order lines take the specimen of their test where they have none.
 *
 * Run it BEFORE deploying the code that needs it: that code reads these
 * columns on every test and order query. One transaction; safe to repeat.
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { classifyTest } from "../shared/lab-catalogue";

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
  const firstRun = !(
    await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'group') AS ok`,
    )
  ).rows[0].ok;

  await client.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS "group" text NOT NULL DEFAULT 'boshqa'`);
  await client.query(`ALTER TABLE tests ADD COLUMN IF NOT EXISTS sample_type text NOT NULL DEFAULT 'qon_zardob'`);
  await client.query(`ALTER TABLE order_tests ADD COLUMN IF NOT EXISTS sample_type text`);
  await client.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS quality text`);
  await client.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS quality_note text`);
  console.log("  ok  ustunlar: tests.group, tests.sample_type, order_tests.sample_type, samples.quality");

  if (firstRun) {
    const { rows } = await client.query<{ id: string; name: string; category: string }>(`SELECT id, name, category FROM tests`);
    const tally: Record<string, number> = {};
    for (const t of rows) {
      const c = classifyTest(t);
      tally[c.group] = (tally[c.group] ?? 0) + 1;
      await client.query(`UPDATE tests SET "group" = $2, sample_type = $3 WHERE id = $1`, [t.id, c.group, c.sampleType]);
    }
    console.log(`  ok  ${rows.length} ta tahlil tasniflandi: ${Object.entries(tally).map(([g, n]) => `${g} ${n}`).join(", ")}`);
  } else {
    console.log("  —   tahlillar avval tasniflangan, katalogdagi o'zgarishlarga tegilmadi");
  }

  const lines = await client.query(
    `UPDATE order_tests ot SET sample_type = t.sample_type FROM tests t WHERE ot.test_id = t.id AND ot.sample_type IS NULL`,
  );
  console.log(`  ok  ${lines.rowCount} ta buyurtma qatoriga namuna turi yozildi`);

  await client.query("COMMIT");
  console.log("\nTayyor.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Xato, hech narsa o'zgarmadi:", (err as Error).message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
