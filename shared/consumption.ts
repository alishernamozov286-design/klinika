/**
 * Reagent sarfi (B5.6, TZ §7.3, §11 Laboratoriya → Ombor).
 *
 * "Laboratoriya buyurtmasi bajarilganda reagent sarfi avtomatik hisoblanadi,
 * lekin faqat tasdiqlangan sarf normasi va real ishlatilgan miqdorga
 * asoslanadi."
 *
 *   - A norm says how much of a warehouse item one test uses. It is proposed
 *     (draft) and takes effect only once the lab head approves it. A changed
 *     norm is a new proposal; the approved one stays in force until the new
 *     one is approved, and every norm keeps its history.
 *   - When a result line is verified (B4.5) the test counts as done: each norm
 *     in force at that moment is consumed once (one row per line and item),
 *     FEFO from usable batches. A result is never held back by the warehouse:
 *     what the shelf cannot cover is recorded as a shortage for the
 *     storekeeper, and settled when stock arrives.
 *   - What really happened beyond the norm (a repeat run, a calibration, a
 *     spill) is recorded by hand with a reason.
 *
 * Both storages and the screens use these rules.
 */
import { INVENTORY_KIND_LABELS, QTY_EPSILON, allocateFefo, fmtQty, lineTotal, type Allocation, type AllocatableBatch, type InventoryKind } from "./inventory";

export const NORM_STATUSES = ["draft", "approved", "retired"] as const;
export type NormStatus = (typeof NORM_STATUSES)[number];
export const NORM_STATUS_LABELS: Record<NormStatus, string> = {
  draft: "Tasdiqlash kutilmoqda",
  approved: "Amalda",
  retired: "Bekor qilingan",
};

export const CONSUMPTION_KINDS = ["norm", "extra"] as const;
export type ConsumptionKind = (typeof CONSUMPTION_KINDS)[number];
export const CONSUMPTION_KIND_LABELS: Record<ConsumptionKind, string> = {
  norm: "Norma bo'yicha",
  extra: "Qo'shimcha sarf",
};

/** Why more was used than the norm: the "real ishlatilgan miqdor" of TZ §7.3. */
export const EXTRA_REASONS = ["repeat", "calibration", "qc", "spoiled", "other"] as const;
export type ExtraReason = (typeof EXTRA_REASONS)[number];
export const EXTRA_REASON_LABELS: Record<ExtraReason, string> = {
  repeat: "Takroriy o'lchov",
  calibration: "Kalibratsiya",
  qc: "Sifat nazorati",
  spoiled: "To'kilgan / yaroqsiz bo'lgan",
  other: "Boshqa sabab",
};

/** Item types a lab test can draw on. */
export const CONSUMABLE_KINDS: readonly InventoryKind[] = ["reagent", "calibrator", "control", "tube", "syringe", "consumable", "disinfectant"];
export const consumableKindLabel = (k: InventoryKind) => INVENTORY_KIND_LABELS[k];

export const MAX_NORM_QUANTITY = 10_000;
/** One reconcile run handles this many verified lines; the next run takes the rest. */
export const MAX_CONSUME_BATCH = 500;

export const NORM_DRAFT_EXISTS = "Bu tahlil va mahsulot uchun tasdiqlanmagan norma allaqachon bor — o'shani tahrirlang";
export const NORM_NOT_DRAFT = "Faqat tasdiqlanmagan normani o'zgartirish yoki tasdiqlash mumkin";
export const NORM_ALREADY_RETIRED = "Bu norma allaqachon bekor qilingan";
export const CONSUMPTION_ALREADY_CANCELLED = "Bu sarf allaqachon bekor qilingan";
export const NORM_CONSUMPTION_FINAL =
  "Norma bo'yicha sarf bekor qilinmaydi: tahlil bajarilgan. Tokcha bilan farq bo'lsa, inventarizatsiya tuzatadi.";

/**
 * Was this norm in force at `at`? Approved by then and not yet replaced or
 * withdrawn. Timestamps are ISO strings of one clock, so they compare as text.
 */
export function normInForce(n: { approvedAt: string | null; retiredAt: string | null }, at: string): boolean {
  return !!n.approvedAt && n.approvedAt <= at && (!n.retiredAt || n.retiredAt > at);
}

export type ConsumptionPlanLine = { key: string; itemId: string; quantity: number };
export type ConsumptionPlan = { key: string; allocations: Allocation[]; posted: number; short: number };
type PlanBatch = AllocatableBatch & { itemId: string };

/**
 * Takes each line from what the shelf has — FEFO, never an expired batch —
 * on one working copy, so two lines of the same item never count the same
 * stock twice. Unlike an issue, a shortfall does not refuse: the test was
 * already done, so the rest is recorded as a shortage.
 */
