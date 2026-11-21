/**
 * Moliyaviy hisobot (B7.8, TZ §9.1 "Moliyaviy hisobotlar", §13): the
 * accountant's period report. Services rendered (accrual) and money moved
 * (cash) are shown apart — they differ by what is still owed and by money
 * taken for other periods. Rules: shared/finance-report.ts.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgePercent, Banknote, CalendarRange, Info, PiggyBank, Receipt, Stethoscope, TrendingDown, Wallet } from "lucide-react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/schema";
import type { FinanceFigures, FinanceReport } from "@shared/finance-report";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, MeterBar, Money, SectionCard, StatCard } from "@/components/ui-kit";
import { FlowChart } from "@/components/flow-chart";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportDoc } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/lib/format";

type Period = "month" | "last-month" | "year" | "30" | "custom";
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
  if (p === "year") return [`${today.slice(0, 4)}-01-01`, today];
  if (p === "30") return [localDay(-29), today];
  return custom;
}

function FiguresCells({ f, strong }: { f: FinanceFigures; strong?: boolean }) {
  return (
    <>
      <TableCell className="text-right tabular">{f.count}</TableCell>
      <TableCell className="hidden text-right lg:table-cell">
        <Money value={f.gross} />
      </TableCell>
      <TableCell className="hidden text-right md:table-cell">{f.discount ? <Money value={-f.discount} className="text-amber-700 dark:text-amber-300" /> : "—"}</TableCell>
      <TableCell className={cn("text-right", strong && "font-semibold")}>
        <Money value={f.net} />
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <Money value={f.paid} />
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">{f.due ? <Money value={f.due} className="text-rose-700 dark:text-rose-300" /> : "—"}</TableCell>
    </>
  );
}

function FiguresHead({ first }: { first: string }) {
  return (
    <TableRow>
      <TableHead>{first}</TableHead>
      <TableHead className="text-right">Soni</TableHead>
      <TableHead className="hidden text-right lg:table-cell">Narx</TableHead>
      <TableHead className="hidden text-right md:table-cell">Chegirma</TableHead>
      <TableHead className="text-right">Hisoblangan</TableHead>
      <TableHead className="hidden text-right sm:table-cell">To'langan</TableHead>
      <TableHead className="hidden text-right sm:table-cell">Qarz</TableHead>
    </TableRow>
  );
}

export function FinanceReportView() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<[string, string]>([localDay(-29), localDay()]);
  const [from, to] = periodRange(period, custom);
  const { data: r, isLoading } = useQuery<FinanceReport>({ queryKey: [`/api/reports/finance?from=${from}&to=${to}`], refetchOnMount: "always" });
  const flow = useMemo(() => (r?.days ?? []).map((d) => ({ date: d.date, in: d.taken, out: d.refunded })), [r]);
  const subtitle = `${formatDate(from)} — ${formatDate(to)}`;
  const periods: { key: Period; label: string }[] = [
    { key: "month", label: "Bu oy" },
    { key: "last-month", label: "O'tgan oy" },
    { key: "year", label: "Yil boshidan" },
    { key: "30", label: "30 kun" },
    { key: "custom", label: "Davr…" },
  ];
  const quiet = r && !r.services.total.count && !r.cash.taken && !r.expenses.total;

  const buildExport = (): ExportDoc<FinanceReport["services"]["byKind"][number]> | null => {
    if (!r) return null;
    const fig = (f: FinanceFigures) => [f.count, f.gross, f.discount, f.net, f.paid, f.due];
    const figCols = [
      { header: "Soni", type: "number" as const, width: 10 },
      { header: "Narx", type: "money" as const, width: 16 },
      { header: "Chegirma", type: "money" as const, width: 14 },
      { header: "Hisoblangan", type: "money" as const, width: 16 },
      { header: "To'langan", type: "money" as const, width: 16 },
      { header: "Qarz", type: "money" as const, width: 14 },
    ];
    return {
      filename: `moliyaviy-hisobot-${from}-${to}`,
      title: "Moliyaviy hisobot",
      subtitle,
      orientation: "landscape",
      columns: [
        { header: "Xizmat turi", value: (k) => k.label, width: 22 },
        { header: "Soni", value: (k) => k.count, type: "number", total: true, width: 10 },
        { header: "Narx", value: (k) => k.gross, type: "money", total: true, width: 16 },
        { header: "Chegirma", value: (k) => k.discount, type: "money", total: true, width: 14 },
        { header: "Hisoblangan", value: (k) => k.net, type: "money", total: true, width: 16 },
        { header: "To'langan", value: (k) => k.paid, type: "money", total: true, width: 16 },
        { header: "Qarz", value: (k) => k.due, type: "money", total: true, width: 14 },
      ],
      rows: r.services.byKind,
      sections: [
        {
          title: "Natija (kassa bo'yicha)",
          columns: [{ header: "Ko'rsatkich", width: 30 }, { header: "Summa", type: "money", width: 18 }],
          rows: [
            ["Kassaga tushdi (qabul qilingan)", r.cash.taken],
            ["Qaytarilgan", -r.cash.refunded],
            ["Sof tushum", r.result.collected],
            ["Xarajatlar", -r.result.expenses],
            ["Sof foyda", r.result.profit],
            ["Hozirgi qarzdorlik (barcha davrlar)", r.debt.due],
          ],
        },
        {
          title: "To'lov usullari",
          columns: [{ header: "Usul", width: 20 }, { header: "Qabul qilindi", type: "money", width: 16 }, { header: "Qaytarildi", type: "money", width: 16 }, { header: "Sof", type: "money", width: 16 }],
          rows: PAYMENT_METHODS.map((m) => [PAYMENT_METHOD_LABELS[m], r.cash.byMethod[m].taken, r.cash.byMethod[m].refunded, r.cash.byMethod[m].net]),
        },
        { title: "Xizmatlar daromadi", columns: [{ header: "Xizmat", width: 30 }, ...figCols], rows: r.services.byService.map((s) => [s.name, ...fig(s)]) },
        ...(r.services.byDoctor.length ? [{ title: "Shifokorlar faoliyati", columns: [{ header: "Shifokor", width: 26 }, ...figCols], rows: r.services.byDoctor.map((d) => [d.doctorName, ...fig(d)]) }] : []),
        ...(r.expenses.byCategory.length
          ? [{ title: "Xarajatlar", columns: [{ header: "Kategoriya", width: 24 }, { header: "Soni", type: "number" as const, width: 10 }, { header: "Summa", type: "money" as const, width: 16 }], rows: r.expenses.byCategory.map((c) => [c.category, c.count, c.amount]) }]
          : []),
      ],
    };
  };

  return (
    <div className="space-y-6" data-testid="finance-report">
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              data-testid={`finance-period-${p.key}`}
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
        {can("data.export") && <ExportButtons testIdPrefix="export-finance" disabled={isLoading} build={buildExport} />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Sof tushum (kassa)" value={r ? money(r.result.collected) : "—"} hint={r ? `Qabul qilindi ${money(r.cash.taken)} · qaytarildi ${money(r.cash.refunded)}` : undefined} icon={Wallet} tone="emerald" isLoading={isLoading} />
        <StatCard index={1} label="Xarajatlar" value={r ? money(r.result.expenses) : "—"} hint={r ? `${r.expenses.count} ta yozuv` : undefined} icon={TrendingDown} tone="rose" isLoading={isLoading} />
        <StatCard index={2} label="Sof foyda" value={r ? money(r.result.profit) : "—"} hint={r?.result.margin !== null && r ? `Rentabellik ${r.result.margin}%` : "Tushum yo'q"} icon={PiggyBank} tone={r && r.result.profit < 0 ? "rose" : "violet"} isLoading={isLoading} />
        <StatCard index={3} label="Hozirgi qarzdorlik" value={r ? money(r.debt.due) : "—"} hint={r ? `${r.debt.debtors} ta bemor · barcha davrlar` : undefined} icon={AlertTriangle} tone={r?.debt.due ? "amber" : "emerald"} isLoading={isLoading} />
      </div>

      {isLoading || !r ? (
        <div className="h-80 skeleton-shimmer rounded-2xl" />
      ) : quiet ? (
        <div className="card-premium">
          <EmptyState icon={Receipt} title="Bu davrda moliyaviy harakat yo'q" description="Boshqa davrni tanlang." />
        </div>
      ) : (
        <>
          <SectionCard icon={Stethoscope} title="Ko'rsatilgan xizmatlar" description="Davrda ko'rsatilgan xizmatlar (hisoblash usuli): narx, chegirma, hisoblangan summa va shundan hozirgacha to'langani">
            <div className="-mx-1 overflow-x-auto" data-testid="finance-kinds">
              <Table>
                <TableHeader>
                  <FiguresHead first="Xizmat turi" />
                </TableHeader>
                <TableBody>
                  {r.services.byKind.map((k) => (
                    <TableRow key={k.kind} data-testid={`finance-kind-${k.kind}`}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <FiguresCells f={k} />
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-semibold" data-testid="finance-kinds-total">
                    <TableCell>Jami</TableCell>
                    <FiguresCells f={r.services.total} strong />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard icon={Banknote} title="Pul oqimi" description="Kassa bo'yicha: qabul qilingan va qaytarilgan pul kunlar kesimida" className="xl:col-span-2">
              <FlowChart days={flow} inLabel="Qabul qilindi" outLabel="Qaytarildi" emptyTitle="Davrda to'lov bo'lmagan" emptyDescription="To'lovlar qabul qilingach, kunlik summa shu yerda ko'rinadi." period={subtitle} testIdPrefix="finance-flow" />
              <div className="mt-4 overflow-x-auto">
                <Table data-testid="finance-methods">
                  <TableHeader>
                    <TableRow>
                      <TableHead>To'lov usuli</TableHead>
                      <TableHead className="text-right">Qabul qilindi</TableHead>
                      <TableHead className="text-right">Qaytarildi</TableHead>
                      <TableHead className="text-right">Sof</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PAYMENT_METHODS.map((m) => (
                      <TableRow key={m}>
                        <TableCell>{PAYMENT_METHOD_LABELS[m]}</TableCell>
                        <TableCell className="text-right">
                          <Money value={r.cash.byMethod[m].taken} />
                        </TableCell>
                        <TableCell className="text-right">{r.cash.byMethod[m].refunded ? <Money value={-r.cash.byMethod[m].refunded} /> : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">
                          <Money value={r.cash.byMethod[m].net} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
            <SectionCard icon={PiggyBank} title="Natija" description="Kassa bo'yicha: to'lanmagan hisobvaraq qo'ldagi pul emas">
              <dl className="space-y-2 text-sm" data-testid="finance-result">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Qabul qilindi</dt>
                  <dd className="tabular">{money(r.cash.taken)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">− Qaytarildi</dt>
                  <dd className="tabular">{money(r.cash.refunded)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-medium">
                  <dt>Sof tushum</dt>
                  <dd className="tabular">{money(r.result.collected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">− Xarajatlar</dt>
                  <dd className="tabular">{money(r.result.expenses)}</dd>
                </div>
                <div className={cn("flex justify-between border-t pt-2 text-base font-bold", r.result.profit < 0 && "text-rose-700 dark:text-rose-300")}>
                  <dt>Sof foyda</dt>
                  <dd className="tabular" data-testid="finance-profit">
                    {money(r.result.profit)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 space-y-1.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <BadgePercent className="h-3.5 w-3.5" />
                  Chegirmalar: {money(r.discounts.total)}
                </p>
                <p>Davr xizmatlariga berilgan chegirma{r.discounts.given ? `; hisobvaraq orqali ${r.discounts.given} marta` : ""}.</p>
                <p className="flex items-start gap-1.5 pt-1">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Hisoblangan ({money(r.services.total.net)}) va sof tushum farqi — davr xizmatlaridan hali to'lanmagani ({money(r.services.total.due)}) va boshqa davr xizmatlari uchun olingan pul.
                </p>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard icon={Receipt} title="Xizmatlar daromadi" description="Har bir xizmat bo'yicha, eng kattasidan">
              <div className="-mx-1 max-h-96 overflow-auto" data-testid="finance-services">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Xizmat</TableHead>
                      <TableHead className="text-right">Soni</TableHead>
                      <TableHead className="text-right">Hisoblangan</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">To'langan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.services.byService.map((s) => (
                      <TableRow key={`${s.kind}|${s.name}`}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right tabular">{s.count}</TableCell>
                        <TableCell className="text-right">
                          <Money value={s.net} />
                        </TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          <Money value={s.paid} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
            <SectionCard icon={Stethoscope} title="Shifokorlar faoliyati" description="Ko'rik, UZI va muolajalar — qabullar soni va summasi">
              {r.services.byDoctor.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Bu davrda shifokor qabuli bo'lmagan.</p>
              ) : (
                <div className="space-y-3" data-testid="finance-doctors">
                  {r.services.byDoctor.map((d) => (
                    <MeterBar
                      key={d.doctorName}
                      value={d.net}
                      max={r.services.byDoctor[0].net || 1}
                      label={
                        <>
                          <span className="text-foreground">{d.doctorName}</span>
                          <span className="tabular">
                            {d.count} ta qabul · <span className="font-semibold text-foreground">{money(d.net)}</span>
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {r.expenses.byCategory.length > 0 && (
            <SectionCard icon={CalendarRange} title="Xarajatlar" description="Kategoriyalar bo'yicha (bekor qilinganlarsiz)">
              <div className="grid gap-3 sm:grid-cols-2" data-testid="finance-expenses">
                {r.expenses.byCategory.map((c) => (
                  <MeterBar
                    key={c.category}
                    value={c.amount}
                    max={r.expenses.byCategory[0].amount || 1}
                    barClassName="bg-rose-500"
                    label={
                      <>
                        <span className="text-foreground">{c.category}</span>
                        <span className="tabular">
                          {c.count} ta · <span className="font-semibold text-foreground">{money(c.amount)}</span>
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
