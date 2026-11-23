/**
 * Zaxira nusxa (B8.3, TZ §12, §14, qabul mezoni 16.10): a complete logical
 * backup of the clinic's Postgres database, and the proof it restores.
 *
 * A backup file holds, for every table of the `public` schema: its structure
 * (columns with types, NOT NULL, defaults, identity; primary, unique, check and
 * foreign keys; indexes) and its rows, with a row count and a checksum taken by
 * the database itself. So the file alone can rebuild an empty database — it
 * does not lean on the migrations matching.
 *
 * It is gzip-compressed and encrypted (AES-256-GCM, key from a passphrase via
 * scrypt): it carries password hashes, 2FA secrets and every patient's record,
 * and it is stored off the database's own provider.
 *
 * The restore check rebuilds the backup in a fresh schema inside one
 * transaction — tables, rows, then foreign keys and indexes, every constraint
 * enforced — compares each table's count and checksum with the file's, and
 * rolls everything back. The same code restores into an empty database for
 * real (`schema: "public"`, committed).
 *
 * The `session` table (signed-in browsers) is backed up as structure only: its
 * rows are credentials and are worthless after a restore anyway.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

export const BACKUP_FORMAT = "medlab-backup";
export const BACKUP_VERSION = 1;
/** Tables whose rows are not backed up (structure only). */
export const STRUCTURE_ONLY = new Set(["session"]);

export type BackupColumn = { name: string; type: string; notNull: boolean; default: string | null; identity: "" | "a" | "d" };
export type BackupConstraint = { name: string; kind: "p" | "u" | "c" | "f" | "x"; def: string };
export type BackupTable = {
  name: string;
  columns: BackupColumn[];
  constraints: BackupConstraint[];
  /** CREATE INDEX statements for indexes no constraint owns, table names unqualified. */
  indexes: string[];
  rowCount: number;
  checksum: string;
  rows: Record<string, unknown>[];
};
export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  server: string;
  tables: BackupTable[];
};
export type TableCheck = { name: string; expectedRows: number; restoredRows: number; ok: boolean };
export type RestoreReport = { ok: boolean; tables: number; rows: number; checks: TableCheck[]; failed: string[]; ms: number };

/** The bit of a pg client this needs (pg / @neondatabase/serverless both fit). */
export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

// ---------------------------------------------------------------- the file

const MAGIC = Buffer.from("MLBK1");

/** gzip, then AES-256-GCM: MAGIC | salt(16) | iv(12) | tag(16) | ciphertext. */
export function sealBackup(backup: BackupFile, passphrase: string): Buffer {
  if (!passphrase || passphrase.length < 12) throw new Error("Zaxira paroli kamida 12 belgi bo'lsin (BACKUP_PASSPHRASE)");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(backup)), { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function openBackup(sealed: Buffer, passphrase: string): BackupFile {
  if (sealed.length < MAGIC.length + 44 || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Bu MedLab zaxira fayli emas");
  let o = MAGIC.length;
  const salt = sealed.subarray(o, (o += 16));
  const iv = sealed.subarray(o, (o += 12));
  const tag = sealed.subarray(o, (o += 16));
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = Buffer.concat([decipher.update(sealed.subarray(o)), decipher.final()]);
  } catch {
    throw new Error("Zaxira paroli noto'g'ri yoki fayl buzilgan");
  }
  const backup = JSON.parse(gunzipSync(plain).toString("utf8")) as BackupFile;
  if (backup.format !== BACKUP_FORMAT) throw new Error("Bu MedLab zaxira fayli emas");
  if (backup.version > BACKUP_VERSION) throw new Error(`Zaxira formati yangiroq (v${backup.version}) — dasturni yangilang`);
  return backup;
}

// ---------------------------------------------------------------- dump

/** A table's count and checksum, computed by the database over its rows as JSON, in a fixed order. */
async function tableDigest(db: Queryable, schema: string, table: string): Promise<{ n: number; sum: string }> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n, md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY to_jsonb(t)::text), '')) AS sum FROM ${ident(schema)}.${ident(table)} t`,
  );
  return { n: Number(rows[0].n), sum: String(rows[0].sum) };
}

/**
 * Reads every table of `public`: structure from the catalog, rows as JSON.
 * Run it inside a REPEATABLE READ transaction so the file is one moment.
 */
export async function dumpDatabase(db: Queryable): Promise<BackupFile> {
  // Unqualified names in the definitions: they will be read back under another search_path.
  await db.query(`SET search_path TO public`);
  const server = String((await db.query(`SHOW server_version`)).rows[0].server_version);
  const tableRows = (
    await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`)
  ).rows;
  const tables: BackupTable[] = [];
  for (const { relname } of tableRows) {
    const reg = `public.${ident(relname)}`;
    const columns = (
      await db.query(
        `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull",
                CASE WHEN a.attidentity = '' THEN pg_get_expr(d.adbin, d.adrelid) END AS "default", a.attidentity AS identity
           FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum`,
        [reg],
      )
    ).rows as BackupColumn[];
    const constraints = (
      await db.query(
        `SELECT conname AS name, contype AS kind, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid = $1::regclass AND contype IN ('p', 'u', 'c', 'f', 'x') ORDER BY contype, conname`,
        [reg],
      )
    ).rows as BackupConstraint[];
    const indexes = (
      await db.query(
        `SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i
          WHERE i.indrelid = $1::regclass AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
          ORDER BY 1`,
        [reg],
      )
    ).rows.map((r) => String(r.def).replace(/ ON public\./, " ON "));
    const structureOnly = STRUCTURE_ONLY.has(relname);
    const digest = structureOnly ? { n: 0, sum: "" } : await tableDigest(db, "public", relname);
    const rows = structureOnly ? [] : (await db.query(`SELECT to_jsonb(t) AS r FROM ${reg} t`)).rows.map((x) => x.r as Record<string, unknown>);
    tables.push({ name: relname, columns, constraints, indexes, rowCount: digest.n, checksum: digest.sum, rows });
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), server, tables };
}

