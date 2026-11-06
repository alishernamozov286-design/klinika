/**
 * Appointment rules (B2.7, TZ §4.1.4) that both the server and the screens
 * use: the booking grid built from a doctor's weekly timetable, overlap
 * checks, and the status machine with who may make each move.
 *
 * Pure functions on wall-clock values ("2026-11-06", "09:20"), so the same
 * answer comes out on the server, in the browser and in the tests.
 */
import type { AppointmentSlot, AppointmentStatus, ScheduleSlot } from "./schema";

/** Statuses that hold a slot. A cancelled or missed booking frees it. */
export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["scheduled", "arrived", "in_progress", "completed"];
export const holdsSlot = (status: AppointmentStatus) => ACTIVE_STATUSES.includes(status);

/** How far ahead the desk may book. */
export const MAX_BOOKING_DAYS_AHEAD = 90;

// ------------------------------------------------------------- time maths

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (total: number): string => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** ISO weekday of a calendar day, 1 = Monday … 7 = Sunday. Time-zone free. */
export function weekdayOf(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function isValidDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** The clinic's "now" as wall-clock values — the server's local clock, like localDay(). */
export function clockNow(now = new Date()): { date: string; minutes: number } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

// -------------------------------------------------------------- the grid

/**
 * Every slot start the timetable offers on `date`. A window that does not
 * divide evenly loses its tail: a 20-minute slot is not offered at 12:50 when
 * the window closes at 13:00.
 */
export function slotStarts(schedule: ScheduleSlot[], slotMinutes: number, date: string): string[] {
  if (slotMinutes <= 0) return [];
  const day = weekdayOf(date);
  const starts: string[] = [];
  for (const w of schedule.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start))) {
    const end = toMinutes(w.end);
    for (let t = toMinutes(w.start); t + slotMinutes <= end; t += slotMinutes) starts.push(fromMinutes(t));
  }
  return starts;
}

export type Booking = {
  id: string;
  startTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  patientName?: string;
  queueNumber?: number;
};

/** True when [aStart, aStart+aLen) and [bStart, bStart+bLen) share any minute. */
export function overlaps(aStart: string, aLen: number, bStart: string, bLen: number): boolean {
  const a = toMinutes(aStart);
  const b = toMinutes(bStart);
  return a < b + bLen && b < a + aLen;
}

/** The live booking that clashes with a proposed one, if any. */
export function findClash(
  bookings: Booking[],
  startTime: string,
  durationMinutes: number,
  ignoreId?: string,
): Booking | undefined {
  return bookings.find(
    (b) => b.id !== ignoreId && holdsSlot(b.status) && overlaps(b.startTime, b.durationMinutes, startTime, durationMinutes),
  );
}

/**
 * The booking grid for one doctor and day.
 *
 * A slot counts as past only once it has ended: at 10:07 the 10:00–10:20 slot
 * can still take a walk-in, because the doctor is right there.
 */
export function buildSlots(
  starts: string[],
  slotMinutes: number,
  bookings: Booking[],
  date: string,
  now: { date: string; minutes: number },
): AppointmentSlot[] {
  return starts.map((startTime) => {
    const endTime = fromMinutes(toMinutes(startTime) + slotMinutes);
    const clash = findClash(bookings, startTime, slotMinutes);
    if (clash) {
      return {
        startTime,
        endTime,
        available: false,
        reason: "taken",
        takenBy: clash.patientName
          ? { appointmentId: clash.id, patientName: clash.patientName, queueNumber: clash.queueNumber ?? 0 }
          : undefined,
      };
    }
    const past = date < now.date || (date === now.date && toMinutes(endTime) <= now.minutes);
    return past ? { startTime, endTime, available: false, reason: "past" } : { startTime, endTime, available: true };
  });
}

