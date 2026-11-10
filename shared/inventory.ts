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

export const MOVEMENT_KINDS = ["receipt", "receipt_cancel", "issue", "writeoff", "issue_cancel"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  receipt: "Kirim",
  receipt_cancel: "Kirim bekor qilindi",
  issue: "Bo'limga berildi",
  writeoff: "Hisobdan chiqarildi",
  issue_cancel: "Chiqim bekor qilindi",
};

export const ITEM_HAS_STOCK_HISTORY = "Bu mahsulot bo'yicha kirim yoki chiqim bor, shuning uchun o'chirilmaydi. Uni faolsizlantiring.";
export const RECEIPT_ALREADY_CANCELLED = "Bu kirim allaqachon bekor qilingan";
export const RECEIPT_IN_USE = "Bu kirimdagi mahsulotdan foydalanilgan, shuning uchun bekor qilib bo'lmaydi. Ortiqchasini chiqim yoki inventarizatsiya orqali tuzating.";

// -------------------------------------------------------------- issues (B5.3)

/** TZ §7.1 "Chiqim" and "Bo'limlarga berish": where the stock went. */
export const ISSUE_KINDS = ["department", "writeoff"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];
export const ISSUE_KIND_LABELS: Record<IssueKind, string> = {
  department: "Bo'limga berish",
  writeoff: "Hisobdan chiqarish",
};

export const WRITEOFF_REASONS = ["expired", "damaged", "other"] as const;
export type WriteoffReason = (typeof WRITEOFF_REASONS)[number];
export const WRITEOFF_REASON_LABELS: Record<WriteoffReason, string> = {
  expired: "Muddati o'tgan",
  damaged: "Shikastlangan / yaroqsiz",
  other: "Boshqa sabab",
};

export const MAX_ISSUE_LINES = 100;

export type AllocatableBatch = {
  id: string;
  remaining: number;
  expiresOn: string | null;
  createdAt: string;
  cancelledAt?: string | null;
};
export type Allocation = { batchId: string; quantity: number };

/** Tolerance for fractional stock (ml, g): anything below this is "nothing left". */
export const QTY_EPSILON = 1e-9;

/**
 * FEFO: first expiry, first out (TZ: "muddati yaqinini birinchi"). Batches
 * with an expiry go before those without; among equals the older receipt
 * goes first. Expired batches are never given to a department — they can
 * only be written off — so they are skipped unless `allowExpired`.
 *
 * Returns the split across batches, or how much is available when the
 * quantity cannot be covered.
 */
