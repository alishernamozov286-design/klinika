/**
 * Statsionar bandligi (R.2, TZ §13): occupancy over a period — the midnight
 * census day by day against the beds in service, by department and ward; who
 * came and left; the average length of stay. Rules: shared/inpatient-report.ts.
 */
import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarClock, Gauge, LogIn, LogOut, Table2, UserRound } from "lucide-react";
import type { InpatientDay, InpatientReport, InpatientUnitRow } from "@shared/inpatient-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, MeterBar, SectionCard, StatCard } from "@/components/ui-kit";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportDoc } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

type Period = "30" | "month" | "last-month" | "90" | "custom";
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
function periodRange(p: Period, custom: [string, string]): [string, string] {
  const today = localDay();
  if (p === "month") return [`${today.slice(0, 8)}01`, today];
  if (p === "last-month") {
    const d = new Date(`${today.slice(0, 8)}01T12:00:00Z`);
    d.setUTCDate(0);
    const end = d.toISOString().slice(0, 10);
    return [`${end.slice(0, 8)}01`, end];
  }
  if (p === "90") return [localDay(-89), today];
  if (p === "30") return [localDay(-29), today];
  return custom;
}
const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);
/** Occupancy bands: under 60% spare capacity, 60–85% healthy, above 85% crowded (the usual planning thresholds). */
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v > 85 ? "text-rose-700 dark:text-rose-300" : v >= 60 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300");

