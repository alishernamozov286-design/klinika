/**
 * Ombor bosh sahifasi va hisobotlari (B5.7, TZ §7.1).
 *
 * Every figure here comes from the stock ledger (`stock_movements`), at the
 * purchase price of the batch each movement touched, and is placed in time by
 * when the movement was recorded. That is what makes the turnover sheet add
 * up by construction: opening + in − out ± count = closing, and the closing of
 * "today" is exactly what is on the shelf. A cancellation nets against what it
 * cancels in the period it was recorded.
 *
 * Storages only total movements by item and bucket; the shaping is here, the
 * same for both.
 */
import { QTY_EPSILON, lineTotal, type InventoryKind, type IssueKind, type MovementKind } from "./inventory";

/** The turnover sheet's columns: where a movement belongs. */
export const TURNOVER_BUCKETS = ["receipt", "department", "writeoff", "consumption", "count"] as const;
export type TurnoverBucket = (typeof TURNOVER_BUCKETS)[number];
export const TURNOVER_BUCKET_LABELS: Record<TurnoverBucket, string> = {
  receipt: "Kirim",
  department: "Bo'limlarga berildi",
  writeoff: "Hisobdan chiqarildi",
  consumption: "Laboratoriya sarfi",
  count: "Inventarizatsiya farqi",
};
/** Outflows: shown as positive amounts that leave the shelf. */
export const OUT_BUCKETS: readonly TurnoverBucket[] = ["department", "writeoff", "consumption"];

/** Which column a ledger movement falls in; a cancellation goes where its original went. */
export function movementBucket(kind: MovementKind, issueKind?: IssueKind | null): TurnoverBucket {
  switch (kind) {
    case "receipt":
    case "receipt_cancel":
      return "receipt";
    case "issue":
      return "department";
    case "writeoff":
      return "writeoff";
    case "issue_cancel":
      return issueKind === "writeoff" ? "writeoff" : "department";
    case "consumption":
    case "consumption_cancel":
      return "consumption";
    case "count":
      return "count";
  }
}

/** Money of one movement, signed like its quantity, in whole so'm. */
export const signedValue = (quantity: number, price: number) => (quantity < 0 ? -1 : 1) * lineTotal(Math.abs(quantity), price);

/** A storage's total of signed movements for one item and bucket, before the period or in it. */
export type MovementTotal = { itemId: string; bucket: TurnoverBucket; period: "before" | "in"; quantity: number; value: number };

export type Amount = { qty: number; value: number };
export type TurnoverRow = {
  itemId: string;
  itemName: string;
  unit: string;
  kind: InventoryKind;
  opening: Amount;
  receipt: Amount;
  department: Amount;
  writeoff: Amount;
  consumption: Amount;
  /** Signed: a surplus found is positive, a shortage negative. */
  count: Amount;
  closing: Amount;
};
export type TurnoverSheet = {
  rows: TurnoverRow[];
  /** Column sums in so'm (quantities of different units do not add up). */
  totals: Record<"opening" | TurnoverBucket | "closing", number>;
};

const tidy = (n: number) => (Math.abs(n) <= QTY_EPSILON ? 0 : Number(n.toFixed(6)));
const zero = (): Amount => ({ qty: 0, value: 0 });

type SheetItem = { id: string; name: string; unit: string; kind: InventoryKind };

/**
 * Aylanma qaydnoma: per item, what was there at the start, what came in, what
 * went out and where, what the counts corrected, and what is left. Items with
 * nothing at the start and no movement in the period are left out.
 */
