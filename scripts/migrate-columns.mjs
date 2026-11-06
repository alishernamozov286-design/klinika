/**
 * B1.10 (TZ §10): "every important table keeps an identifier, when it was
 * created and changed, and the user responsible" — plus voiding for payments,
 * which are never deleted.
 *
 *   npm run db:columns
 *
 * Run it BEFORE deploying the code that needs it: that code reads these
 * columns on every order, test and user query. The old code ignores them, so
 * running it early is harmless.
 *
 * Additive and safe to run again. Every column is nullable. Rows that predate
 * it keep NULL rather than a made-up value: "unknown" is the truth for them.
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

/** table -> [column, type] */
const COLUMNS = {
  users: [
    ["created_by", "varchar"],
    ["updated_at", "timestamptz"],
    ["updated_by", "varchar"],
  ],
  roles: [["created_by", "varchar"]],
  departments: [["created_by", "varchar"]],
  doctors: [["created_by", "varchar"]],
  patients: [["created_by", "varchar"]],
  tests: [
    ["created_at", "timestamptz"],
    ["created_by", "varchar"],
    ["updated_at", "timestamptz"],
    ["updated_by", "varchar"],
  ],
  orders: [
    ["updated_at", "timestamptz"],
    ["updated_by", "varchar"],
  ],
  payments: [
    ["voided_at", "timestamptz"],
    ["voided_by", "varchar"],
    ["voided_by_name", "text"],
    ["void_reason", "text"],
  ],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const [table, columns] of Object.entries(COLUMNS)) {
    const { rows } = await client.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [table]);
    if (!rows[0].present) {
      console.log(`  --  ${table} (jadval yo'q, o'tkazib yuborildi)`);
      continue;
    }
    for (const [name, type] of columns) {
      await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} ${type}`);
    }
    console.log(`  ok  ${table}: ${columns.map(([n]) => n).join(", ")}`);
  }

  // New catalogue rows are stamped; existing ones stay NULL (set after the
  // ADD COLUMN, so the default does not back-fill them with today's date).
  if ((await client.query(`SELECT to_regclass('tests') IS NOT NULL AS present`)).rows[0].present) {
    await client.query(`ALTER TABLE tests ALTER COLUMN created_at SET DEFAULT now()`);
  }

  // Backs the "has any order used this test?" check that guards deletion.
  if ((await client.query(`SELECT to_regclass('order_tests') IS NOT NULL AS present`)).rows[0].present) {
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_order_tests_test" ON order_tests (test_id)`);
    console.log(`  ok  IDX_order_tests_test`);
  }

  await client.query("COMMIT");
  console.log("Tayyor.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Xato, hech narsa o'zgarmadi:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
