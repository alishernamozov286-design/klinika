/**
 * Kassa bosh sahifasi va kunlik tushum (B7.7, TZ §9.1 "Kassa bosh sahifasi",
 * "Kunlik tushum"). Every figure from the money ledger, on the day the money
 * moved: shaping rules in shared/cash-report.ts.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarRange, ChevronRight, Clock, CreditCard, Landmark, ShieldCheck, Undo2, Wallet } from "lucide-react";
import type { PaymentMethod } from "@shared/schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/schema";
import { changePercent, methodShares, type CashDay, type CashOverview } from "@shared/cash-report";
import { LONG_SHIFT_HOURS, describeDuration } from "@shared/cash-shift";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, MeterBar, Money, SectionCard, StatCard, TableSkeleton } from "@/components/ui-kit";
import { FlowChart } from "@/components/flow-chart";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/lib/format";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { naqd: Banknote, karta: CreditCard, "o'tkazma": Landmark };

export type CashHomeTarget = "bills-due" | "refunds" | "shifts" | "daily";

function Trend({ now, before }: { now: number; before: number }) {
  const p = changePercent(now, before);
  if (p === null) return <span>O'tgan haftaning shu kuni: tushum bo'lmagan</span>;
  const up = p >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cn("h-3.5 w-3.5", up ? "text-emerald-600" : "text-rose-600")} aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(p)}% o'tgan haftaning shu kuniga nisbatan
    </span>
  );
}

function AttentionRow({ icon: Icon, tone, title, detail, onClick, testId }: { icon: typeof Wallet; tone: string; title: string; detail: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60" data-testid={testId}>
      <span className={cn("icon-tile h-9 w-9 shrink-0", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function CashHomeTab({ onOpen, onOpenBill }: { onOpen: (t: CashHomeTarget) => void; onOpenBill: (visitId: string) => void }) {
  const { data: o, isLoading } = useQuery<CashOverview>({ queryKey: ["/api/cashier/overview"], refetchOnMount: "always", refetchInterval: 60_000 });
  const shares = o ? methodShares(o.today) : [];
  const flow = useMemo(() => (o?.days ?? []).map((d) => ({ date: d.date, in: d.taken, out: d.refunded })), [o]);
  const attention = o
    ? [
        o.bills.due > 0 && { key: "due", icon: AlertTriangle, tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300", title: `Bugungi qarz: ${money(o.bills.due)}`, detail: `${o.bills.debtors.length} ta bemorda to'lanmagan xizmat`, target: "bills-due" as const },
        o.refunds.requested.count > 0 && { key: "req", icon: Undo2, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", title: `${o.refunds.requested.count} ta qaytarish tasdiq kutmoqda`, detail: money(o.refunds.requested.amount), target: "refunds" as const },
        o.refunds.approved.count > 0 && { key: "appr", icon: ShieldCheck, tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300", title: `${o.refunds.approved.count} ta tasdiqlangan qaytarish berilmagan`, detail: money(o.refunds.approved.amount), target: "refunds" as const },
        ...o.openShifts
          .filter((s) => s.hours >= LONG_SHIFT_HOURS)
          .map((s) => ({ key: s.id, icon: Clock, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300", title: `Smena №${s.number} ${describeDuration(s.hours)} ochiq`, detail: `${s.cashierName} — yopishni unutmang`, target: "shifts" as const })),
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6" data-testid="cash-home">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Bugungi tushum" value={o ? money(o.today.net) : "—"} hint={o ? <Trend now={o.today.net} before={o.weekAgo.net} /> : undefined} icon={Wallet} tone="emerald" isLoading={isLoading} onClick={() => onOpen("daily")} />
        <StatCard
          index={1}
          label="Bu oy"
          value={o ? money(o.month.net) : "—"}
          hint={o ? `${formatDate(o.month.from)} dan · ${o.month.payments} ta to'lov${o.month.refunded ? ` · qaytarilgan ${money(o.month.refunded)}` : ""}` : undefined}
          icon={CalendarRange}
          tone="violet"
          isLoading={isLoading}
          onClick={() => onOpen("daily")}
        />
        <StatCard index={2} label="Bugungi qarz" value={o ? money(o.bills.due) : "—"} hint={o ? `${o.bills.count} ta hisobvaraq, ${money(o.bills.amount)}` : undefined} icon={AlertTriangle} tone={o?.bills.due ? "rose" : "emerald"} isLoading={isLoading} onClick={() => onOpen("bills-due")} />
        <StatCard
          index={3}
          label="Qaytarishlar"
          value={o ? o.refunds.requested.count + o.refunds.approved.count : "—"}
          hint={o ? (o.refunds.requested.count || o.refunds.approved.count ? `${o.refunds.requested.count} tasdiq kutmoqda · ${o.refunds.approved.count} berilishi kerak` : "Kutayotgan qaytarish yo'q") : undefined}
          icon={Undo2}
          tone={o && o.refunds.requested.count + o.refunds.approved.count ? "amber" : "emerald"}
          isLoading={isLoading}
          onClick={() => onOpen("refunds")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="So'nggi 30 kun" description="Tushum nol chizig'idan yuqorida, qaytarilgan pul pastda — barcha to'lov usullari" className="xl:col-span-2">
          {isLoading || !o ? (
            <div className="h-64 skeleton-shimmer rounded-lg" />
          ) : (
            <FlowChart days={flow} inLabel="Tushum" outLabel="Qaytarildi" emptyTitle="30 kunda to'lov bo'lmagan" emptyDescription="Kassada to'lov qabul qilingach, kunlik tushum shu yerda ko'rinadi." testIdPrefix="cash-flow" />
          )}
        </SectionCard>
        <SectionCard title="Bugun qanday to'landi" description="Sof tushum (qaytarishlarsiz) to'lov usullari bo'yicha">
          {isLoading || !o ? (
            <div className="h-48 skeleton-shimmer rounded-lg" />
          ) : (
            <div className="space-y-4" data-testid="cash-methods">
              {shares.map((s) => {
                const Icon = METHOD_ICON[s.method];
                const m = o.today.byMethod[s.method];
                return (
                  <MeterBar
                    key={s.method}
                    value={s.share}
                    max={1}
                    label={
                      <>
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {PAYMENT_METHOD_LABELS[s.method]}
                        </span>
                        <span className="tabular">
                          <span className="font-semibold text-foreground">{money(m.net)}</span>
                          {m.refunded ? <span> · qaytarildi {money(m.refunded)}</span> : null} · {Math.round(s.share * 100)}%
                        </span>
                      </>
                    }
                  />
                );
              })}
              <div className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">To'lovlar</p>
                  <p className="font-semibold tabular">{o.today.payments}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Qaytarishlar</p>
                  <p className="font-semibold tabular">
                    {o.today.refunds}
                    {o.today.refunded ? <span className="ml-1 text-xs font-normal text-muted-foreground">({money(o.today.refunded)})</span> : null}
                  </p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="E'tibor talab qiladi" description="Har biri o'z bo'limini ochadi">
          {isLoading || !o ? (
            <div className="h-32 skeleton-shimmer rounded-lg" />
          ) : attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-testid="cash-attention-empty">
              Hammasi joyida: qarz, kutayotgan qaytarish yoki uzoq ochiq smena yo'q.
            </p>
          ) : (
            <div className="-m-1 space-y-1" data-testid="cash-attention">
              {attention.map((a) => a && <AttentionRow key={a.key} icon={a.icon} tone={a.tone} title={a.title} detail={a.detail} onClick={() => onOpen(a.target)} testId={`cash-attention-${a.key}`} />)}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Bugungi qarzdorlar" description="Eng katta qarzdan — bosilsa hisobvaraq ochiladi">
          {isLoading || !o ? (
            <div className="h-32 skeleton-shimmer rounded-lg" />
          ) : o.bills.debtors.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bugun qarzdor yo'q.</p>
          ) : (
            <ul className="-m-1 space-y-1" data-testid="cash-debtors">
              {o.bills.debtors.map((d) => (
                <li key={d.visitId}>
                  <button type="button" onClick={() => onOpenBill(d.visitId)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left hover:bg-muted/60" data-testid={`cash-debtor-${d.visitId}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.patientName}</span>
                      <span className="block text-xs text-muted-foreground tabular">#{d.patientNumber}</span>
                    </span>
                    <Money value={d.due} className="shrink-0 font-semibold text-rose-700 dark:text-rose-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- kunlik tushum

type Period = "month" | "last-month" | "week" | "30" | "custom";
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
  if (p === "week") return [localDay(-6), today];
  if (p === "30") return [localDay(-29), today];
  return custom;
}

const EXPORT_COLUMNS: ExportColumn<CashDay>[] = [
  { header: "Sana", value: (d) => formatDate(d.date), width: 12 },
  { header: "To'lovlar", value: (d) => d.payments, type: "number", total: true, width: 10 },
  ...PAYMENT_METHODS.map((m) => ({ header: PAYMENT_METHOD_LABELS[m], value: (d: CashDay) => d.byMethod[m].net, type: "money" as const, total: true, width: 16 })),
  { header: "Qaytarildi", value: (d) => d.refunded, type: "money", total: true, width: 14 },
  { header: "Sof tushum", value: (d) => d.net, type: "money", total: true, width: 16 },
];

export function DailyTakingsTab() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<[string, string]>([localDay(-6), localDay()]);
  const [hideQuiet, setHideQuiet] = useState(false);
  const [from, to] = periodRange(period, custom);
  const { data, isLoading } = useQuery<{ from: string; to: string; days: CashDay[]; total: CashDay }>({ queryKey: [`/api/cashier/daily?from=${from}&to=${to}`], refetchOnMount: "always" });
  const days = useMemo(() => [...(data?.days ?? [])].reverse().filter((d) => !hideQuiet || d.taken || d.refunded), [data, hideQuiet]);
  const t = data?.total;
  const working = (data?.days ?? []).filter((d) => d.taken).length;
  const periods: { key: Period; label: string }[] = [
    { key: "month", label: "Bu oy" },
    { key: "last-month", label: "O'tgan oy" },
    { key: "week", label: "7 kun" },
    { key: "30", label: "30 kun" },
    { key: "custom", label: "Davr…" },
  ];
  const subtitle = `${formatDate(from)} — ${formatDate(to)}`;

  return (
    <div className="space-y-4" data-testid="cash-daily">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Sof tushum" value={t ? money(t.net) : "—"} hint={subtitle} icon={Wallet} tone="emerald" isLoading={isLoading} />
        <StatCard index={1} label="Kunlik o'rtacha" value={t ? money(working ? Math.round(t.net / working) : 0) : "—"} hint={`${working} ta ish kuni bo'yicha`} icon={CalendarRange} tone="violet" isLoading={isLoading} />
        <StatCard index={2} label="To'lovlar" value={t ? t.payments : "—"} hint={t ? `Qabul qilingan: ${money(t.taken)}` : undefined} icon={Banknote} isLoading={isLoading} />
        <StatCard index={3} label="Qaytarilgan" value={t ? money(t.refunded) : "—"} hint={t ? `${t.refunds} ta qaytarish` : undefined} icon={Undo2} tone={t?.refunded ? "rose" : "emerald"} isLoading={isLoading} />
      </div>
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              data-testid={`daily-period-${p.key}`}
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
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={hideQuiet} onChange={(e) => setHideQuiet(e.target.checked)} className="accent-primary" data-testid="toggle-hide-quiet" />
            To'lovsiz kunlarni yashirish
          </label>
        </div>
        {can("data.export") && (
          <ExportButtons
            testIdPrefix="export-daily"
            disabled={isLoading}
            build={() => (data ? { filename: `kunlik-tushum-${from}-${to}`, title: "Kassa: kunlik tushum", subtitle, columns: EXPORT_COLUMNS, rows: [...data.days].filter((d) => !hideQuiet || d.taken || d.refunded) } : null)}
          />
        )}
      </div>
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : !days.length ? (
          <EmptyState icon={Wallet} title="Tushum yo'q" description="Bu davrda kassada to'lov qabul qilinmagan." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">To'lovlar</TableHead>
                  {PAYMENT_METHODS.map((m) => (
                    <TableHead key={m} className="hidden text-right md:table-cell">
                      {PAYMENT_METHOD_LABELS[m]}
                    </TableHead>
                  ))}
                  <TableHead className="hidden text-right sm:table-cell">Qaytarildi</TableHead>
                  <TableHead className="text-right">Sof tushum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => (
                  <TableRow key={d.date} className={cn(!d.taken && !d.refunded && "text-muted-foreground")} data-testid={`daily-row-${d.date}`}>
                    <TableCell className="whitespace-nowrap tabular">
                      {formatDate(d.date)}
                      <span className="block text-xs text-muted-foreground sm:hidden">{d.payments} ta to'lov</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">{d.payments || "—"}</TableCell>
                    {PAYMENT_METHODS.map((m) => (
                      <TableCell key={m} className="hidden text-right md:table-cell">
                        {d.byMethod[m].net ? <Money value={d.byMethod[m].net} /> : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="hidden text-right sm:table-cell">{d.refunded ? <Money value={-d.refunded} className="text-rose-700 dark:text-rose-300" /> : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{d.net || d.taken ? <Money value={d.net} /> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {t && (
                <TableFooter>
                  <TableRow className="font-semibold" data-testid="daily-total">
                    <TableCell>Jami</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">{t.payments}</TableCell>
                    {PAYMENT_METHODS.map((m) => (
                      <TableCell key={m} className="hidden text-right md:table-cell">
                        <Money value={t.byMethod[m].net} />
                      </TableCell>
                    ))}
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={-t.refunded} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={t.net} />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
