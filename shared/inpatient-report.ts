/**
 * Statsionar bandligi (R.2, TZ §13 "statsionar bandligi"): how full the wards
 * were over a period, day by day and by department and ward, how many came
 * and left, and how long they stayed.
 *
 * Counting rules (one place, both storages and the screen use them):
 *   - Census: a bed counts as occupied on a day when a stay's bed period covers
 *     the end of that day (23:59 local; for today — now). The usual hospital
 *     midnight census: a patient moved during the day counts once, in the ward
 *     where they ended it.
 *   - Capacity: the beds that existed by that day and are in service now
 *     (active, not under maintenance), plus any bed someone lay in that day
 *     (a back-dated stay, a bed retired since) — occupancy never passes 100%.
 *     Bed history is not kept beyond creation, so an idle bed retired since is
 *     not counted backwards.
 *   - Occupancy % = occupied bed-days ÷ available bed-days over the period.
 *   - Cancelled stays (a mistake, B6.2) count nowhere.
 *   - Average length of stay: over stays discharged in the period, local days
 *     from admission to discharge, at least one.
 */
import { dayDiff } from "./stay-bill";

export type ReportBed = { id: string; wardId: string; createdAt: string; usable: boolean };
export type ReportWard = { id: string; name: string; departmentId: string; departmentName: string };
export type ReportStay = {
  id: string;
  status: "active" | "discharged" | "cancelled";
  admittedAt: string;
  dischargedAt: string | null;
  departmentId: string;
  periods: { bedId: string; wardId: string; fromAt: string; toAt: string | null }[];
};

