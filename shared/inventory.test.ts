import { describe, expect, it } from "vitest";
import { DEFAULT_UNIT, INVENTORY_KINDS, INVENTORY_KIND_LABELS, INVENTORY_KIND_SHORT, allocateFefo, duplicateIssueLine, duplicateLine, inventoryKey, isLotTracked, lineTotal, planIssue, receiptLineProblem } from "./inventory";
import { insertInventoryItemSchema } from "./schema";

describe("inventory catalogue (B5.1, TZ §7.2)", () => {
  it("has the eight TZ product types, each labelled", () => {
    expect(INVENTORY_KINDS).toHaveLength(8);
    for (const k of INVENTORY_KINDS) {
      expect(INVENTORY_KIND_LABELS[k]).toBeTruthy();
      expect(INVENTORY_KIND_SHORT[k]).toBeTruthy();
      expect(DEFAULT_UNIT[k]).toBeTruthy();
    }
  });

  it("compares names and codes without case or extra spaces", () => {
    expect(inventoryKey("  Glyukoza   reagenti ")).toBe(inventoryKey("GLYUKOZA reagenti"));
  });

  it("validates the form", () => {
    const ok = insertInventoryItemSchema.parse({ name: "Probirka EDTA 4 ml", kind: "tube", unit: "dona", code: "", salePrice: null });
    expect(ok).toMatchObject({ code: null, minStock: 0, salePrice: null, isActive: true });
    expect(insertInventoryItemSchema.safeParse({ name: "X1", kind: "food", unit: "dona" }).success).toBe(false);
    expect(insertInventoryItemSchema.safeParse({ name: "X1", kind: "tube", unit: "dona", minStock: -1 }).success).toBe(false);
    expect(insertInventoryItemSchema.safeParse({ name: "X1", kind: "tube", unit: "dona", salePrice: 1.5 }).success).toBe(false);
    expect(insertInventoryItemSchema.safeParse({ name: "X1", kind: "tube", unit: "" }).success).toBe(false);
    expect(insertInventoryItemSchema.parse({ name: "Etanol 70%", kind: "disinfectant", unit: "l", minStock: 2.5 }).minStock).toBe(2.5);
  });
});

