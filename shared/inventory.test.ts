import { describe, expect, it } from "vitest";
import { DEFAULT_UNIT, INVENTORY_KINDS, INVENTORY_KIND_LABELS, INVENTORY_KIND_SHORT, inventoryKey } from "./inventory";
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
