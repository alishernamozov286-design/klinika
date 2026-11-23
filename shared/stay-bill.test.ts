import { describe, expect, it } from "vitest";
import { dayDiff, stayCharge, stayLineText } from "./stay-bill";
import { buildBillLines, paymentSource, paymentTarget } from "./invoice";

// Days cut in UTC here; the app passes the clinic's localDay.
const dayOf = (iso: string) => iso.slice(0, 10);
const base = { status: "active" as const, orders: [], discount: 0, dayOf };

describe("bed-days", () => {
  it("counts calendar days per period, the day of leaving not counted", () => {
    expect(dayDiff("2026-11-20", "2026-11-23")).toBe(3);
    const c = stayCharge({
      ...base,
      now: "2026-11-25T09:00:00Z",
      periods: [
        { fromAt: "2026-11-20T15:00:00Z", toAt: "2026-11-22T10:00:00Z", dayPrice: 150_000, wardName: "101", bedLabel: "1" },
        { fromAt: "2026-11-22T10:00:00Z", toAt: null, dayPrice: 300_000, wardName: "VIP", bedLabel: "1" },
      ],
    });
    expect(c.bedDays.map((b) => [b.wardName, b.days, b.amount])).toEqual([
      ["101", 2, 300_000],
      ["VIP", 3, 900_000],
    ]);
    expect([c.days, c.bedAmount, c.amount]).toEqual([5, 1_200_000, 1_200_000]);
  });

  it("charges one day at the first ward for a stay shorter than a day", () => {
    const c = stayCharge({
      ...base,
      now: "2026-11-20T18:00:00Z",
      periods: [
        { fromAt: "2026-11-20T09:00:00Z", toAt: "2026-11-20T12:00:00Z", dayPrice: 150_000, wardName: "101", bedLabel: "1" },
        { fromAt: "2026-11-20T12:00:00Z", toAt: null, dayPrice: 300_000, wardName: "VIP", bedLabel: "1" },
      ],
    });
    expect([c.days, c.amount]).toEqual([1, 150_000]);
  });
});

describe("the stay line", () => {
  const periods = [{ fromAt: "2026-11-20T09:00:00Z", toAt: null, dayPrice: 100_000, wardName: "101", bedLabel: "2" }];
  const orders = [
    { id: "o1", name: "Ingalyatsiya", unitPrice: 30_000, done: 4 },
    { id: "o2", name: "Massaj (qo'lda)", unitPrice: null, done: 2 },
    { id: "o3", name: "Fizioterapiya", unitPrice: 50_000, done: 0 },
  ];

  it("adds procedures done at their ordered price; hand-written ones are given, not billed", () => {
    const c = stayCharge({ ...base, now: "2026-11-23T09:00:00Z", periods, orders, discount: 50_000 });
    expect(c.procedures).toEqual([{ orderId: "o1", name: "Ingalyatsiya", done: 4, unitPrice: 30_000, amount: 120_000 }]);
    expect(c.unpriced).toEqual([{ name: "Massaj (qo'lda)", done: 2 }]);
    expect([c.gross, c.discount, c.amount]).toEqual([420_000, 50_000, 370_000]);
    expect(stayLineText(7, c)).toEqual({ title: "Statsionar karta №7", detail: "3 yotoq-kun · 4 muolaja" });
  });

  it("a cancelled stay charges nothing but keeps what was paid as credit", () => {
    const c = stayCharge({ ...base, status: "cancelled", now: "2026-11-23T09:00:00Z", periods, orders });
    expect(c.amount).toBe(0);
    const [line] = buildBillLines([], [], [{ id: "a1", number: 7, status: "cancelled", admittedAt: "2026-11-20T09:00:00Z", charge: c, paid: 100_000 }]);
    expect(line).toMatchObject({ source: "stay", sourceId: "a1", amount: 0, paid: 100_000, cancelled: true });
    expect(buildBillLines([], [], [{ id: "a1", number: 7, status: "cancelled", admittedAt: "2026-11-20T09:00:00Z", charge: c, paid: 0 }])).toEqual([]);
  });

  it("a payment pays exactly one of the three", () => {
    expect(paymentTarget("stay", "a1")).toEqual({ orderId: null, appointmentId: null, admissionId: "a1" });
    expect(paymentSource({ orderId: null, appointmentId: null, admissionId: "a1" })).toEqual({ source: "stay", sourceId: "a1" });
    expect(paymentSource({ orderId: "o", appointmentId: null })).toEqual({ source: "order", sourceId: "o" });
  });
});
