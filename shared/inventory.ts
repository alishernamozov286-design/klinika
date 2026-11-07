/**
 * Ombor (Bosqich 5, TZ §7). This file holds what every step shares: the
 * product types of TZ §7.2, units, and the naming rules.
 *
 * B5.1 is the catalogue. Stock itself (batches with LOT and expiry, receipts,
 * issues to departments, counts) arrives in B5.2–B5.5 and hangs off these
 * items, so an item that has ever moved will not be deletable then.
 */

/** TZ §7.2, in the order the TZ lists them. */
export const INVENTORY_KINDS = [
  "reagent",
  "calibrator",
  "control",
  "tube",
  "syringe",
  "consumable",
  "medicine",
  "disinfectant",
] as const;
export type InventoryKind = (typeof INVENTORY_KINDS)[number];

export const INVENTORY_KIND_LABELS: Record<InventoryKind, string> = {
  reagent: "Laboratoriya reagentlari",
  calibrator: "Kalibratorlar",
  control: "Nazorat materiallari",
  tube: "Probirkalar",
  syringe: "Shpritslar",
  consumable: "Tibbiy sarf materiallari",
  medicine: "Dori vositalari",
  disinfectant: "Dezinfeksiya vositalari",
};

/** Singular, for a badge on one row. */
export const INVENTORY_KIND_SHORT: Record<InventoryKind, string> = {
  reagent: "Reagent",
  calibrator: "Kalibrator",
  control: "Nazorat materiali",
  tube: "Probirka",
  syringe: "Shprits",
  consumable: "Sarf materiali",
  medicine: "Dori vositasi",
  disinfectant: "Dezinfeksiya",
};

/**
 * Units offered in the form. The field accepts any short unit, since a
 * clinic's stock is counted in whatever it is bought in; these cover most.
 */
export const UNIT_SUGGESTIONS = [
  "dona",
  "quti",
  "to'plam",
  "flakon",
  "ampula",
  "kartrij",
  "test",
  "ml",
  "l",
  "g",
  "kg",
  "juft",
  "rulon",
  "tabletka",
] as const;

/** A sensible default unit per type, only as the form's first suggestion. */
export const DEFAULT_UNIT: Record<InventoryKind, string> = {
  reagent: "to'plam",
  calibrator: "flakon",
  control: "flakon",
  tube: "dona",
  syringe: "dona",
  consumable: "dona",
  medicine: "dona",
  disinfectant: "l",
};

/** Names and codes are compared without case or extra spaces. */
export const inventoryKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export const INVENTORY_NAME_TAKEN = "Bunday nomli mahsulot allaqachon bor";
export const INVENTORY_CODE_TAKEN = "Bu artikul boshqa mahsulotga berilgan";
