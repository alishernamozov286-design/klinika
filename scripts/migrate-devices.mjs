/**
 * B4.9 (TZ §6.4): the lab's analyzers and their error log.
 *
 *   npm run db:devices
 *
 * Additive and safe to run again: two new tables and their index, and the new
 * permissions added to the built-in roles (nothing else in a role is
 * touched). Until it runs the Analizatorlar screen is empty and saving
 * answers 503; nothing else is affected.
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
  laborant: ["devices.read", "devices.log"],
  lab_mudiri: ["devices.read", "devices.log", "devices.manage"],
  rahbar: ["devices.read"],
  auditor: ["devices.read"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  console.log("Jadvallar:");
  await client.query(`
    CREATE TABLE IF NOT EXISTS lab_devices (
      id             varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      name           text        NOT NULL,
      manufacturer   text,
      model          text,
      serial_number  text,
      direction      text        NOT NULL DEFAULT 'boshqa',
      connection     text        NOT NULL DEFAULT 'manual',
      status         text        NOT NULL DEFAULT 'active',
      location       text,
      installed_on   text,
      notes          text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      created_by     varchar,
      updated_at     timestamptz,
      updated_by     varchar
    )`);
  console.log("  ok  lab_devices");
  await client.query(`
    CREATE TABLE IF NOT EXISTS lab_device_errors (
      id                varchar     PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id         varchar     NOT NULL,
      occurred_at       timestamptz NOT NULL,
      severity          text        NOT NULL DEFAULT 'error',
      code              text,
      message           text        NOT NULL,
      action_taken      text,
      reported_by       varchar,
      reported_by_name  text,
      created_at        timestamptz NOT NULL DEFAULT now(),
      resolved_at       timestamptz,
      resolved_by       varchar,
      resolved_by_name  text,
      resolution        text
    )`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_lab_device_errors_device" ON lab_device_errors (device_id, occurred_at)`);
  console.log("  ok  lab_device_errors");

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
