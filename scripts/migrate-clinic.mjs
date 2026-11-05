/**
 * B1.5 (TZ §10): adds the departments and doctors tables.
 *
 *   npm run db:clinic
 *
 * Additive only (CREATE ... IF NOT EXISTS), so it is safe to run repeatedly and
 * touches no existing row. Until it has run, the app lists no departments or
 * doctors and refuses to create them with a message pointing here.
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

const run = async (label, sqlText) => {
  await pool.query(sqlText);
  console.log(`  ok  ${label}`);
};

console.log("Jadvallar:");
await run(
  "departments",
  `CREATE TABLE IF NOT EXISTS departments (
     id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     name         text    NOT NULL UNIQUE,
     kind         text    NOT NULL DEFAULT 'ambulator',
     description  text,
     is_active    boolean NOT NULL DEFAULT true,
     created_at   timestamptz NOT NULL DEFAULT now(),
     updated_at   timestamptz,
     updated_by   varchar
   )`,
);
await run(
  "doctors",
  `CREATE TABLE IF NOT EXISTS doctors (
     id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id             varchar NOT NULL UNIQUE,
     department_id       varchar,
     specialty           text    NOT NULL,
     room                text,
     consultation_price  integer NOT NULL DEFAULT 0,
     slot_minutes        integer NOT NULL DEFAULT 20,
     schedule            json    NOT NULL DEFAULT '[]'::json,
     is_active           boolean NOT NULL DEFAULT true,
     created_at          timestamptz NOT NULL DEFAULT now(),
     updated_at          timestamptz,
     updated_by          varchar
   )`,
);
await run(
  "doctors.department_id index",
  `CREATE INDEX IF NOT EXISTS "IDX_doctors_department" ON doctors (department_id)`,
);

await pool.end();
console.log("\nTayyor.");
