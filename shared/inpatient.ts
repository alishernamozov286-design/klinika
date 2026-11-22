/**
 * Statsionar: palatalar va yotoqlar (B6.1, TZ §8, §10 "beds").
 *
 * Structure: a department of kind "statsionar" → its wards (palata) → their
 * beds. A ward carries the bed-day price (B6.6 bills it). A bed carries only
 * the states a person sets — ready, being cleaned, out of service. Whether it
 * is occupied is never stored: it is read from the admissions (B6.2), so the
 * board cannot drift from who is actually lying where.
 */
export const WARD_GENDERS = ["mixed", "male", "female"] as const;
export type WardGender = (typeof WARD_GENDERS)[number];
export const WARD_GENDER_LABELS: Record<WardGender, string> = { mixed: "Aralash", male: "Erkaklar", female: "Ayollar" };

export const BED_STATES = ["ready", "cleaning", "maintenance"] as const;
export type BedState = (typeof BED_STATES)[number];
export const BED_STATE_LABELS: Record<BedState, string> = { ready: "Bo'sh", cleaning: "Tozalanmoqda", maintenance: "Ta'mirda" };
/** What a bed shows on the board: its own state, or "occupied" from an admission. */
export type BedDisplay = BedState | "occupied";
export const BED_DISPLAY_LABELS: Record<BedDisplay, string> = { ...BED_STATE_LABELS, occupied: "Band" };

export const WARD_NAME_TAKEN = "Bu bo'limda shu nomli palata bor";
export const WARD_HAS_BEDS = "Palatada yotoqlar bor — avval ularni o'chiring yoki palatani faolsizlantiring";
export const WARD_DEPARTMENT = "Palata faqat faol statsionar bo'limga qo'shiladi (Klinika → Bo'limlar)";
export const BED_LABEL_TAKEN = "Bu palatada shu raqamli yotoq bor";
export const BED_MAINTENANCE_NOTE = "Yotoq nega ishlatilmasligini yozing";
export const MAX_BEDS_PER_WARD = 40;
export const DEPARTMENT_HAS_WARDS = "Bo'limda palatalar bor — bo'limni o'chirish o'rniga yopib qo'ying (faolsizlantiring)";

/** Name comparison: case and spacing do not make a different ward or bed. */
export const labelKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("uz");

/**
 * The next `count` bed numbers after those a ward has: "1".."n" continue from
 * the largest number already used; letters and odd labels are left alone.
 */
export function nextBedLabels(existing: readonly string[], count: number): string[] {
  const taken = new Set(existing.map(labelKey));
  let n = existing.reduce((max, l) => (/^\d+$/.test(l.trim()) ? Math.max(max, Number(l.trim())) : max), 0);
  const out: string[] = [];
  while (out.length < count) {
    n++;
    if (!taken.has(String(n))) out.push(String(n));
  }
  return out;
}

export type BedCounts = { total: number; free: number; occupied: number; cleaning: number; maintenance: number };

/** The board's figures over active beds; a bed counts once, by what it shows. */
export function countBeds(beds: readonly { isActive: boolean; display: BedDisplay }[]): BedCounts {
  const c: BedCounts = { total: 0, free: 0, occupied: 0, cleaning: 0, maintenance: 0 };
  for (const b of beds) {
    if (!b.isActive) continue;
    c.total++;
    if (b.display === "ready") c.free++;
    else c[b.display]++;
  }
  return c;
}

/** Occupancy in whole percent of beds that can be used (out-of-service beds left out); null without any. */
export function occupancy(c: BedCounts): number | null {
  const usable = c.total - c.maintenance;
  return usable > 0 ? Math.round((c.occupied / usable) * 100) : null;
}

const natural = (a: string, b: string) => a.localeCompare(b, "uz", { numeric: true, sensitivity: "base" });

/** Department, then floor, then ward name in natural order ("2" before "10"). */
export function sortWards<T extends { departmentName: string; floor: number | null; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => natural(a.departmentName, b.departmentName) || (a.floor ?? 0) - (b.floor ?? 0) || natural(a.name, b.name));
}

/** Beds in natural label order. */
export function sortBeds<T extends { label: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => natural(a.label, b.label));
}

// ---------------------------------------------------------------- B6.2 admissions

/**
 * Yotqizish (B6.2, TZ §8.1.2, §10 "admissions"): a patient's stay — who took
 * them in, when, and the beds they lay in. Each bed is a period of its own
 * (`admission_beds`, from → to), so a move between wards keeps both, and the
 * bed-days are billed at each ward's own price (B6.6). One active stay per
 * patient, one patient per bed, both guarded by the database too.
 */
export const ADMISSION_STATUSES = ["active", "discharged", "cancelled"] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];
export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = { active: "Statsionarda", discharged: "Chiqarilgan", cancelled: "Bekor qilingan" };

