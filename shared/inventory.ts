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

// ------------------------------------------------------------ receipts (B5.2)

/**
 * Types whose batches are tracked by LOT and expiry: what a recall, an expiry
 * warning (B5.4) or a QC record (B4.8) has to be able to name.
 */
export const LOT_TRACKED: readonly InventoryKind[] = ["reagent", "calibrator", "control", "medicine"];
export const isLotTracked = (kind: InventoryKind) => LOT_TRACKED.includes(kind);

export const MAX_RECEIPT_LINES = 100;

/** A line's money, in whole so'm: quantity may be fractional (ml, l). */
export const lineTotal = (quantity: number, price: number) => Math.round(quantity * price);

type LineItem = { name: string; kind: InventoryKind; isActive: boolean };
type ReceiptLine = { lotNumber?: string | null; expiresOn?: string | null; quantity: number };

/**
 * Why a receipt line cannot be accepted, in Uzbek, or null. `today` and
 * `expiresOn` are calendar days (YYYY-MM-DD).
 */
export function receiptLineProblem(item: LineItem | undefined, line: ReceiptLine, today: string): string | null {
  if (!item) return "Mahsulot topilmadi";
  if (!item.isActive) return `"${item.name}" faolsizlantirilgan — avval katalogda faollashtiring`;
  if (!(line.quantity > 0)) return `"${item.name}": miqdor musbat bo'lishi kerak`;
  if (isLotTracked(item.kind)) {
    if (!line.lotNumber) return `"${item.name}": LOT raqamini kiriting`;
    if (!line.expiresOn) return `"${item.name}": yaroqlilik muddatini kiriting`;
  }
  if (line.expiresOn && line.expiresOn < today) return `"${item.name}": yaroqlilik muddati o'tgan (${line.expiresOn}) — qabul qilinmaydi`;
  return null;
}

/** The same item and LOT twice on one receipt is a typing slip, not two batches. */
export function duplicateLine(lines: { itemId: string; lotNumber?: string | null }[]): number | null {
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const key = `${lines[i].itemId}|${inventoryKey(lines[i].lotNumber ?? "")}`;
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return null;
}

export const MOVEMENT_KINDS = ["receipt", "receipt_cancel"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  receipt: "Kirim",
  receipt_cancel: "Kirim bekor qilindi",
};

export const ITEM_HAS_STOCK_HISTORY = "Bu mahsulot bo'yicha kirim yoki chiqim bor, shuning uchun o'chirilmaydi. Uni faolsizlantiring.";
export const RECEIPT_ALREADY_CANCELLED = "Bu kirim allaqachon bekor qilingan";
export const RECEIPT_IN_USE = "Bu kirimdagi mahsulotdan foydalanilgan, shuning uchun bekor qilib bo'lmaydi. Ortiqchasini chiqim yoki inventarizatsiya orqali tuzating.";