export function planConsumptions(lines: ConsumptionPlanLine[], batches: PlanBatch[], today: string): ConsumptionPlan[] {
  const left = new Map(batches.map((b) => [b.id, b.remaining]));
  return lines.map((l) => {
    const own = batches.filter((b) => b.itemId === l.itemId).map((b) => ({ ...b, remaining: left.get(b.id) ?? 0 }));
    let r = allocateFefo(own, l.quantity, today);
    if (!r.ok) r = r.available > QTY_EPSILON ? allocateFefo(own, r.available, today) : { ok: true, allocations: [] };
    const allocations = r.ok ? r.allocations : [];
    for (const a of allocations) left.set(a.batchId, (left.get(a.batchId) ?? 0) - a.quantity);
    const posted = Number(allocations.reduce((s, a) => s + a.quantity, 0).toFixed(6));
    return { key: l.key, allocations, posted, short: shortOf({ quantity: l.quantity, posted }) };
  });
}

/** What the shelf could not cover, with fractional noise ignored. */
export function shortOf(e: { quantity: number; posted: number }): number {
  const s = e.quantity - e.posted;
  return s > QTY_EPSILON ? Number(s.toFixed(6)) : 0;
}

/** "Glyukoza reagenti 0.02 to'plam; Probirka 1 dona" — for the audit log. */
export function describeConsumption(entries: { itemName: string; unit: string; quantity: number; posted: number }[]): string {
  const byItem = new Map<string, { unit: string; q: number; short: number }>();
  for (const e of entries) {
    const x = byItem.get(e.itemName) ?? { unit: e.unit, q: 0, short: 0 };
    x.q += e.quantity;
    x.short += shortOf(e);
    byItem.set(e.itemName, x);
  }
  return Array.from(byItem.entries())
    .map(([name, x]) => `${name} ${fmtQty(x.q)} ${x.unit}${x.short > 0 ? ` (${fmtQty(x.short)} yetishmadi)` : ""}`)
    .join("; ");
}

// ------------------------------------------------------------------ report

type ReportEntry = {
  kind: ConsumptionKind;
  itemId: string;
  itemName: string;
  unit: string;
  testId: string | null;
  testName: string | null;
  orderTestId: string | null;
  quantity: number;
  posted: number;
  value: number;
  cancelledAt: string | null;
};

export type ConsumptionItemRow = { itemId: string; itemName: string; unit: string; norm: number; extra: number; total: number; short: number; value: number };
export type ConsumptionTestRow = { testId: string; testName: string; performed: number; value: number };
export type ConsumptionReport = {
  /** At purchase prices of the batches the stock was taken from, so'm. */
  value: number;
  /** Distinct result lines that consumed by norm. */
  performed: number;
  extraEntries: number;
  shortEntries: number;
  byItem: ConsumptionItemRow[];
  byTest: ConsumptionTestRow[];
};

/** TZ §13 "reagent sarfi": per item and per test, norm and extra apart. Cancelled entries do not count. */
export function summarizeConsumption(entries: ReportEntry[]): ConsumptionReport {
  const items = new Map<string, ConsumptionItemRow>();
  const tests = new Map<string, ConsumptionTestRow & { lines: Set<string> }>();
  const performed = new Set<string>();
  const out: ConsumptionReport = { value: 0, performed: 0, extraEntries: 0, shortEntries: 0, byItem: [], byTest: [] };
  for (const e of entries) {
    if (e.cancelledAt) continue;
    out.value += e.value;
    if (shortOf(e) > 0) out.shortEntries += 1;
    if (e.kind === "extra") out.extraEntries += 1;
    const it = items.get(e.itemId) ?? { itemId: e.itemId, itemName: e.itemName, unit: e.unit, norm: 0, extra: 0, total: 0, short: 0, value: 0 };
    if (e.kind === "norm") it.norm += e.quantity;
    else it.extra += e.quantity;
    it.total += e.quantity;
    it.short += shortOf(e);
    it.value += e.value;
    items.set(e.itemId, it);
    if (e.testId) {
      const t = tests.get(e.testId) ?? { testId: e.testId, testName: e.testName ?? "—", performed: 0, value: 0, lines: new Set<string>() };
      t.value += e.value;
      if (e.kind === "norm" && e.orderTestId) {
        t.lines.add(e.orderTestId);
        performed.add(e.orderTestId);
      }
      tests.set(e.testId, t);
    }
  }
  const tidy = (n: number) => Number(n.toFixed(6));
  out.performed = performed.size;
  out.byItem = Array.from(items.values())
    .map((r) => ({ ...r, norm: tidy(r.norm), extra: tidy(r.extra), total: tidy(r.total), short: tidy(r.short) }))
    .sort((a, b) => b.value - a.value || a.itemName.localeCompare(b.itemName));
  out.byTest = Array.from(tests.values())
    .map(({ lines, ...t }) => ({ ...t, performed: lines.size }))
    .sort((a, b) => b.value - a.value || a.testName.localeCompare(b.testName));
  return out;
}

/** Money of one consumption's movements: out is positive, a cancellation brings it back. */
export const movementValue = (quantity: number, price: number) => (quantity < 0 ? 1 : -1) * lineTotal(Math.abs(quantity), price);
