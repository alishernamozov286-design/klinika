import { describe, expect, it } from "vitest";
import {
  bookingProblem,
  buildSlots,
  checkTransition,
  daysBetween,
  findClash,
  isValidDay,
  nextInLine,
  nextQueueNumber,
  overlaps,
  slotStarts,
  TRANSITIONS,
  weekdayOf,
  type Booking,
} from "./appointment";
import { APPOINTMENT_STATUSES, type ScheduleSlot } from "./schema";

// 2026-11-09 is a Monday.
const MON = "2026-11-09";
const SCHEDULE: ScheduleSlot[] = [
  { day: 1, start: "09:00", end: "10:00" },
  { day: 1, start: "14:00", end: "14:50" },
  { day: 3, start: "08:00", end: "09:00" },
];
const booking = (over: Partial<Booking>): Booking => ({
  id: "a1",
  startTime: "09:00",
  durationMinutes: 20,
  status: "scheduled",
  ...over,
});

describe("calendar helpers", () => {
  it("names weekdays Monday-first without time-zone drift", () => {
    expect(weekdayOf("2026-11-09")).toBe(1);
    expect(weekdayOf("2026-11-15")).toBe(7);
    expect(weekdayOf("2026-03-29")).toBe(7); // a DST change day elsewhere
  });

  it("counts days and validates dates", () => {
    expect(daysBetween("2026-12-31", "2027-01-02")).toBe(2);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-1-5")).toBe(false);
  });
});

describe("slot grid", () => {
  it("cuts each window into whole slots and drops a short tail", () => {
    expect(slotStarts(SCHEDULE, 20, MON)).toEqual(["09:00", "09:20", "09:40", "14:00", "14:20"]);
  });

  it("offers nothing on a day off or with a broken slot length", () => {
    expect(slotStarts(SCHEDULE, 20, "2026-11-10")).toEqual([]);
    expect(slotStarts(SCHEDULE, 0, MON)).toEqual([]);
  });

  it("detects overlaps at the minute", () => {
    expect(overlaps("09:00", 20, "09:20", 20)).toBe(false);
    expect(overlaps("09:00", 30, "09:20", 20)).toBe(true);
    expect(overlaps("09:10", 5, "09:00", 20)).toBe(true);
  });

  it("ignores cancelled and missed bookings when looking for a clash", () => {
    const list = [booking({ status: "cancelled" }), booking({ id: "a2", status: "no_show" })];
    expect(findClash(list, "09:00", 20)).toBeUndefined();
    expect(findClash([booking({ status: "completed" })], "09:00", 20)?.id).toBe("a1");
    expect(findClash([booking({})], "09:00", 20, "a1")).toBeUndefined();
  });

  it("marks taken and past slots, keeping a running slot bookable", () => {
    const slots = buildSlots(
      ["09:00", "09:20", "09:40"],
      20,
      [booking({ startTime: "09:40", patientName: "Ali", queueNumber: 3 })],
      MON,
      { date: MON, minutes: 9 * 60 + 25 },
    );
    expect(slots.map((s) => [s.startTime, s.available, s.reason])).toEqual([
      ["09:00", false, "past"],
      ["09:20", true, undefined],
      ["09:40", false, "taken"],
    ]);
    expect(slots[2].takenBy).toEqual({ appointmentId: "a1", patientName: "Ali", queueNumber: 3 });
    expect(slots[1].endTime).toBe("09:40");
  });
});