export function InpatientReportView() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Period>("30");
  const [custom, setCustom] = useState<[string, string]>([localDay(-29), localDay()]);
  // Chart or table: kept across period changes (the chart remounts while the report loads).
  const [asTable, setAsTable] = useState(false);
  const [from, to] = periodRange(period, custom);
  const { data: r, isLoading } = useQuery<InpatientReport>({ queryKey: [`/api/reports/inpatient?from=${from}&to=${to}`], refetchOnMount: "always" });
  const subtitle = `${formatDate(from)} — ${formatDate(to)}`;
  const periods: { key: Period; label: string }[] = [
    { key: "30", label: "30 kun" },
    { key: "month", label: "Bu oy" },
    { key: "last-month", label: "O'tgan oy" },
    { key: "90", label: "3 oy" },
    { key: "custom", label: "Davr…" },
  ];
  const empty = r && r.totals.availableBedDays === 0 && r.totals.admitted === 0;

  const buildExport = (): ExportDoc<InpatientUnitRow> | null => {
    if (!r) return null;
    const unitCols = [
      { header: "Yotoq", type: "number" as const, width: 9 },
      { header: "Band yotoq-kun", type: "number" as const, width: 14 },
      { header: "Mavjud yotoq-kun", type: "number" as const, width: 15 },
      { header: "Bandlik, %", type: "number" as const, width: 11 },
      { header: "Yotqizilgan", type: "number" as const, width: 12 },
      { header: "Chiqarilgan", type: "number" as const, width: 12 },
      { header: "O'rtacha kun", type: "number" as const, width: 12 },
    ];
    const unit = (u: InpatientUnitRow) => [u.beds, u.occupiedBedDays, u.availableBedDays, u.occupancy ?? "", u.admitted, u.discharged, u.alos ?? ""];
    return {
      filename: `statsionar-bandligi-${from}-${to}`,
      title: "Statsionar bandligi",
      subtitle,
      orientation: "landscape",
      columns: [
        { header: "Bo'lim", value: (u) => u.name, width: 26 },
        { header: "Yotoq", value: (u) => u.beds, type: "number", total: true, width: 9 },
        { header: "Band yotoq-kun", value: (u) => u.occupiedBedDays, type: "number", total: true, width: 14 },
        { header: "Mavjud yotoq-kun", value: (u) => u.availableBedDays, type: "number", total: true, width: 15 },
        { header: "Bandlik, %", value: (u) => u.occupancy ?? "", type: "number", width: 11 },
        { header: "Yotqizilgan", value: (u) => u.admitted, type: "number", total: true, width: 12 },
        { header: "Chiqarilgan", value: (u) => u.discharged, type: "number", total: true, width: 12 },
        { header: "O'rtacha kun", value: (u) => u.alos ?? "", type: "number", width: 12 },
      ],
      rows: r.byDepartment,
      sections: [
        {
          title: "Jami",
          columns: [{ header: "Ko'rsatkich", width: 30 }, { header: "Qiymat", type: "number", width: 14 }],
          rows: [
            ["O'rtacha bandlik, %", r.totals.occupancy ?? ""],
            ["Band yotoq-kun", r.totals.occupiedBedDays],
            ["Mavjud yotoq-kun", r.totals.availableBedDays],
            ["Yotqizilgan", r.totals.admitted],
            ["Chiqarilgan", r.totals.discharged],
            ["O'rtacha yotish kuni", r.totals.alos ?? ""],
            ["Davr oxirida statsionarda", r.totals.inHospital],
          ],
        },
        { title: "Palatalar", columns: [{ header: "Bo'lim", width: 22 }, { header: "Palata", width: 12 }, ...unitCols], rows: r.byWard.map((w) => [w.departmentName, w.name, ...unit(w)]) },
        {
          title: "Kunlar bo'yicha",
          columns: [
            { header: "Sana", width: 12 },
            { header: "Band", type: "number", width: 8 },
            { header: "Sig'im", type: "number", width: 8 },
            { header: "Bandlik, %", type: "number", width: 11 },
            { header: "Yotqizildi", type: "number", width: 11 },
            { header: "Chiqarildi", type: "number", width: 11 },
          ],
          rows: r.days.map((d) => [formatDate(d.day), d.occupied, d.capacity, d.occupancy ?? "", d.admitted, d.discharged]),
        },
      ],
    };
  };

  return (
    <div className="space-y-6" data-testid="inpatient-report">
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              data-testid={`inpatient-period-${p.key}`}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={custom[0]} max={custom[1]} onChange={(e) => setCustom([e.target.value, custom[1]])} className="h-8 w-36" aria-label="Davr boshi" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={custom[1]} min={custom[0]} onChange={(e) => setCustom([custom[0], e.target.value])} className="h-8 w-36" aria-label="Davr oxiri" />
            </div>
          )}
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {can("data.export") && <ExportButtons testIdPrefix="export-inpatient" disabled={isLoading} build={buildExport} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          index={0}
          label="O'rtacha bandlik"
          value={r ? pctText(r.totals.occupancy) : "—"}
          hint={r ? `${r.totals.occupiedBedDays} / ${r.totals.availableBedDays} yotoq-kun` : undefined}
          icon={Gauge}
          tone={r?.totals.occupancy !== null && r && r.totals.occupancy! > 85 ? "rose" : "violet"}
          isLoading={isLoading}
        />
        <StatCard index={1} label="Yotqizilgan" value={r?.totals.admitted ?? 0} hint="Davrda" icon={LogIn} tone="primary" isLoading={isLoading} />
        <StatCard index={2} label="Chiqarilgan" value={r?.totals.discharged ?? 0} hint="Davrda" icon={LogOut} tone="emerald" isLoading={isLoading} />
        <StatCard index={3} label="O'rtacha yotish" value={r?.totals.alos !== null && r ? `${r.totals.alos} kun` : "—"} hint="Chiqarilganlar bo'yicha" icon={CalendarClock} tone="amber" isLoading={isLoading} />
        <StatCard
          index={4}
          label="Statsionarda"
          value={r?.totals.inHospital ?? 0}
          hint={r?.totals.peak ? `Eng band kun: ${formatDate(r.totals.peak.day)}, ${r.totals.peak.occupancy}%` : "Davr oxirida"}
          icon={UserRound}
          isLoading={isLoading}
        />
      </div>

      {isLoading || !r ? (
        <div className="h-80 skeleton-shimmer rounded-2xl" />
      ) : empty ? (
        <div className="card-premium">
          <EmptyState icon={BedDouble} title="Bu davrda statsionar ma'lumoti yo'q" description="Palata va yotoqlar qo'shilgach va bemorlar yotqizilgach hisobot to'ladi." />
        </div>
      ) : (
        <>
          <SectionCard icon={BedDouble} title="Kunlik bandlik" description="Har kun oxiridagi band yotoqlar (to'q) va xizmatdagi yotoqlar (och fon)">
            <CensusChart days={r.days} table={asTable} onTable={setAsTable} />
          </SectionCard>
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Bo'limlar" description="Bandlik — band yotoq-kun ÷ mavjud yotoq-kun" flush>
              <UnitTable rows={r.byDepartment} first="Bo'lim" testId="inpatient-departments" />
            </SectionCard>
            <SectionCard title="Palatalar" flush>
              <UnitTable rows={r.byWard} first="Palata" sub={(u) => (u as InpatientUnitRow & { departmentName: string }).departmentName} testId="inpatient-wards" />
            </SectionCard>
          </div>
          <p className="text-xs text-muted-foreground">
            Hisob qoidasi: kun oxiridagi holat (yarim tun usuli; bugun uchun — hozir). Sig'im — o'sha kunga qadar qo'shilgan va hozir xizmatdagi yotoqlar (ta'mirdagilar sanalmaydi). Xato yotqizishlar (bekor qilingan) hisobga
            kirmaydi. O'rtacha yotish — davrda chiqarilganlar bo'yicha, yotqizilgan kundan chiqarilgan kungacha.
          </p>
        </>
      )}
    </div>
  );
}

