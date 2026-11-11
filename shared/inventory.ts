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

export const MOVEMENT_KINDS = ["receipt", "receipt_cancel", "issue", "writeoff", "issue_cancel", "count"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  receipt: "Kirim",
  receipt_cancel: "Kirim bekor qilindi",
  issue: "Bo'limga berildi",
  writeoff: "Hisobdan chiqarildi",
  issue_cancel: "Chiqim bekor qilindi",
  count: "Inventarizatsiya tuzatishi",
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

// ------------------------------------------------------------- counts (B5.5)

/**
 * Inventarizatsiya (TZ §7.1): the shelf is counted batch by batch and the
 * difference between what the ledger says and what is really there is
 * posted as a correcting movement.
 *
 * A count opens over the live batches of the chosen types. Each line keeps
 * `expected` — the ledger's remaining at the moment that line was counted —
 * so issues made while the count is open are never mistaken for a shortage:
 * posting moves each batch by (counted − expected), the difference found when
 * it was counted, and what moved since then stays as it is. One count is open
 * at a time; a posted count is final (a later count corrects it).
 */
export const COUNT_STATUSES = ["open", "posted", "cancelled"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];
export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  open: "Sanoq davom etmoqda",
  posted: "Tasdiqlangan",
  cancelled: "Bekor qilingan",
};

export const MAX_COUNT_ENTRIES = 500;

export const COUNT_ALREADY_OPEN = "Ochiq inventarizatsiya bor — avval uni tasdiqlang yoki bekor qiling";
export const COUNT_NOT_OPEN = "Bu inventarizatsiya yopilgan: tasdiqlangan yoki bekor qilingan";
export const COUNT_POSTED_FINAL = "Tasdiqlangan inventarizatsiya bekor qilinmaydi — farqni yangi inventarizatsiya bilan tuzating";
export const COUNT_NOTHING = "Tanlangan turlarda qoldig'i bor partiya yo'q — sanaladigan narsa yo'q";
export const COUNT_LINE_MISSING = "Sanoq qatori topilmadi — sahifani yangilang";
export const COUNTED_AFTER_DOCUMENT =
  "Bu hujjatdan keyin uning partiyalari inventarizatsiyada sanalgan, shuning uchun bekor qilib bo'lmaydi. Farqni yangi hujjat yoki inventarizatsiya bilan tuzating.";

type CountItem = { name: string; unit: string };
type CountBatch = { quantity: number; cancelledAt?: string | null; lotNumber?: string | null };

const lotLabel = (lot: string | null | undefined) => (lot ? `LOT ${lot}` : "LOT yo'q");

/**
 * Why a counted quantity cannot be recorded, or null. A batch cannot hold
 * more than arrived with it: goods found beyond that are a receipt nobody
 * recorded, and are taken in with a receipt document, not by a count.
 */
export function countedProblem(counted: number, batch: CountBatch, item: CountItem): string | null {
  if (!Number.isFinite(counted) || counted < 0) return `"${item.name}": sanalgan miqdor manfiy bo'lmasligi kerak`;
  if (batch.cancelledAt) return `"${item.name}" (${lotLabel(batch.lotNumber)}): partiya bekor qilingan — sanalmaydi`;
  if (counted > batch.quantity + QTY_EPSILON) {
    return `"${item.name}" (${lotLabel(batch.lotNumber)}): sanalgan ${fmtQty(counted)} ${item.unit} partiyaga kelgan ${fmtQty(batch.quantity)} ${item.unit} dan ko'p — ortiqcha mahsulotni kirim hujjati bilan qabul qiling`;
  }
  return null;
}

/** counted − expected, with fractional noise (ml, g) treated as no difference. */
export function countDelta(line: { expected: number; counted: number | null }): number {
  if (line.counted === null) return 0;
  const d = line.counted - line.expected;
  return Math.abs(d) <= QTY_EPSILON ? 0 : Number(d.toFixed(6));
}

