import { describe, expect, it } from "vitest";
import type { BillLine } from "./invoice";
import { appointmentCharge, buildBillLines } from "./invoice";
import { describeDiscount, planDiscount } from "./discount";
import { discountBillSchema } from "./schema";

const line = (over: Partial<BillLine>): BillLine => ({
  source: "order",
  sourceId: "o1",
  title: "Laboratoriya #1",
  detail: "",
  createdAt: "2026-11-21T09:00:00.000Z",
  amount: 100000,
  discount: 0,
  paid: 0,
  cancelled: false,
  ...over,
});

describe("discounts (B7.2, TZ §9.2)", () => {
  const lines = [
    line({ source: "appointment", sourceId: "a1", title: "Terapevt ko'rigi", amount: 80000 }),
    line({ sourceId: "o1", title: "Laboratoriya #1042", amount: 45000, paid: 40000 }),
    line({ sourceId: "o2", title: "Laboratoriya #1043", amount: 30000, paid: 30000 }),
  ];

  it("percent: of each line's charge, cut to what it still owes; paid lines are left alone", () => {
    expect(planDiscount(lines, "percent", 10, null)).toEqual({
      lines: [
        { source: "appointment", sourceId: "a1", title: "Terapevt ko'rigi", amount: 8000 },
        { source: "order", sourceId: "o1", title: "Laboratoriya #1042", amount: 4500 },
      ],
      total: 12500,
    });
    // 50% of #1042 would be 22 500, but only 5 000 is unpaid.
    expect(planDiscount(lines, "percent", 50, { source: "order", sourceId: "o1" }).total).toBe(5000);
    expect(planDiscount(lines, "percent", 10, { source: "order", sourceId: "o2" }).total).toBe(0);
  });

  it("sum: shared by what each line owes, whole so'm, never past the debt", () => {
    const p = planDiscount(lines, "amount", 17000, null);
    expect(p.total).toBe(17000);
    expect(p.lines.map((l) => l.amount)).toEqual([16000, 1000]);
    expect(planDiscount(lines, "amount", 1_000_000, null).total).toBe(85000);
    const odd = planDiscount([line({ sourceId: "x", amount: 1 }), line({ sourceId: "y", amount: 1 }), line({ sourceId: "z", amount: 1 })], "amount", 2, null);
    expect(odd.total).toBe(2);
  });

  it("an appointment charges its price less its discount; the bill line shows both", () => {
    expect(appointmentCharge({ price: 80000, discount: 8000 })).toBe(72000);
    expect(appointmentCharge({ price: 80000 })).toBe(80000);
    const [l] = buildBillLines([], [{ id: "a1", status: "completed", price: 80000, discount: 8000, paid: 0, startTime: "09:00", createdAt: "2026-11-21T08:00:00.000Z", serviceName: null, doctorName: "Dr", specialty: "Terapevt" }]);
    expect(l).toMatchObject({ amount: 72000, discount: 8000 });
    expect(describeDiscount("percent", 10, 12500)).toBe("10% (12 500 so'm)");
  });

  it("validates: a reason, percent up to 100", () => {
    expect(discountBillSchema.parse({ mode: "percent", value: 10, reason: "Nogironlik guruhi" })).toEqual({ mode: "percent", value: 10, target: null, reason: "Nogironlik guruhi" });
    expect(discountBillSchema.safeParse({ mode: "percent", value: 120, reason: "Nogironlik guruhi" }).success).toBe(false);
    expect(discountBillSchema.safeParse({ mode: "amount", value: 5000, reason: "ok" }).success).toBe(false);
  });
});
