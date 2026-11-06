/**
 * B3.4 (TZ §5.1.3, D-5): the MKB-10 catalogue and the diagnosis code columns.
 *
 *   npm run db:icd10
 *
 * Creates the `icd10` table, adds the optional code columns to
 * medical_records and medical_record_versions, and loads the Ministry of
 * Health NSI file from data/icd10. Russian names and the hierarchy are
 * refreshed on every run; the clinic's Uzbek names are never touched.
 *
 * Run it BEFORE deploying the code that needs it: that code reads the new
 * record columns on every examination query. One transaction; safe to repeat.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { parseNsiIcd10 } from "../shared/icd10";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — nothing to load
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL topilmadi. Mahalliy JSON store katalogni fayldan o'zi o'qiydi.");
  process.exit(1);
}

const rows = parseNsiIcd10(readFileSync(join(import.meta.dirname, "..", "data", "icd10", "mkb10-nsi-2.27.csv"), "utf8"));

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS icd10 (
      code         varchar     PRIMARY KEY,
      kind         text        NOT NULL,
      name_ru      text        NOT NULL,
      name_uz      text,
      chapter      varchar     NOT NULL,
      block        varchar,
      parent_code  varchar,
      is_actual    boolean     NOT NULL DEFAULT true,
      selectable   boolean     NOT NULL DEFAULT false,
      sort_order   integer     NOT NULL,
      updated_at   timestamptz,
      updated_by   varchar
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_icd10_sort" ON icd10 (sort_order)`);
  console.log("  ok  icd10");

  for (const table of ["medical_records", "medical_record_versions"]) {
    const present = (await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${table}`])).rows[0].ok;
    if (!present) {
      console.log(`  —   ${table} yo'q (avval npm run db:medical)`);
      continue;
    }
    await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS preliminary_diagnosis_code varchar`);
    await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS final_diagnosis_code varchar`);
    console.log(`  ok  ${table}: tashxis kodlari`);
  }

  const before = Number((await client.query(`SELECT count(*) AS n FROM icd10`)).rows[0].n);
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: unknown[] = [];
    const values = chunk.map((r) => {
      const at = params.length;
      params.push(r.code, r.kind, r.nameRu, r.chapter, r.block, r.parentCode, r.isActual, r.selectable, r.sortOrder);
      return `(${Array.from({ length: 9 }, (_, k) => `$${at + k + 1}`).join(", ")})`;
    });
    await client.query(
      `INSERT INTO icd10 (code, kind, name_ru, chapter, block, parent_code, is_actual, selectable, sort_order)
       VALUES ${values.join(", ")}
       ON CONFLICT (code) DO UPDATE SET
         kind = excluded.kind, name_ru = excluded.name_ru, chapter = excluded.chapter, block = excluded.block,
         parent_code = excluded.parent_code, is_actual = excluded.is_actual, selectable = excluded.selectable,
         sort_order = excluded.sort_order`,
      params,
    );
  }
  const stats = (
    await client.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE selectable)::int AS selectable,
                               count(*) FILTER (WHERE name_uz IS NOT NULL AND name_uz <> '')::int AS uz FROM icd10`)
  ).rows[0];
  console.log(`  ok  katalog: ${stats.total} ta yozuv (${stats.total - before} ta yangi), ${stats.selectable} ta tanlanadigan, ${stats.uz} tasida o'zbekcha nom`);

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
