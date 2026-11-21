import { describe, expect, it } from "vitest";
import type { BillLine } from "./invoice";
import { allocateRefund, refundActionProblem, refundAvailable } from "./refund";
import { requestRefundSchema } from "./schema";

const line = (over: Partial<BillLine>): BillLine => ({
  source: "order",
  sourceId: "o1",
  title: "Laboratoriya #1",
  detail: "",
  createdAt: "2026-11-21T09:00:00.000Z",
  amount: 100000,
  discount: 0,
  paid: 100000,
  cancelled: false,
  ...over,
});

describe("refunds (B7.4, TZ §9.2)", () => {
  const lines = [
    line({ sourceId: "o1", title: "Laboratoriya #1042", amount: 0, paid: 45000, cancelled: true, createdAt: "2026-11-21T10:00:00.000Z" }),
    line({ source: "appointment", sourceId: "a1", title: "Terapevt ko'rigi", amount: 60000, paid: 80000, createdAt: "2026-11-21T08:00:00.000Z" }),
    line({ sourceId: "o2", title: "Laboratoriya #1043", amount: 30000, paid: 10000 }),
  ];

  it("only a bill's credit is refundable, less what open requests already hold", () => {
    expect(refundAvailable(lines, [])).toBe(65000);
    expect(
      refundAvailable(lines, [
        { amount: 20000, status: "requested" },
        { amount: 5000, status: "approved" },
        { amount: 40000, status: "rejected" },
        { amount: 40000, status: "cancelled" },
        { amount: 1000, status: "paid" },
      ]),
    ).toBe(40000);
    expect(refundAvailable([line({ paid: 50000 })], [])).toBe(0);
  });

  it("a payout takes the credit oldest first and never more than a line holds", () => {
    expect(allocateRefund(lines, 30000)).toEqual({
      lines: [
        { source: "appointment", sourceId: "a1", title: "Terapevt ko'rigi", amount: 20000 },
        { source: "order", sourceId: "o1", title: "Laboratoriya #1042", amount: 10000 },
      ],
      taken: 30000,
    });
    // The bill changed under an approved refund: short.
    expect(allocateRefund(lines, 90000).taken).toBe(65000);
  });

  it("the flow: ask → approve or reject → pay; open ones may be cancelled", () => {
    expect(refundActionProblem("requested", "approve")).toBeNull();
    expect(refundActionProblem("requested", "pay")).toMatch(/pulni berish mumkin emas/);
    expect(refundActionProblem("approved", "pay")).toBeNull();
    expect(refundActionProblem("approved", "cancel")).toBeNull();
    expect(refundActionProblem("paid", "cancel")).toMatch(/Qaytarildi/);
    expect(refundActionProblem("rejected", "approve")).toMatch(/Rad etilgan/);
  });

  it("validates a request", () => {
    expect(requestRefundSchema.parse({ amount: 45000, reason: "Tahlil bekor qilindi" })).toEqual({ amount: 45000, method: "naqd", reason: "Tahlil bekor qilindi" });
    expect(requestRefundSchema.safeParse({ amount: 45000, reason: "xato" }).success).toBe(false);
    expect(requestRefundSchema.safeParse({ amount: 0, reason: "Tahlil bekor qilindi" }).success).toBe(false);
  });
});
