/**
 * Statsionar (TZ §8). B6.1: palatalar va yotoqlar.
 *
 *   inpatient.read              the wards and beds board
 *   beds.manage                 wards (bed-day price), beds: add, rename, deactivate, delete
 *   beds.state | beds.manage    a bed's state: ready / cleaning / out of service
 *
 * Rules: shared/inpatient.ts.
 */
import type { Express } from "express";
import { addBedsSchema, bedStateSchema, insertWardSchema, updateBedSchema, updateWardSchema } from "@shared/schema";
import { BED_STATE_LABELS, WARD_GENDER_LABELS } from "@shared/inpatient";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle } from "./route-helpers";
import { storage } from "./storage";

const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function registerInpatientRoutes(app: Express) {
  app.get(
    "/api/wards",
    requirePermission("inpatient.read"),
    handle(async (_req, res) => {
      res.json(await storage.listWards().catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.post(
    "/api/wards",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const input = insertWardSchema.parse(req.body);
      const w = await storage.createWard(input, actorOf(req));
      await audit(req, "create", "ward", w.id, `Palata "${w.name}" qo'shildi: ${w.departmentName}${w.floor !== null ? `, ${w.floor}-qavat` : ""}, ${WARD_GENDER_LABELS[w.gender]}, yotoq-kun ${sum(w.dayPrice)}`);
      res.status(201).json(w);
    }),
  );

  app.patch(
    "/api/wards/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const patch = updateWardSchema.parse(req.body);
      const before = await storage.getWard(req.params.id);
      if (!before) return res.status(404).json({ message: "Palata topilmadi" });
      const w = (await storage.updateWard(req.params.id, patch, actorOf(req)))!;
      const changes: string[] = [];
      if (before.name !== w.name) changes.push(`nomi "${before.name}" → "${w.name}"`);
      if (before.departmentId !== w.departmentId) changes.push(`bo'lim ${before.departmentName} → ${w.departmentName}`);
      if (before.floor !== w.floor) changes.push(`qavat ${before.floor ?? "—"} → ${w.floor ?? "—"}`);
      if (before.gender !== w.gender) changes.push(`${WARD_GENDER_LABELS[before.gender]} → ${WARD_GENDER_LABELS[w.gender]}`);
      if (before.dayPrice !== w.dayPrice) changes.push(`yotoq-kun ${sum(before.dayPrice)} → ${sum(w.dayPrice)}`);
      if (before.isActive !== w.isActive) changes.push(w.isActive ? "faollashtirildi" : "faolsizlantirildi");
      if ((before.note ?? "") !== (w.note ?? "")) changes.push("izoh");
      if (changes.length) await audit(req, "update", "ward", w.id, `Palata "${w.name}": ${changes.join(", ")}`);
      res.json(w);
    }),
  );

  app.delete(
    "/api/wards/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const before = await storage.getWard(req.params.id);
      if (!before || !(await storage.deleteWard(req.params.id))) return res.status(404).json({ message: "Palata topilmadi" });
      await audit(req, "delete", "ward", req.params.id, `Palata "${before.name}" (${before.departmentName}) o'chirildi`);
      res.status(204).end();
    }),
  );

  app.post(
    "/api/wards/:id/beds",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const { count } = addBedsSchema.parse(req.body);
      const before = await storage.getWard(req.params.id);
      if (!before) return res.status(404).json({ message: "Palata topilmadi" });
      const w = (await storage.addBeds(req.params.id, count, actorOf(req)))!;
      const added = w.beds.filter((b) => !before.beds.some((x) => x.id === b.id)).map((b) => b.label);
      await audit(req, "create", "bed", w.id, `Palata "${w.name}": ${added.length} ta yotoq qo'shildi (${added.join(", ")})`);
      res.status(201).json(w);
    }),
  );

  app.patch(
    "/api/beds/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const patch = updateBedSchema.parse(req.body);
      const b = await storage.updateBed(req.params.id, patch, actorOf(req));
      if (!b) return res.status(404).json({ message: "Yotoq topilmadi" });
      const parts = [patch.label !== undefined && `raqami ${b.label}`, patch.isActive !== undefined && (b.isActive ? "faollashtirildi" : "faolsizlantirildi"), patch.note !== undefined && "izoh"].filter(Boolean);
      await audit(req, "update", "bed", b.id, `Yotoq ${b.label}: ${parts.join(", ")}`);
      res.json(b);
    }),
  );

  app.post(
    "/api/beds/:id/state",
    requirePermission("beds.state", "beds.manage"),
    handle(async (req, res) => {
      const { state, note } = bedStateSchema.parse(req.body);
      const b = await storage.setBedState(req.params.id, state, note, actorOf(req));
      if (!b) return res.status(404).json({ message: "Yotoq topilmadi" });
      await audit(req, "update", "bed", b.id, `Yotoq ${b.label}: ${BED_STATE_LABELS[state].toLowerCase()}${note ? ` — ${note}` : ""}`);
      res.json(b);
    }),
  );

  app.delete(
    "/api/beds/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const ward = (await storage.listWards()).find((w) => w.beds.some((b) => b.id === req.params.id));
      const label = ward?.beds.find((b) => b.id === req.params.id)?.label;
      if (!(await storage.deleteBed(req.params.id))) return res.status(404).json({ message: "Yotoq topilmadi" });
      await audit(req, "delete", "bed", req.params.id, `Palata "${ward?.name ?? "—"}": yotoq ${label ?? "—"} o'chirildi`);
      res.status(204).end();
    }),
  );
}
