import { describe, expect, it } from "vitest";
import {
  TASK_NOT_PLANNED,
  TASK_TOO_EARLY,
  addDays,
  markDoneProblem,
  normalizeTimes,
  orderProblem,
  orderProgress,
  planSlots,
  sortTasks,
  taskState,
  type OrderPlan,
} from "./procedures";

const at = (day: string, time: string) => new Date(`${day}T${time}:00Z`);
const plan: OrderPlan = { kind: "medicine", name: "Seftriakson", dose: "1 g", route: "iv", times: ["08:00", "20:00"], startOn: "2026-11-22", days: 3 };

describe("orders", () => {
  it("checks what a doctor must write", () => {
    expect(orderProblem(plan, "2026-11-22", "2026-11-20")).toBeNull();
    expect(orderProblem({ ...plan, name: " " }, "2026-11-22", "2026-11-20")).toMatch(/Dori nomini/);
    expect(orderProblem({ ...plan, dose: null }, "2026-11-22", "2026-11-20")).toMatch(/Dozani/);
    expect(orderProblem({ ...plan, kind: "procedure", dose: null }, "2026-11-22", "2026-11-20")).toBeNull();
    expect(orderProblem({ ...plan, times: [] }, "2026-11-22", "2026-11-20")).toMatch(/Kamida bitta vaqt/);
    expect(orderProblem({ ...plan, times: ["8:00"] }, "2026-11-22", "2026-11-20")).toMatch(/Vaqt noto'g'ri/);
    expect(orderProblem({ ...plan, days: 0 }, "2026-11-22", "2026-11-20")).toMatch(/1–60/);
    expect(orderProblem({ ...plan, startOn: "2026-11-21" }, "2026-11-22", "2026-11-20")).toMatch(/o'tgan kundan/);
    expect(orderProblem({ ...plan, startOn: "2026-12-20" }, "2026-11-22", "2026-11-20")).toMatch(/14 kun/);
  });

  it("normalises times and counts days on the calendar", () => {
    expect(normalizeTimes(["20:00", " 08:00", "20:00"])).toEqual(["08:00", "20:00"]);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("writes one dose per day and time, skipping those already gone by", () => {
    const morning = planSlots(plan, new Date("2026-11-22T06:00:00Z"), at);
    expect(morning.map((d) => d.toISOString())).toEqual([
      "2026-11-22T08:00:00.000Z",
      "2026-11-22T20:00:00.000Z",
      "2026-11-23T08:00:00.000Z",
      "2026-11-23T20:00:00.000Z",
      "2026-11-24T08:00:00.000Z",
      "2026-11-24T20:00:00.000Z",
    ]);
    // Written at 15:00: this morning's dose is past; still due within the hour counts.
    expect(planSlots(plan, new Date("2026-11-22T15:00:00Z"), at)).toHaveLength(5);
    expect(planSlots(plan, new Date("2026-11-22T08:40:00Z"), at)).toHaveLength(6);
  });
});

describe("doses", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("is upcoming, due, overdue — or what was marked", () => {
    expect(taskState({ status: "planned", plannedAt: "2026-11-22T14:00:00Z" }, now)).toBe("upcoming");
    expect(taskState({ status: "planned", plannedAt: "2026-11-22T12:30:00Z" }, now)).toBe("due");
    expect(taskState({ status: "planned", plannedAt: "2026-11-22T11:30:00Z" }, now)).toBe("due");
    expect(taskState({ status: "planned", plannedAt: "2026-11-22T10:00:00Z" }, now)).toBe("overdue");
    expect(taskState({ status: "done", plannedAt: "2026-11-22T10:00:00Z" }, now)).toBe("done");
  });

  it("is marked at most two hours early, and only once", () => {
    expect(markDoneProblem({ status: "planned", plannedAt: "2026-11-22T13:30:00Z" }, now)).toBeNull();
    expect(markDoneProblem({ status: "planned", plannedAt: "2026-11-22T15:00:00Z" }, now)).toBe(TASK_TOO_EARLY);
    expect(markDoneProblem({ status: "done", plannedAt: "2026-11-22T11:00:00Z" }, now)).toBe(TASK_NOT_PLANNED);
  });

  it("counts a course and orders the nurse's list", () => {
    const tasks = [
      { id: "a", status: "done" as const, plannedAt: "2026-11-22T08:00:00Z" },
      { id: "b", status: "planned" as const, plannedAt: "2026-11-22T10:00:00Z" },
      { id: "c", status: "planned" as const, plannedAt: "2026-11-22T20:00:00Z" },
      { id: "d", status: "missed" as const, plannedAt: "2026-11-22T06:00:00Z" },
      { id: "e", status: "cancelled" as const, plannedAt: "2026-11-23T08:00:00Z" },
      { id: "f", status: "planned" as const, plannedAt: "2026-11-22T12:15:00Z" },
    ];
    expect(orderProgress(tasks, now)).toEqual({ total: 5, done: 1, missed: 1, overdue: 1, ahead: 2, cancelled: 1 });
    expect(sortTasks(tasks, now).map((t) => t.id)).toEqual(["b", "f", "c", "d", "a", "e"]);
  });
});
