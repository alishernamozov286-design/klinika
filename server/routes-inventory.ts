/**
 * Ombor (Bosqich 5, TZ §7). B5.1: the product catalogue.
 *
 *   inventory.read     the catalogue (with stock on hand) and receipts
 *   inventory.manage   add, edit, deactivate, delete an item that never moved; cancel a receipt
 *   inventory.receive  record a receipt (B5.2)
 *
 * Rules and labels: shared/inventory.ts.
 */
import type { Express } from "express";
import {
  createReceiptSchema,
  insertInventoryItemSchema,
  updateInventoryItemSchema,
  voidRecordSchema,
  type InventoryItemView,
  type StockReceiptView,
} from "@shared/schema";
import {
  INVENTORY_CODE_TAKEN,
  INVENTORY_KIND_SHORT,
  INVENTORY_NAME_TAKEN,
  duplicateLine,
  inventoryKey,
  receiptLineProblem,
} from "@shared/inventory";
import { clockNow } from "@shared/appointment";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
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
      res.json(await storage.listInventoryItems().catch((e) => emptyIfMissing(e, [] as InventoryItemView[])));
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
      // An item that ever moved is refused inside the storage (409): deactivate it instead.
      await storage.deleteInventoryItem(item.id);
      await audit(req, "delete", "inventory", item.id, `"${item.name}" katalogdan o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ------------------------------------------------------- receipts (B5.2)

  app.get(
    "/api/inventory/receipts",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const n = Number(stringParam(req.query.limit) ?? 200);
      const limit = Number.isFinite(n) ? Math.min(Math.max(1, Math.trunc(n)), 500) : 200;
      res.json(await storage.listReceipts({ limit }).catch((e) => emptyIfMissing(e, [] as StockReceiptView[])));
    }),
  );

  app.get(
    "/api/inventory/receipts/:id",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const receipt = await storage.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ message: "Kirim hujjati topilmadi" });
      res.json(receipt);
    }),
  );

  app.post(
    "/api/inventory/receipts",
    requirePermission("inventory.receive"),
    handle(async (req, res) => {
      const input = createReceiptSchema.parse(req.body);
      const today = clockNow().date;
      if (input.receivedOn > today) return res.status(400).json({ message: "Kirim sanasi kelajakda bo'lishi mumkin emas" });
      const items = new Map((await storage.listInventoryItems()).map((i) => [i.id, i]));
      for (const [n, line] of input.lines.entries()) {
        const problem = receiptLineProblem(items.get(line.itemId), line, today);
        if (problem) return res.status(400).json({ message: `${n + 1}-qator: ${problem}` });
      }
      const dup = duplicateLine(input.lines);
      if (dup !== null) {
        return res.status(400).json({ message: `${dup + 1}-qator: bu mahsulot va LOT hujjatda allaqachon bor — miqdorini bitta qatorga yozing` });
      }
      const receipt = await storage.createReceipt(input, actorOf(req));
      const names = receipt.lines.map((l) => `${l.itemName} ${l.quantity} ${l.unit}${l.lotNumber ? ` (LOT ${l.lotNumber})` : ""}`);
      await audit(
        req,
        "create",
        "inventory",
        receipt.id,
        `Kirim №${receipt.number}: ${receipt.supplier}${receipt.documentNumber ? `, hujjat ${receipt.documentNumber}` : ""} — ${names.join("; ")}; jami ${receipt.total} so'm`,
      );
      res.status(201).json(receipt);
    }),
  );

  app.post(
    "/api/inventory/receipts/:id/cancel",
    requirePermission("inventory.manage"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      // Refused inside the storage (409) once any of its batches has been used.
      const receipt = await storage.cancelReceipt(req.params.id, reason, actorOf(req));
      if (!receipt) return res.status(404).json({ message: "Kirim hujjati topilmadi" });
      await audit(req, "void", "inventory", receipt.id, `Kirim №${receipt.number} bekor qilindi (${receipt.supplier}): ${reason}`);
      res.json(receipt);
    }),
  );
}
