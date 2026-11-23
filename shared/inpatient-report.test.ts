import { describe, expect, it } from "vitest";
import { buildInpatientReport, eachDay, type ReportStay } from "./inpatient-report";

// Days cut in UTC here; the app passes the clinic's local day and its end.
const dayOf = (iso: string) => iso.slice(0, 10);
const endOfDay = (day: string) => Date.parse(`${day}T23:59:59.999Z`);
const wards = [
  { id: "w1", name: "101", departmentId: "d1", departmentName: "Terapiya" },
  { id: "w2", name: "201", departmentId: "d2", departmentName: "Jarrohlik" },
];
const beds = [
  { id: "b1", wardId: "w1", createdAt: "2026-11-01T00:00:00Z", usable: true },
  { id: "b2", wardId: "w1", createdAt: "2026-11-01T00:00:00Z", usable: true },
  // Added mid-period: counted from its day on.
  { id: "b3", wardId: "w2", createdAt: "2026-11-03T10:00:00Z", usable: true },
  // Out of service now: not capacity.
  { id: "b4", wardId: "w2", createdAt: "2026-11-01T00:00:00Z", usable: false },
];
const stay = (s: Partial<ReportStay> & Pick<ReportStay, "id" | "admittedAt" | "periods">): ReportStay => ({ status: "active", dischargedAt: null, departmentId: "d1", ...s });

describe("inpatient occupancy (R.2)", () => {
  it("lists the days of a period", () => {
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("counts the midnight census against the beds in service; moves, discharges and mistakes counted right", () => {
    const stays: ReportStay[] = [
      // In 101 from the 1st, moved to 201 on the 3rd, discharged on the 4th.
      stay({
        id: "a",
        admittedAt: "2026-11-01T09:00:00Z",
        status: "discharged",
        dischargedAt: "2026-11-04T11:00:00Z",
        periods: [
          { bedId: "b1", wardId: "w1", fromAt: "2026-11-01T09:00:00Z", toAt: "2026-11-03T12:00:00Z" },
          { bedId: "b3", wardId: "w2", fromAt: "2026-11-03T12:00:00Z", toAt: "2026-11-04T11:00:00Z" },
        ],
      }),
      // Still in, from the 2nd.
      stay({ id: "b", admittedAt: "2026-11-02T15:00:00Z", periods: [{ bedId: "b2", wardId: "w1", fromAt: "2026-11-02T15:00:00Z", toAt: null }] }),
      // A mistake: never counted.
      stay({ id: "c", admittedAt: "2026-11-02T10:00:00Z", status: "cancelled", periods: [{ bedId: "b1", wardId: "w1", fromAt: "2026-11-02T10:00:00Z", toAt: "2026-11-02T10:30:00Z" }] }),
    ];
    const r = buildInpatientReport({ from: "2026-11-01", to: "2026-11-04", wards, beds, stays, endOfDay, today: "2026-11-30", now: Date.parse("2026-11-30T12:00:00Z"), dayOf });
    expect(r.days.map((d) => [d.day, d.occupied, d.capacity, d.occupancy, d.admitted, d.discharged])).toEqual([
      ["2026-11-01", 1, 2, 50, 1, 0],
      ["2026-11-02", 2, 2, 100, 1, 0],
      ["2026-11-03", 2, 3, 66.7, 0, 0],
      ["2026-11-04", 1, 3, 33.3, 0, 1],
    ]);
    expect(r.totals).toMatchObject({ occupiedBedDays: 6, availableBedDays: 10, occupancy: 60, admitted: 2, discharged: 1, alos: 3, inHospital: 1, peak: { day: "2026-11-02", occupancy: 100 } });
    // By department: admitted where they came in, discharged where they left from.
    const dept = Object.fromEntries(r.byDepartment.map((d) => [d.name, d]));
    expect(dept.Terapiya).toMatchObject({ beds: 2, occupiedBedDays: 5, availableBedDays: 8, occupancy: 62.5, admitted: 2, discharged: 0, alos: null });
    expect(dept.Jarrohlik).toMatchObject({ beds: 1, occupiedBedDays: 1, availableBedDays: 2, occupancy: 50, admitted: 0, discharged: 1, alos: 3 });
    expect(r.byWard.map((w) => [w.departmentName, w.name])).toEqual([
      ["Jarrohlik", "201"],
      ["Terapiya", "101"],
    ]);
  });

  it("stops at today and uses now for it", () => {
    const stays = [stay({ id: "x", admittedAt: "2026-11-30T08:00:00Z", periods: [{ bedId: "b1", wardId: "w1", fromAt: "2026-11-30T08:00:00Z", toAt: null }] })];
    const r = buildInpatientReport({ from: "2026-11-29", to: "2026-12-05", wards, beds, stays, endOfDay, today: "2026-11-30", now: Date.parse("2026-11-30T12:00:00Z"), dayOf });
    expect(r.days.map((d) => d.day)).toEqual(["2026-11-29", "2026-11-30"]);
    expect(r.days[1]).toMatchObject({ occupied: 1, admitted: 1 });
    // Shorter than a day still counts as one day of stay.
    const short = buildInpatientReport({
      from: "2026-11-01",
      to: "2026-11-01",
      wards,
      beds,
      stays: [stay({ id: "s", admittedAt: "2026-11-01T08:00:00Z", status: "discharged", dischargedAt: "2026-11-01T18:00:00Z", periods: [{ bedId: "b1", wardId: "w1", fromAt: "2026-11-01T08:00:00Z", toAt: "2026-11-01T18:00:00Z" }] })],
      endOfDay,
      today: "2026-11-30",
      now: 0,
      dayOf,
    });
    expect(short.totals).toMatchObject({ alos: 1, discharged: 1, occupiedBedDays: 0 });
  });

  it("never passes 100%: a back-dated stay in a bed added later counts that bed as capacity", () => {
    const newBed = [{ id: "n1", wardId: "w1", createdAt: "2026-11-10T00:00:00Z", usable: true }];
    const r = buildInpatientReport({
      from: "2026-11-01",
      to: "2026-11-10",
      wards,
      beds: newBed,
      stays: [stay({ id: "late", admittedAt: "2026-11-05T09:00:00Z", periods: [{ bedId: "n1", wardId: "w1", fromAt: "2026-11-05T09:00:00Z", toAt: null }] })],
      endOfDay,
      today: "2026-11-30",
      now: 0,
      dayOf,
    });
    expect(r.days.every((d) => d.occupied <= d.capacity)).toBe(true);
    expect(r.days.find((d) => d.day === "2026-11-05")).toMatchObject({ occupied: 1, capacity: 1, occupancy: 100 });
    expect(r.days.find((d) => d.day === "2026-11-04")).toMatchObject({ occupied: 0, capacity: 0, occupancy: null });
    expect(r.totals.occupancy).toBe(100);
  });
});