function UnitTable({ rows, first, sub, testId }: { rows: InpatientUnitRow[]; first: string; sub?: (u: InpatientUnitRow) => string; testId: string }) {
  return (
    <div className="overflow-x-auto" data-testid={testId}>
      <Table className="table-premium">
        <TableHeader>
          <TableRow>
            <TableHead>{first}</TableHead>
            <TableHead className="text-right">Yotoq</TableHead>
            <TableHead className="min-w-[140px]">Bandlik</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Kirdi</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Chiqdi</TableHead>
            <TableHead className="hidden text-right md:table-cell">O'rt. kun</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id} data-testid={`${testId}-${u.id}`}>
              <TableCell>
                <span className="font-medium">{u.name}</span>
                {sub && <span className="block text-xs text-muted-foreground">{sub(u)}</span>}
              </TableCell>
              <TableCell className="text-right tabular">{u.beds}</TableCell>
              <TableCell>
                <MeterBar
                  value={u.occupiedBedDays}
                  max={Math.max(1, u.availableBedDays)}
                  label={
                    <>
                      <span className={cn("font-semibold tabular", tone(u.occupancy))}>{pctText(u.occupancy)}</span>
                      <span className="tabular">
                        {u.occupiedBedDays}/{u.availableBedDays}
                      </span>
                    </>
                  }
                />
              </TableCell>
              <TableCell className="hidden text-right tabular sm:table-cell">{u.admitted}</TableCell>
              <TableCell className="hidden text-right tabular sm:table-cell">{u.discharged}</TableCell>
              <TableCell className="hidden text-right tabular md:table-cell">{u.alos ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * One measure on one axis — beds: the capacity of each day as a faint column,
 * the beds occupied at the day's end as the solid one inside it. A hover
 * readout per day; a table view for the same numbers.
 */
function CensusChart({ days, table, onTable }: { days: InpatientDay[]; table: boolean; onTable: (t: boolean) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = 220;
  const M = { top: 10, right: 8, bottom: 24, left: 34 };
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const max = Math.max(1, ...days.map((d) => Math.max(d.capacity, d.occupied)));
  const step = days.length ? innerW / days.length : 0;
  const barW = Math.max(2, Math.min(28, step - 2));
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const ticks = useMemo(() => {
    const n = max <= 5 ? max : 4;
    return Array.from({ length: n + 1 }, (_, i) => Math.round((max * i) / n));
  }, [max]);
  const cur = active !== null ? days[active] : days[days.length - 1];
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(innerW / 44))));

  return (
    <div data-testid="census-chart">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Band yotoq
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/15 ring-1 ring-primary/30" /> Xizmatdagi yotoq
          </span>
        </div>
        {cur && (
          <span className="tabular text-muted-foreground" data-testid="census-readout">
            {formatDate(cur.day)}: <span className="font-semibold text-foreground">{cur.occupied}</span>/{cur.capacity} yotoq · {pctText(cur.occupancy)} · kirdi {cur.admitted}, chiqdi {cur.discharged}
          </span>
        )}
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onTable(!table)} data-testid="button-census-table">
          <Table2 className="mr-1.5 h-3.5 w-3.5" />
          {table ? "Grafik" : "Jadval"}
        </Button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 text-left">Sana</th>
                <th className="px-3 py-1.5 text-right">Band / sig'im</th>
                <th className="px-3 py-1.5 text-right">Bandlik</th>
                <th className="px-3 py-1.5 text-right">Kirdi</th>
                <th className="px-3 py-1.5 text-right">Chiqdi</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="px-3 py-1.5">{formatDate(d.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular">
                    {d.occupied}/{d.capacity}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right tabular", tone(d.occupancy))}>{pctText(d.occupancy)}</td>
                  <td className="px-3 py-1.5 text-right tabular">{d.admitted || "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular">{d.discharged || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={width} height={H} role="img" aria-label={`Kunlik bandlik, ${days.length} kun`} onMouseLeave={() => setActive(null)}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t ? "3 3" : undefined} />
                  <text x={M.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular">
                    {t}
                  </text>
                </g>
              ))}
              {days.map((d, i) => {
                const x = M.left + i * step + (step - barW) / 2;
                return (
                  <g key={d.day}>
                    <rect x={x} y={y(d.capacity)} width={barW} height={Math.max(0, y(0) - y(d.capacity))} rx={Math.min(4, barW / 2)} className="fill-primary/15" />
                    {d.occupied > 0 && <rect x={x} y={y(d.occupied)} width={barW} height={Math.max(0, y(0) - y(d.occupied))} rx={Math.min(4, barW / 2)} className={cn(active === i ? "fill-primary" : "fill-primary/85")} />}
                    {i % labelEvery === 0 && (
                      <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular">
                        {d.day.slice(8, 10)}.{d.day.slice(5, 7)}
                      </text>
                    )}
                    <rect x={M.left + i * step} y={M.top} width={step} height={innerH} fill="transparent" onMouseEnter={() => setActive(i)} />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
