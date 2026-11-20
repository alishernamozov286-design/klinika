/**
 * Ombor hisobotlari (B5.7, TZ §7.1 "Hisobotlar").
 *
 *   Aylanma qaydnoma  per item: opening, in, out by kind, count difference,
 *                     closing — in quantity or in money. Built from the
 *                     ledger, so it adds up and today's closing is the shelf.
 *   Bo'limlar         what each department received; its total is the sheet's
 *                     "Bo'limlarga berildi" column.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, ClipboardList, Info } from "lucide-react";
import { fmtQty, inventoryKey } from "@shared/inventory";
import { TURNOVER_BUCKET_LABELS, type Amount, type DepartmentReport, type TurnoverRow, type TurnoverSheet } from "@shared/inventory-reports";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, SectionCard } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/lib/format";

type Reports = { from: string; to: string; turnover: TurnoverSheet; departments: DepartmentReport[] };
type Measure = "value" | "qty";

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const COLS = ["opening", "receipt", "department", "writeoff", "consumption", "count", "closing"] as const;
type Col = (typeof COLS)[number];
const COL_LABEL: Record<Col, string> = {
  opening: "Davr boshida",
  receipt: TURNOVER_BUCKET_LABELS.receipt,
  department: "Bo'limlarga",
  writeoff: "Hisobdan chiqarildi",
  consumption: "Lab sarfi",
  count: "Inventarizatsiya ±",
  closing: "Davr oxirida",
};

const TURNOVER_EXPORT: ExportColumn<TurnoverRow>[] = [
  { header: "Mahsulot", value: (r) => r.itemName, width: 30 },
  { header: "Birlik", value: (r) => r.unit, width: 8 },
  ...COLS.flatMap((c) => [
    { header: `${COL_LABEL[c]}, miqdor`, value: (r: TurnoverRow) => r[c].qty, type: "number" as const, width: 12 },
    { header: `${COL_LABEL[c]}, so'm`, value: (r: TurnoverRow) => r[c].value, type: "money" as const, width: 14, total: true },
  ]),
];
const DEPT_EXPORT: ExportColumn<{ dept: string; item: string; unit: string; quantity: number; value: number }>[] = [
  { header: "Bo'lim", value: (r) => r.dept, width: 22 },
  { header: "Mahsulot", value: (r) => r.item, width: 30 },
  { header: "Miqdor", value: (r) => r.quantity, type: "number", width: 10 },
  { header: "Birlik", value: (r) => r.unit, width: 8 },
  { header: "Tannarx", value: (r) => r.value, type: "money", width: 14, total: true },
];

export function InventoryReports() {
  const { can } = useAuth();
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [measure, setMeasure] = useState<Measure>("value");
  const [search, setSearch] = useState("");
  const valid = Boolean(from && to && from <= to && to <= today);
  const { data, isLoading } = useQuery<Reports>({ queryKey: [`/api/inventory/reports?from=${from}&to=${to}`], enabled: valid, refetchOnMount: "always" });
  const period = data ? `${formatDate(data.from)} — ${formatDate(data.to)}` : "";
  const q = inventoryKey(search);
  const rows = (data?.turnover.rows ?? []).filter((r) => !q || inventoryKey(r.itemName).includes(q));
  const canExport = can("data.export");

  const presets: { label: string; from: string; to: string }[] = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    const prevEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
    const prevStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), 1));
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return [
      { label: "Bu oy", from: `${today.slice(0, 7)}-01`, to: today },
      { label: "O'tgan oy", from: iso(prevStart), to: iso(prevEnd) },
      { label: "Yil boshidan", from: `${today.slice(0, 4)}-01-01`, to: today },
    ];
  })();

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="rep-from" className="text-xs">
              Davr boshi
            </Label>
            <Input id="rep-from" type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" data-testid="input-report-from" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-to" className="text-xs">
              Davr oxiri
            </Label>
            <Input id="rep-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" data-testid="input-report-to" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={from === p.from && to === p.to}
                onClick={() => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  from === p.from && to === p.to ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                )}
                data-testid={`report-preset-${p.label}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {!valid && <p className="text-sm text-destructive">Davrni to'g'ri tanlang (oxiri bugundan keyin emas)</p>}
      </div>

      <SectionCard
        icon={ClipboardList}
        title="Aylanma qaydnoma"
        description={data ? `${period} · ${data.turnover.rows.length} ta mahsulot` : "Davr boshidagi qoldiq, kirim, chiqim va davr oxiridagi qoldiq"}
        action={
          canExport && data ? (
            <ExportButtons
              testIdPrefix="export-turnover"
              build={() => ({ filename: `aylanma-qaydnoma-${data.from}-${data.to}`, title: "Ombor: aylanma qaydnoma", subtitle: period, columns: TURNOVER_EXPORT, rows })}
            />
          ) : undefined
        }
        flush
      >
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Mahsulot…" className="sm:w-72" data-testid="input-search-turnover" />
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Ko'rsatish">
            {(
              [
                ["value", "Summa"],
                ["qty", "Miqdor"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={measure === k}
                onClick={() => setMeasure(k)}
                className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", measure === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                data-testid={`turnover-measure-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isLoading || !data ? (
          <div className="m-5 h-48 skeleton-shimmer rounded-lg" />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title={data.turnover.rows.length ? "Mos mahsulot yo'q" : "Bu davrda qoldiq ham, harakat ham yo'q"} description="Davrni yoki qidiruvni o'zgartiring." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium" data-testid="turnover-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-[11rem] bg-card">Mahsulot</TableHead>
                  {COLS.map((c) => (
                    <TableHead key={c} className={cn("whitespace-nowrap text-right", (c === "opening" || c === "closing") && "bg-muted/40")}>
                      {COL_LABEL[c]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.itemId} data-testid={`turnover-row-${r.itemId}`}>
                    <TableCell className="sticky left-0 z-10 bg-card">
                      <p className="font-medium">{r.itemName}</p>
                      <p className="text-xs text-muted-foreground">{r.unit}</p>
                    </TableCell>
                    {COLS.map((c) => (
                      <TableCell key={c} className={cn("whitespace-nowrap text-right tabular", (c === "opening" || c === "closing") && "bg-muted/40 font-semibold")}>
                        <Cell a={r[c]} measure={measure} signed={c === "count"} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {measure === "value" && !q && (
                <TableFooter>
                  <TableRow data-testid="turnover-totals">
                    <TableCell className="sticky left-0 z-10 bg-muted font-semibold">Jami</TableCell>
                    {COLS.map((c) => (
                      <TableCell key={c} className="whitespace-nowrap text-right font-bold tabular">
                        {c === "count" && data.turnover.totals.count > 0 ? "+" : ""}
                        {money(data.turnover.totals[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
        <p className="flex items-start gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Qoldiq daftaridagi harakatlar qayd etilgan vaqti bo'yicha, xarid narxlarida. Bekor qilingan hujjat o'zi bekor qilingan davrda ayiriladi. Davr boshi + kirim − chiqim ± inventarizatsiya = davr oxiri.
          {measure === "qty" ? " Miqdorlar har mahsulotning o'z birligida, shuning uchun jami qatori faqat summada." : ""}
        </p>
      </SectionCard>

      <DepartmentsSection departments={data?.departments} period={period} loading={isLoading || !data} canExport={canExport} total={data?.turnover.totals.department ?? 0} />
    </div>
  );
}

function Cell({ a, measure, signed }: { a: Amount; measure: Measure; signed?: boolean }) {
  const v = measure === "value" ? a.value : a.qty;
  if (v === 0) return <span className="text-muted-foreground/60">—</span>;
  const sign = signed && v > 0 ? "+" : "";
  return <span className={cn(signed && v < 0 && "text-rose-700 dark:text-rose-300", signed && v > 0 && "text-emerald-700 dark:text-emerald-300")}>{measure === "value" ? `${sign}${money(v)}` : `${sign}${fmtQty(v)}`}</span>;
}

function DepartmentsSection({ departments, period, loading, canExport, total }: { departments: DepartmentReport[] | undefined; period: string; loading: boolean; canExport: boolean; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...(departments ?? []).map((d) => d.value));
  return (
    <SectionCard
      icon={Building2}
      title="Bo'limlar bo'yicha chiqim"
      description={departments ? `${period} · jami ${money(total)}` : "Qaysi bo'limga nima berilgan"}
      action={
        canExport && departments?.length ? (
          <ExportButtons
            testIdPrefix="export-departments"
            build={() => ({
              filename: "bolimlar-boyicha-chiqim",
              title: "Ombor: bo'limlar bo'yicha chiqim",
              subtitle: period,
              columns: DEPT_EXPORT,
              rows: departments.flatMap((d) => d.items.map((i) => ({ dept: d.departmentName, item: i.itemName, unit: i.unit, quantity: i.quantity, value: i.value }))),
            })}
          />
        ) : undefined
      }
      flush
    >
      {loading || !departments ? (
        <div className="m-5 h-32 skeleton-shimmer rounded-lg" />
      ) : departments.length === 0 ? (
        <EmptyState icon={Building2} title="Bu davrda bo'limlarga berilmagan" description="Chiqim hujjatlari shu yerda bo'limlar bo'yicha jamlanadi." />
      ) : (
        <ul className="divide-y" data-testid="department-report">
          {departments.map((d) => (
            <li key={d.departmentId}>
              <button
                type="button"
                onClick={() => setOpen((o) => (o === d.departmentId ? null : d.departmentId))}
                aria-expanded={open === d.departmentId}
                className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                data-testid={`department-${d.departmentId}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.departmentName}</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(d.value / max) * 100}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular">{money(d.value)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.documents} ta hujjat · {d.items.length} ta mahsulot
                  </p>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === d.departmentId && "rotate-180")} />
              </button>
              {open === d.departmentId && (
                <Table className="table-premium border-t bg-muted/20">
                  <TableBody>
                    {d.items.map((i) => (
                      <TableRow key={i.itemId}>
                        <TableCell className="pl-8">{i.itemName}</TableCell>
                        <TableCell className="text-right tabular">
                          {fmtQty(i.quantity)} <span className="text-xs text-muted-foreground">{i.unit}</span>
                        </TableCell>
                        <TableCell className="pr-5 text-right tabular">{money(i.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
