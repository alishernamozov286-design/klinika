import { describe, expect, it } from "vitest";
import { insertDepartmentSchema, insertDoctorSchema, scheduleSchema } from "./schema";

describe("scheduleSchema", () => {
  it("sorts windows by weekday, then start time", () => {
    const out = scheduleSchema.parse([
      { day: 3, start: "14:00", end: "18:00" },
      { day: 1, start: "08:00", end: "12:00" },
      { day: 3, start: "08:00", end: "12:00" },
    ]);
    expect(out.map((s) => `${s.day} ${s.start}`)).toEqual(["1 08:00", "3 08:00", "3 14:00"]);
  });

  it("allows two windows on one day around a break", () => {
    expect(
      scheduleSchema.safeParse([
        { day: 2, start: "08:00", end: "12:00" },
        { day: 2, start: "13:00", end: "17:00" },
      ]).success,
    ).toBe(true);
  });

  it("refuses a window that ends before it starts", () => {
    const r = scheduleSchema.safeParse([{ day: 1, start: "17:00", end: "08:00" }]);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("Dushanba");
  });

  it("refuses overlapping windows on the same day", () => {
    const r = scheduleSchema.safeParse([
      { day: 4, start: "08:00", end: "13:00" },
      { day: 4, start: "12:00", end: "17:00" },
    ]);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("ustma-ust");
  });

  it("refuses malformed times and weekdays", () => {
    expect(scheduleSchema.safeParse([{ day: 1, start: "8:00", end: "17:00" }]).success).toBe(false);
    expect(scheduleSchema.safeParse([{ day: 1, start: "24:00", end: "25:00" }]).success).toBe(false);
    expect(scheduleSchema.safeParse([{ day: 8, start: "08:00", end: "17:00" }]).success).toBe(false);
  });
});

describe("insertDoctorSchema", () => {
  it("fills defaults", () => {
    const d = insertDoctorSchema.parse({ userId: "u1", specialty: "Kardiolog" });
    expect(d).toMatchObject({ consultationPrice: 0, slotMinutes: 20, schedule: [], isActive: true });
  });

  it("bounds the appointment length", () => {
    expect(insertDoctorSchema.safeParse({ userId: "u1", specialty: "X Y", slotMinutes: 2 }).success).toBe(false);
    expect(insertDoctorSchema.safeParse({ userId: "u1", specialty: "X Y", slotMinutes: 600 }).success).toBe(false);
  });
});

describe("insertDepartmentSchema", () => {
  it("defaults to an outpatient department", () => {
    expect(insertDepartmentSchema.parse({ name: "Terapiya" }).kind).toBe("ambulator");
  });

  it("refuses an unknown kind", () => {
    expect(insertDepartmentSchema.safeParse({ name: "Terapiya", kind: "sklad" }).success).toBe(false);
  });
});
