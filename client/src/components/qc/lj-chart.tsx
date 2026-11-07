/**
 * Levey–Jennings control chart (B4.8, TZ §6.5).
 *
 * One series, plotted in SD units: each run at the z it was given when entered
 * (against the target in force then), so a later change of target mean/SD does
 * not move old points. The reference lines carry the current target's values.
 *
 * Status is never colour alone: a warning is an amber triangle, a rejection a
 * red diamond, and the tooltip and the table below name the rule. Hover or the
 * arrow keys move a crosshair that snaps to the nearest run.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { QcResult } from "@shared/schema";
import { QC_STATUS_LABELS, WESTGARD_RULE_INFO, type QcStatus } from "@shared/qc";
import { formatDateTime } from "@/lib/format";

/** In control wears the series colour; warning and reject the reserved status steps. */
const STATUS_FILL: Record<QcStatus, string> = {
  ok: "hsl(var(--chart-1))",
  warning: "#fab219",
  reject: "#d03b3b",
};

const H = 280;
const PAD = { top: 16, right: 84, bottom: 30, left: 44 };
const LIMIT = 4; // z beyond ±4 is drawn on the edge

const fmt = (n: number) => {
  const a = Math.abs(n);
  const digits = a >= 100 ? 1 : a >= 10 ? 2 : 3;
  return String(Number(n.toFixed(digits)));
};
const shortDay = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const shortTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function LeveyJenningsChart({
  results,
  mean,
  sd,
  unit,
}: {
  results: QcResult[];
  mean: number;
  sd: number;
  unit: string | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Voided runs are not part of the series.
  const points = useMemo(() => results.filter((r) => !r.voidedAt), [results]);
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (z: number) => PAD.top + ((LIMIT - Math.max(-LIMIT, Math.min(LIMIT, z))) / (LIMIT * 2)) * innerH;

  const lines = [3, 2, 1, 0, -1, -2, -3];
  const lineStroke = (k: number) =>
    k === 0 ? "hsl(var(--foreground) / 0.55)" : Math.abs(k) === 3 ? "#d03b3b" : Math.abs(k) === 2 ? "#fab219" : "hsl(var(--border))";
  const lineOpacity = (k: number) => (Math.abs(k) >= 2 ? 0.55 : 1);

  // Date ticks: about one per 90px, always the first and the last.
  const tickEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerW / 90))));
  const ticks = points.map((p, i) => ({ p, i })).filter(({ i }) => i % tickEvery === 0 || i === points.length - 1);

  const nearest = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return null;
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.z).toFixed(1)}`).join(" ");
  const a = active !== null ? points[active] : null;

  if (points.length === 0) {
    return (
      <div ref={wrap} className="flex h-[220px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        Hali natija yo'q — birinchi nazorat natijasini kiriting.
      </div>
    );
  }

  return (
    <div ref={wrap} className="relative select-none" data-testid="lj-chart">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={`Levey–Jennings kartasi, ${points.length} ta natija. Chap va o'ng strelkalar bilan natijalar bo'ylab yuring.`}
        tabIndex={0}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((v) => v ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive((v) => Math.max(0, (v ?? points.length) - 1));
          if (e.key === "ArrowRight") setActive((v) => Math.min(points.length - 1, (v ?? -1) + 1));
        }}
      >
        {/* reference lines */}
        {lines.map((k) => (
          <g key={k}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(k)}
              y2={y(k)}
              stroke={lineStroke(k)}
              strokeOpacity={lineOpacity(k)}
              strokeWidth={k === 0 ? 1.5 : 1}
              shapeRendering="crispEdges"
            />
            <text x={PAD.left - 8} y={y(k)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
              {k === 0 ? "x̄" : `${k > 0 ? "+" : "−"}${Math.abs(k)}SD`}
            </text>
            <text x={width - PAD.right + 8} y={y(k)} dy="0.32em" className="fill-muted-foreground text-[10px] tabular-nums">
              {fmt(mean + k * sd)}
            </text>
          </g>
        ))}

        {/* date ticks */}
        {/* The day where it changes, the time within a day. */}
        {ticks.map(({ p, i }, k) => {
          const sameDay = k > 0 && shortDay(ticks[k - 1].p.measuredAt) === shortDay(p.measuredAt);
          return (
            <text key={p.id} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
              {sameDay ? shortTime(p.measuredAt) : shortDay(p.measuredAt)}
            </text>
          );
        })}

        {/* crosshair */}
        {a && active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="hsl(var(--foreground) / 0.25)" strokeWidth={1} shapeRendering="crispEdges" />
        )}

        <path d={path} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* points: a 2px surface ring keeps them legible where they cross lines */}
        {points.map((p, i) => {
          const cx = x(i);
          const cy = y(p.z);
          const r = active === i ? 6 : 4.5;
          const fill = STATUS_FILL[p.status];
          const ring = { stroke: "hsl(var(--card))", strokeWidth: 2 };
          if (p.status === "reject") {
            const d = r + 1.5;
            return <path key={p.id} d={`M${cx},${cy - d} L${cx + d},${cy} L${cx},${cy + d} L${cx - d},${cy} Z`} fill={fill} {...ring} data-status="reject" />;
          }
          if (p.status === "warning") {
            const d = r + 1.5;
            return <path key={p.id} d={`M${cx},${cy - d} L${cx + d},${cy + d * 0.8} L${cx - d},${cy + d * 0.8} Z`} fill={fill} {...ring} data-status="warning" />;
          }
          return <circle key={p.id} cx={cx} cy={cy} r={r} fill={fill} {...ring} data-status="ok" />;
        })}
      </svg>

      {a && active !== null && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(8, x(active) - 112), width - 232),
            top: y(a.z) > H / 2 ? 8 : H - 118,
          }}
          role="status"
          data-testid="lj-tooltip"
        >
          <p className="text-[15px] font-semibold tabular-nums text-foreground">
            {fmt(a.value)} <span className="text-xs font-normal text-muted-foreground">{unit ?? ""}</span>
          </p>
          <p className="tabular-nums text-muted-foreground">z = {a.z > 0 ? "+" : ""}{a.z.toFixed(2)} · {formatDateTime(a.measuredAt)}</p>
          <p className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
            <StatusGlyph status={a.status} />
            {QC_STATUS_LABELS[a.status]}
          </p>
          {a.rules.length > 0 && (
            <p className="mt-0.5 text-muted-foreground">{a.rules.map((r) => WESTGARD_RULE_INFO[r].label).join(", ")}</p>
          )}
        </div>
      )}

      {/* key: shape + label, so status never rides on colour alone */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["ok", "warning", "reject"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <StatusGlyph status={s} />
            {QC_STATUS_LABELS[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#fab219]" /> ±2SD
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#d03b3b]" /> ±3SD
        </span>
      </div>
    </div>
  );
}

/** The status mark as the chart draws it, for legends, tooltips and tables. */
export function StatusGlyph({ status, size = 10 }: { status: QcStatus; size?: number }) {
  const fill = STATUS_FILL[status];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className="shrink-0">
      {status === "reject" ? (
        <path d="M5,0 L10,5 L5,10 L0,5 Z" fill={fill} />
      ) : status === "warning" ? (
        <path d="M5,0.5 L9.8,9.2 L0.2,9.2 Z" fill={fill} />
      ) : (
        <circle cx="5" cy="5" r="4.2" fill={fill} />
      )}
    </svg>
  );
}