export function buildTurnover(items: SheetItem[], totals: MovementTotal[]): TurnoverSheet {
  const byItem = new Map<string, TurnoverRow>();
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const rowOf = (itemId: string) => {
    let r = byItem.get(itemId);
    if (!r) {
      const it = itemOf.get(itemId);
      r = {
        itemId,
        itemName: it?.name ?? "—",
        unit: it?.unit ?? "",
        kind: it?.kind ?? "consumable",
        opening: zero(),
        receipt: zero(),
        department: zero(),
        writeoff: zero(),
        consumption: zero(),
        count: zero(),
        closing: zero(),
      };
      byItem.set(itemId, r);
    }
    return r;
  };
  for (const t of totals) {
    const r = rowOf(t.itemId);
    if (t.period === "before") {
      r.opening.qty += t.quantity;
      r.opening.value += t.value;
      continue;
    }
    // Outflows are recorded negative; the sheet shows them as amounts that left.
    const sign = OUT_BUCKETS.includes(t.bucket) ? -1 : 1;
    r[t.bucket].qty += sign * t.quantity;
    r[t.bucket].value += sign * t.value;
  }
  const sum: TurnoverSheet["totals"] = { opening: 0, receipt: 0, department: 0, writeoff: 0, consumption: 0, count: 0, closing: 0 };
  const rows: TurnoverRow[] = [];
  for (const r of Array.from(byItem.values())) {
    for (const k of ["opening", ...TURNOVER_BUCKETS] as const) r[k] = { qty: tidy(r[k].qty), value: Math.round(r[k].value) };
    r.closing = {
      qty: tidy(r.opening.qty + r.receipt.qty - r.department.qty - r.writeoff.qty - r.consumption.qty + r.count.qty),
      value: r.opening.value + r.receipt.value - r.department.value - r.writeoff.value - r.consumption.value + r.count.value,
    };
    const moved = TURNOVER_BUCKETS.some((k) => r[k].qty !== 0 || r[k].value !== 0);
    if (!moved && r.opening.qty === 0 && r.opening.value === 0) continue;
    rows.push(r);
    for (const k of ["opening", ...TURNOVER_BUCKETS, "closing"] as const) sum[k] += r[k].value;
  }
  rows.sort((a, b) => a.itemName.localeCompare(b.itemName));
  return { rows, totals: sum };
}

/** One day of the overview chart: what came in and what went out, in so'm. */
export type DailyFlow = { date: string; in: number; out: number };

/** Every calendar day from `from` to `to` (YYYY-MM-DD), quiet days as zero. */
export function fillDays(from: string, to: string, rows: DailyFlow[]): DailyFlow[] {
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const out: DailyFlow[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    const day = d.toISOString().slice(0, 10);
    const r = byDay.get(day);
    out.push({ date: day, in: Math.round(r?.in ?? 0), out: Math.round(r?.out ?? 0) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** A storage's issue lines to departments in the period (net of cancellations). */
export type DepartmentLine = {
  departmentId: string;
  departmentName: string;
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
  value: number;
  /** Issue documents this line drew from (not counting cancellations). */
  issueIds: string[];
};
export type DepartmentReport = {
  departmentId: string;
  departmentName: string;
  documents: number;
  value: number;
  items: { itemId: string; itemName: string; unit: string; quantity: number; value: number }[];
};

/** "Bo'limlarga berildi" per department: its total is the turnover column's total. */
export function summarizeDepartments(lines: DepartmentLine[]): DepartmentReport[] {
  const byDept = new Map<string, DepartmentReport & { ids: Set<string> }>();
  for (const l of lines) {
    const d = byDept.get(l.departmentId) ?? { departmentId: l.departmentId, departmentName: l.departmentName, documents: 0, value: 0, items: [], ids: new Set<string>() };
    for (const id of l.issueIds) d.ids.add(id);
    d.value += l.value;
    if (Math.abs(l.quantity) > QTY_EPSILON || l.value !== 0) d.items.push({ itemId: l.itemId, itemName: l.itemName, unit: l.unit, quantity: tidy(l.quantity), value: Math.round(l.value) });
    byDept.set(l.departmentId, d);
  }
  return Array.from(byDept.values())
    .map(({ ids, ...d }) => ({ ...d, documents: ids.size, value: Math.round(d.value), items: d.items.sort((a, b) => b.value - a.value || a.itemName.localeCompare(b.itemName)) }))
    .filter((d) => d.items.length > 0)
    .sort((a, b) => b.value - a.value || a.departmentName.localeCompare(b.departmentName));
}

/** The overview's month figures, from the period part of the totals (outflows positive). */
export function monthFigures(totals: MovementTotal[]): Record<TurnoverBucket, number> {
  const out: Record<TurnoverBucket, number> = { receipt: 0, department: 0, writeoff: 0, consumption: 0, count: 0 };
  for (const t of totals) if (t.period === "in") out[t.bucket] += (OUT_BUCKETS.includes(t.bucket) ? -1 : 1) * t.value;
  for (const k of TURNOVER_BUCKETS) out[k] = Math.round(out[k]);
  return out;
}

/** A line in the overview's feed of recent documents. */
export type RecentDocument = {
  type: "receipt" | "issue" | "count";
  id: string;
  number: number;
  /** The document's own date (YYYY-MM-DD). */
  date: string;
  createdAt: string;
  title: string;
  subtitle: string;
  value: number | null;
  cancelled: boolean;
};

export type InventoryOverview = {
  date: string;
  month: { from: string; to: string; figures: Record<TurnoverBucket, number> };
  daily: DailyFlow[];
  recent: RecentDocument[];
  attention: {
    pendingNorms: number;
    openCount: { id: string; number: number; counted: number; lines: number } | null;
    lastCount: { number: number; postedAt: string } | null;
  };
};
