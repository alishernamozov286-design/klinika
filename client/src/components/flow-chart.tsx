/**
 * The two-direction daily money chart (dataviz rules: validated palette in
 * both themes via .viz-flow tokens, thin bars with a rounded data end, one
 * axis, a band hit-target and tooltip per day, arrow keys, a table view).
 * Used by the warehouse home (B5.7) and the cash desk home (B7.7).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpFromLine, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit";
import { formatDate, money, moneyShort } from "@/lib/format";

export type FlowDay = { date: string; in: number; out: number };

export function niceCeil(v: number): number {
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
 * Money in above the baseline, money out below it, on one money axis — the
 * two directions of the same ledger (warehouse: kirim/chiqim; cash desk:
 * tushum/qaytarish). Thin bars with a rounded data end, a band
 * hit-target per day with a tooltip, arrow keys, and a table view.
 */
export function FlowChart({
  days,
  inLabel,
  outLabel,
  emptyTitle,
  emptyDescription,
  period = "So'nggi 30 kun",
  testIdPrefix = "flow",
}: {
  days: FlowDay[];
  inLabel: string;
  outLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  period?: string;
  testIdPrefix?: string;
}) {
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
    <div className="viz-flow space-y-3" data-testid={`${testIdPrefix}-chart`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm" aria-label="Belgilar">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-in)" }} />
            {inLabel} <span className="font-semibold tabular">{money(totals.in)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-out)" }} />
            {outLabel} <span className="font-semibold tabular">{money(totals.out)}</span>
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setTable((t) => !t)} aria-pressed={table} data-testid={`button-${testIdPrefix}-table`}>
          <Table2 className="mr-1.5 h-4 w-4" />
          {table ? "Grafik" : "Jadval"}
        </Button>
      </div>

      {quiet ? (
        <EmptyState icon={ArrowUpFromLine} title={emptyTitle} description={emptyDescription} />
      ) : table ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm" data-testid={`${testIdPrefix}-table`}>
            <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sana</th>
                <th className="px-3 py-2 text-right font-medium">{inLabel}</th>
                <th className="px-3 py-2 text-right font-medium">{outLabel}</th>
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
              aria-label={`${period}: ${inLabel.toLowerCase()} ${money(totals.in)}, ${outLabel.toLowerCase()} ${money(totals.out)}. Kunlar bo'yicha o'tish uchun chap va o'ng tugmalar.`}
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
                    <rect x={M.left + band * i} y={M.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} data-testid={`${testIdPrefix}-day-${d.date}`} />
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
              data-testid={`${testIdPrefix}-tooltip`}
            >
              <p className="mb-1 font-medium">{formatDate(cur.date)}</p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--series-in)" }} />
                  {inLabel}
                </span>
                <span className="font-semibold tabular">{money(cur.in)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm" style={{ background: "var(--series-out)" }} />
                  {outLabel}
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
