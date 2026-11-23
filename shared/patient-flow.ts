/**
 * Bemorlar oqimi (R.2, TZ §13 "kunlik bemorlar soni", "laboratoriya tahlillari
 * soni"): how many people the clinic served each day, and how much lab work.
 *
 * Counting rules (both storages and the screen use them):
 *   - A patient counts once a day however many services they had: an attended
 *     appointment (arrived / in progress / completed), a lab order (not
 *     cancelled), or a stay in hospital during the day. The breakdown by kind
 *     may add up to more than the day's total — one person can be in two.
 *   - In hospital on a day: admitted by its end and not discharged before its
 *     start; a cancelled stay (a mistake) counts nowhere.
 *   - New patients: cards registered that day.
 *   - Lab tests: lines of orders placed that day (not cancelled) — ordered;
 *     results verified that day (B4.5) — done, whatever day they were ordered.
 *   - The period total of patients counts each person once over the whole period.
 */
import { eachDay } from "./inpatient-report";

export type ActivityKind = "visit" | "lab";
export type ActivityEvent = { day: string; patientId: string; kind: ActivityKind };
export type FlowStay = { patientId: string; status: "active" | "discharged" | "cancelled"; admittedAt: string; dischargedAt: string | null };

export type PatientFlowDay = {
  day: string;
  patients: number;
  outpatients: number;
  labPatients: number;
  inpatients: number;
  newPatients: number;
  testsOrdered: number;
  testsVerified: number;
};
export type PatientFlowReport = {
  range: { from: string; to: string };
  days: PatientFlowDay[];
  totals: {
    /** Each person once over the period. */
    uniquePatients: number;
    /** Patient-days over the period ÷ days. */
    avgPerDay: number;
    newPatients: number;
    outpatients: number;
    labPatients: number;
    inpatients: number;
    testsOrdered: number;
    testsVerified: number;
    busiest: { day: string; patients: number } | null;
  };
};

export function buildPatientFlowReport(input: {
  from: string;
  to: string;
  today: string;
  events: ActivityEvent[];
  stays: FlowStay[];
  newPatients: { day: string; count: number }[];
  tests: { day: string; ordered: number; verified: number }[];
  /** The instants a local day starts and ends. */
  startOfDay: (day: string) => number;
  endOfDay: (day: string) => number;
}): PatientFlowReport {
  const days = eachDay(input.from, input.to).filter((d) => d <= input.today);
  const byDay = new Map<string, { all: Set<string>; visit: Set<string>; lab: Set<string>; stay: Set<string> }>();
  const slot = (d: string) => {
    let s = byDay.get(d);
    if (!s) byDay.set(d, (s = { all: new Set(), visit: new Set(), lab: new Set(), stay: new Set() }));
    return s;
  };
  for (const e of input.events) {
    if (e.day < input.from || e.day > input.to) continue;
    const s = slot(e.day);
    s.all.add(e.patientId);
    s[e.kind].add(e.patientId);
  }
  const live = input.stays.filter((s) => s.status !== "cancelled");
  for (const d of days) {
    const start = input.startOfDay(d);
    const end = input.endOfDay(d);
    for (const st of live) {
      if (Date.parse(st.admittedAt) > end) continue;
      if (st.dischargedAt && Date.parse(st.dischargedAt) < start) continue;
      const s = slot(d);
      s.all.add(st.patientId);
      s.stay.add(st.patientId);
    }
  }
  const fresh = new Map(input.newPatients.map((n) => [n.day, n.count]));
  const tests = new Map(input.tests.map((t) => [t.day, t]));
  const rows: PatientFlowDay[] = days.map((d) => {
    const s = byDay.get(d);
    return {
      day: d,
      patients: s?.all.size ?? 0,
      outpatients: s?.visit.size ?? 0,
      labPatients: s?.lab.size ?? 0,
      inpatients: s?.stay.size ?? 0,
      newPatients: fresh.get(d) ?? 0,
      testsOrdered: tests.get(d)?.ordered ?? 0,
      testsVerified: tests.get(d)?.verified ?? 0,
    };
  });
  const everyone = new Set<string>();
  const kinds = { visit: new Set<string>(), lab: new Set<string>(), stay: new Set<string>() };
  for (const d of days) {
    const s = byDay.get(d);
    if (!s) continue;
    s.all.forEach((p) => everyone.add(p));
    s.visit.forEach((p) => kinds.visit.add(p));
    s.lab.forEach((p) => kinds.lab.add(p));
    s.stay.forEach((p) => kinds.stay.add(p));
  }
  const patientDays = rows.reduce((x, r) => x + r.patients, 0);
  const busiest = rows.filter((r) => r.patients > 0).sort((a, b) => b.patients - a.patients || a.day.localeCompare(b.day))[0];
  return {
    range: { from: input.from, to: input.to },
    days: rows,
    totals: {
      uniquePatients: everyone.size,
      avgPerDay: rows.length ? Math.round((patientDays / rows.length) * 10) / 10 : 0,
      newPatients: rows.reduce((x, r) => x + r.newPatients, 0),
      outpatients: kinds.visit.size,
      labPatients: kinds.lab.size,
      inpatients: kinds.stay.size,
      testsOrdered: rows.reduce((x, r) => x + r.testsOrdered, 0),
      testsVerified: rows.reduce((x, r) => x + r.testsVerified, 0),
      busiest: busiest ? { day: busiest.day, patients: busiest.patients } : null,
    },
  };
}