describe("receipt rules (B5.2, TZ §7.3)", () => {
  const reagent = { name: "Glyukoza reagenti", kind: "reagent" as const, isActive: true };
  const tube = { name: "Probirka", kind: "tube" as const, isActive: true };
  const today = "2026-11-07";

  it("LOT and expiry are required for tracked types only", () => {
    expect(receiptLineProblem(reagent, { quantity: 2 }, today)).toMatch(/LOT/);
    expect(receiptLineProblem(reagent, { quantity: 2, lotNumber: "L1" }, today)).toMatch(/muddat/);
    expect(receiptLineProblem(reagent, { quantity: 2, lotNumber: "L1", expiresOn: "2027-01-01" }, today)).toBeNull();
    expect(receiptLineProblem(tube, { quantity: 500 }, today)).toBeNull();
  });

  it("refuses expired goods, inactive or missing items, and zero quantity", () => {
    expect(receiptLineProblem(tube, { quantity: 1, expiresOn: "2026-11-06" }, today)).toMatch(/o'tgan/);
    expect(receiptLineProblem(tube, { quantity: 1, expiresOn: today }, today)).toBeNull();
    expect(receiptLineProblem({ ...tube, isActive: false }, { quantity: 1 }, today)).toMatch(/faolsiz/);
    expect(receiptLineProblem(undefined, { quantity: 1 }, today)).toMatch(/topilmadi/);
    expect(receiptLineProblem(tube, { quantity: 0 }, today)).toMatch(/musbat/);
  });

  it("the same item and LOT twice is a slip", () => {
    expect(duplicateLine([{ itemId: "a", lotNumber: "L1" }, { itemId: "a", lotNumber: "l1 " }])).toBe(1);
    expect(duplicateLine([{ itemId: "a", lotNumber: "L1" }, { itemId: "a", lotNumber: "L2" }, { itemId: "b", lotNumber: "L1" }])).toBeNull();
    expect(duplicateLine([{ itemId: "t" }, { itemId: "t", lotNumber: null }])).toBe(1);
  });

  it("line money in whole so'm", () => {
    expect(lineTotal(2.5, 30000)).toBe(75000);
    expect(lineTotal(3, 333.33 as number)).toBe(1000);
    expect(isLotTracked("medicine")).toBe(true);
    expect(isLotTracked("syringe")).toBe(false);
  });
});

describe("FEFO issues (B5.3)", () => {
  const today = "2026-11-10";
  const b = (id: string, remaining: number, expiresOn: string | null, createdAt = "2026-11-01T00:00:00Z", itemId = "glu") => ({
    id,
    itemId,
    remaining,
    expiresOn,
    createdAt,
    cancelledAt: null as string | null,
  });
  const items = new Map([
    ["glu", { id: "glu", name: "Glyukoza", unit: "to'plam" }],
    ["tub", { id: "tub", name: "Probirka", unit: "dona" }],
  ]);

  it("takes the nearest expiry first, undated last, older receipt among equals", () => {
    const r = allocateFefo(
      [b("late", 5, "2027-06-01"), b("none", 5, null), b("soon", 2, "2026-12-01"), b("soon-new", 2, "2026-12-01", "2026-11-05T00:00:00Z")],
      7,
      today,
    );
    expect(r).toEqual({
      ok: true,
      allocations: [
        { batchId: "soon", quantity: 2 },
        { batchId: "soon-new", quantity: 2 },
        { batchId: "late", quantity: 3 },
      ],
    });
  });

  it("never gives a department an expired batch; a write-off may take it", () => {
    const batches = [b("old", 3, "2026-11-01"), b("ok", 1, "2027-01-01")];
    expect(allocateFefo(batches, 2, today)).toEqual({ ok: false, available: 1 });
    expect(allocateFefo(batches, 2, today, { allowExpired: true })).toEqual({ ok: true, allocations: [{ batchId: "old", quantity: 2 }] });
    // Expiring today is still good today.
    expect(allocateFefo([b("t", 1, today)], 1, today).ok).toBe(true);
  });

  it("plans several lines on one working copy, pinned batches first", () => {
    const batches = [b("a", 3, "2026-12-01"), b("c", 4, "2027-03-01"), b("t1", 100, null, undefined, "tub")];
    const plan = planIssue(
      "department",
      [
        { itemId: "glu", quantity: 3 },
        { itemId: "glu", quantity: 2, batchId: "a" },
        { itemId: "tub", quantity: 40 },
      ],
      batches,
      items,
      today,
    );
    expect(plan).toEqual({
      ok: true,
      allocations: [
        { batchId: "a", quantity: 2, itemId: "glu" },
        { batchId: "a", quantity: 1, itemId: "glu" },
        { batchId: "c", quantity: 2, itemId: "glu" },
        { batchId: "t1", quantity: 40, itemId: "tub" },
      ],
    });
  });

  it("names the line and the shortage, and says when only expired stock is left", () => {
    const short = planIssue("department", [{ itemId: "tub", quantity: 1 }, { itemId: "glu", quantity: 5 }], [b("a", 3, "2027-01-01"), b("t", 9, null, undefined, "tub")], items, today);
    expect(short).toEqual({ ok: false, message: `2-qator: "Glyukoza": qoldiq 3 to'plam, so'ralgan 5 to'plam` });
    const expired = planIssue("department", [{ itemId: "glu", quantity: 1 }], [b("x", 3, "2026-01-01")], items, today);
    expect(!expired.ok && expired.message).toMatch(/muddati o'tmagan qoldiq 0/);
    const pinnedExpired = planIssue("department", [{ itemId: "glu", quantity: 1, batchId: "x" }], [b("x", 3, "2026-01-01")], items, today);
    expect(!pinnedExpired.ok && pinnedExpired.message).toMatch(/hisobdan chiqaring/);
    const wrongBatch = planIssue("department", [{ itemId: "glu", quantity: 1, batchId: "t" }], [b("t", 9, null, undefined, "tub")], items, today);
    expect(!wrongBatch.ok && wrongBatch.message).toMatch(/Partiya topilmadi/);
  });

  it("duplicate lines", () => {
    expect(duplicateIssueLine([{ itemId: "a" }, { itemId: "a", batchId: null }])).toBe(1);
    expect(duplicateIssueLine([{ itemId: "a" }, { itemId: "a", batchId: "b1" }])).toBeNull();
  });
});
