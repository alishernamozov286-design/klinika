/**
 * Ombor (Bosqich 5, TZ §7). B5.1: the product catalogue.
 *
 *   inventory.read    the catalogue
 *   inventory.manage  add, edit, deactivate, delete an item that never moved
 *
 * Rules and labels: shared/inventory.ts.
 */
import type { Express } from "express";
import { insertInventoryItemSchema, updateInventoryItemSchema, type InventoryItem } from "@shared/schema";
import { INVENTORY_CODE_TAKEN, INVENTORY_KIND_SHORT, INVENTORY_NAME_TAKEN, inventoryKey } from "@shared/inventory";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle } from "./route-helpers";
import { storage } from "./storage";

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000);

export function registerInventoryRoutes(app: Express) {
  /** Name and code are unique without case or extra spaces; null codes never clash. */
  async function clash(input: { name?: string; code?: string | null }, exceptId?: string): Promise<string | null> {
    const items = await storage.listInventoryItems();
    const others = items.filter((i) => i.id !== exceptId);
    if (input.name && others.some((i) => inventoryKey(i.name) === inventoryKey(input.name!))) return INVENTORY_NAME_TAKEN;
    if (input.code && others.some((i) => i.code && inventoryKey(i.code) === inventoryKey(input.code!))) return INVENTORY_CODE_TAKEN;
    return null;
  }

  app.get(
    "/api/inventory/items",
    requirePermission("inventory.read"),
    handle(async (_req, res) => {
      res.json(await storage.listInventoryItems().catch((e) => emptyIfMissing(e, [] as InventoryItem[])));
    }),
  );

  app.post(
    "/api/inventory/items",
    requirePermission("inventory.manage"),
    handle(async (req, res) => {
      const input = insertInventoryItemSchema.parse(req.body);
      const problem = await clash(input);
      if (problem) return res.status(409).json({ message: problem });
      const item = await storage.createInventoryItem(input, actorOf(req));
      await audit(
        req,
        "create",
        "inventory",
        item.id,
        `"${item.name}" katalogga qo'shildi (${INVENTORY_KIND_SHORT[item.kind]}, ${item.unit}, minimal qoldiq ${fmtQty(item.minStock)})`,
      );
      res.status(201).json(item);
    }),
  );

  app.patch(
    "/api/inventory/items/:id",
    requirePermission("inventory.manage"),
    handle(async (req, res) => {
      const input = updateInventoryItemSchema.parse(req.body);
      const before = await storage.getInventoryItem(req.params.id);
      if (!before) return res.status(404).json({ message: "Mahsulot topilmadi" });
      const problem = await clash(input, before.id);
      if (problem) return res.status(409).json({ message: problem });
      const item = await storage.updateInventoryItem(before.id, input, actorOf(req));
      if (!item) return res.status(404).json({ message: "Mahsulot topilmadi" });

      const changes: string[] = [];
      if (item.name !== before.name) changes.push(`nomi: ${before.name} → ${item.name}`);
      if (item.kind !== before.kind) changes.push(`turi: ${INVENTORY_KIND_SHORT[item.kind]}`);
      if (item.unit !== before.unit) changes.push(`birlik: ${before.unit} → ${item.unit}`);
      if (item.minStock !== before.minStock) changes.push(`minimal qoldiq: ${fmtQty(before.minStock)} → ${fmtQty(item.minStock)}`);
      if (item.salePrice !== before.salePrice) changes.push(`narx: ${before.salePrice ?? "—"} → ${item.salePrice ?? "—"}`);
      if (item.isActive !== before.isActive) changes.push(item.isActive ? "qayta faollashtirildi" : "faolsizlantirildi");
      if (item.code !== before.code) changes.push(`artikul: ${item.code ?? "—"}`);
      if (item.manufacturer !== before.manufacturer) changes.push("ishlab chiqaruvchi");
      if (item.notes !== before.notes) changes.push("izoh");
      await audit(req, "update", "inventory", item.id, `"${item.name}" — ${changes.join(", ") || "o'zgarishsiz saqlandi"}`);
      res.json(item);
    }),
  );

  app.delete(
    "/api/inventory/items/:id",
    requirePermission("inventory.manage"),
    handle(async (req, res) => {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) return res.status(404).json({ message: "Mahsulot topilmadi" });
      // Until receipts exist (B5.2) nothing can refer to an item. From then on
      // the storage refuses an item with movements, and it is deactivated instead.
      await storage.deleteInventoryItem(item.id);
      await audit(req, "delete", "inventory", item.id, `"${item.name}" katalogdan o'chirildi`);
      res.sendStatus(204);
    }),
  );
}
