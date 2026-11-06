import { describe, expect, it } from "vitest";
import type { AppointmentStatus, AppointmentWithDetails } from "./schema";
import { summarizeQueue } from "./reception";

let n = 0;
function appt(status: AppointmentStatus, startTime: string, extra: Partial<AppointmentWithDetails> = {}) {
  n++;
  return {
    id: `a${n}`,
    status,
    startTime,
    queueNumber: n,
    arrivedAt: null,
    ...extra,
  } as AppointmentWithDetails;
}

describe("registratura queue summary (TZ §4.1.1, B2.11)", () => {
  const list = [
    appt("scheduled", "09:00"),
    appt("scheduled", "11:30"),
    appt("scheduled", "08:40"),
    appt("arrived", "10:00", { arrivedAt: "2026-11-06T05:10:00.000Z" }),
    appt("arrived", "09:20", { arrivedAt: "2026-11-06T04:55:00.000Z" }),
    appt("in_progress", "09:40", { arrivedAt: "2026-11-06T05:30:00.000Z" }),
    appt("completed", "08:00"),
    appt("no_show", "08:20"),
    appt("cancelled", "12:00"),
  ];

  it("counts each state, leaving cancelled bookings out of the total", () => {
    const { counts } = summarizeQueue(list, { isToday: true, now: "10:00" });
    expect(counts).toEqual({
      total: 8,
      scheduled: 3,
      late: 2, // 08:40 and 09:00 are past and nobody came
      arrived: 2,
      inProgress: 1,
      completed: 1,
      noShow: 1,
      cancelled: 1,
    });
  });

  it("is never late on a day other than today", () => {
    expect(summarizeQueue(list, { isToday: false, now: "23:59" }).counts.late).toBe(0);
  });

  it("lists the chair first, then the waiting room in arrival order", () => {
    const { waiting } = summarizeQueue(list, { isToday: true, now: "10:00" });
    expect(waiting.map((a) => [a.status, a.startTime])).toEqual([
      ["in_progress", "09:40"],
      ["arrived", "09:20"], // arrived 04:55Z, before the 10:00 booking that came at 05:10Z
      ["arrived", "10:00"],
    ]);
  });

  it("lists who is still to come by booked time, and caps both lists", () => {
    const { upcoming } = summarizeQueue(list, { isToday: true, now: "10:00" });
    expect(upcoming.map((a) => a.startTime)).toEqual(["08:40", "09:00", "11:30"]);
    const capped = summarizeQueue(list, { isToday: true, now: "10:00", limit: 1 });
    expect(capped.upcoming).toHaveLength(1);
    expect(capped.waiting).toHaveLength(1);
  });
});
