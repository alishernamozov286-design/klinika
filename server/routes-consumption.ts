/**
 * Reagent sarfi (B5.6, TZ §7.3, §11 Laboratoriya → Ombor).
 *
 *   consumption.norms    propose a norm, edit a draft, withdraw a norm
 *   consumption.approve  put a norm in force; cancel an extra consumption
 *   consumption.record   record real use beyond the norm, with a reason
 *   inventory.read       read norms, the journal and the report
 *   inventory.issue      settle shortages from new stock (with the approver)
 *
 * Consumption by norm itself happens on verification (routes.ts → ./reagent-consumption).
 * Rules: shared/consumption.ts.
 */
import type { Express } from "express";
import { extraConsumptionSchema, insertNormSchema, updateNormSchema, voidRecordSchema, type LabConsumptionView } from "@shared/schema";
import {
  CONSUMABLE_KINDS,
  EXTRA_REASON_LABELS,
  describeConsumption,
  summarizeConsumption,
} from "@shared/consumption";
import { fmtQty } from "@shared/inventory";
import { clockNow } from "@shared/appointment";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The server's local midnight of a calendar day, as an instant (deploys run with TZ=Asia/Tashkent). */
const startOf = (day: string) => new Date(`${day}T00:00:00`).toISOString();
const nextDay = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
};