/** Why a booking at `date` / `startTime` cannot be made, or null when it can. */
export function bookingProblem(opts: {
  date: string;
  startTime: string;
  slotMinutes: number;
  starts: string[];
  bookings: Booking[];
  now: { date: string; minutes: number };
  ignoreId?: string;
}): string | null {
  const { date, startTime, slotMinutes, starts, bookings, now } = opts;
  if (!isValidDay(date)) return "Sana noto'g'ri";
  if (date < now.date) return "O'tgan kunga yozib bo'lmaydi";
  if (daysBetween(now.date, date) > MAX_BOOKING_DAYS_AHEAD) {
    return `${MAX_BOOKING_DAYS_AHEAD} kundan uzoq muddatga yozib bo'lmaydi`;
  }
  if (starts.length === 0) return "Shifokor bu kuni qabul qilmaydi";
  if (!starts.includes(startTime)) return "Bu vaqt shifokorning ish jadvaliga to'g'ri kelmaydi";
  if (date === now.date && toMinutes(startTime) + slotMinutes <= now.minutes) return "Bu vaqt allaqachon o'tib ketgan";
  const clash = findClash(bookings, startTime, slotMinutes, opts.ignoreId);
  if (clash) return `Bu vaqt band${clash.queueNumber ? ` (navbat №${clash.queueNumber})` : ""}`;
  return null;
}

/** Next ticket number for a doctor's day: one past the highest ever issued, cancelled ones included. */
export function nextQueueNumber(existing: number[]): number {
  return existing.reduce((max, n) => Math.max(max, n), 0) + 1;
}

// --------------------------------------------------------- status machine

/**
 * Who makes a move:
 * - desk: the registrar (appointments.manage) — check-in, cancel, reschedule;
 * - doctor: the appointment's own doctor (appointments.serve) — call in,
 *   finish, send back to the waiting list;
 * - either: both may record that the patient did not come.
 */
export type TransitionActor = "desk" | "doctor" | "either";

export const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, TransitionActor>>> = {
  scheduled: { arrived: "desk", cancelled: "desk", no_show: "either" },
  // Back to "scheduled" undoes a check-in made by mistake.
  arrived: { in_progress: "doctor", scheduled: "desk", cancelled: "desk", no_show: "either" },
  // Back to "arrived": the doctor called the wrong patient, or sends them for a test first.
  in_progress: { completed: "doctor", arrived: "doctor" },
  // A late patient who turns up after all.
  no_show: { arrived: "desk" },
  completed: {},
  cancelled: {},
};

export type TransitionCheck = { ok: true } | { ok: false; status: 400 | 403; message: string };

export function checkTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  who: { desk: boolean; ownDoctor: boolean },
): TransitionCheck {
  if (from === to) return { ok: false, status: 400, message: "Qabul allaqachon shu holatda" };
  const actor = TRANSITIONS[from][to];
  if (!actor) return { ok: false, status: 400, message: TRANSITION_REFUSALS[from] ?? "Bu holatga o'tkazib bo'lmaydi" };
  const allowed =
    actor === "desk" ? who.desk : actor === "doctor" ? who.ownDoctor : who.desk || who.ownDoctor;
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      message: actor === "doctor" ? "Bu amalni faqat qabul qiluvchi shifokor bajaradi" : "Bu amal uchun ruxsatingiz yo'q",
    };
  }
  return { ok: true };
}

const TRANSITION_REFUSALS: Partial<Record<AppointmentStatus, string>> = {
  completed: "Yakunlangan qabulni o'zgartirib bo'lmaydi",
  cancelled: "Bekor qilingan qabulni o'zgartirib bo'lmaydi. Yangi qabulga yozing",
};

/** Moves that need a reason in writing. */
export const needsReason = (to: AppointmentStatus) => to === "cancelled";

/** The doctor calls the next patient: arrived first, in booked time order, then ticket order. */
export function nextInLine<T extends { status: AppointmentStatus; startTime: string; queueNumber: number }>(
  list: T[],
): T | undefined {
  return list
    .filter((a) => a.status === "arrived")
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber)[0];
}
