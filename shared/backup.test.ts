import { describe, expect, it } from "vitest";
import { backupHealth, isGoodRun, type BackupRunView } from "./backup";

const run = (startedAt: string, over: Partial<BackupRunView> = {}): BackupRunView => ({
  id: startedAt,
  startedAt,
  finishedAt: startedAt,
  status: "ok",
  location: "GitHub Actions #1",
  fileName: "medlab.mlbk",
  sizeBytes: 1000,
  tables: 59,
  rows: 15000,
  restoreChecked: true,
  restoreOk: true,
  error: null,
  ...over,
});
const now = new Date("2026-11-24T10:00:00Z");

describe("backup health (B8.3)", () => {
  it("a good run is a backup whose restore check passed", () => {
    expect(isGoodRun(run("2026-11-24T00:00:00Z"))).toBe(true);
    expect(isGoodRun(run("2026-11-24T00:00:00Z", { restoreChecked: false, restoreOk: null }))).toBe(false);
    expect(isGoodRun(run("2026-11-24T00:00:00Z", { restoreOk: false }))).toBe(false);
  });

  it("ok, stale after 36 hours, failed when the latest failed, none without runs", () => {
    expect(backupHealth([], now)).toEqual({ health: "none", lastGood: null, hoursSince: null });
    expect(backupHealth([run("2026-11-23T21:30:00Z")], now)).toMatchObject({ health: "ok", hoursSince: 12.5 });
    expect(backupHealth([run("2026-11-22T21:30:00Z")], now)).toMatchObject({ health: "stale", hoursSince: 36.5 });
    const failed = backupHealth([run("2026-11-23T21:30:00Z", { status: "failed", error: "fetch failed", restoreChecked: false, restoreOk: null }), run("2026-11-22T21:30:00Z")], now);
    expect(failed).toMatchObject({ health: "failed", hoursSince: 36.5 });
    expect(failed.lastGood?.startedAt).toBe("2026-11-22T21:30:00Z");
  });
});