type SummaryLine = { expected: number; counted: number | null; purchasePrice: number; batchCancelled?: boolean };
export type CountSummary = {
  lines: number;
  counted: number;
  /** Lines still waiting for a number (cancelled batches are not waited for). */
  uncounted: number;
  matched: number;
  shortage: { lines: number; value: number };
  surplus: { lines: number; value: number };
};

/** Progress and the money of the differences, at purchase prices. Server and form share it. */
export function summarizeCount(lines: SummaryLine[]): CountSummary {
  const s: CountSummary = { lines: lines.length, counted: 0, uncounted: 0, matched: 0, shortage: { lines: 0, value: 0 }, surplus: { lines: 0, value: 0 } };
  for (const l of lines) {
    // A batch cancelled while the count was open has nothing left to count or post.
    if (l.batchCancelled) continue;
    if (l.counted === null) {
      s.uncounted += 1;
      continue;
    }
    s.counted += 1;
    const d = countDelta(l);
    if (d === 0) s.matched += 1;
    else if (d < 0) {
      s.shortage.lines += 1;
      s.shortage.value += lineTotal(-d, l.purchasePrice);
    } else {
      s.surplus.lines += 1;
      s.surplus.value += lineTotal(d, l.purchasePrice);
    }
  }
  return s;
}

type PostLine = { id: string; batchId: string; expected: number; counted: number | null; itemName: string; unit: string };
type PostBatch = { id: string; remaining: number; quantity: number; cancelledAt: string | null; lotNumber: string | null };
export type CountAdjustment = { lineId: string; batchId: string; delta: number; next: number };

/**
 * What posting a count does to each batch: `remaining + (counted − expected)`.
 * Every line must be counted first (a cancelled batch is skipped), and the
 * result must stay between nothing and what arrived — if stock left a batch
 * after it was counted and the count found less, the shelf and the ledger
 * disagree again and that line has to be counted anew.
 */
export function planCountPost(lines: PostLine[], batches: Map<string, PostBatch>): { ok: true; adjustments: CountAdjustment[] } | { ok: false; message: string } {
  const live = lines.filter((l) => {
    const b = batches.get(l.batchId);
    return b && !b.cancelledAt;
  });
  const waiting = live.filter((l) => l.counted === null).length;
  if (waiting > 0) return { ok: false, message: `${waiting} ta partiya hali sanalmagan — hammasini sanab, keyin tasdiqlang` };
  const adjustments: CountAdjustment[] = [];
  for (const l of live) {
    const d = countDelta(l);
    if (d === 0) continue;
    const b = batches.get(l.batchId)!;
    const next = b.remaining + d;
    const where = `"${l.itemName}" (${lotLabel(b.lotNumber)})`;
    if (next < -QTY_EPSILON) {
      return {
        ok: false,
        message: `${where}: sanoqdan keyin partiyadan chiqim bo'lgan, hisobda ${fmtQty(b.remaining)} ${l.unit} qoldi — ${fmtQty(-d)} ${l.unit} kamomadni qo'llab bo'lmaydi. Shu partiyani qayta sanang.`,
      };
    }
    if (next > b.quantity + QTY_EPSILON) {
      return {
        ok: false,
        message: `${where}: sanoqdan keyin partiyaga qaytarilgan, ${fmtQty(d)} ${l.unit} ortiqcha bilan kelgan miqdordan oshadi. Shu partiyani qayta sanang.`,
      };
    }
    adjustments.push({ lineId: l.id, batchId: l.batchId, delta: d, next: Math.abs(next) <= QTY_EPSILON ? 0 : Math.min(next, b.quantity) });
  }
  return { ok: true, adjustments };
}

/** "Hammasi" or the chosen TZ §7.2 types, for lists and the act. */
export const countScopeLabel = (kinds: readonly InventoryKind[] | null) =>
  !kinds || kinds.length === 0 || kinds.length === INVENTORY_KINDS.length ? "Butun ombor" : kinds.map((k) => INVENTORY_KIND_LABELS[k]).join(", ");
