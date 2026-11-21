import { describe, expect, it } from "vitest";
import {
  cleanDenominations,
  closeProblem,
  countOutcome,
  describeDuration,
  shiftEntries,
  shiftHours,
  summarizeShift,
  sumDenominations,
  type ShiftPaymentRow,
} from "./cash-shift";
import { closeShiftSchema, openShiftSchema } from "./schema";

const row = (over: Partial<ShiftPaymentRow>): ShiftPaymentRow => ({
  id: "p1",
  amount: 50000,
  method: "naqd",
  createdAt: "2026-11-21T09:00:00.000Z",
  voidedAt: null,
  voidReason: null,
  receiptId: null,
  receiptNumber: null,
  invoiceNumber: null,
  orderNumber: 1042,
  patientName: "Toshmatova G.",
  patientNumber: 7,
  ...over,
});

describe("cash shift (B7.5, TZ §9.2)", () => {
  it("a receipt is one entry however many services it paid; newest first", () => {
    const entries = shiftEntries([
      row({ id: "s1", amount: 80000, receiptId: "r1", receiptNumber: 5, invoiceNumber: 3, orderNumber: null }),
      row({ id: "s2", amount: 20000, receiptId: "r1", receiptNumber: 5, invoiceNumber: 3 }),
      row({ id: "p2", amount: -15000, createdAt: "2026-11-21T10:00:00.000Z" }),
    ]);
    expect(entries.map((e) => [e.kind, e.title, e.amount])).toEqual([
      ["refund", "Buyurtma #1042", -15000],
      ["receipt", "Kvitansiya №5 · Hisobvaraq №3", 100000],
    ]);
  });

  it("expected cash = opening + cash taken − cash refunded; terminal and bank stay out of the drawer; voids count nowhere", () => {
    const t = summarizeShift(
      [
        row({ id: "a", amount: 100000 }),
        row({ id: "b", amount: 60000, method: "karta" }),
        row({ id: "c", amount: 40000, method: "o'tkazma" }),
        row({ id: "d", amount: -15000 }),
        row({ id: "e", amount: 30000, voidedAt: "2026-11-21T11:00:00.000Z", voidReason: "xato" }),
      ],
      50000,
    );
    expect(t.byMethod.naqd).toEqual({ taken: 100000, refunded: 15000, net: 85000 });
    expect(t.byMethod.karta.net).toBe(60000);
    expect(t).toMatchObject({ taken: 200000, refunded: 15000, net: 185000, payments: 3, refunds: 1, voided: { count: 1, amount: 30000 }, openingCash: 50000, expectedCash: 135000 });
    expect(summarizeShift([], 20000).expectedCash).toBe(20000);
  });

  it("closing: a drawer that does not match needs a reason; nothing is left behind that was not counted", () => {
    expect(closeProblem({ countedCash: 135000, carriedCash: 50000 }, 135000)).toBeNull();
    expect(closeProblem({ countedCash: 130000, carriedCash: 0 }, 135000)).toMatch(/Kamomad bor/);
    expect(closeProblem({ countedCash: 140000, carriedCash: 0, note: "  " }, 135000)).toMatch(/Ortiqcha bor/);
    expect(closeProblem({ countedCash: 130000, carriedCash: 0, note: "Qaytim xato berildi" }, 135000)).toBeNull();
    expect(closeProblem({ countedCash: 10000, carriedCash: 20000 }, 10000)).toMatch(/ko'p pul qoldirib/);
    expect(closeProblem({ countedCash: -1, carriedCash: 0 }, 0)).toMatch(/kiriting/);
    expect([countOutcome(0), countOutcome(-5), countOutcome(5)]).toEqual(["match", "short", "over"]);
  });

  it("counting aid: so'm notes and coins; only what was counted is kept", () => {
    expect(sumDenominations({ "200000": 2, "50000": 1, "1000": 3, "999": 5 })).toBe(453000);
    expect(sumDenominations(null)).toBe(0);
    expect(cleanDenominations({ "200000": 2, "100000": 0, "500": 1.7 })).toEqual({ "200000": 2, "500": 1 });
    expect(cleanDenominations({ "100000": 0 })).toBeNull();
  });

  it("duration", () => {
    expect(shiftHours("2026-11-21T08:00:00.000Z", "2026-11-21T11:20:00.000Z")).toBeCloseTo(3.333, 2);
    expect(describeDuration(3 + 1 / 3)).toBe("3 soat 20 daqiqa");
    expect(describeDuration(0.5)).toBe("30 daqiqa");
    expect(describeDuration(2)).toBe("2 soat");
  });

  it("validates opening and closing input", () => {
    expect(openShiftSchema.parse({})).toEqual({ openingCash: 0, note: null });
    expect(openShiftSchema.safeParse({ openingCash: -1 }).success).toBe(false);
    expect(closeShiftSchema.parse({ countedCash: 135000, expectedCash: 135000 })).toMatchObject({ countedCash: 135000, carriedCash: 0, note: null });
    expect(closeShiftSchema.safeParse({ countedCash: 1.5, expectedCash: 0 }).success).toBe(false);
    expect(closeShiftSchema.safeParse({ countedCash: 3_000_000_000, expectedCash: 0 }).success).toBe(false);
  });
});
