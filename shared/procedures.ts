/**
 * Muolajalar (B6.5, TZ §8.1.4): "Shifokor tayinlovi. Dori vositasi. Dozasi.
 * Vaqti. Bajaruvchi hamshira. Bajarilganlik holati."
 *
 * A doctor's order (tayinlov) names a medicine or a procedure, its dose and
 * route, the times of day and for how many days. Prescribing writes the whole
 * schedule at once — one task per day and time — so the nurse's list is a plain
 * read and each dose has its own row to be marked: done (who, when) or not done
 * (why). A mistaken mark is put back with a reason; nothing is deleted.
 * Stopping an order early (with a reason) calls off its tasks still ahead.
 */
import { ADMIN_ROUTES, type AdminRoute } from "./prescription";

export const ORDER_KINDS = ["medicine", "procedure"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];
export const ORDER_KIND_LABELS: Record<OrderKind, string> = { medicine: "Dori vositasi", procedure: "Muolaja" };

export const TASK_STATUSES = ["planned", "done", "missed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = { planned: "Rejada", done: "Bajarildi", missed: "Bajarilmadi", cancelled: "Bekor qilingan" };

/** What a task shows: a planned one is upcoming, due now, or overdue. */
export type TaskState = "upcoming" | "due" | "overdue" | "done" | "missed" | "cancelled";
export const TASK_STATE_LABELS: Record<TaskState, string> = {
  upcoming: "Keyinroq",
  due: "Vaqti keldi",
  overdue: "Kechikmoqda",
  done: "Bajarildi",
  missed: "Bajarilmadi",
  cancelled: "Bekor qilingan",
};

export const MAX_TIMES_PER_DAY = 8;
export const MAX_ORDER_DAYS = 60;
/** How far ahead a course may start (a doctor plans the week, not the season). */
export const MAX_START_AHEAD_DAYS = 14;
/** A dose counts as due from an hour before to an hour after its time; later it is overdue. */
export const DUE_WINDOW_MS = 60 * 60_000;
/** A dose may be marked done at most this long before its time (an early round). */
export const EARLY_MARK_MS = 2 * 60 * 60_000;

/** Offered in the form: common day schedules. */
export const TIME_PRESETS: { label: string; times: string[] }[] = [
  { label: "1 mahal", times: ["08:00"] },
  { label: "2 mahal", times: ["08:00", "20:00"] },
  { label: "3 mahal", times: ["08:00", "14:00", "20:00"] },
  { label: "Har 8 soatda", times: ["06:00", "14:00", "22:00"] },
  { label: "4 mahal", times: ["08:00", "12:00", "16:00", "20:00"] },
];

export const ORDER_STOPPED = "Tayinlov to'xtatilgan";
export const ORDER_STAY_CLOSED = "Statsionar karta yopilgan — muolaja tayinlab yoki belgilab bo'lmaydi";
export const TASK_NOT_PLANNED = "Bu muolaja allaqachon belgilangan — avval belgini qaytaring";
export const TASK_NOT_MARKED = "Muolaja hali belgilanmagan";
export const TASK_TOO_EARLY = "Muolaja vaqti hali kelmagan — vaqtidan ko'pi bilan 2 soat oldin belgilanadi";
export const ORDER_NOTHING_AHEAD = "Tanlangan kunlarda vaqtlar o'tib ketgan — jadvalda birorta ham muolaja qolmadi";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Times as stored: valid, unique, in order. */
export const normalizeTimes = (times: readonly string[]) => [...new Set(times.map((t) => t.trim()))].sort();

export type OrderPlan = {
  kind: OrderKind;
  name: string;
  dose: string | null;
  route: AdminRoute | null;
  times: string[];
  startOn: string;
  days: number;
};

/** YYYY-MM-DD plus n days (calendar arithmetic, no clock involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Why an order cannot be written, or null. `today` is the clinic's local day. */
export function orderProblem(p: OrderPlan, today: string, admittedDay: string): string | null {
  if (!p.name.trim()) return p.kind === "medicine" ? "Dori nomini kiriting" : "Muolajani tanlang yoki yozing";
  if (p.kind === "medicine" && !(p.dose ?? "").trim()) return "Dozani kiriting (masalan 500 mg, 1 tabletka)";
  if (p.route && !ADMIN_ROUTES.includes(p.route)) return "Yuborish yo'lini tanlang";
  if (p.times.length === 0) return "Kamida bitta vaqtni belgilang";
  if (p.times.length > MAX_TIMES_PER_DAY) return `Kuniga ko'pi bilan ${MAX_TIMES_PER_DAY} marta`;
  const bad = p.times.find((t) => !TIME.test(t));
  if (bad) return `Vaqt noto'g'ri: ${bad} (SS:DD)`;
  if (new Set(p.times).size !== p.times.length) return "Bir xil vaqt ikki marta yozilgan";
  if (!Number.isInteger(p.days) || p.days < 1 || p.days > MAX_ORDER_DAYS) return `Davomiyligi 1–${MAX_ORDER_DAYS} kun`;
  if (!DAY.test(p.startOn)) return "Boshlanish kunini tanlang";
  if (p.startOn < today) return "Kurs o'tgan kundan boshlanmaydi";
  if (p.startOn < admittedDay) return "Kurs yotqizilgan kundan oldin boshlanmaydi";
  if (p.startOn > addDays(today, MAX_START_AHEAD_DAYS)) return `Kurs ko'pi bilan ${MAX_START_AHEAD_DAYS} kun keyin boshlanadi`;
  return null;
}

/**
 * The schedule: one slot per day and time, from the first day, skipping the
 * times already gone by when prescribing (an order written at 15:00 for "08:00
 * and 20:00" starts tonight). `at` turns a local day and time into an instant.
 */
export function planSlots(p: Pick<OrderPlan, "startOn" | "days" | "times">, now: Date, at: (day: string, time: string) => Date): Date[] {
  const out: Date[] = [];
  const from = now.getTime() - DUE_WINDOW_MS;
  for (let i = 0; i < p.days; i++) {
    const day = addDays(p.startOn, i);
    for (const t of normalizeTimes(p.times)) {
      const d = at(day, t);
      if (d.getTime() >= from) out.push(d);
    }
  }
  return out;
}

export function taskState(t: { status: TaskStatus; plannedAt: string }, now = new Date()): TaskState {
  if (t.status !== "planned") return t.status;
  const diff = now.getTime() - Date.parse(t.plannedAt);
  if (diff > DUE_WINDOW_MS) return "overdue";
  if (diff >= -DUE_WINDOW_MS) return "due";
  return "upcoming";
}

/** Why a task cannot be marked done now, or null. */
export function markDoneProblem(t: { status: TaskStatus; plannedAt: string }, now = new Date()): string | null {
  if (t.status !== "planned") return TASK_NOT_PLANNED;
  if (Date.parse(t.plannedAt) - now.getTime() > EARLY_MARK_MS) return TASK_TOO_EARLY;
  return null;
}

/** A course's progress: what was done of what was due so far, and what is left. */
export function orderProgress(tasks: readonly { status: TaskStatus; plannedAt: string }[], now = new Date()) {
  const c = { total: 0, done: 0, missed: 0, overdue: 0, ahead: 0, cancelled: 0 };
  for (const t of tasks) {
    const s = taskState(t, now);
    if (s === "cancelled") {
      c.cancelled++;
      continue;
    }
    c.total++;
    if (s === "done") c.done++;
    else if (s === "missed") c.missed++;
    else if (s === "overdue") c.overdue++;
    else c.ahead++;
  }
  return c;
}

/** Order of the nurse's list: overdue first, then due, then by time; marked ones after. */
const RANK: Record<TaskState, number> = { overdue: 0, due: 1, upcoming: 2, missed: 3, done: 4, cancelled: 5 };
export function sortTasks<T extends { status: TaskStatus; plannedAt: string }>(rows: T[], now = new Date()): T[] {
  return [...rows].sort((a, b) => RANK[taskState(a, now)] - RANK[taskState(b, now)] || a.plannedAt.localeCompare(b.plannedAt));
}
