/**
 * B6.7 (TZ §8.1.5 "Chiqarish", §8.2 "Bemor chiqarilganda yakuniy epikriz
 * yaratiladi"): the epicrisis of a stay — every save a new version, drafts
 * before discharge and corrections (with a reason) after.
 *
 *   npm run db:epicrisis
 *
 * Additive and safe to run again. Run it before deploying the code that reads
 * it (the case history page reads the table; discharge requires it). Grants
 * inpatient.discharge to shifokor (only ever adds).
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
const GRANTS = { shifokor: ["inpatient.discharge"] };

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS epicrisis_versions (
      id                    varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      admission_id          varchar     NOT NULL REFERENCES admissions (id),
      version               integer     NOT NULL CHECK (version >= 1),
      final_diagnosis       text        CHECK (length(final_diagnosis) <= 2000),
      final_diagnosis_code  varchar,
      treatment_summary     text        CHECK (length(treatment_summary) <= 6000),
      epicrisis             text        CHECK (length(epicrisis) <= 10000),
      recommendations       text        CHECK (length(recommendations) <= 4000),
      reason                text,
      saved_at              timestamptz NOT NULL DEFAULT now(),
      saved_by              varchar,
      saved_by_name         text
    )`);
  // Two saves on the same version: one wins, the other is told to reload.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_epicrisis_versions" ON epicrisis_versions (admission_id, version)`);
  console.log("  ok  epicrisis_versions (har saqlash — yangi versiya)");

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
