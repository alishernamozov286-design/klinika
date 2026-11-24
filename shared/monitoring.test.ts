import { describe, expect, it } from "vitest";
import {
  HISTOGRAM_SIZE,
  bucketOf,
  errorFingerprint,
  hourOf,
  maskMessage,
  maskPath,
  percentileFromHistogram,
  summarizeHours,
  summarizeRoutes,
  trimStack,
  type RequestStatRow,
} from "./monitoring";

const hist = (pairs: [number, number][]) => {
  const h = Array(HISTOGRAM_SIZE).fill(0);
  for (const [i, n] of pairs) h[i] = n;
  return h;
};

describe("monitoring (B8.4)", () => {
  it("buckets latencies and estimates p95 from the histogram", () => {
    expect([10, 50, 51, 999, 1000, 1001, 9000].map(bucketOf)).toEqual([0, 0, 1, 4, 4, 5, 7]);
    // 95 fast requests and 5 slow ones: p95 is still fast; one more slow one tips it.
    expect(percentileFromHistogram(hist([[0, 95], [5, 5]]), 0.95, 2100)).toBe(50);
    expect(percentileFromHistogram(hist([[0, 94], [5, 6]]), 0.95, 2100)).toBe(2100);
    expect(percentileFromHistogram(hist([[7, 1]]), 0.95, 12000)).toBe(12000);
    expect(percentileFromHistogram(hist([]), 0.95, 0)).toBeNull();
  });

  it("masks ids, numbers, emails and phones so nothing personal is kept and one fault is one group", () => {
    const a = maskMessage('Patient 3f2a8b1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c not found (order 1042), call +998 90 123 45 67 or a.b@x.uz');
    expect(a).toBe("Patient :id not found (order :n), call :phone or :email");
    expect(maskPath("/api/admissions/3f2a8b1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c/history?x=1")).toBe("/api/admissions/:id/history");
    expect(maskPath("/api/orders/1042")).toBe("/api/orders/:n");
    expect(errorFingerprint("server", "GET /api/x", "TypeError", "row 5 missing")).toBe(errorFingerprint("server", "GET /api/x", "TypeError", "row 9 missing"));
  });

  it("keeps only file:line frames of a stack", () => {
    const stack = "TypeError: x\n    at handle (C:\\app\\server\\routes.ts:10:5)\n    at Layer.handle (C:\\app\\node_modules\\express\\router.js:1:1)\n    at process (node:internal/process:1:1)";
    expect(trimStack(stack)).toBe("at handle (server/routes.ts:10:5)");
    expect(trimStack(undefined)).toBeNull();
  });

  it("sums routes over hours, slowest first, and fills every hour", () => {
    const h0 = hourOf(new Date("2026-11-24T08:10:00Z"));
    const h1 = hourOf(new Date("2026-11-24T09:59:00Z"));
    expect(h0).toBe("2026-11-24T08:00:00.000Z");
    const rows: RequestStatRow[] = [
      { hour: h0, method: "GET", route: "/api/patients", count: 10, totalMs: 500, maxMs: 90, errors: 0, histogram: hist([[0, 6], [1, 4]]) },
      { hour: h1, method: "GET", route: "/api/patients", count: 10, totalMs: 700, maxMs: 120, errors: 1, histogram: hist([[1, 9], [2, 1]]) },
      { hour: h1, method: "GET", route: "/api/reports/finance", count: 2, totalMs: 4000, maxMs: 2400, errors: 0, histogram: hist([[5, 2]]) },
    ];
    const routes = summarizeRoutes(rows);
    expect(routes.map((r) => [r.route, r.count, r.avgMs, r.p95Ms, r.errors, r.errorRate, r.slow])).toEqual([
      ["/api/reports/finance", 2, 2000, 2400, 0, 0, true],
      ["/api/patients", 20, 60, 100, 1, 5, false],
    ]);
    const hours = summarizeHours(rows, new Date("2026-11-24T09:30:00Z"), 3);
    expect(hours.map((h) => [h.hour.slice(11, 16), h.count, h.errors])).toEqual([
      ["07:00", 0, 0],
      ["08:00", 10, 0],
      ["09:00", 12, 1],
    ]);
  });
});
