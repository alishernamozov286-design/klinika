/**
 * Bemorlar oqimi (R.2, TZ §13): people served each day — every patient once a
 * day, by kind (appointment, lab, hospital) — new cards, and lab tests ordered
 * and verified. Rules: shared/patient-flow.ts.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarDays, FlaskConical, Stethoscope, Table2, UserPlus, Users } from "lucide-react";
import type { PatientFlowDay, PatientFlowReport } from "@shared/patient-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function PatientFlowView() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Period>("30");
  const [custom, setCustom] = useState<[string, string]>([localDay(-29), localDay()]);
  const [asTable, setAsTable] = useState(false);
  const [from, to] = periodRange(period, custom);
  const { data: r, isLoading } = useQuery<PatientFlowReport>({ queryKey: [`/api/reports/patient-flow?from=${from}&to=${to}`], refetchOnMount: "always" });
  const subtitle = `${formatDate(from)} — ${formatDate(to)}`;
  const periods: { key: Period; label: string }[] = [
    { key: "30", label: "30 kun" },
    { key: "month", label: "Bu oy" },
    { key: "last-month", label: "O'tgan oy" },
    { key: "90", label: "3 oy" },
    { key: "custom", label: "Davr…" },
  ];
  const quiet = r && r.totals.uniquePatients === 0 && r.totals.testsOrdered === 0 && r.totals.newPatients === 0;

  const buildExport = (): ExportDoc<PatientFlowDay> | null => {
    if (!r) return null;
    return {
      filename: `bemorlar-oqimi-${from}-${to}`,
      title: "Bemorlar oqimi va laboratoriya tahlillari",
      subtitle,
      orientation: "landscape",
      columns: [
        { header: "Sana", value: (d) => formatDate(d.day), width: 12 },
        { header: "Bemorlar", value: (d) => d.patients, type: "number", total: true, width: 11 },
        { header: "Qabul", value: (d) => d.outpatients, type: "number", total: true, width: 9 },
        { header: "Laboratoriya", value: (d) => d.labPatients, type: "number", total: true, width: 12 },
        { header: "Statsionar", value: (d) => d.inpatients, type: "number", total: true, width: 11 },
        { header: "Yangi bemor", value: (d) => d.newPatients, type: "number", total: true, width: 12 },
        { header: "Tahlil buyurildi", value: (d) => d.testsOrdered, type: "number", total: true, width: 14 },
        { header: "Tahlil tasdiqlandi", value: (d) => d.testsVerified, type: "number", total: true, width: 15 },
      ],
      rows: r.days,
      sections: [
        {
          title: "Davr bo'yicha (har bemor bir marta)",
          columns: [{ header: "Ko'rsatkich", width: 34 }, { header: "Qiymat", type: "number", width: 12 }],
          rows: [
            ["Jami bemorlar", r.totals.uniquePatients],
            ["Kunlik o'rtacha", r.totals.avgPerDay],
            ["Qabulga kelganlar", r.totals.outpatients],
            ["Laboratoriyaga kelganlar", r.totals.labPatients],
            ["Statsionarda bo'lganlar", r.totals.inpatients],
            ["Yangi bemorlar", r.totals.newPatients],
            ["Tahlillar buyurildi", r.totals.testsOrdered],
            ["Tahlillar tasdiqlandi", r.totals.testsVerified],
          ],
        },
      ],
    };
  };

  return (
    <div className="space-y-6" data-testid="patient-flow-report">
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              data-testid={`flow-period-${p.key}`}
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
        {can("data.export") && <ExportButtons testIdPrefix="export-flow" disabled={isLoading} build={buildExport} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard index={0} label="Jami bemorlar" value={r?.totals.uniquePatients ?? 0} hint="Davrda, har biri bir marta" icon={Users} tone="violet" isLoading={isLoading} />
        <StatCard index={1} label="Kunlik o'rtacha" value={r ? r.totals.avgPerDay : 0} hint={r?.totals.busiest ? `Eng gavjum: ${formatDate(r.totals.busiest.day)}, ${r.totals.busiest.patients}` : "Kunlik bemorlar"} icon={CalendarDays} tone="primary" isLoading={isLoading} />
        <StatCard index={2} label="Yangi bemorlar" value={r?.totals.newPatients ?? 0} hint="Ro'yxatga olingan kartalar" icon={UserPlus} tone="emerald" isLoading={isLoading} />
        <StatCard index={3} label="Tahlillar buyurildi" value={r?.totals.testsOrdered ?? 0} hint="Bekor qilinmagan buyurtmalarda" icon={FlaskConical} tone="amber" isLoading={isLoading} />
        <StatCard index={4} label="Tahlillar tasdiqlandi" value={r?.totals.testsVerified ?? 0} hint="Natijasi tasdiqlangan" icon={FlaskConical} isLoading={isLoading} />
      </div>

      {isLoading || !r ? (
        <div className="h-80 skeleton-shimmer rounded-2xl" />
      ) : quiet ? (
        <div className="card-premium">
          <EmptyState icon={Users} title="Bu davrda bemor yo'q" description="Boshqa davrni tanlang." />
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SectionCard icon={Users} title="Kunlik bemorlar" description="Har bemor kuniga bir marta — qabul, laboratoriya yoki statsionar">
              <DailyBars
                days={r.days}
                series={[{ key: "patients", label: "Bemorlar", cls: "fill-primary", swatch: "bg-primary" }]}
                readout={(d) => `${d.patients} bemor · qabul ${d.outpatients}, laboratoriya ${d.labPatients}, statsionar ${d.inpatients} · yangi ${d.newPatients}`}
                table={asTable}
                onTable={setAsTable}
                testId="flow-patients"
              />
            </SectionCard>
            <SectionCard title="Qayerga kelishdi" description="Davrda, har bemor bir marta; biri bir nechtasida bo'lishi mumkin">
              <div className="space-y-4" data-testid="flow-kinds">
                {[
                  { icon: Stethoscope, label: "Qabul (shifokor, UZI, muolaja)", n: r.totals.outpatients },
                  { icon: FlaskConical, label: "Laboratoriya", n: r.totals.labPatients },
                  { icon: BedDouble, label: "Statsionar", n: r.totals.inpatients },
                ].map((k) => (
                  <div key={k.label} className="flex items-center gap-3">
                    <k.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <MeterBar
                      className="min-w-0 flex-1"
                      value={k.n}
                      max={Math.max(1, r.totals.uniquePatients)}
                      label={
                        <>
                          <span className="text-foreground">{k.label}</span>
                          <span className="tabular">
                            {k.n} · {r.totals.uniquePatients ? Math.round((k.n / r.totals.uniquePatients) * 100) : 0}%
                          </span>
                        </>
                      }
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          <SectionCard icon={FlaskConical} title="Laboratoriya tahlillari" description="Kunlik buyurilgan va tasdiqlangan tahlillar (bir o'q — tahlil soni)">
            <DailyBars
              days={r.days}
              series={[
                { key: "testsOrdered", label: "Buyurildi", cls: "fill-primary", swatch: "bg-primary" },
                { key: "testsVerified", label: "Tasdiqlandi", cls: "fill-emerald-500", swatch: "bg-emerald-500" },
              ]}
              readout={(d) => `buyurildi ${d.testsOrdered}, tasdiqlandi ${d.testsVerified}`}
              table={asTable}
              onTable={setAsTable}
              testId="flow-tests"
            />
          </SectionCard>
          <p className="text-xs text-muted-foreground">
            Hisob qoidasi: bemor kuniga bir marta sanaladi — kelgan qabuli (keldi, qabulda, yakunlandi), bekor qilinmagan laboratoriya buyurtmasi yoki o'sha kuni statsionarda bo'lgani uchun. Tasdiqlangan tahlil — natija tasdiqlangan
            kunda sanaladi.
          </p>
        </>
      )}
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

type SeriesKey = "patients" | "testsOrdered" | "testsVerified";

/** Daily bars of one or two series on one count axis, a hover readout, and a table view. */
function DailyBars({
  days,
  series,
  readout,
  table,
  onTable,
  testId,
}: {
  days: PatientFlowDay[];
  series: { key: SeriesKey; label: string; cls: string; swatch: string }[];
  readout: (d: PatientFlowDay) => string;
  table: boolean;
  onTable: (t: boolean) => void;
  testId: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = 200;
  const M = { top: 10, right: 8, bottom: 24, left: 34 };
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const max = Math.max(1, ...days.flatMap((d) => series.map((s) => d[s.key])));
  const step = days.length ? innerW / days.length : 0;
  const groupW = Math.max(2, Math.min(30, step - 2));
  const barW = series.length > 1 ? Math.max(1, groupW / series.length - 1) : groupW;
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const ticks = useMemo(() => {
    const n = max <= 4 ? max : 4;
    return Array.from(new Set(Array.from({ length: n + 1 }, (_, i) => Math.round((max * i) / n))));
  }, [max]);
  const cur = active !== null ? days[active] : days[days.length - 1];
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(innerW / 44))));

  return (
    <div data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", s.swatch)} /> {s.label}
            </span>
          ))}
        </div>
        {cur && (
          <span className="tabular text-muted-foreground" data-testid={`${testId}-readout`}>
            {formatDate(cur.day)}: <span className="text-foreground">{readout(cur)}</span>
          </span>
        )}
        <Button variant="ghost" size="sm" className="h-7" onClick={() => onTable(!table)} data-testid={`${testId}-table`}>
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
                {series.map((s) => (
                  <th key={s.key} className="px-3 py-1.5 text-right">
                    {s.label}
                  </th>
                ))}
                <th className="hidden px-3 py-1.5 text-left sm:table-cell">Tafsilot</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t">
                  <td className="px-3 py-1.5">{formatDate(d.day)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular">
                      {d[s.key] || "—"}
                    </td>
                  ))}
                  <td className="hidden px-3 py-1.5 text-xs text-muted-foreground sm:table-cell">{readout(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="w-full">
          {width > 0 && (
            <svg width={width} height={H} role="img" aria-label={`${series.map((s) => s.label).join(", ")}, ${days.length} kun`} onMouseLeave={() => setActive(null)}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t ? "3 3" : undefined} />
                  <text x={M.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular">
                    {t}
                  </text>
                </g>
              ))}
              {days.map((d, i) => {
                const x0 = M.left + i * step + (step - groupW) / 2;
                return (
                  <g key={d.day}>
                    {series.map((s, k) =>
                      d[s.key] > 0 ? (
                        <rect key={s.key} x={x0 + k * (barW + 1)} y={y(d[s.key])} width={barW} height={Math.max(0, y(0) - y(d[s.key]))} rx={Math.min(3, barW / 2)} className={cn(s.cls, active === i ? "opacity-100" : "opacity-85")} />
                      ) : null,
                    )}
                    {i % labelEvery === 0 && (
                      <text x={x0 + groupW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular">
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
