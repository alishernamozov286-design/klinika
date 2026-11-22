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
