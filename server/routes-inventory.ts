/**
 * Ombor (Bosqich 5, TZ §7): catalogue, receipts, issues, stock and counts.
 *
 *   inventory.read     the catalogue (with stock on hand) and receipts
 *   inventory.manage   add, edit, deactivate, delete an item that never moved; cancel a receipt
 *   inventory.receive  record a receipt (B5.2)
 *   inventory.issue    issue to a department or write off (B5.3)
 *   inventory.count    open, count, post or cancel a stock count (B5.5)
 *
 * Rules and labels: shared/inventory.ts.
 */
import type { Express } from "express";
import {
  createCountSchema,
  createIssueSchema,
  saveCountEntriesSchema,
  createReceiptSchema,
  insertInventoryItemSchema,
  updateInventoryItemSchema,
  voidRecordSchema,
  type InventoryBatchView,
  type InventoryItemView,
  type LabConsumptionView,
  type StockCountView,
  type StockIssueView,
  type StockReceiptView,
} from "@shared/schema";
import {
  INVENTORY_CODE_TAKEN,
  INVENTORY_KIND_SHORT,
  INVENTORY_NAME_TAKEN,
  ISSUE_KIND_LABELS,
  WRITEOFF_REASON_LABELS,
  countScopeLabel,
  duplicateIssueLine,
  duplicateLine,
  fmtQty,
  summarizeCount,
  summarizeStock,
  inventoryKey,
  receiptLineProblem,
} from "@shared/inventory";
import { clockNow } from "@shared/appointment";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";


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

  // --------------------------------------------------------- issues (B5.3)

  app.get(
    "/api/inventory/batches",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      res.json(await storage.listBatches({ itemId: stringParam(req.query.itemId) }).catch((e) => emptyIfMissing(e, [] as InventoryBatchView[])));
    }),
  );

  app.get(
    "/api/inventory/issues",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const n = Number(stringParam(req.query.limit) ?? 200);
      const limit = Number.isFinite(n) ? Math.min(Math.max(1, Math.trunc(n)), 500) : 200;
      res.json(await storage.listIssues({ limit }).catch((e) => emptyIfMissing(e, [] as StockIssueView[])));
    }),
  );

  app.get(
    "/api/inventory/issues/:id",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const issue = await storage.getIssue(req.params.id);
      if (!issue) return res.status(404).json({ message: "Chiqim hujjati topilmadi" });
      res.json(issue);
    }),
  );

  app.post(
    "/api/inventory/issues",
    requirePermission("inventory.issue"),
    handle(async (req, res) => {
      const input = createIssueSchema.parse(req.body);
      const today = clockNow().date;
      if (input.issuedOn > today) return res.status(400).json({ message: "Chiqim sanasi kelajakda bo'lishi mumkin emas" });
      if (input.kind === "department") {
        if (!input.departmentId) return res.status(400).json({ message: "Bo'limni tanlang" });
        const dept = (await storage.listDepartments()).find((d) => d.id === input.departmentId);
        if (!dept) return res.status(400).json({ message: "Bo'lim topilmadi" });
        if (!dept.isActive) return res.status(400).json({ message: `"${dept.name}" bo'limi yopilgan` });
        if (!input.receivedBy || input.receivedBy.length < 2) return res.status(400).json({ message: "Kim olganini yozing" });
      } else if (!input.reason) {
        return res.status(400).json({ message: "Hisobdan chiqarish sababini tanlang" });
      }
      const dup = duplicateIssueLine(input.lines);
      if (dup !== null) return res.status(400).json({ message: `${dup + 1}-qator: bu mahsulot hujjatda allaqachon bor — miqdorini bitta qatorga yozing` });
      // Stock is checked and split inside the storage, on locked batches (409 with the line).
      const issue = await storage.createIssue(input, today, actorOf(req));
      const byItem = new Map<string, { name: string; unit: string; q: number; lots: string[] }>();
      for (const l of issue.lines) {
        const e = byItem.get(l.itemId) ?? { name: l.itemName, unit: l.unit, q: 0, lots: [] };
        e.q += l.quantity;
        if (l.lotNumber) e.lots.push(l.lotNumber);
        byItem.set(l.itemId, e);
      }
      const what = Array.from(byItem.values())
        .map((e) => `${e.name} ${fmtQty(e.q)} ${e.unit}${e.lots.length ? ` (LOT ${e.lots.join(", ")})` : ""}`)
        .join("; ");
      const where =
        issue.kind === "department"
          ? `${issue.departmentName ?? "bo'lim"}, oldi: ${issue.receivedBy}`
          : `sabab: ${issue.reason ? WRITEOFF_REASON_LABELS[issue.reason] : "—"}`;
      await audit(req, "create", "inventory", issue.id, `Chiqim №${issue.number} (${ISSUE_KIND_LABELS[issue.kind]}, ${where}) — ${what}; tannarx ${issue.total} so'm`);
      res.status(201).json(issue);
    }),
  );

  app.post(
    "/api/inventory/issues/:id/cancel",
    requirePermission("inventory.manage"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const issue = await storage.cancelIssue(req.params.id, reason, actorOf(req));
      if (!issue) return res.status(404).json({ message: "Chiqim hujjati topilmadi" });
      await audit(req, "void", "inventory", issue.id, `Chiqim №${issue.number} bekor qilindi, mahsulot partiyalariga qaytarildi: ${reason}`);
      res.json(issue);
    }),
  );

  // ------------------------------------------------- stock & expiry (B5.4)

  /** TZ §7.3: the warnings the warehouse acts on — expired, expiring, running low. */
  app.get(
    "/api/inventory/alerts",
    requirePermission("inventory.read"),
    handle(async (_req, res) => {
      const today = clockNow().date;
      const [items, batches, short] = await Promise.all([
        storage.listInventoryItems().catch((e) => emptyIfMissing(e, [] as InventoryItemView[])),
        storage.listBatches().catch((e) => emptyIfMissing(e, [] as InventoryBatchView[])),
        storage.listConsumptions({ shortOnly: true, limit: 1000 }).catch((e) => emptyIfMissing(e, [] as LabConsumptionView[])),
      ]);
      res.json({ ...summarizeStock(items, batches, today), consumptionShort: short.length });
    }),
  );

  // ------------------------------------------------------- counts (B5.5)

  app.get(
    "/api/inventory/counts",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const n = Number(stringParam(req.query.limit) ?? 100);
      const limit = Number.isFinite(n) ? Math.min(Math.max(1, Math.trunc(n)), 500) : 100;
      res.json(await storage.listCounts({ limit }).catch((e) => emptyIfMissing(e, [] as StockCountView[])));
    }),
  );

  app.get(
    "/api/inventory/counts/:id",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      const count = await storage.getCount(req.params.id);
      if (!count) return res.status(404).json({ message: "Inventarizatsiya topilmadi" });
      res.json(count);
    }),
  );

  app.post(
    "/api/inventory/counts",
    requirePermission("inventory.count"),
    handle(async (req, res) => {
      const input = createCountSchema.parse(req.body);
      if (input.countedOn > clockNow().date) return res.status(400).json({ message: "Inventarizatsiya sanasi kelajakda bo'lishi mumkin emas" });
      // One open count at a time, and something to count: both refused inside the storage (409).
      const count = await storage.createCount(input, actorOf(req));
      await audit(
        req,
        "create",
        "inventory",
        count.id,
        `Inventarizatsiya №${count.number} boshlandi (${countScopeLabel(count.kinds)}, ${count.countedOn}): ${count.lineCount} ta partiya sanaladi`,
      );
      res.status(201).json(count);
    }),
  );

  app.put(
    "/api/inventory/counts/:id/lines",
    requirePermission("inventory.count"),
    handle(async (req, res) => {
      const { entries } = saveCountEntriesSchema.parse(req.body);
      const count = await storage.saveCountEntries(req.params.id, entries, actorOf(req));
      if (!count) return res.status(404).json({ message: "Inventarizatsiya topilmadi" });
      const byId = new Map(count.lines.map((l) => [l.id, l]));
      const what = entries
        .map((e) => {
          const l = byId.get(e.lineId);
          if (!l) return null;
          const lot = l.lotNumber ? ` LOT ${l.lotNumber}` : "";
          return e.counted === null
            ? `${l.itemName}${lot}: sanoq o'chirildi`
            : `${l.itemName}${lot}: sanaldi ${fmtQty(e.counted)}, hisobda ${fmtQty(l.expected)} ${l.unit}`;
        })
        .filter(Boolean);
      await audit(req, "update", "inventory", count.id, `Inventarizatsiya №${count.number}: ${what.slice(0, 20).join("; ")}${what.length > 20 ? ` va yana ${what.length - 20} ta` : ""}`);
      res.json(count);
    }),
  );

  app.post(
    "/api/inventory/counts/:id/post",
    requirePermission("inventory.count"),
    handle(async (req, res) => {
      // Every line counted and each result within the batch: checked on locked rows inside the storage (409).
      const count = await storage.postCount(req.params.id, actorOf(req));
      if (!count) return res.status(404).json({ message: "Inventarizatsiya topilmadi" });
      const s = summarizeCount(count.lines);
      await audit(
        req,
        "verify",
        "inventory",
        count.id,
        `Inventarizatsiya №${count.number} tasdiqlandi: ${s.counted} ta partiya sanaldi, ${s.matched} tasi mos; ` +
          `kamomad ${s.shortage.lines} ta (${count.shortageValue} so'm), ortiqcha ${s.surplus.lines} ta (${count.surplusValue} so'm) — qoldiq tuzatildi`,
      );
      res.json(count);
    }),
  );

  app.post(
    "/api/inventory/counts/:id/cancel",
    requirePermission("inventory.count"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const count = await storage.cancelCount(req.params.id, reason, actorOf(req));
      if (!count) return res.status(404).json({ message: "Inventarizatsiya topilmadi" });
      await audit(req, "void", "inventory", count.id, `Inventarizatsiya №${count.number} bekor qilindi, qoldiq o'zgarmadi: ${reason}`);
      res.json(count);
    }),
  );
}
