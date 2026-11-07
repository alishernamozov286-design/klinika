import { describe, expect, it } from "vitest";
import {
  DEVICE_CONNECTIONS,
  DEVICE_CONNECTION_LABELS,
  DEVICE_DIRECTIONS,
  DEVICE_DIRECTION_LABELS,
  TZ_ANALYZERS,
  deviceNameKey,
  occurredAtProblem,
} from "./lab-devices";
import { insertDeviceErrorSchema, insertDeviceSchema } from "./schema";

describe("lab devices (B4.9)", () => {
  it("every option has an Uzbek label, and the TZ §6.4 set uses known directions", () => {
    for (const d of DEVICE_DIRECTIONS) expect(DEVICE_DIRECTION_LABELS[d]).toBeTruthy();
    for (const c of DEVICE_CONNECTIONS) expect(DEVICE_CONNECTION_LABELS[c]).toBeTruthy();
    expect(TZ_ANALYZERS).toHaveLength(6);
    for (const a of TZ_ANALYZERS) expect(DEVICE_DIRECTIONS).toContain(a.direction);
  });

  it("compares names without case or extra spaces", () => {
    expect(deviceNameKey("  BS-240   Pro ")).toBe(deviceNameKey("bs-240 pro"));
  });

  it("refuses a log entry dated in the future, with a minute of slack", () => {
    const now = Date.parse("2026-11-07T10:00:00Z");
    expect(occurredAtProblem("2026-11-07T09:00:00Z", now)).toBeNull();
    expect(occurredAtProblem("2026-11-07T10:00:30Z", now)).toBeNull();
    expect(occurredAtProblem("2026-11-07T10:05:00Z", now)).toMatch(/kelajakda/);
    expect(occurredAtProblem("kecha", now)).toMatch(/noto'g'ri/);
  });

  it("forms: blank optional fields become null, unknown options are refused", () => {
    const d = insertDeviceSchema.parse({ name: "DH26", manufacturer: "", installedOn: "" });
    expect(d).toMatchObject({ manufacturer: null, installedOn: null, direction: "boshqa", connection: "manual", status: "active" });
    expect(insertDeviceSchema.safeParse({ name: "X1", connection: "usb" }).success).toBe(false);
    expect(insertDeviceSchema.safeParse({ name: "X1", installedOn: "07.11.2026" }).success).toBe(false);
    expect(insertDeviceErrorSchema.safeParse({ message: "ok" }).success).toBe(false);
    expect(insertDeviceErrorSchema.parse({ message: "Lampa xatosi" })).toMatchObject({ severity: "error", markOutOfService: false });
  });
});
