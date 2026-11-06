/**
 * B4.5 (TZ §6.1.5): result verification by the lab head, returns to the
 * laborant, and amendments kept as versions. Plus the permissions.
 *
 *   npm run db:results
 *
 * Run it BEFORE deploying the code that needs it: that code reads the new
 * order_tests columns on every order query. The old code ignores them.
 *
 * Results that already exist were entered before verification existed and
 * were already handed to patients. On the run that adds the columns they are
 * marked released under a name that says exactly that — never an invented
 * verifier. Later runs never touch them again, so a value entered after the
 * upgrade can never be marked verified by re-running this script.
 *
 * One transaction; safe to run again.
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
const GRANTS = { lab_mudiri: ["results.verify", "results.amend"] };
// Kept in step with LEGACY_VERIFIER in shared/lab-verification.ts.
const LEGACY_VERIFIER = "Tasdiqlash joriy etilishidan oldingi natija";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");

  const firstRun = !(
    await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'order_tests' AND column_name = 'verified_at') AS ok`,
    )
  ).rows[0].ok;

  for (const [name, type] of [
    ["entered_by_id", "varchar"],
    ["verified_at", "timestamptz"],
    ["verified_by", "varchar"],
    ["verified_by_name", "text"],
    ["returned_at", "timestamptz"],
    ["returned_by_name", "text"],
    ["return_reason", "text"],
    ["version", "integer NOT NULL DEFAULT 1"],
  ]) {
    await client.query(`ALTER TABLE order_tests ADD COLUMN IF NOT EXISTS ${name} ${type}`);
  }
  console.log("  ok  order_tests: tasdiqlash ustunlari");

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_test_versions (
      id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      order_test_id     varchar     NOT NULL,
      order_id          varchar     NOT NULL,
      version           integer     NOT NULL,
      result            text,
      flag              text,
      notes             text,
      entered_by        text,
      verified_at       timestamptz,
      verified_by_name  text,
      replaced_at       timestamptz NOT NULL DEFAULT now(),
      replaced_by       varchar,
      replaced_by_name  text,
      replace_reason    text        NOT NULL
    )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_test_versions" ON order_test_versions (order_test_id, version)`);
  console.log("  ok  order_test_versions");

  if (firstRun) {
    const { rowCount } = await client.query(
      `UPDATE order_tests
          SET verified_at = coalesce(completed_at, now()), verified_by_name = $1
        WHERE result IS NOT NULL AND result <> '' AND verified_at IS NULL`,
      [LEGACY_VERIFIER],
    );
    console.log(`  ok  ${rowCount} ta eski natija "${LEGACY_VERIFIER}" deb belgilandi`);
  } else {
    console.log("  —   eski natijalar avval belgilangan, qayta tegilmadi");
  }

  console.log("\nRuxsatlar:");
  const hasRoles = (await client.query(`SELECT to_regclass('public.roles') IS NOT NULL AS ok`)).rows[0].ok;
  if (!hasRoles) {
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
