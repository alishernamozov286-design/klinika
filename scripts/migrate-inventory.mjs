/**
 * B5.1 (TZ §7.2): the warehouse product catalogue.
 *
 *   npm run db:inventory
 *
 * Additive and safe to run again: one new table with its unique indexes, and
 * the new permissions added to the built-in roles (nothing else in a role is
 * touched). Until it runs the Ombor screen is empty and saving answers 503.
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
  omborchi: ["inventory.read", "inventory.manage"],
  lab_mudiri: ["inventory.read"],
  rahbar: ["inventory.read"],
  buxgalter: ["inventory.read"],
  auditor: ["inventory.read"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id            varchar          PRIMARY KEY DEFAULT gen_random_uuid(),
      name          text             NOT NULL,
      kind          text             NOT NULL,
      code          text,
      manufacturer  text,
      unit          text             NOT NULL,
      min_stock     double precision NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      sale_price    integer          CHECK (sale_price IS NULL OR sale_price >= 0),
      is_active     boolean          NOT NULL DEFAULT true,
      notes         text,
      created_at    timestamptz      NOT NULL DEFAULT now(),
      created_by    varchar,
      updated_at    timestamptz,
      updated_by    varchar
    )`);
  // The route compares names and codes without case or spaces; these are the last guard.
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_inventory_items_name" ON inventory_items (lower(btrim(name)))`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_inventory_items_code" ON inventory_items (lower(btrim(code))) WHERE code IS NOT NULL`,
  );
  console.log("  ok  inventory_items");

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
