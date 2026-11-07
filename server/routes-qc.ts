/**
 * Sifat nazorati (B4.8, TZ §6.5). Rules: shared/qc.ts.
 *
 *   qc.read    everything on the QC screen
 *   qc.enter   QC runs, calibrations, maintenance, external QC; corrective actions
 *   qc.manage  control materials and series (target mean/SD); voiding a wrong entry
 *
 * Nothing here is edited or deleted after the fact. A run is judged when it is
 * entered and keeps that verdict; a wrong entry is voided with a reason.
 */
import type { Express, Request } from "express";
import {
  insertCalibrationSchema,
  insertEqaSchema,
  insertMaintenanceSchema,
  insertQcMaterialSchema,
  insertQcResultSchema,
  insertQcTargetSchema,
  reviewQcResultSchema,
  updateQcMaterialSchema,
  updateQcTargetSchema,
  voidRecordSchema,
} from "@shared/schema";
import {
  CALIBRATION_RESULT_LABELS,
  EQA_EVALUATION_LABELS,
  MAINTENANCE_KIND_LABELS,
  QC_STATUS_LABELS,
  WESTGARD_RULE_INFO,
  isExpired,
} from "@shared/qc";
import { clockNow } from "@shared/appointment";
import { occurredAtProblem } from "@shared/lab-devices";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";
import { localDay } from "./storage-types";

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Clamps ?limit= to something sane. */
function limitParam(req: Request, fallback: number, max: number): number {
  const n = Number(stringParam(req.query.limit) ?? fallback);
  return Number.isFinite(n) ? Math.min(Math.max(1, Math.trunc(n)), max) : fallback;
}

