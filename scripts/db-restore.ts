/**
 * B8.3: restore a backup made by `npm run db:backup`.
 *
 *   BACKUP_PASSPHRASE=… npm run db:restore -- backups/medlab-20261124-0230.mlbk
 *       Check only (the default): rebuilds the file in a throwaway schema of
 *       DATABASE_URL inside one transaction and rolls it back. Nothing changes.
 *
 *   BACKUP_PASSPHRASE=… RESTORE_DATABASE_URL=postgresql://… npm run db:restore -- <file> --into-empty --yes
 *       Disaster recovery: restores into the database RESTORE_DATABASE_URL,
 *       which must be EMPTY (no tables in public) — a new Neon branch or
 *       project. It never overwrites a database that holds anything. Point the
 *       app at it afterwards (DATABASE_URL) and redeploy.
 *
 * A separate variable for the target, on purpose: a restore cannot land on the
 * live database by a slip of DATABASE_URL.
 */
import { readFileSync } from "node:fs";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { backupSummary, openBackup, restoreBackup } from "../server/backup-core";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const intoEmpty = args.includes("--into-empty");
const yes = args.includes("--yes");
const passphrase = process.env.BACKUP_PASSPHRASE ?? "";
if (!file) {
  console.error("Foydalanish: npm run db:restore -- <fayl.mlbk> [--into-empty --yes]");
  process.exit(1);
}
const url = intoEmpty ? process.env.RESTORE_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(intoEmpty ? "RESTORE_DATABASE_URL topilmadi (bo'sh maqsad baza)." : "DATABASE_URL topilmadi.");
  process.exit(1);
}
if (intoEmpty && !yes) {
  console.error("Haqiqiy tiklash uchun --yes ham kerak.");
  process.exit(1);
}

let backup: ReturnType<typeof openBackup>;
try {
  backup = openBackup(readFileSync(file), passphrase);
} catch (err) {
  console.error("Zaxirani ochib bo'lmadi:", (err as Error).message);
  process.exit(1);
}
const s = backupSummary(backup);
console.log(`Fayl: ${file} — ${s.createdAt}, Postgres ${s.server}, ${s.tables} jadval, ${s.rows} yozuv`);

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
let ok = false;
try {
  if (intoEmpty) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`);
    if (rows[0].n > 0) throw new Error(`Maqsad bazada ${rows[0].n} ta jadval bor — faqat bo'sh bazaga tiklanadi (yangi Neon branch yoki loyiha oching)`);
  }
  await client.query("BEGIN");
  // A progress line on a terminal only; a CI log gets the result.
  const tty = process.stdout.isTTY;
  const report = await restoreBackup(client, backup, intoEmpty ? "public" : `restore_check_${Date.now()}`, tty ? (t) => process.stdout.write(`\r  ${t.padEnd(40)}`) : undefined);
  if (tty) process.stdout.write("\r".padEnd(44) + "\r");
  for (const c of report.checks.filter((x) => !x.ok)) console.log(`  MOS EMAS  ${c.name}: ${c.restoredRows}/${c.expectedRows}`);
  if (intoEmpty && report.ok) {
    await client.query("COMMIT");
    console.log(`Tiklandi: ${report.checks.length} jadval, ${report.rows} yozuv — har jadval soni va nazorat yig'indisi mos (${report.ms} ms).`);
  } else {
    await client.query("ROLLBACK");
    console.log(`${intoEmpty ? "Tiklash bekor qilindi" : "Tiklash sinovi"}: ${report.ok ? "O'TDI" : "YIQILDI"} — ${report.checks.length} jadval, ${report.rows} yozuv (${report.ms} ms)${intoEmpty ? "" : "; hech narsa o'zgarmadi"}.`);
  }
  ok = report.ok;
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Xato:", (err as Error).message);
} finally {
  client.release();
  await pool.end();
}
process.exit(ok ? 0 : 1);
