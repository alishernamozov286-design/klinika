/**
 * B8.3: a complete, encrypted backup of the clinic's database — and the proof
 * it restores (server/backup-core.ts).
 *
 *   BACKUP_PASSPHRASE=… npm run db:backup                       # writes backups/medlab-YYYYMMDD-HHMM.mlbk
 *   BACKUP_PASSPHRASE=… npm run db:backup -- --check --record   # + restore check, + result in backup_runs
 *
 *   --out <dir>   where the file goes (default: backups/)
 *   --check       decrypt the file just written and rebuild it in a throwaway
 *                 schema on the same database (one transaction, rolled back):
 *                 every table's rows and checksum must match
 *   --record      write the outcome to backup_runs (Sozlamalar → Zaxira shows it)
 *
 * The dump is read in one REPEATABLE READ, READ ONLY transaction: one moment
 * of the clinic, never a half-written payment. Nothing in the database is
 * changed except the backup_runs row with --record. Runs nightly in GitHub
 * Actions (.github/workflows/backup.yml); keep BACKUP_PASSPHRASE safe — without
 * it the file cannot be opened.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import { backupSummary, dumpDatabase, openBackup, restoreBackup, sealBackup, type RestoreReport } from "../server/backup-core";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env — the environment carries the settings (CI)
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = process.env.DATABASE_URL;
const passphrase = process.env.BACKUP_PASSPHRASE ?? "";
if (!url) {
  console.error("DATABASE_URL topilmadi.");
  process.exit(1);
}
if (passphrase.length < 12) {
  console.error("BACKUP_PASSPHRASE kamida 12 belgi bo'lishi kerak — zaxira shifrlanadi, parolsiz uni ochib bo'lmaydi.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url });
const outDir = option("--out") ?? "backups";
const started = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}-${pad(started.getHours())}${pad(started.getMinutes())}`;
const file = join(outDir, `medlab-${stamp}.mlbk`);
const where = process.env.GITHUB_RUN_ID ? `GitHub Actions #${process.env.GITHUB_RUN_NUMBER ?? process.env.GITHUB_RUN_ID}` : "qo'lda";

let summary = { tables: 0, rows: 0 };
let size = 0;
let report: RestoreReport | null = null;
let error: string | null = null;

const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const backup = await dumpDatabase(client);
  await client.query("COMMIT");
  summary = backupSummary(backup);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, sealBackup(backup, passphrase));
  size = statSync(file).size;
  console.log(`Zaxira: ${file} — ${summary.tables} jadval, ${summary.rows} yozuv, ${(size / 1024).toFixed(1)} KB (shifrlangan)`);

  if (flag("--check")) {
    // From the file, not from memory: the passphrase and the bytes on disk are what a restore will have.
    const reread = openBackup(readFileSync(file), passphrase);
    const schema = `restore_check_${stamp.replace("-", "_")}`;
    await client.query("BEGIN");
    try {
      report = await restoreBackup(client, reread, schema);
    } finally {
      await client.query("ROLLBACK");
    }
    console.log(`Tiklash sinovi: ${report.ok ? "O'TDI" : "YIQILDI"} — ${report.checks.length} jadval, ${report.rows} yozuv, ${report.ms} ms${report.failed.length ? `; mos kelmadi: ${report.failed.join(", ")}` : ""}`);
    if (!report.ok) error = `Tiklash sinovida mos kelmagan jadvallar: ${report.failed.join(", ")}`;
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  error = (err as Error).message;
  console.error("Zaxira olinmadi:", error);
} finally {
  client.release();
}

if (flag("--record")) {
  try {
    await pool.query(
      `INSERT INTO backup_runs (started_at, finished_at, status, location, file_name, size_bytes, tables, rows, restore_checked, restore_ok, restore_details, error)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        started.toISOString(),
        error ? "failed" : "ok",
        where,
        size ? file.split(/[\\/]/).pop() : null,
        size || null,
        summary.tables || null,
        summary.rows || null,
        Boolean(report),
        report ? report.ok : null,
        report ? JSON.stringify({ ms: report.ms, failed: report.failed, checks: report.checks.length }) : null,
        error,
      ],
    );
    console.log("Natija backup_runs ga yozildi.");
  } catch (err) {
    console.error("Natijani yozib bo'lmadi (npm run db:backup-runs bajarilganmi?):", (err as Error).message);
    if (!error) error = "record failed";
  }
}
await pool.end();
process.exit(error ? 1 : 0);