export const PATIENT_ALREADY_ADMITTED = "Bemor allaqachon statsionarda — avval chiqaring yoki boshqa yotoqqa ko'chiring";
export const BED_OCCUPIED = "Yotoqda bemor bor";
export const BED_HAS_HISTORY = "Bu yotoqda bemor yotgan — o'chirib bo'lmaydi, faolsizlantiring";
export const WARD_OCCUPIED = "Palatada bemor bor — avval ularni ko'chiring yoki chiqaring";
export const ADMISSION_NOT_ACTIVE = "Yotqizish faol emas (chiqarilgan yoki bekor qilingan)";
export const ADMISSION_SAME_BED = "Bemor shu yotoqda yotibdi";
export const ADMISSION_IN_FUTURE = "Yotqizish vaqti kelajakda bo'lishi mumkin emas";
export const ADMISSION_DOCTOR = "Qabul qiluvchi shifokorni tanlang (faol shifokor)";
export const VACATED_NOTE = "Bemor chiqqandan keyin";

/** Why a bed cannot take a patient now, or null. */
export function bedFreeProblem(bed: { isActive: boolean; state: BedState } | undefined, wardActive: boolean, occupied: boolean): string | null {
  if (!bed) return "Yotoq topilmadi";
  if (!bed.isActive || !wardActive) return "Yotoq yoki palata faol emas";
  if (occupied) return BED_OCCUPIED;
  if (bed.state !== "ready") return `Yotoq ${BED_STATE_LABELS[bed.state].toLowerCase()} — avval uni bo'sh deb belgilang`;
  return null;
}

/** The day of the stay ("3-kun"): the admission day is day 1 (YYYY-MM-DD, calendar arithmetic). */
export function stayDay(admittedDay: string, today: string): number {
  return Math.max(1, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${admittedDay}T12:00:00Z`)) / 86_400_000) + 1);
}

// ---------------------------------------------------------------- B6.3 home page

export const DISCHARGE_PLAN_BEFORE_ADMISSION = "Chiqarish sanasi yotqizilgan kundan oldin bo'lishi mumkin emas";

/** Where a planned discharge stands against today. */
export type DischargeDue = "overdue" | "today" | "tomorrow" | "later";
export function dischargeDue(planned: string, today: string): DischargeDue {
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const t = tomorrow.toISOString().slice(0, 10);
  return planned < today ? "overdue" : planned === today ? "today" : planned === t ? "tomorrow" : "later";
}
export const DISCHARGE_DUE_LABELS: Record<DischargeDue, string> = { overdue: "Muddati o'tgan", today: "Bugun", tomorrow: "Ertaga", later: "Keyinroq" };

type OverviewBed = { id: string; label: string; isActive: boolean; display: BedDisplay; stateNote: string | null; stateChangedAt: string | null };
type OverviewWard = { id: string; name: string; departmentId: string; departmentName: string; isActive: boolean; beds: OverviewBed[] };
type OverviewStay = { id: string; admittedAt: string; plannedDischargeOn: string | null; departmentId: string };

export type InpatientOverview<S> = {
  today: string;
  counts: BedCounts;
  occupancy: number | null;
  /** Patients in hospital now. */
  patients: number;
  byDepartment: { id: string; name: string; counts: BedCounts; occupancy: number | null; patients: number }[];
  /** Admitted today (the server's day), newest first. */
  admittedToday: S[];
  /** Planned to leave by tomorrow (overdue first). */
  discharging: (S & { due: DischargeDue })[];
  dischargedToday: number;
  /** Beds not usable now: being cleaned or out of service. */
  attention: { wardId: string; wardName: string; bedId: string; label: string; display: BedDisplay; note: string | null; since: string | null }[];
};

/** The home page's figures from the wards board and the active stays (TZ §8.1.1). */
export function buildInpatientOverview<S extends OverviewStay>(wards: readonly OverviewWard[], active: readonly S[], dischargedToday: number, today: string, dayOf: (iso: string) => string): InpatientOverview<S> {
  const live = wards.filter((w) => w.isActive);
  const counts = countBeds(live.flatMap((w) => w.beds));
  const depts = new Map<string, { id: string; name: string; beds: OverviewBed[] }>();
  for (const w of live) {
    const d = depts.get(w.departmentId) ?? { id: w.departmentId, name: w.departmentName, beds: [] };
    d.beds.push(...w.beds);
    depts.set(w.departmentId, d);
  }
  const order: Record<DischargeDue, number> = { overdue: 0, today: 1, tomorrow: 2, later: 3 };
  return {
    today,
    counts,
    occupancy: occupancy(counts),
    patients: active.length,
    byDepartment: [...depts.values()]
      .map((d) => {
        const c = countBeds(d.beds);
        return { id: d.id, name: d.name, counts: c, occupancy: occupancy(c), patients: active.filter((a) => a.departmentId === d.id).length };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "uz")),
    admittedToday: active.filter((a) => dayOf(a.admittedAt) === today).sort((a, b) => b.admittedAt.localeCompare(a.admittedAt)),
    discharging: active
      .filter((a) => a.plannedDischargeOn)
      .map((a) => ({ ...a, due: dischargeDue(a.plannedDischargeOn!, today) }))
      .filter((a) => a.due !== "later")
      .sort((a, b) => order[a.due] - order[b.due] || a.plannedDischargeOn!.localeCompare(b.plannedDischargeOn!)),
    dischargedToday,
    attention: live.flatMap((w) =>
      w.beds
        .filter((b) => b.isActive && (b.display === "cleaning" || b.display === "maintenance"))
        .map((b) => ({ wardId: w.id, wardName: w.name, bedId: b.id, label: b.label, display: b.display, note: b.stateNote, since: b.stateChangedAt })),
    ),
  };
}