export function registerQcRoutes(app: Express) {
  // ----------------------------------------------------------------- board

  app.get(
    "/api/qc",
    requirePermission("qc.read"),
    handle(async (_req, res) => {
      const date = clockNow().date;
      res.json(await storage.getQcBoard(date).catch((e) => emptyIfMissing(e, { date, materials: [], targets: [] })));
    }),
  );

  // ------------------------------------------------------------- materials

  async function materialTaken(name: string, lot: string, level: string, exceptId?: string) {
    const key = (s: string) => s.trim().toLowerCase();
    const { materials } = await storage.getQcBoard(clockNow().date);
    return materials.some((m) => m.id !== exceptId && key(m.name) === key(name) && key(m.lotNumber) === key(lot) && key(m.level) === key(level));
  }

  app.post(
    "/api/qc/materials",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const input = insertQcMaterialSchema.parse(req.body);
      if (await materialTaken(input.name, input.lotNumber, input.level)) {
        return res.status(409).json({ message: "Bu material, LOT va daraja allaqachon kiritilgan" });
      }
      const m = await storage.createQcMaterial(input, actorOf(req));
      await audit(req, "create", "qc", m.id, `Nazorat materiali qo'shildi: ${m.name}, ${m.level}, LOT ${m.lotNumber}, muddati ${m.expiresOn}`);
      res.status(201).json(m);
    }),
  );

  app.patch(
    "/api/qc/materials/:id",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const input = updateQcMaterialSchema.parse(req.body);
      const before = await storage.getQcMaterial(req.params.id);
      if (!before) return res.status(404).json({ message: "Material topilmadi" });
      const next = { ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
      if (await materialTaken(next.name, next.lotNumber, next.level, before.id)) {
        return res.status(409).json({ message: "Bu material, LOT va daraja allaqachon kiritilgan" });
      }
      const m = await storage.updateQcMaterial(before.id, input, actorOf(req));
      if (!m) return res.status(404).json({ message: "Material topilmadi" });
      const changes: string[] = [];
      if (m.lotNumber !== before.lotNumber) changes.push(`LOT: ${before.lotNumber} → ${m.lotNumber}`);
      if (m.expiresOn !== before.expiresOn) changes.push(`muddati: ${before.expiresOn} → ${m.expiresOn}`);
      if (m.isActive !== before.isActive) changes.push(m.isActive ? "qayta faollashtirildi" : "ishlatishdan olindi");
      if (m.name !== before.name || m.level !== before.level) changes.push(`nomi: ${m.name}, ${m.level}`);
      await audit(req, "update", "qc", m.id, `Nazorat materiali ${m.name} (${m.level}) — ${changes.join(", ") || "izoh yangilandi"}`);
      res.json(m);
    }),
  );

  // ---------------------------------------------------------------- series

  app.post(
    "/api/qc/targets",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const input = insertQcTargetSchema.parse(req.body);
      const [material, test, device] = await Promise.all([
        storage.getQcMaterial(input.materialId),
        storage.getTest(input.testId),
        input.deviceId ? storage.getDevice(input.deviceId) : Promise.resolve(null),
      ]);
      if (!material) return res.status(400).json({ message: "Material topilmadi" });
      if (!test) return res.status(400).json({ message: "Tahlil topilmadi" });
      if (input.deviceId && !device) return res.status(400).json({ message: "Qurilma topilmadi" });
      const t = await storage.createQcTarget({ ...input, unit: input.unit ?? test.unit ?? null }, actorOf(req));
      await audit(
        req,
        "create",
        "qc",
        t.id,
        `Nazorat seriyasi: ${test.name} — ${material.name} ${material.level}${device ? `, ${device.name}` : ""}; o'rtacha ${fmt(t.mean)}, SD ${fmt(t.sd)}`,
      );
      res.status(201).json(t);
    }),
  );

  app.patch(
    "/api/qc/targets/:id",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const input = updateQcTargetSchema.parse(req.body);
      const before = await storage.getQcTarget(req.params.id);
      if (!before) return res.status(404).json({ message: "Nazorat seriyasi topilmadi" });
      const t = await storage.updateQcTarget(before.id, input, actorOf(req));
      if (!t) return res.status(404).json({ message: "Nazorat seriyasi topilmadi" });
      const test = await storage.getTest(t.testId);
      const changes: string[] = [];
      if (t.mean !== before.mean) changes.push(`o'rtacha ${fmt(before.mean)} → ${fmt(t.mean)}`);
      if (t.sd !== before.sd) changes.push(`SD ${fmt(before.sd)} → ${fmt(t.sd)}`);
      if (t.isActive !== before.isActive) changes.push(t.isActive ? "qayta faollashtirildi" : "to'xtatildi");
      if (t.unit !== before.unit) changes.push(`birlik: ${t.unit ?? "—"}`);
      await audit(req, "update", "qc", t.id, `Nazorat seriyasi ${test?.name ?? ""} — ${changes.join(", ") || "o'zgarishsiz"}`);
      res.json(t);
    }),
  );

  // ------------------------------------------------------------------ runs

  app.get(
    "/api/qc/targets/:id/results",
    requirePermission("qc.read"),
    handle(async (req, res) => {
      res.json(await storage.listQcResults(req.params.id, limitParam(req, 60, 500)));
    }),
  );

  app.post(
    "/api/qc/targets/:id/results",
    requirePermission("qc.enter"),
    handle(async (req, res) => {
      const input = insertQcResultSchema.parse(req.body);
      if (input.measuredAt) {
        const problem = occurredAtProblem(input.measuredAt);
        if (problem) return res.status(400).json({ message: problem });
      }
      const target = await storage.getQcTarget(req.params.id);
      if (!target) return res.status(404).json({ message: "Nazorat seriyasi topilmadi" });
      if (!target.isActive) return res.status(409).json({ message: "Bu nazorat seriyasi to'xtatilgan" });
      const material = await storage.getQcMaterial(target.materialId);
      if (!material || !material.isActive) return res.status(409).json({ message: "Nazorat materiali ishlatishdan olingan" });
      const day = localDay(input.measuredAt ?? new Date());
      // A control past its expiry says nothing about the analyzer.
      if (isExpired(material.expiresOn, day)) {
        return res.status(409).json({ message: `Nazorat materialining muddati o'tgan (${material.expiresOn}). Yangi LOT kiriting.` });
      }
      if (isExpired(input.reagentExpiresOn, day)) {
        return res.status(400).json({ message: `Reagentning yaroqlilik muddati o'tgan (${input.reagentExpiresOn})` });
      }
      const r = await storage.addQcResult(target, input, actorOf(req));
      const test = await storage.getTest(target.testId);
      const rules = r.rules.map((x) => WESTGARD_RULE_INFO[x].label).join(", ");
      await audit(
        req,
        "create",
        "qc",
        target.id,
        `QC ${test?.name ?? ""} (${material.level}): ${fmt(r.value)}, z = ${r.z} — ${QC_STATUS_LABELS[r.status]}${rules ? ` (${rules})` : ""}`,
      );
      res.status(201).json(r);
    }),
  );

  app.post(
    "/api/qc/results/:id/review",
    requirePermission("qc.enter"),
    handle(async (req, res) => {
      const { correctiveAction } = reviewQcResultSchema.parse(req.body);
      const before = await storage.getQcResult(req.params.id);
      if (!before) return res.status(404).json({ message: "QC natijasi topilmadi" });
      if (before.status === "ok") return res.status(409).json({ message: "Qabul qilingan natijaga chora kerak emas" });
      if (before.voidedAt) return res.status(409).json({ message: "Bekor qilingan natijaga chora yozilmaydi" });
      const r = await storage.reviewQcResult(before.id, correctiveAction, actorOf(req));
      if (!r) return res.status(404).json({ message: "QC natijasi topilmadi" });
      await audit(req, "update", "qc", r.targetId, `QC natijasiga chora yozildi (${fmt(r.value)}, ${QC_STATUS_LABELS[r.status]}): ${correctiveAction}`);
      res.json(r);
    }),
  );

  app.post(
    "/api/qc/results/:id/void",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const r = await storage.voidQcResult(req.params.id, reason, actorOf(req));
      if (!r) return res.status(404).json({ message: "QC natijasi topilmadi" });
      await audit(req, "void", "qc", r.targetId, `QC natijasi bekor qilindi (${fmt(r.value)}, ${r.measuredAt}): ${reason}`);
      res.json(r);
    }),
  );

  // ------------------------------------------------------------ calibration

  app.get(
    "/api/qc/calibrations",
    requirePermission("qc.read"),
    handle(async (req, res) => {
      res.json(
        await storage
          .listCalibrations({ deviceId: stringParam(req.query.deviceId), limit: limitParam(req, 200, 500) })
          .catch((e) => emptyIfMissing(e, [])),
      );
    }),
  );

  app.post(
    "/api/qc/calibrations",
    requirePermission("qc.enter"),
    handle(async (req, res) => {
      const input = insertCalibrationSchema.parse(req.body);
      if (input.performedAt) {
        const problem = occurredAtProblem(input.performedAt);
        if (problem) return res.status(400).json({ message: problem });
      }
      const device = await storage.getDevice(input.deviceId);
      if (!device) return res.status(400).json({ message: "Qurilma topilmadi" });
      const test = input.testId ? await storage.getTest(input.testId) : null;
      if (input.testId && !test) return res.status(400).json({ message: "Tahlil topilmadi" });
      const day = localDay(input.performedAt ?? new Date());
      if (isExpired(input.calibratorExpiresOn, day)) {
        return res.status(400).json({ message: `Kalibratorning yaroqlilik muddati o'tgan (${input.calibratorExpiresOn})` });
      }
      if (isExpired(input.reagentExpiresOn, day)) {
        return res.status(400).json({ message: `Reagentning yaroqlilik muddati o'tgan (${input.reagentExpiresOn})` });
      }
      const c = await storage.addCalibration(input, actorOf(req));
      await audit(
        req,
        "create",
        "qc",
        device.id,
        `Kalibratsiya: ${device.name}${test ? `, ${test.name}` : ""} — ${CALIBRATION_RESULT_LABELS[c.result]} (${c.calibratorName}${c.calibratorLot ? `, LOT ${c.calibratorLot}` : ""})`,
      );
      res.status(201).json(c);
    }),
  );

  // ------------------------------------------------------------ maintenance

  app.get(
    "/api/qc/maintenance",
    requirePermission("qc.read"),
    handle(async (req, res) => {
      res.json(
        await storage
          .listMaintenance({ deviceId: stringParam(req.query.deviceId), limit: limitParam(req, 200, 500) })
          .catch((e) => emptyIfMissing(e, [])),
      );
    }),
  );

  app.post(
    "/api/qc/maintenance",
    requirePermission("qc.enter"),
    handle(async (req, res) => {
      const input = insertMaintenanceSchema.parse(req.body);
      if (input.performedAt) {
        const problem = occurredAtProblem(input.performedAt);
        if (problem) return res.status(400).json({ message: problem });
      }
      const device = await storage.getDevice(input.deviceId);
      if (!device) return res.status(400).json({ message: "Qurilma topilmadi" });
      if (input.nextDueOn && input.nextDueOn < localDay(input.performedAt ?? new Date())) {
        return res.status(400).json({ message: "Keyingi xizmat sanasi bajarilgan kundan oldin bo'lishi mumkin emas" });
      }
      const m = await storage.addMaintenance(input, actorOf(req));
      await audit(req, "create", "qc", device.id, `Texnik xizmat: ${device.name} — ${MAINTENANCE_KIND_LABELS[m.kind]}: ${m.description}`);
      res.status(201).json(m);
    }),
  );

  // ----------------------------------------------------------- external QC

  app.get(
    "/api/qc/eqa",
    requirePermission("qc.read"),
    handle(async (req, res) => {
      res.json(await storage.listEqa({ limit: limitParam(req, 200, 500) }).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.post(
    "/api/qc/eqa",
    requirePermission("qc.enter"),
    handle(async (req, res) => {
      const input = insertEqaSchema.parse(req.body);
      if (input.sampleDate > clockNow().date) return res.status(400).json({ message: "Namuna sanasi kelajakda bo'lishi mumkin emas" });
      const test = await storage.getTest(input.testId);
      if (!test) return res.status(400).json({ message: "Tahlil topilmadi" });
      if (input.deviceId && !(await storage.getDevice(input.deviceId))) return res.status(400).json({ message: "Qurilma topilmadi" });
      const e = await storage.addEqa(input, actorOf(req));
      await audit(
        req,
        "create",
        "qc",
        e.id,
        `Tashqi nazorat: ${e.provider} ${e.cycle}, ${test.name} — ${fmt(e.reportedValue)} / ${fmt(e.assignedValue)}, z = ${e.z} (${EQA_EVALUATION_LABELS[e.evaluation]})`,
      );
      res.status(201).json(e);
    }),
  );

  app.post(
    "/api/qc/eqa/:id/void",
    requirePermission("qc.manage"),
    handle(async (req, res) => {
      const { reason } = voidRecordSchema.parse(req.body);
      const e = await storage.voidEqa(req.params.id, reason, actorOf(req));
      if (!e) return res.status(404).json({ message: "Yozuv topilmadi" });
      await audit(req, "void", "qc", e.id, `Tashqi nazorat natijasi bekor qilindi (${e.provider} ${e.cycle}): ${reason}`);
      res.json(e);
    }),
  );
}
