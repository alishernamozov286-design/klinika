import { describe, expect, it } from "vitest";
import { DEFAULT_UNIT, INVENTORY_KINDS, INVENTORY_KIND_LABELS, INVENTORY_KIND_SHORT, duplicateLine, inventoryKey, isLotTracked, lineTotal, receiptLineProblem } from "./inventory";
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
