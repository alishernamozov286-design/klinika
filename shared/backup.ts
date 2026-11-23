/**
 * Zaxira holati (B8.3): what Sozlamalar → Zaxira tells from the backup runs.
 * A nightly backup is expected; more than a day and a half without a good one
 * (backup taken AND restore check passed) is a warning.
 */
export const BACKUP_STALE_HOURS = 36;

export type BackupRunView = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "ok" | "failed";
  location: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  tables: number | null;
  rows: number | null;
  restoreChecked: boolean;
  restoreOk: boolean | null;
  error: string | null;
};

export type BackupHealth = "ok" | "stale" | "failed" | "none";
export const BACKUP_HEALTH_LABELS: Record<BackupHealth, string> = {
  ok: "Zaxira joyida",
  stale: "Zaxira eskirgan",
  failed: "Oxirgi zaxira muvaffaqiyatsiz",
  none: "Avtomatik zaxira hali olinmagan",
};

/** A good run: the backup was written and its restore check passed. */
export const isGoodRun = (r: BackupRunView) => r.status === "ok" && r.restoreChecked && r.restoreOk === true;

export function backupHealth(runs: readonly BackupRunView[], now = new Date()): { health: BackupHealth; lastGood: BackupRunView | null; hoursSince: number | null } {
  const sorted = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lastGood = sorted.find(isGoodRun) ?? null;
  const hoursSince = lastGood ? Math.round(((now.getTime() - Date.parse(lastGood.startedAt)) / 3_600_000) * 10) / 10 : null;
  if (sorted.length === 0) return { health: "none", lastGood, hoursSince };
  if (!isGoodRun(sorted[0])) return { health: "failed", lastGood, hoursSince };
  if (hoursSince !== null && hoursSince > BACKUP_STALE_HOURS) return { health: "stale", lastGood, hoursSince };
  return { health: "ok", lastGood, hoursSince };
}
