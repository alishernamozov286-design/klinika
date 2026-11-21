import { describe, expect, it } from "vitest";
import { allocatePayment, billTotals, buildBillLines, describeShares, filterBills, lineCredit, lineDue, slipFigures, type BillLine } from "./invoice";
import { payBillSchema } from "./schema";

const line = (over: Partial<BillLine>): BillLine => ({
  source: "order",
  sourceId: "o1",
  title: "Laboratoriya #1",
  detail: "",
  createdAt: "2026-11-20T09:00:00.000Z",
  amount: 100000,
  discount: 0,
  paid: 0,
  cancelled: false,
  ...over,
});

describe("patient bill (B7.1, TZ §9.1–9.2)", () => {
  it("builds lines from a visit's appointments and orders; cancelled ones stay only while they hold money", () => {
    const lines = buildBillLines(
      [
        { id: "o1", orderNumber: 1042, status: "pending", totalAmount: 45000, paidAmount: 0, createdAt: "2026-11-20T10:00:00.000Z", tests: 2 },
        { id: "o2", orderNumber: 1043, status: "cancelled", totalAmount: 30000, paidAmount: 0, createdAt: "2026-11-20T10:05:00.000Z", tests: 1 },
        { id: "o3", orderNumber: 1044, status: "cancelled", totalAmount: 20000, paidAmount: 20000, createdAt: "2026-11-20T10:06:00.000Z", tests: 1 },
      ],
      [
        { id: "a1", status: "completed", price: 80000, paid: 0, startTime: "09:00", createdAt: "2026-11-20T08:00:00.000Z", serviceName: null, doctorName: "Rahimova D.", specialty: "Terapevt" },
        { id: "a2", status: "scheduled", price: 50000, paid: 0, startTime: "11:00", createdAt: "2026-11-20T08:10:00.000Z", serviceName: "UZI", doctorName: "Karimov A.", specialty: "Uzist" },
      ],
    );
    expect(lines.map((l) => [l.title, l.amount, l.paid, l.cancelled])).toEqual([
      ["Terapevt ko'rigi", 80000, 0, false],
      ["Laboratoriya #1042", 45000, 0, false],
      ["Laboratoriya #1044", 0, 20000, true],
    ]);
    expect(lines[1].detail).toBe("2 ta tahlil");
    const t = billTotals(lines);
    expect(t).toEqual({ amount: 125000, paid: 20000, due: 125000, credit: 20000, status: "partial" });
  });

  it("states", () => {
    expect(billTotals([]).status).toBe("empty");
    expect(billTotals([line({})]).status).toBe("unpaid");
    expect(billTotals([line({ paid: 40000 })]).status).toBe("partial");
    expect(billTotals([line({ paid: 100000 })]).status).toBe("paid");
    expect(billTotals([line({ amount: 0, paid: 5000, cancelled: true })]).status).toBe("overpaid");
    expect(lineDue(line({ paid: 120000 }))).toBe(0);
    expect(lineCredit(line({ paid: 120000 }))).toBe(20000);
  });

  it("one payment for several services: oldest first, never past what a line owes, the rest is change", () => {
    const lines = [
      line({ source: "order", sourceId: "o1", createdAt: "2026-11-20T10:00:00.000Z", amount: 45000 }),
      line({ source: "appointment", sourceId: "a1", title: "Terapevt ko'rigi", createdAt: "2026-11-20T08:00:00.000Z", amount: 80000, paid: 30000 }),
      line({ source: "order", sourceId: "o3", createdAt: "2026-11-20T07:00:00.000Z", amount: 0, paid: 20000, cancelled: true }),
    ];
    expect(allocatePayment(lines, 60000)).toEqual({
      shares: [
        { source: "appointment", sourceId: "a1", amount: 50000 },
        { source: "order", sourceId: "o1", amount: 10000 },
      ],
      taken: 60000,
    });
    // More than owed: cut to the debt.
    expect(allocatePayment(lines, 1_000_000).taken).toBe(95000);
    expect(allocatePayment([line({ paid: 100000 })], 5000)).toEqual({ shares: [], taken: 0 });
    expect(describeShares(allocatePayment(lines, 60000).shares, lines)).toBe("Terapevt ko'rigi 50 000 + Laboratoriya #1 10 000");
  });

  it("filters the desk's list", () => {
    const rows = [
      { id: 1, totals: billTotals([line({})]) },
      { id: 2, totals: billTotals([line({ paid: 100000 })]) },
      { id: 3, totals: billTotals([line({ paid: 50000 })]) },
    ];
    expect(filterBills(rows, "due").map((r) => r.id)).toEqual([1, 3]);
    expect(filterBills(rows, "settled").map((r) => r.id)).toEqual([2]);
    expect(filterBills(rows, "all")).toHaveLength(3);
  });

  it("validates a payment: positive whole so'm, a known method", () => {
    expect(payBillSchema.parse({ amount: 125000 })).toEqual({ amount: 125000, method: "naqd", note: null });
    expect(payBillSchema.safeParse({ amount: -5 }).success).toBe(false);
    expect(payBillSchema.safeParse({ amount: 10.5 }).success).toBe(false);
    expect(payBillSchema.safeParse({ amount: 10, method: "crypto" }).success).toBe(false);
  });

  it("the chek: change only for cash handed over above the receipt; a reprint is a copy; old receipts say nothing", () => {
    expect(slipFigures({ amount: 95000, method: "naqd", tendered: 100000, dueAfter: 0 }, 1)).toEqual({ tendered: 100000, change: 5000, dueAfter: 0, paidInFull: true, copy: false });
    expect(slipFigures({ amount: 95000, method: "karta", tendered: 120000, dueAfter: 25000 }, 2)).toEqual({ tendered: null, change: 0, dueAfter: 25000, paidInFull: false, copy: true });
    expect(slipFigures({ amount: 50000, method: "naqd", tendered: 50000, dueAfter: 10000 }, 1).change).toBe(0);
    expect(slipFigures({ amount: 50000, method: "naqd", tendered: null, dueAfter: null }, 1)).toMatchObject({ change: 0, dueAfter: null, paidInFull: false });
  });
});