export function allocateFefo(
  batches: AllocatableBatch[],
  quantity: number,
  today: string,
  opts: { allowExpired?: boolean } = {},
): { ok: true; allocations: Allocation[] } | { ok: false; available: number } {
  const usable = batches
    .filter((b) => !b.cancelledAt && b.remaining > QTY_EPSILON && (opts.allowExpired || !b.expiresOn || b.expiresOn >= today))
    .sort((a, b) => {
      if (a.expiresOn && b.expiresOn && a.expiresOn !== b.expiresOn) return a.expiresOn < b.expiresOn ? -1 : 1;
      if (a.expiresOn && !b.expiresOn) return -1;
      if (!a.expiresOn && b.expiresOn) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  const available = usable.reduce((s, b) => s + b.remaining, 0);
  if (available + QTY_EPSILON < quantity) return { ok: false, available };
  const allocations: Allocation[] = [];
  let left = quantity;
  for (const b of usable) {
    if (left <= QTY_EPSILON) break;
    const take = Math.min(b.remaining, left);
    allocations.push({ batchId: b.id, quantity: take });
    left -= take;
  }
  return { ok: true, allocations };
}

/** The same item twice on one issue (without a pinned batch) is a slip. */
export function duplicateIssueLine(lines: { itemId: string; batchId?: string | null }[]): number | null {
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const key = `${lines[i].itemId}|${lines[i].batchId ?? ""}`;
    if (seen.has(key)) return i;
    seen.add(key);
  }
  return null;
}

/** "Glyukoza reagenti: omborda 2 to'plam bor, 3 so'ralgan". */
export const shortageMessage = (name: string, unit: string, available: number, requested: number, expiredOnly = false) =>
  `"${name}": ${expiredOnly ? "muddati o'tmagan " : ""}qoldiq ${fmtQty(available)} ${unit}, so'ralgan ${fmtQty(requested)} ${unit}`;

export const fmtQty = (n: number) => String(Number(n.toFixed(3)));

export const ISSUE_ALREADY_CANCELLED = "Bu chiqim allaqachon bekor qilingan";
export const ISSUE_BATCH_GONE = "Partiya topilmadi yoki bekor qilingan";

type PlanItem = { id: string; name: string; unit: string };
type PlanLine = { itemId: string; quantity: number; batchId?: string | null };
type PlanBatch = AllocatableBatch & { itemId: string };

/**
 * Splits every line of an issue across batches in one pass, on a working copy
 * of `remaining`, so two lines of the same item never count the same stock
 * twice. A pinned batch must be the line's item and still live; a department
 * never gets an expired batch, a write-off may take one. Both storages call
 * this with the batches they have locked.
 */
export function planIssue(
  kind: IssueKind,
  lines: PlanLine[],
  batches: PlanBatch[],
  items: Map<string, PlanItem>,
  today: string,
): { ok: true; allocations: (Allocation & { itemId: string })[] } | { ok: false; message: string } {
  const left = new Map(batches.map((b) => [b.id, b.remaining]));
  const allowExpired = kind === "writeoff";
  const out: (Allocation & { itemId: string })[] = [];
  // Pinned lines first: they leave FEFO to work with what is left.
  const order = lines.map((l, i) => ({ l, i })).sort((a, b) => Number(!a.l.batchId) - Number(!b.l.batchId));
  for (const { l, i } of order) {
    const item = items.get(l.itemId);
    if (!item) return { ok: false, message: `${i + 1}-qator: mahsulot topilmadi` };
    const own = batches.filter((b) => b.itemId === l.itemId).map((b) => ({ ...b, remaining: left.get(b.id) ?? 0 }));
    let pool = own;
    if (l.batchId) {
      pool = own.filter((b) => b.id === l.batchId && !b.cancelledAt);
      if (pool.length === 0) return { ok: false, message: `${i + 1}-qator: ${ISSUE_BATCH_GONE}` };
      if (!allowExpired && pool[0].expiresOn && pool[0].expiresOn < today) {
        return { ok: false, message: `${i + 1}-qator: "${item.name}" bu partiyaning muddati o'tgan — bo'limga berilmaydi, hisobdan chiqaring` };
      }
    }
    const r = allocateFefo(pool, l.quantity, today, { allowExpired });
    if (!r.ok) {
      const expiredStock = !allowExpired && own.some((b) => b.expiresOn && b.expiresOn < today && b.remaining > QTY_EPSILON);
      return { ok: false, message: `${i + 1}-qator: ${shortageMessage(item.name, item.unit, r.available, l.quantity, expiredStock)}` };
    }
    for (const a of r.allocations) {
      left.set(a.batchId, (left.get(a.batchId) ?? 0) - a.quantity);
      out.push({ ...a, itemId: l.itemId });
    }
  }
  return { ok: true, allocations: out };
}

// ------------------------------------------------------- stock & expiry (B5.4)

/**
 * TZ §7.3 "Tizim muddati yaqinlashayotgan mahsulotlar haqida ogohlantiradi".
 * A batch is expired after its expiry day; "soon" within 30 days is the
 * warning, 90 days is the watch list. Expired stock stays on the shelf (and
 * in the count) until it is written off, but it is not usable.
 */
export const EXPIRY_SOON_DAYS = 30;
export const EXPIRY_WATCH_DAYS = 90;

export type ExpiryState = "expired" | "soon" | "watch" | "ok" | "none";
export const EXPIRY_STATE_LABELS: Record<ExpiryState, string> = {
  expired: "Muddati o'tgan",
  soon: `${EXPIRY_SOON_DAYS} kun ichida tugaydi`,
  watch: `${EXPIRY_WATCH_DAYS} kun ichida tugaydi`,
  ok: "Muddati yetarli",
  none: "Muddatsiz",
};

/** Whole days from `today` to `day` (both YYYY-MM-DD); negative when past. */
export function daysLeft(day: string, today: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function expiryState(expiresOn: string | null | undefined, today: string): ExpiryState {
  if (!expiresOn) return "none";
  const d = daysLeft(expiresOn, today);
  if (d < 0) return "expired";
  if (d <= EXPIRY_SOON_DAYS) return "soon";
  if (d <= EXPIRY_WATCH_DAYS) return "watch";
  return "ok";
}

type StockItem = { id: string; name: string; unit: string; kind: InventoryKind; minStock: number; isActive: boolean };
type StockBatch = { id: string; itemId: string; remaining: number; expiresOn: string | null; purchasePrice: number };

export type LowStockItem = { id: string; name: string; unit: string; kind: InventoryKind; usable: number; minStock: number };
export type StockAlerts = {
  date: string;
  /** Value of everything on the shelf at purchase prices, so'm. */
  value: number;
  expired: { batches: number; value: number };
  soon: { batches: number; value: number };
  watch: { batches: number };
  /** Active items with a minimum whose usable (unexpired) stock is at or below it. */
  lowStock: LowStockItem[];
};

/**
 * The warehouse's warnings in one place, computed from live batches. "Kam
 * qolgan" counts only usable stock: an expired box on the shelf does not
 * cover tomorrow's tests.
 */
export function summarizeStock(items: StockItem[], batches: StockBatch[], today: string): StockAlerts {
  const out: StockAlerts = { date: today, value: 0, expired: { batches: 0, value: 0 }, soon: { batches: 0, value: 0 }, watch: { batches: 0 }, lowStock: [] };
  const usable = new Map<string, number>();
  for (const b of batches) {
    if (b.remaining <= QTY_EPSILON) continue;
    const v = lineTotal(b.remaining, b.purchasePrice);
    out.value += v;
    const st = expiryState(b.expiresOn, today);
    if (st === "expired") {
      out.expired.batches += 1;
      out.expired.value += v;
      continue;
    }
    if (st === "soon") {
      out.soon.batches += 1;
      out.soon.value += v;
    } else if (st === "watch") out.watch.batches += 1;
    usable.set(b.itemId, (usable.get(b.itemId) ?? 0) + b.remaining);
  }
  for (const i of items) {
    if (!i.isActive || !(i.minStock > 0)) continue;
    const u = usable.get(i.id) ?? 0;
    if (u <= i.minStock + QTY_EPSILON) out.lowStock.push({ id: i.id, name: i.name, unit: i.unit, kind: i.kind, usable: u, minStock: i.minStock });
  }
  out.lowStock.sort((a, b) => a.usable / a.minStock - b.usable / b.minStock || a.name.localeCompare(b.name));
  return out;
}
