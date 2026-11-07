/**
 * Laboratoriya jihozlari (B4.9, TZ §6.4): analizatorlar ro'yxati va qurilma
 * xatolari jurnali. Rules and labels: shared/lab-devices.ts.
 *
 *   devices.read    the list and the log
 *   devices.log     record an error, close it, take a broken device out of service
 *   devices.manage  add, edit, change status, delete a device that has no log
 */
import type { Express } from "express";
import {
  insertDeviceErrorSchema,
  insertDeviceSchema,
  resolveDeviceErrorSchema,
  updateDeviceSchema,
  type LabDeviceWithStats,
} from "@shared/schema";
import {
  DEVICE_CONNECTION_LABELS,
  DEVICE_DIRECTION_LABELS,
  DEVICE_STATUS_LABELS,
  ERROR_SEVERITY_LABELS,
  deviceNameKey,
  occurredAtProblem,
} from "@shared/lab-devices";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";

export function registerLabRoutes(app: Express) {
  async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
    const key = deviceNameKey(name);
    return (await storage.listDevices()).some((d) => d.id !== exceptId && deviceNameKey(d.name) === key);
  }

  app.get(
    "/api/devices",
    requirePermission("devices.read"),
    handle(async (_req, res) => {
      res.json(await storage.listDevices().catch((e) => emptyIfMissing(e, [] as LabDeviceWithStats[])));
    }),
  );

  app.post(
    "/api/devices",
    requirePermission("devices.manage"),
    handle(async (req, res) => {
      const input = insertDeviceSchema.parse(req.body);
      if (await nameTaken(input.name)) return res.status(409).json({ message: "Bunday nomli qurilma allaqachon bor" });
      const device = await storage.createDevice(input, actorOf(req));
      await audit(
        req,
        "create",
        "device",
        device.id,
        `"${device.name}" analizatori qo'shildi (${DEVICE_DIRECTION_LABELS[device.direction]}, ${DEVICE_CONNECTION_LABELS[device.connection]})`,
      );
      res.status(201).json({ ...device, errorCount: 0, openErrors: 0, lastErrorAt: null });
    }),
  );

  app.patch(
    "/api/devices/:id",
    requirePermission("devices.manage"),
    handle(async (req, res) => {
      const input = updateDeviceSchema.parse(req.body);
      const before = await storage.getDevice(req.params.id);
      if (!before) return res.status(404).json({ message: "Qurilma topilmadi" });
      if (input.name && (await nameTaken(input.name, before.id))) {
        return res.status(409).json({ message: "Bunday nomli qurilma allaqachon bor" });
      }
      const device = await storage.updateDevice(before.id, input, actorOf(req));
      if (!device) return res.status(404).json({ message: "Qurilma topilmadi" });

      const changes: string[] = [];
      if (device.name !== before.name) changes.push(`nomi: ${before.name} → ${device.name}`);
      if (device.status !== before.status) {
        changes.push(`holati: ${DEVICE_STATUS_LABELS[before.status]} → ${DEVICE_STATUS_LABELS[device.status]}`);
      }
      if (device.connection !== before.connection) {
        changes.push(`ulanish: ${DEVICE_CONNECTION_LABELS[before.connection]} → ${DEVICE_CONNECTION_LABELS[device.connection]}`);
      }
      if (device.direction !== before.direction) changes.push(`yo'nalish: ${DEVICE_DIRECTION_LABELS[device.direction]}`);
      for (const [key, label] of [
        ["manufacturer", "ishlab chiqaruvchi"],
        ["model", "model"],
        ["serialNumber", "seriya raqami"],
        ["location", "joylashuv"],
        ["installedOn", "o'rnatilgan sana"],
        ["notes", "izoh"],
      ] as const) {
        if (device[key] !== before[key]) changes.push(label);
      }
      await audit(req, "update", "device", device.id, `"${device.name}" analizatori — ${changes.join(", ") || "o'zgarishsiz saqlandi"}`);
      res.json(device);
    }),
  );

  app.delete(
    "/api/devices/:id",
    requirePermission("devices.manage"),
    handle(async (req, res) => {
      const device = await storage.getDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "Qurilma topilmadi" });
      // A device with a log is refused inside the storage (StorageConflict → 409).
      await storage.deleteDevice(device.id);
      await audit(req, "delete", "device", device.id, `"${device.name}" analizatori o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ------------------------------------------------------------ error log

  app.get(
    "/api/device-errors",
    requirePermission("devices.read"),
    handle(async (req, res) => {
      const limit = Number(stringParam(req.query.limit) ?? 200);
      res.json(
        await storage
          .listDeviceErrors({
            deviceId: stringParam(req.query.deviceId),
            open: req.query.open === "1",
            limit: Number.isFinite(limit) ? Math.min(Math.max(1, limit), 500) : 200,
          })
          .catch((e) => emptyIfMissing(e, [])),
      );
    }),
  );

  app.post(
    "/api/devices/:id/errors",
    requirePermission("devices.log"),
    handle(async (req, res) => {
      const input = insertDeviceErrorSchema.parse(req.body);
      if (input.occurredAt) {
        const problem = occurredAtProblem(input.occurredAt);
        if (problem) return res.status(400).json({ message: problem });
      }
      const device = await storage.getDevice(req.params.id);
      if (!device) return res.status(404).json({ message: "Qurilma topilmadi" });
      const entry = await storage.createDeviceError(device.id, input, actorOf(req));
      if (!entry) return res.status(404).json({ message: "Qurilma topilmadi" });
      const retired = input.markOutOfService && device.status !== "out_of_service";
      await audit(
        req,
        "create",
        "device",
        device.id,
        `"${device.name}": ${ERROR_SEVERITY_LABELS[entry.severity].toLowerCase()} qayd etildi${entry.code ? ` (${entry.code})` : ""} — ${entry.message}` +
          (retired ? `; qurilma "${DEVICE_STATUS_LABELS.out_of_service}" deb belgilandi` : ""),
      );
      res.status(201).json(entry);
    }),
  );

  app.post(
    "/api/device-errors/:id/resolve",
    requirePermission("devices.log"),
    handle(async (req, res) => {
      const { resolution } = resolveDeviceErrorSchema.parse(req.body);
      const entry = await storage.resolveDeviceError(req.params.id, resolution, actorOf(req));
      if (!entry) return res.status(404).json({ message: "Yozuv topilmadi" });
      const device = await storage.getDevice(entry.deviceId);
      await audit(req, "update", "device", entry.deviceId, `"${device?.name ?? "—"}": xato hal qilindi — ${resolution}`);
      res.json(entry);
    }),
  );
}
