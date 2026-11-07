import { describe, expect, it } from "vitest";
import { daysUntil, eqaEvaluation, evaluateWestgard, isExpired, seriesStats, zScore } from "./qc";

const judge = (...zs: number[]) => evaluateWestgard(zs);

describe("Westgard multirules (TZ §6.5)", () => {
  it("in control", () => {
    expect(judge(0.3, -0.8, 1.2)).toEqual({ rules: [], status: "ok" });
    expect(judge()).toEqual({ rules: [], status: "ok" });
  });

  it("1-2s warns, 1-3s rejects", () => {
    expect(judge(0.1, 2.4)).toEqual({ rules: ["1-2s"], status: "warning" });
    expect(judge(-3.2)).toEqual({ rules: ["1-2s", "1-3s"], status: "reject" });
    // Exactly 2 SD is not beyond 2 SD.
    expect(judge(2).status).toBe("ok");
  });

  it("2-2s needs two in a row on the same side", () => {
    expect(judge(2.3, 2.1).rules).toContain("2-2s");
    expect(judge(2.3, -2.1).rules).not.toContain("2-2s");
    expect(judge(2.3, 0.5, 2.1).rules).not.toContain("2-2s");
  });

  it("R-4s: a range over 4 SD across the mean", () => {
    expect(judge(2.2, -2.1).rules).toContain("R-4s");
    expect(judge(2.2, -2.1).status).toBe("reject");
    expect(judge(1.5, -2.6).rules).not.toContain("R-4s"); // 4.1 apart but the first is inside 2 SD
  });

  it("4-1s and 10x catch drift", () => {
    expect(judge(1.2, 1.4, 1.1, 1.3).rules).toEqual(["4-1s"]);
    expect(judge(1.2, 1.4, 0.9, 1.3).rules).toEqual([]);
    const shift = [0.4, 0.2, 0.8, 0.5, 0.3, 0.6, 0.1, 0.7, 0.4, 0.2];
    expect(judge(...shift)).toEqual({ rules: ["10x"], status: "reject" });
    expect(judge(...shift.slice(0, 9), -0.1).rules).toEqual([]);
  });

  it("only the newest point raises a rule", () => {
    // The old 1-3s does not follow the series around.
    expect(judge(3.5, 0.2).status).toBe("ok");
  });
});

describe("numbers", () => {
  it("z-score, stats", () => {
    expect(zScore(110, 100, 5)).toBe(2);
    expect(zScore(1, 1, 0)).toBe(0);
    const s = seriesStats([98, 100, 102, 100])!;
    expect(s.n).toBe(4);
    expect(s.mean).toBe(100);
    expect(s.sd).toBeCloseTo(1.633, 3);
    expect(s.cv).toBeCloseTo(1.633, 3);
    expect(seriesStats([5])).toBeNull();
  });

  it("external QC by ISO 13528 z", () => {
    expect(eqaEvaluation(-1.9)).toBe("acceptable");
    expect(eqaEvaluation(2.5)).toBe("questionable");
    expect(eqaEvaluation(-3.1)).toBe("unacceptable");
  });

  it("calendar days", () => {
    expect(isExpired("2026-11-06", "2026-11-07")).toBe(true);
    expect(isExpired("2026-11-07", "2026-11-07")).toBe(false);
    expect(isExpired(null, "2026-11-07")).toBe(false);
    expect(daysUntil("2026-11-17", "2026-11-07")).toBe(10);
    expect(daysUntil("2026-11-01", "2026-11-07")).toBe(-6);
  });
});