export type InpatientDay = { day: string; occupied: number; capacity: number; occupancy: number | null; admitted: number; discharged: number };
export type InpatientUnitRow = {
  id: string;
  name: string;
  /** Beds in service now. */
  beds: number;
  occupiedBedDays: number;
  availableBedDays: number;
  occupancy: number | null;
  admitted: number;
  discharged: number;
  /** Average length of stay of those discharged, days; null without any. */
  alos: number | null;
};
export type InpatientReport = {
  range: { from: string; to: string };
  days: InpatientDay[];
  totals: {
    occupancy: number | null;
    occupiedBedDays: number;
    availableBedDays: number;
    admitted: number;
    discharged: number;
    alos: number | null;
    /** In hospital at the end of the period. */
    inHospital: number;
    /** The fullest day. */
    peak: { day: string; occupancy: number } | null;
  };
  byDepartment: InpatientUnitRow[];
  byWard: (InpatientUnitRow & { departmentName: string })[];
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Every YYYY-MM-DD day from `from` to `to`, inclusive (at most a year and a little). */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const n = Math.min(dayDiff(from, to), 400);
  for (let i = 0; i <= n; i++) {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function buildInpatientReport(input: {
  from: string;
  to: string;
  wards: ReportWard[];
  beds: ReportBed[];
  stays: ReportStay[];
  /** The instant a local day ends (23:59:59.999), and today's local day. */
  endOfDay: (day: string) => number;
  today: string;
  now: number;
  dayOf: (iso: string) => string;
}): InpatientReport {
  const days = eachDay(input.from, input.to).filter((d) => d <= input.today);
  const wardOf = new Map(input.wards.map((w) => [w.id, w]));
  const live = input.stays.filter((s) => s.status !== "cancelled");
  const usableBeds = input.beds.filter((b) => b.usable);

  type Acc = { occupied: number; available: number; admitted: number; discharged: number; stayDays: number[] };
  const blank = (): Acc => ({ occupied: 0, available: 0, admitted: 0, discharged: 0, stayDays: [] });
  const byDept = new Map<string, Acc>();
  const byWard = new Map<string, Acc>();
  const acc = (m: Map<string, Acc>, k: string) => {
    const a = m.get(k) ?? blank();
    m.set(k, a);
    return a;
  };

  const dayRows: InpatientDay[] = days.map((day) => {
    const cut = day === input.today ? input.now : input.endOfDay(day);
    // Who lies where at the day's end.
    const occupiedBeds = new Map<string, string>();
    for (const s of live) {
      const p = s.periods.find((x) => Date.parse(x.fromAt) <= cut && (x.toAt === null || Date.parse(x.toAt) > cut));
      if (p) occupiedBeds.set(p.bedId, p.wardId);
    }
    // Capacity: beds in service by that day — and any bed someone lay in that day, whatever its
    // record says (a stay entered back-dated before the bed was added, a bed retired since).
    // So occupancy never passes 100%.
    const capacityBeds = new Map<string, string>(occupiedBeds);
    for (const b of usableBeds) if (input.dayOf(b.createdAt) <= day) capacityBeds.set(b.id, b.wardId);
    for (const wardId of capacityBeds.values()) {
      const w = wardOf.get(wardId);
      if (!w) continue;
      acc(byWard, w.id).available++;
      acc(byDept, w.departmentId).available++;
    }
    for (const wardId of occupiedBeds.values()) {
      const w = wardOf.get(wardId);
      if (!w) continue;
      acc(byWard, w.id).occupied++;
      acc(byDept, w.departmentId).occupied++;
    }
    const capacity = capacityBeds.size;
    const occupied = occupiedBeds.size;
    const admitted = live.filter((s) => input.dayOf(s.admittedAt) === day).length;
    const discharged = live.filter((s) => s.dischargedAt && input.dayOf(s.dischargedAt) === day).length;
    return { day, occupied, capacity, occupancy: pct(occupied, capacity), admitted, discharged };
  });

  // Came and left in the period, by where they were admitted / where they left from.
  const inRange = (iso: string | null) => Boolean(iso) && input.dayOf(iso!) >= input.from && input.dayOf(iso!) <= input.to;
  const alosAll: number[] = [];
  for (const s of live) {
    const firstWard = wardOf.get(s.periods[0]?.wardId ?? "");
    const lastWard = wardOf.get(s.periods[s.periods.length - 1]?.wardId ?? "");
    if (inRange(s.admittedAt)) {
      if (firstWard) acc(byWard, firstWard.id).admitted++;
      acc(byDept, firstWard?.departmentId ?? s.departmentId).admitted++;
    }
    if (s.status === "discharged" && inRange(s.dischargedAt)) {
      const length = Math.max(1, dayDiff(input.dayOf(s.admittedAt), input.dayOf(s.dischargedAt!)));
      alosAll.push(length);
      if (lastWard) {
        const w = acc(byWard, lastWard.id);
        w.discharged++;
        w.stayDays.push(length);
      }
      const d = acc(byDept, lastWard?.departmentId ?? s.departmentId);
      d.discharged++;
      d.stayDays.push(length);
    }
  }

  const row = (id: string, name: string, beds: number, a: Acc): InpatientUnitRow => ({
    id,
    name,
    beds,
    occupiedBedDays: a.occupied,
    availableBedDays: a.available,
    occupancy: pct(a.occupied, a.available),
    admitted: a.admitted,
    discharged: a.discharged,
    alos: a.stayDays.length ? round1(a.stayDays.reduce((x, y) => x + y, 0) / a.stayDays.length) : null,
  });
  const departments = [...new Map(input.wards.map((w) => [w.departmentId, w.departmentName])).entries()];
  const bedsIn = (pred: (b: ReportBed) => boolean) => usableBeds.filter(pred).length;

  const occupied = dayRows.reduce((s, d) => s + d.occupied, 0);
  const available = dayRows.reduce((s, d) => s + d.capacity, 0);
  const peakDay = dayRows.filter((d) => d.occupancy !== null).sort((a, b) => b.occupancy! - a.occupancy! || a.day.localeCompare(b.day))[0];
  return {
    range: { from: input.from, to: input.to },
    days: dayRows,
    totals: {
      occupancy: pct(occupied, available),
      occupiedBedDays: occupied,
      availableBedDays: available,
      admitted: dayRows.reduce((s, d) => s + d.admitted, 0),
      discharged: dayRows.reduce((s, d) => s + d.discharged, 0),
      alos: alosAll.length ? round1(alosAll.reduce((x, y) => x + y, 0) / alosAll.length) : null,
      inHospital: dayRows.length ? dayRows[dayRows.length - 1].occupied : 0,
      peak: peakDay ? { day: peakDay.day, occupancy: peakDay.occupancy! } : null,
    },
    byDepartment: departments
      .map(([id, name]) => row(id, name, bedsIn((b) => wardOf.get(b.wardId)?.departmentId === id), byDept.get(id) ?? blank()))
      .sort((a, b) => (b.occupancy ?? -1) - (a.occupancy ?? -1) || a.name.localeCompare(b.name)),
    byWard: input.wards
      .map((w) => ({ ...row(w.id, w.name, bedsIn((b) => b.wardId === w.id), byWard.get(w.id) ?? blank()), departmentName: w.departmentName }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name, "uz", { numeric: true })),
  };
}
