import { describe, expect, it } from "vitest";
import { ledgerTotal, orderDeleteProblem } from "./ledger";

describe("ledger rules (TZ §10, B1.10)", () => {
  it("adds up payments and refunds, leaving voided rows out", () => {
    expect(ledgerTotal([])).toBe(0);
    expect(
      ledgerTotal([
        { amount: 50_000, voidedAt: null },
        { amount: -10_000, voidedAt: null },
        { amount: 20_000, voidedAt: "2026-11-06T10:00:00.000Z" },
      ]),
    ).toBe(40_000);
  });

  it("lets only an order with no money and no result be deleted", () => {
    expect(orderDeleteProblem(0, 0)).toBeNull();
    expect(orderDeleteProblem(1, 0)).toMatch(/to'lov yozuvlari bor/);
    expect(orderDeleteProblem(0, 3)).toMatch(/natijalari bor/);
    // Money is named first: it is what an auditor asks about.
    expect(orderDeleteProblem(2, 2)).toMatch(/to'lov/);
  });
});
