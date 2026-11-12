import { describe, expect, it } from "vitest";
import { describeConsumption, movementValue, normInForce, planConsumptions, shortOf, summarizeConsumption } from "./consumption";
import { extraConsumptionSchema, insertNormSchema } from "./schema";

describe("reagent consumption (B5.6, TZ §7.3)", () => {
  const today = "2026-11-12";
  const b = (id: string, itemId: string, remaining: number, expiresOn: string | null, createdAt = "2026-11-01T00:00:00Z") => ({
    id,
    itemId,
    remaining,
    expiresOn,
    createdAt,
    cancelledAt: null as string | null,
  });

  it("a norm counts from its approval until it is replaced", () => {
    const n = { approvedAt: "2026-11-10T08:00:00.000Z", retiredAt: "2026-11-12T08:00:00.000Z" };
    expect(normInForce(n, "2026-11-10T07:59:59.000Z")).toBe(false);
    expect(normInForce(n, "2026-11-10T08:00:00.000Z")).toBe(true);
    expect(normInForce(n, "2026-11-12T07:59:59.000Z")).toBe(true);
    expect(normInForce(n, "2026-11-12T08:00:00.000Z")).toBe(false);
    // A draft (never approved) is never in force, nor is a withdrawn draft.
    expect(normInForce({ approvedAt: null, retiredAt: null }, today)).toBe(false);
    expect(normInForce({ approvedAt: "2026-11-01T00:00:00.000Z", retiredAt: null }, "2027-01-01T00:00:00.000Z")).toBe(true);
  });

  it("takes FEFO from usable stock and records the rest as a shortage, on one working copy", () => {
    const plan = planConsumptions(
      [
        { key: "a", itemId: "glu", quantity: 0.03 },
        { key: "b", itemId: "glu", quantity: 0.03 },
        { key: "c", itemId: "tube", quantity: 1 },
      ],
      [b("old", "glu", 1, "2026-11-01"), b("soon", "glu", 0.04, "2026-12-01"), b("late", "glu", 0.01, "2027-06-01")],
      today,
    );
    // The expired batch is never used; the second line gets what the first left.
    expect(plan[0]).toEqual({ key: "a", allocations: [{ batchId: "soon", quantity: 0.03 }], posted: 0.03, short: 0 });
    expect(plan[1].allocations.map((a) => a.batchId)).toEqual(["soon", "late"]);
    expect(plan[1].posted).toBeCloseTo(0.02);
    expect(plan[1].short).toBeCloseTo(0.01);
    expect(plan[2]).toEqual({ key: "c", allocations: [], posted: 0, short: 1 });
  });

  it("shortages ignore fractional noise", () => {
    expect(shortOf({ quantity: 0.3, posted: 0.1 + 0.2 })).toBe(0);
    expect(shortOf({ quantity: 1, posted: 0.25 })).toBe(0.75);
  });

  it("reports per item and per test; cancelled entries do not count", () => {
    const e = (over: Partial<Parameters<typeof summarizeConsumption>[0][number]>) => ({
      kind: "norm" as const,
      itemId: "glu",
      itemName: "Glyukoza reagenti",
      unit: "to'plam",
      testId: "t-glu",
      testName: "Glyukoza",
      orderTestId: "ot1",
      quantity: 0.01,
      posted: 0.01,
      value: 1800,
      cancelledAt: null,
      ...over,
    });
    const r = summarizeConsumption([
      e({}),
      e({ orderTestId: "ot2" }),
      e({ orderTestId: "ot3", posted: 0, value: 0 }),
      e({ kind: "extra", orderTestId: null, quantity: 0.05, posted: 0.05, value: 9000 }),
      e({ kind: "extra", orderTestId: null, quantity: 1, posted: 1, value: 180000, cancelledAt: "2026-11-12T00:00:00Z" }),
      e({ itemId: "tube", itemName: "Probirka", unit: "dona", testId: null, testName: null, orderTestId: null, kind: "extra", quantity: 2, posted: 2, value: 1800 }),
    ]);
    expect(r).toMatchObject({ value: 1800 * 2 + 9000 + 1800, performed: 3, extraEntries: 2, shortEntries: 1 });
    expect(r.byItem[0]).toEqual({ itemId: "glu", itemName: "Glyukoza reagenti", unit: "to'plam", norm: 0.03, extra: 0.05, total: 0.08, short: 0.01, value: 12600 });
    expect(r.byTest).toEqual([{ testId: "t-glu", testName: "Glyukoza", performed: 3, value: 12600 }]);
  });

  it("money of movements: out positive, a cancellation back", () => {
    expect(movementValue(-0.01, 180000)).toBe(1800);
    expect(movementValue(0.01, 180000)).toBe(-1800);
  });

  it("names what was used for the audit", () => {
    expect(describeConsumption([{ itemName: "Glyukoza reagenti", unit: "to'plam", quantity: 0.01, posted: 0 }, { itemName: "Glyukoza reagenti", unit: "to'plam", quantity: 0.01, posted: 0.01 }])).toBe(
      "Glyukoza reagenti 0.02 to'plam (0.01 yetishmadi)",
    );
  });

  it("validates the forms", () => {
    expect(insertNormSchema.safeParse({ testId: "t", itemId: "i", quantity: 0 }).success).toBe(false);
    expect(insertNormSchema.parse({ testId: "t", itemId: "i", quantity: 0.01 })).toMatchObject({ quantity: 0.01, notes: null });
    expect(extraConsumptionSchema.safeParse({ itemId: "i", quantity: 1, reason: "party" }).success).toBe(false);
    expect(extraConsumptionSchema.parse({ itemId: "i", quantity: 1, reason: "repeat" })).toMatchObject({ testId: null, reason: "repeat" });
  });
});
