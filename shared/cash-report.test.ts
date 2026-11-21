import { describe, expect, it } from "vitest";
import { cashDays, cashTotal, changePercent, methodShares, type CashDayRow } from "./cash-report";

const rows: CashDayRow[] = [
  { date: "2026-11-19", method: "naqd", taken: 300000, refunded: 0, payments: 3, refunds: 0 },
  { date: "2026-11-19", method: "karta", taken: 200000, refunded: 0, payments: 2, refunds: 0 },
  { date: "2026-11-21", method: "naqd", taken: 100000, refunded: 45000, payments: 1, refunds: 1 },
  { date: "2026-11-21", method: "o'tkazma", taken: 50000, refunded: 0, payments: 1, refunds: 0 },
];

describe("cash desk takings (B7.7, TZ §9.1)", () => {
  it("days: every day of the period, quiet ones at zero, refunds taken off per method", () => {
    const days = cashDays(rows, "2026-11-19", "2026-11-21");
    expect(days.map((d) => [d.date, d.taken, d.refunded, d.net])).toEqual([
      ["2026-11-19", 500000, 0, 500000],
      ["2026-11-20", 0, 0, 0],
      ["2026-11-21", 150000, 45000, 105000],
    ]);
    expect(days[2].byMethod.naqd).toEqual({ taken: 100000, refunded: 45000, net: 55000 });
    expect(days[2]).toMatchObject({ payments: 2, refunds: 1 });
  });

  it("the period's total and how it was paid", () => {
    const t = cashTotal(cashDays(rows, "2026-11-19", "2026-11-21"));
    expect(t).toMatchObject({ taken: 650000, refunded: 45000, net: 605000, payments: 7, refunds: 1 });
    expect(t.byMethod.karta.net).toBe(200000);
    const shares = methodShares(t);
    expect(shares.map((s) => [s.method, Math.round(s.share * 100)])).toEqual([
      ["naqd", 59],
      ["karta", 33],
      ["o'tkazma", 8],
    ]);
  });

  it("trend against an earlier figure", () => {
    expect(changePercent(120000, 100000)).toBe(20);
    expect(changePercent(80000, 100000)).toBe(-20);
    expect(changePercent(50000, 0)).toBeNull();
  });
});
