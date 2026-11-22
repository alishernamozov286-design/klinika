import { describe, expect, it } from "vitest";
import { countBeds, labelKey, nextBedLabels, occupancy, sortBeds, sortWards } from "./inpatient";
import { bedStateSchema, insertWardSchema } from "./schema";

describe("wards and beds (B6.1, TZ §8)", () => {
  it("bed numbers continue from the ward's last number; odd labels are left alone", () => {
    expect(nextBedLabels([], 3)).toEqual(["1", "2", "3"]);
    expect(nextBedLabels(["1", "2", "5", "A"], 2)).toEqual(["6", "7"]);
    expect(nextBedLabels(["VIP"], 1)).toEqual(["1"]);
  });

  it("names compare without case or extra spaces; natural order", () => {
    expect(labelKey("  Palata   101 ")).toBe(labelKey("palata 101"));
    expect(sortBeds([{ label: "10" }, { label: "2" }, { label: "1" }]).map((b) => b.label)).toEqual(["1", "2", "10"]);
    expect(
      sortWards([
        { departmentName: "Terapiya", floor: 2, name: "201" },
        { departmentName: "Jarrohlik", floor: 1, name: "12" },
        { departmentName: "Jarrohlik", floor: 1, name: "9" },
      ]).map((w) => w.name),
    ).toEqual(["9", "12", "201"]);
  });

  it("the board's figures: active beds by what they show; occupancy over usable beds", () => {
    const c = countBeds([
      { isActive: true, display: "ready" },
      { isActive: true, display: "occupied" },
      { isActive: true, display: "occupied" },
      { isActive: true, display: "cleaning" },
      { isActive: true, display: "maintenance" },
      { isActive: false, display: "ready" },
    ]);
    expect(c).toEqual({ total: 5, free: 1, occupied: 2, cleaning: 1, maintenance: 1 });
    expect(occupancy(c)).toBe(50);
    expect(occupancy({ total: 0, free: 0, occupied: 0, cleaning: 0, maintenance: 0 })).toBeNull();
  });

  it("validates a ward and a state", () => {
    expect(insertWardSchema.parse({ departmentId: "d1", name: " 101 " })).toMatchObject({ name: "101", gender: "mixed", dayPrice: 0, floor: null, note: null });
    expect(insertWardSchema.safeParse({ departmentId: "d1", name: "101", dayPrice: -1 }).success).toBe(false);
    expect(bedStateSchema.safeParse({ state: "occupied" }).success).toBe(false);
  });
});

describe("admissions (B6.2, TZ §8.1.2)", () => {
  it("a bed takes a patient only when active, ready and empty", async () => {
    const { bedFreeProblem } = await import("./inpatient");
    expect(bedFreeProblem({ isActive: true, state: "ready" }, true, false)).toBeNull();
    expect(bedFreeProblem({ isActive: true, state: "ready" }, true, true)).toMatch(/bemor bor/);
    expect(bedFreeProblem({ isActive: true, state: "cleaning" }, true, false)).toMatch(/tozalanmoqda/);
    expect(bedFreeProblem({ isActive: false, state: "ready" }, true, false)).toMatch(/faol emas/);
    expect(bedFreeProblem({ isActive: true, state: "ready" }, false, false)).toMatch(/faol emas/);
    expect(bedFreeProblem(undefined, true, false)).toMatch(/topilmadi/);
  });

  it("the day of the stay: admission day is day 1", async () => {
    const { stayDay } = await import("./inpatient");
    expect(stayDay("2026-11-22", "2026-11-22")).toBe(1);
    expect(stayDay("2026-11-20", "2026-11-22")).toBe(3);
  });
});

describe("inpatient home page (B6.3, TZ §8.1.1)", () => {
  it("discharge plans against today", async () => {
    const { dischargeDue } = await import("./inpatient");
    expect(["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-25"].map((d) => dischargeDue(d, "2026-11-22"))).toEqual(["overdue", "today", "tomorrow", "later"]);
  });

  it("the five figures, by department, admitted today, leaving by tomorrow, beds to see to", async () => {
    const { buildInpatientOverview } = await import("./inpatient");
    const bed = (id: string, display: "ready" | "occupied" | "cleaning" | "maintenance", isActive = true) => ({ id, label: id, isActive, display, stateNote: display === "maintenance" ? "Singan" : null, stateChangedAt: null });
    const wards = [
      { id: "w1", name: "101", departmentId: "d1", departmentName: "Terapiya", isActive: true, beds: [bed("1", "occupied"), bed("2", "ready"), bed("3", "cleaning")] },
      { id: "w2", name: "201", departmentId: "d2", departmentName: "Jarrohlik", isActive: true, beds: [bed("1", "occupied"), bed("2", "maintenance")] },
      { id: "w3", name: "301", departmentId: "d2", departmentName: "Jarrohlik", isActive: false, beds: [bed("1", "ready")] },
    ];
    const stays = [
      { id: "a1", admittedAt: "2026-11-22T08:00:00.000Z", plannedDischargeOn: "2026-11-23", departmentId: "d1" },
      { id: "a2", admittedAt: "2026-11-18T08:00:00.000Z", plannedDischargeOn: "2026-11-21", departmentId: "d2" },
      { id: "a3", admittedAt: "2026-11-20T08:00:00.000Z", plannedDischargeOn: null, departmentId: "d2" },
    ];
    const o = buildInpatientOverview(wards, stays, 2, "2026-11-22", (iso) => iso.slice(0, 10));
    expect(o.counts).toEqual({ total: 5, free: 1, occupied: 2, cleaning: 1, maintenance: 1 });
    expect(o.occupancy).toBe(50);
    expect(o.patients).toBe(3);
    expect(o.byDepartment.map((d) => [d.name, d.counts.total, d.occupancy, d.patients])).toEqual([
      ["Jarrohlik", 2, 100, 2],
      ["Terapiya", 3, 33, 1],
    ]);
    expect(o.admittedToday.map((a) => a.id)).toEqual(["a1"]);
    expect(o.discharging.map((a) => [a.id, a.due])).toEqual([["a2", "overdue"], ["a1", "tomorrow"]]);
    expect(o.attention.map((b) => [b.wardName, b.label, b.display])).toEqual([["101", "3", "cleaning"], ["201", "2", "maintenance"]]);
    expect(o.dischargedToday).toBe(2);
  });
});
