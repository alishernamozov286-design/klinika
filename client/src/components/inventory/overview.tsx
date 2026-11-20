/**
 * Ombor bosh sahifasi (B5.7, TZ §7.1): the month in money, the last 30 days
 * of in and out, what needs doing, and the latest documents. Every number is
 * from the stock ledger (shared/inventory-reports.ts).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Beaker,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  PackageMinus,
  PackagePlus,
  Scale,
  Table2,
  Wallet,
} from "lucide-react";
import type { StockAlerts } from "@shared/inventory";
import type { DailyFlow, InventoryOverview, RecentDocument } from "@shared/inventory-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard, StatCard } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money, moneyShort } from "@/lib/format";

/** Where a card or a line leads: a tab of the Ombor page, optionally a filter. */
export type OverviewTarget =
  | { tab: "stock"; window?: "expired" | "soon" }
  | { tab: "stock-low" }
  | { tab: "receipts" | "issues" | "counts" | "consumption" | "reports" | "items" };

export function InventoryOverviewTab({ onOpen }: { onOpen: (t: OverviewTarget) => void }) {
  const { data: o, isLoading } = useQuery<InventoryOverview>({ queryKey: ["/api/inventory/overview"], refetchOnMount: "always" });
  const { data: alerts } = useQuery<StockAlerts>({ queryKey: ["/api/inventory/alerts"], refetchOnMount: "always" });
  const f = o?.month.figures;
  const out = f ? f.department + f.writeoff + f.consumption : 0;

  return (
    <div className="space-y-4">
      {/* Money in full ("1 420 000 so'm") needs a whole row on a phone. */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Ombor qiymati" value={money(alerts?.value ?? 0)} hint="Hozirgi qoldiq, xarid narxlarida" icon={Wallet} isLoading={!alerts} />
        <StatCard
          index={1}
          label="Bu oy kirim"
          value={money(f?.receipt ?? 0)}
          hint={o ? `${formatDate(o.month.from)} dan` : undefined}
          icon={PackagePlus}
          tone="emerald"
          isLoading={isLoading}
          onClick={() => onOpen({ tab: "receipts" })}
        />
        <StatCard
          index={2}
          label="Bu oy chiqim"
          value={money(out)}
          hint={f ? `Bo'limlarga ${moneyShort(f.department)} · sarf ${moneyShort(f.consumption)} · hisobdan ${moneyShort(f.writeoff)}` : undefined}
          icon={PackageMinus}
          tone="amber"
          isLoading={isLoading}
          onClick={() => onOpen({ tab: "issues" })}
        />
        <StatCard
          index={3}
          label="Inventarizatsiya farqi"
          value={money(f?.count ?? 0)}
          hint={f && f.count !== 0 ? (f.count < 0 ? "Bu oy kamomad" : "Bu oy ortiqcha") : "Bu oy farq yo'q"}
          icon={Scale}
          tone={f && f.count < 0 ? "rose" : "violet"}
          isLoading={isLoading}
          onClick={() => onOpen({ tab: "counts" })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          icon={ArrowDownToLine}
          title="So'nggi 30 kun: kirim va chiqim"
          description="Kunlik summa, xarid narxlarida. Chiqim: bo'limlarga, laboratoriya sarfi va hisobdan chiqarish"
          className="xl:col-span-2"
        >
          {isLoading || !o ? <div className="h-64 skeleton-shimmer rounded-lg" /> : <FlowChart days={o.daily} />}
        </SectionCard>
        <AttentionCard overview={o} alerts={alerts} onOpen={onOpen} />
      </div>

      <SectionCard
        icon={FileText}
        title="Oxirgi hujjatlar"
        description="Kirim, chiqim va inventarizatsiya"
        action={
          <Button variant="ghost" size="sm" onClick={() => onOpen({ tab: "reports" })} data-testid="button-open-reports">
            Hisobotlar
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        }
        flush
      >
        {isLoading || !o ? (
          <div className="m-5 h-40 skeleton-shimmer rounded-lg" />
        ) : o.recent.length === 0 ? (
          <EmptyState icon={FileText} title="Hujjat yo'q" description="Birinchi kirim hujjatini rasmiylashtiring." />
        ) : (
          <ul className="divide-y" data-testid="recent-documents">
            {o.recent.map((d) => (
              <RecentRow key={`${d.type}-${d.id}`} doc={d} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------- attention

function AttentionCard({ overview, alerts, onOpen }: { overview: InventoryOverview | undefined; alerts: StockAlerts | undefined; onOpen: (t: OverviewTarget) => void }) {
  const a = overview?.attention;
  const daysSinceCount = a?.lastCount ? Math.floor((Date.now() - Date.parse(a.lastCount.postedAt)) / 864e5) : null;
  const rows: { key: string; icon: typeof AlertTriangle; n: number | string; label: string; tone: "rose" | "amber" | "sky" | "muted"; to: OverviewTarget }[] = [];
  if (alerts) {
    rows.push({ key: "expired", icon: AlertTriangle, n: alerts.expired.batches, label: "partiyaning muddati o'tgan — hisobdan chiqaring", tone: alerts.expired.batches ? "rose" : "muted", to: { tab: "stock", window: "expired" } });
    rows.push({ key: "soon", icon: CalendarClock, n: alerts.soon.batches, label: "partiya 30 kun ichida tugaydi", tone: alerts.soon.batches ? "amber" : "muted", to: { tab: "stock", window: "soon" } });
    rows.push({ key: "low", icon: PackageMinus, n: alerts.lowStock.length, label: "mahsulot kam qolgan", tone: alerts.lowStock.length ? "amber" : "muted", to: { tab: "stock-low" } });
    rows.push({ key: "short", icon: Beaker, n: alerts.consumptionShort, label: "laboratoriya sarfi qoldiqdan chiqmagan", tone: alerts.consumptionShort ? "amber" : "muted", to: { tab: "consumption" } });
  }
  if (a) {
    rows.push({ key: "norms", icon: Scale, n: a.pendingNorms, label: "sarf normasi tasdiqlash kutmoqda", tone: a.pendingNorms ? "sky" : "muted", to: { tab: "consumption" } });
    rows.push(
      a.openCount
        ? { key: "count", icon: ClipboardList, n: `${a.openCount.counted}/${a.openCount.lines}`, label: `inventarizatsiya №${a.openCount.number} davom etmoqda`, tone: "sky", to: { tab: "counts" } }
        : {
            key: "count",
            icon: ClipboardList,
            n: daysSinceCount === null ? "—" : `${daysSinceCount} kun`,
            label: daysSinceCount === null ? "inventarizatsiya hali o'tkazilmagan" : "oxirgi inventarizatsiyadan beri",
            tone: daysSinceCount === null || daysSinceCount > 90 ? "amber" : "muted",
            to: { tab: "counts" },
          },
    );
  }
  const busy = rows.filter((r) => r.tone !== "muted").length;
  return (
    <SectionCard icon={AlertTriangle} title="E'tibor talab qiladi" description={rows.length ? (busy ? `${busy} ta masala` : "Hammasi joyida") : "Yuklanmoqda…"} flush>
      {rows.length === 0 ? (
        <div className="m-5 h-48 skeleton-shimmer rounded-lg" />
      ) : (
        <ul className="divide-y" data-testid="attention-list">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onOpen(r.to)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                data-testid={`attention-${r.key}`}
              >
                <r.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    r.tone === "rose" && "text-rose-600 dark:text-rose-400",
                    r.tone === "amber" && "text-amber-600 dark:text-amber-400",
                    r.tone === "sky" && "text-sky-600 dark:text-sky-400",
                    r.tone === "muted" && "text-muted-foreground/60",
                  )}
                />
                <span className={cn("min-w-[3.5rem] text-base font-bold tabular", r.tone === "muted" && "font-semibold text-muted-foreground")}>{r.n}</span>
                <span className={cn("min-w-0 flex-1 text-sm", r.tone === "muted" ? "text-muted-foreground" : "text-foreground")}>{r.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ recent

const DOC_META: Record<RecentDocument["type"], { icon: typeof PackagePlus; tone: string; tab: OverviewTarget }> = {
  receipt: { icon: PackagePlus, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", tab: { tab: "receipts" } },
  issue: { icon: Building2, tone: "bg-amber-500/10 text-amber-800 dark:text-amber-300", tab: { tab: "issues" } },
  count: { icon: ClipboardList, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300", tab: { tab: "counts" } },
};

function RecentRow({ doc, onOpen }: { doc: RecentDocument; onOpen: (t: OverviewTarget) => void }) {
  const meta = DOC_META[doc.type];
  return (
    <li>
      <button type="button" onClick={() => onOpen(meta.tab)} className={cn("flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40", doc.cancelled && "opacity-60")}>
        <div className={cn("icon-tile h-9 w-9 shrink-0", meta.tone)}>
          <meta.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {doc.title}
            {doc.cancelled && (
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300">
                Bekor qilingan
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{doc.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          {doc.value !== null && (
            <p className={cn("text-sm font-semibold tabular", doc.cancelled && "line-through", doc.type === "count" && doc.value < 0 && "text-rose-700 dark:text-rose-300")}>
              {doc.type === "count" && doc.value > 0 ? "+" : ""}
              {money(doc.value)}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">{formatDateTime(doc.createdAt)}</p>
        </div>
      </button>
    </li>
  );
}

// ------------------------------------------------------------------- chart

/** A round step above `v` for the axis: 1, 2 or 5 × 10ⁿ. */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** "20.11" — short enough for a 30-day axis. */
const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/**
 * Kirim above the baseline, chiqim below it, on one money axis — the two
 * directions of the same ledger. Thin bars with a rounded data end, a band
 * hit-target per day with a tooltip, arrow keys, and a table view.
 */
function FlowChart({ days }: { days: DailyFlow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const totals = useMemo(() => days.reduce((s, d) => ({ in: s.in + d.in, out: s.out + d.out }), { in: 0, out: 0 }), [days]);
  const quiet = totals.in === 0 && totals.out === 0;

  const H = 240;
  const M = { top: 12, right: 8, bottom: 26, left: 58 };
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const maxIn = niceCeil(Math.max(0, ...days.map((d) => d.in)));
  const maxOut = niceCeil(Math.max(0, ...days.map((d) => d.out)));
  // Each side keeps at least a sliver, so a quiet direction still shows its baseline side.
  const top = maxIn || (maxOut ? maxOut / 4 : 1);
  const bottom = maxOut || (maxIn ? maxIn / 4 : 1);
  const y = (v: number) => M.top + ((top - v) / (top + bottom)) * innerH;
  const zeroY = y(0);
  const band = days.length ? innerW / days.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const ticks = [top, top / 2, 0, -bottom / 2, -bottom].filter((t, i, a) => a.indexOf(t) === i);
  const labelEvery = band < 22 ? 5 : band < 34 ? 3 : 1;

  /** A bar from the baseline with a 4px rounded data end; square where it meets the baseline. */
  const bar = (x: number, v: number, up: boolean) => {
    const h = Math.abs(y(v) - zeroY);
    if (h < 0.5) return "";
    const r = Math.min(4, h, barW / 2);
    const x0 = x - barW / 2;
    const x1 = x + barW / 2;
    if (up) {
      const t = zeroY - h;
      return `M${x0},${zeroY} V${t + r} Q${x0},${t} ${x0 + r},${t} H${x1 - r} Q${x1},${t} ${x1},${t + r} V${zeroY} Z`;
    }
    const b = zeroY + h;
    return `M${x0},${zeroY} V${b - r} Q${x0},${b} ${x0 + r},${b} H${x1 - r} Q${x1},${b} ${x1},${b - r} V${zeroY} Z`;
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setActive((a) => (a === null ? 0 : Math.min(days.length - 1, a + 1)));
    else if (e.key === "ArrowLeft") setActive((a) => (a === null ? days.length - 1 : Math.max(0, a - 1)));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  const cur = active !== null ? days[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(M.left + band * active + band / 2, 90), Math.max(90, width - 90)) : 0;

  return (
    <div className="viz-flow space-y-3" data-testid="flow-chart">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm" aria-label="Belgilar">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-in)" }} />
            Kirim <span className="font-semibold tabular">{money(totals.in)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-out)" }} />
            Chiqim <span className="font-semibold tabular">{money(totals.out)}</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setTable((t) => !t)} aria-pressed={table} data-testid="button-flow-table">
          <Table2 className="mr-1.5 h-4 w-4" />
          {table ? "Grafik" : "Jadval"}
        </Button>
      </div>

      {quiet ? (
        <EmptyState icon={ArrowUpFromLine} title="30 kunda harakat bo'lmagan" description="Kirim yoki chiqim rasmiylashtirilgach, kunlik summa shu yerda ko'rinadi." />
      ) : table ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="flow-table">
            <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sana</th>
                <th className="px-3 py-2 text-right font-medium">Kirim</th>
                <th className="px-3 py-2 text-right font-medium">Chiqim</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5 tabular">{formatDate(d.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular">{d.in ? money(d.in) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular">{d.out ? money(d.out) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
          {width > 0 && (
            <svg
              width={width}
              height={H}
              role="img"
              aria-label={`So'nggi 30 kun: kirim ${money(totals.in)}, chiqim ${money(totals.out)}. Kunlar bo'yicha o'tish uchun chap va o'ng tugmalar.`}
              tabIndex={0}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              className="overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            >
              {/* recessive grid and axis */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-border" : "stroke-border/50"} strokeWidth={t === 0 ? 1 : 1} strokeDasharray={t === 0 ? undefined : "2 4"} />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular">
                    {t === 0 ? "0" : `${t < 0 ? "−" : ""}${moneyShort(Math.abs(t))}`}
                  </text>
                </g>
              ))}
              {active !== null && <rect x={M.left + band * active} y={M.top} width={band} height={innerH} className="fill-muted/60" rx={4} />}
              {days.map((d, i) => {
                const cx = M.left + band * i + band / 2;
                return (
                  <g key={d.date}>
                    <path d={bar(cx, d.in, true)} style={{ fill: "var(--series-in)" }} />
                    <path d={bar(cx, -d.out, false)} style={{ fill: "var(--series-out)" }} />
                    {(i % labelEvery === 0 || i === days.length - 1) && (i === days.length - 1 || days.length - 1 - i >= labelEvery / 2) && (
                      <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular">
                        {dayLabel(d.date)}
                      </text>
                    )}
                    {/* the hit target is the whole day band, not the thin bar */}
                    <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} data-testid={`flow-day-${d.date}`} />
                  </g>
                );
              })}
            </svg>
          )}
          {cur && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
              style={{ left: tipLeft }}
              role="status"
              data-testid="flow-tooltip"
            >
              <p className="mb-1 font-medium">{formatDate(cur.date)}</p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--series-in)" }} />
                  Kirim
                </span>
                <span className="font-semibold tabular">{money(cur.in)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--series-out)" }} />
                  Chiqim
                </span>
                <span className="font-semibold tabular">{money(cur.out)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