// ---------------------------------------------------------------- restore

export function columnDdl(c: BackupColumn): string {
  const parts = [ident(c.name), c.type];
  if (c.identity === "a") parts.push("GENERATED ALWAYS AS IDENTITY");
  else if (c.identity === "d") parts.push("GENERATED BY DEFAULT AS IDENTITY");
  else if (c.default !== null) parts.push(`DEFAULT ${c.default}`);
  if (c.notNull) parts.push("NOT NULL");
  return parts.join(" ");
}

/**
 * Rebuilds `backup` in `schema` on `db` (the caller owns the transaction):
 * tables with their keys and checks, the rows, then the foreign keys and
 * indexes — each enforced as it is added — identity sequences moved past the
 * restored ids, and every table's count and checksum compared with the file.
 */
export async function restoreBackup(db: Queryable, backup: BackupFile, schema: string, onTable?: (name: string) => void): Promise<RestoreReport> {
  const started = Date.now();
  if (schema !== "public") await db.query(`CREATE SCHEMA ${ident(schema)}`);
  await db.query(`SET LOCAL search_path TO ${ident(schema)}`);
  for (const t of backup.tables) {
    await db.query(`CREATE TABLE ${ident(t.name)} (${t.columns.map(columnDdl).join(", ")})`);
    for (const c of t.constraints.filter((x) => x.kind !== "f")) await db.query(`ALTER TABLE ${ident(t.name)} ADD CONSTRAINT ${ident(c.name)} ${c.def}`);
  }
  for (const t of backup.tables) {
    onTable?.(t.name);
    for (let i = 0; i < t.rows.length; i += 500) {
      await db.query(`INSERT INTO ${ident(t.name)} OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::${ident(t.name)}, $1::jsonb)`, [JSON.stringify(t.rows.slice(i, i + 500))]);
    }
    for (const c of t.columns.filter((x) => x.identity)) {
      await db.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), coalesce((SELECT max(${ident(c.name)}) FROM ${ident(t.name)}), 0) + 1, false)`,
        [`${ident(schema)}.${ident(t.name)}`, c.name],
      );
    }
  }
  for (const t of backup.tables) for (const c of t.constraints.filter((x) => x.kind === "f")) await db.query(`ALTER TABLE ${ident(t.name)} ADD CONSTRAINT ${ident(c.name)} ${c.def}`);
  for (const t of backup.tables) for (const def of t.indexes) await db.query(def);

  const checks: TableCheck[] = [];
  for (const t of backup.tables) {
    if (STRUCTURE_ONLY.has(t.name)) continue;
    const d = await tableDigest(db, schema, t.name);
    checks.push({ name: t.name, expectedRows: t.rowCount, restoredRows: d.n, ok: d.n === t.rowCount && d.sum === t.checksum });
  }
  const failed = checks.filter((c) => !c.ok).map((c) => c.name);
  return { ok: failed.length === 0, tables: backup.tables.length, rows: checks.reduce((s, c) => s + c.restoredRows, 0), checks, failed, ms: Date.now() - started };
}

/** What a backup holds, for the log and the record. */
export function backupSummary(b: BackupFile) {
  return { tables: b.tables.length, rows: b.tables.reduce((s, t) => s + t.rowCount, 0), createdAt: b.createdAt, server: b.server };
}