export function registerConsumptionRoutes(app: Express) {
  // ------------------------------------------------------------- norms

  app.get(
    "/api/consumption/norms",
    requirePermission("inventory.read", "consumption.norms", "consumption.approve"),
    handle(async (_req, res) => {
      res.json(await storage.listNorms().catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.post(
    "/api/consumption/norms",
    requirePermission("consumption.norms"),
    handle(async (req, res) => {
      const input = insertNormSchema.parse(req.body);
      const [test, item] = await Promise.all([storage.getTest(input.testId), storage.getInventoryItem(input.itemId)]);
      if (!test) return res.status(400).json({ message: "Tahlil topilmadi" });
      if (!item) return res.status(400).json({ message: "Mahsulot topilmadi" });
      if (!item.isActive) return res.status(400).json({ message: `"${item.name}" faolsizlantirilgan` });
      if (!CONSUMABLE_KINDS.includes(item.kind)) return res.status(400).json({ message: "Tahlil uchun reagent yoki sarf materialini tanlang" });
      // One draft per test and item: refused inside the storage (409).
      const norm = await storage.createNorm(input, actorOf(req));
      await audit(req, "create", "inventory", norm.id, `Sarf normasi taklif qilindi: "${test.name}" — ${item.name} ${fmtQty(norm.quantity)} ${item.unit} (1 tahlilga)`);
      res.status(201).json(norm);
    }),
  );

  app.patch(
    "/api/consumption/norms/:id",
    requirePermission("consumption.norms"),
    handle(async (req, res) => {
      const input = updateNormSchema.parse(req.body);
      const before = await storage.getNorm(req.params.id);
      if (!before) return res.status(404).json({ message: "Norma topilmadi" });
      const norm = await storage.updateNorm(before.id, input, actorOf(req));
      if (!norm) return res.status(404).json({ message: "Norma topilmadi" });
      await audit(
        req,
        "update",
        "inventory",
        norm.id,
        `Sarf normasi (tasdiqlanmagan): "${norm.testName}" — ${norm.itemName} ${fmtQty(before.quantity)} → ${fmtQty(norm.quantity)} ${norm.unit}`,
      );
      res.json(norm);
    }),
  );

  app.post(
    "/api/consumption/norms/:id/approve",
    requirePermission("consumption.approve"),
    handle(async (req, res) => {
      const out = await storage.approveNorm(req.params.id, actorOf(req));
      if (!out) return res.status(404).json({ message: "Norma topilmadi" });
      const { norm, replaced } = out;
      const own = norm.createdBy && norm.createdBy === req.user?.id ? " (o'zi taklif qilgan)" : "";
      await audit(
        req,
        "verify",
        "inventory",
        norm.id,
        `Sarf normasi tasdiqlandi${own}: "${norm.testName}" — ${norm.itemName} ${fmtQty(norm.quantity)} ${norm.unit}` +
          (replaced ? ` (oldingi norma ${fmtQty(replaced.quantity)} ${replaced.unit} o'rniga)` : ""),
      );
      res.json(out);
    }),
  );

  app.post(
    "/api/consumption/norms/:id/retire",
    requirePermission("consumption.norms", "consumption.approve"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const norm = await storage.retireNorm(req.params.id, reason, actorOf(req));
      if (!norm) return res.status(404).json({ message: "Norma topilmadi" });
      await audit(req, "void", "inventory", norm.id, `Sarf normasi bekor qilindi: "${norm.testName}" — ${norm.itemName} ${fmtQty(norm.quantity)} ${norm.unit}. Sabab: ${reason}`);
      res.json(norm);
    }),
  );

  // ----------------------------------------------------- journal & report

  /** The journal for a period (default: this month) with the TZ §13 report, or every open shortage. */
  app.get(
    "/api/consumption",
    requirePermission("inventory.read"),
    handle(async (req, res) => {
      if (stringParam(req.query.short) === "1") {
        const entries = await storage.listConsumptions({ shortOnly: true, limit: 1000 }).catch((e) => emptyIfMissing(e, [] as LabConsumptionView[]));
        return res.json({ entries });
      }
      const today = clockNow().date;
      const from = stringParam(req.query.from) ?? `${today.slice(0, 7)}-01`;
      const to = stringParam(req.query.to) ?? today;
      if (!DAY.test(from) || !DAY.test(to)) return res.status(400).json({ message: "Sanani YYYY-MM-DD ko'rinishida kiriting" });
      if (from > to) return res.status(400).json({ message: "Davr boshi oxiridan keyin bo'lishi mumkin emas" });
      const entries = await storage.listConsumptions({ from: startOf(from), to: nextDay(to) }).catch((e) => emptyIfMissing(e, [] as LabConsumptionView[]));
      res.json({ from, to, report: summarizeConsumption(entries), entries: entries.slice(0, 500), total: entries.length });
    }),
  );

  app.post(
    "/api/consumption",
    requirePermission("consumption.record"),
    handle(async (req, res) => {
      const input = extraConsumptionSchema.parse(req.body);
      if (input.reason === "other" && !input.note) return res.status(400).json({ message: "Sababni izohda yozing" });
      const item = await storage.getInventoryItem(input.itemId);
      if (!item) return res.status(400).json({ message: "Mahsulot topilmadi" });
      if (input.testId && !(await storage.getTest(input.testId))) return res.status(400).json({ message: "Tahlil topilmadi" });
      const c = await storage.recordConsumption(input, clockNow().date, actorOf(req));
      await audit(
        req,
        "create",
        "inventory",
        c.id,
        `Qo'shimcha sarf (${EXTRA_REASON_LABELS[input.reason]}${c.testName ? `, ${c.testName}` : ""}): ${describeConsumption([c])}${input.note ? `. ${input.note}` : ""}`,
      );
      res.status(201).json(c);
    }),
  );

  app.post(
    "/api/consumption/:id/cancel",
    requirePermission("consumption.approve"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const c = await storage.cancelConsumption(req.params.id, reason, actorOf(req));
      if (!c) return res.status(404).json({ message: "Sarf topilmadi" });
      await audit(req, "void", "inventory", c.id, `Qo'shimcha sarf bekor qilindi, mahsulot partiyalariga qaytarildi: ${c.itemName} ${fmtQty(c.quantity)} ${c.unit}. Sabab: ${reason}`);
      res.json(c);
    }),
  );

  /**
   * "Qayta hisoblash": consumes verified lines the verification hook missed,
   * then covers shortages from the stock there is now. Safe to press any time.
   */
  app.post(
    "/api/consumption/reconcile",
    requirePermission("inventory.issue", "consumption.approve"),
    handle(async (req, res) => {
      const today = clockNow().date;
      const consumed = await storage.consumeVerified({}, today, actorOf(req));
      const settled = await storage.settleConsumptions(null, today, actorOf(req));
      const stillShort = (await storage.listConsumptions({ shortOnly: true, limit: 1000 })).length;
      if (consumed.length || settled.length) {
        await audit(
          req,
          "update",
          "inventory",
          null,
          `Reagent sarfi qayta hisoblandi: ${consumed.length} ta yangi sarf${consumed.length ? ` (${describeConsumption(consumed)})` : ""}, ` +
            `${settled.length} ta yetishmovchilik yopildi${stillShort ? `, ${stillShort} tasi qoldi` : ""}`,
        );
      }
      res.json({ consumed: consumed.length, settled: settled.length, stillShort });
    }),
  );
}