describe("booking validation", () => {
  const base = {
    date: MON,
    startTime: "09:20",
    slotMinutes: 20,
    starts: slotStarts(SCHEDULE, 20, MON),
    bookings: [] as Booking[],
    now: { date: MON, minutes: 8 * 60 },
  };

  it("accepts a free slot in the timetable", () => {
    expect(bookingProblem(base)).toBeNull();
  });

  it("refuses the past, the far future, days off and off-grid times", () => {
    expect(bookingProblem({ ...base, now: { date: "2026-11-10", minutes: 0 } })).toMatch(/O'tgan kun/);
    expect(bookingProblem({ ...base, now: { date: "2026-07-01", minutes: 0 } })).toMatch(/90 kundan/);
    expect(bookingProblem({ ...base, starts: [] })).toMatch(/qabul qilmaydi/);
    expect(bookingProblem({ ...base, startTime: "09:10" })).toMatch(/ish jadvali/);
    expect(bookingProblem({ ...base, now: { date: MON, minutes: 9 * 60 + 40 } })).toMatch(/o'tib ketgan/);
    expect(bookingProblem({ ...base, date: "2026-02-30" })).toMatch(/Sana/);
  });

  it("refuses a taken slot and names the ticket, but not when moving the same booking", () => {
    const bookings = [booking({ startTime: "09:20", queueNumber: 4 })];
    expect(bookingProblem({ ...base, bookings })).toBe("Bu vaqt band (navbat №4)");
    expect(bookingProblem({ ...base, bookings, ignoreId: "a1" })).toBeNull();
  });

  it("issues ticket numbers past the highest ever used", () => {
    expect(nextQueueNumber([])).toBe(1);
    expect(nextQueueNumber([1, 2, 5])).toBe(6);
  });
});

describe("status machine", () => {
  const desk = { desk: true, ownDoctor: false };
  const doctor = { desk: false, ownDoctor: true };
  const stranger = { desk: false, ownDoctor: false };

  it("lets the desk check in, cancel and undo a check-in", () => {
    expect(checkTransition("scheduled", "arrived", desk).ok).toBe(true);
    expect(checkTransition("scheduled", "cancelled", desk).ok).toBe(true);
    expect(checkTransition("arrived", "scheduled", desk).ok).toBe(true);
    expect(checkTransition("no_show", "arrived", desk).ok).toBe(true);
  });

  it("keeps calling in and finishing to the appointment's own doctor", () => {
    expect(checkTransition("arrived", "in_progress", doctor).ok).toBe(true);
    expect(checkTransition("in_progress", "completed", doctor).ok).toBe(true);
    expect(checkTransition("in_progress", "arrived", doctor).ok).toBe(true);
    const r = checkTransition("arrived", "in_progress", desk);
    expect(r.ok === false && r.status).toBe(403);
  });

  it("lets either side record a no-show, and nobody else", () => {
    expect(checkTransition("scheduled", "no_show", desk).ok).toBe(true);
    expect(checkTransition("scheduled", "no_show", doctor).ok).toBe(true);
    expect(checkTransition("scheduled", "no_show", stranger).ok).toBe(false);
  });

  it("never reopens a finished or cancelled appointment", () => {
    for (const to of APPOINTMENT_STATUSES) {
      expect(checkTransition("completed", to, { desk: true, ownDoctor: true }).ok).toBe(false);
      expect(checkTransition("cancelled", to, { desk: true, ownDoctor: true }).ok).toBe(false);
    }
  });

  it("refuses skipping steps (scheduled → completed)", () => {
    const r = checkTransition("scheduled", "completed", { desk: true, ownDoctor: true });
    expect(r.ok === false && r.status).toBe(400);
  });

  it("defines a row for every status", () => {
    for (const s of APPOINTMENT_STATUSES) expect(TRANSITIONS[s]).toBeDefined();
  });

  it("calls the arrived patient with the earliest booking first", () => {
    const list = [
      { id: "x", status: "scheduled" as const, startTime: "09:00", queueNumber: 1 },
      { id: "y", status: "arrived" as const, startTime: "09:40", queueNumber: 2 },
      { id: "z", status: "arrived" as const, startTime: "09:20", queueNumber: 5 },
    ];
    expect(nextInLine(list)?.id).toBe("z");
    expect(nextInLine([])).toBeUndefined();
  });
});
