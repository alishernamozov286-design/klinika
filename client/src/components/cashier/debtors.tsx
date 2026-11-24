/**
 * Qarzdorlik (B7.3, TZ §9.1 "Qarzdorlik"): every patient still owing across all
 * their visits, largest first, with how old the oldest unpaid bill is. A row
 * opens the patient's owing bills; each opens the bill to take the payment.
 * Rules: shared/debt.ts.
 */
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Phone, Receipt, UserRound, Users } from "lucide-react";
import type { BillSummary } from "@shared/schema";
import { DEBT_AGES, DEBT_AGE_LABELS, daysSince, debtAge, type DebtAge, type DebtSummary, type DebtorRow } from "@shared/debt";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, StatCard, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate, formatPhone, money, phoneMatches } from "@/lib/format";
import { liveInterval } from "@/lib/live-updates";

const AGE_TONE: Record<DebtAge, string> = {
  week: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  month: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  quarter: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  older: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
};

type DebtorsResponse = { today: string; rows: DebtorRow[]; summary: DebtSummary };

function OwingBills({ patientId, onOpenBill }: { patientId: string; onOpenBill: (visitId: string) => void }) {
  const { data: bills, isLoading } = useQuery<BillSummary[]>({ queryKey: [`/api/bills?patientId=${patientId}&status=due`], refetchOnMount: "always" });
  if (isLoading || !bills) return <div className="h-12 skeleton-shimmer rounded-lg" />;
  return (
    <ul className="divide-y rounded-lg border bg-card" data-testid={`debtor-bills-${patientId}`}>
      {bills.map((b) => (
        <li key={b.visitId}>
          <button type="button" onClick={() => onOpenBill(b.visitId)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60" data-testid={`debtor-bill-${b.visitId}`}>
            <span className="flex min-w-0 items-center gap-2">
              <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {formatDate(b.visitDate)}
                {b.invoiceNumber ? ` · Hisobvaraq №${b.invoiceNumber}` : ""}
                <span className="text-muted-foreground"> · {[b.appointments ? `${b.appointments} ta qabul` : "", b.orders ? `${b.orders} ta lab buyurtma` : ""].filter(Boolean).join(", ")}</span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <Money value={b.totals.due} className="font-semibold text-rose-700 dark:text-rose-300" />
              <span className="block text-xs text-muted-foreground">{money(b.totals.amount)} dan</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DebtorsTab({ onOpenBill }: { onOpenBill: (visitId: string) => void }) {
  const { can } = useAuth();
  const { data, isLoading } = useQuery<DebtorsResponse>({ queryKey: ["/api/debtors"], refetchOnMount: "always", refetchInterval: liveInterval(60_000) });
  const [age, setAge] = useState<DebtAge | "all">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const today = data?.today ?? "";
  const s = data?.summary;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (age === "all" || debtAge(r.oldest, today) === age) &&
        (!q || r.patientName.toLowerCase().includes(q) || String(r.patientNumber) === q.replace("#", "") || phoneMatches(r.phone, q)),
    );
  }, [data, age, search, today]);
  const stale = s ? s.byAge.quarter.due + s.byAge.older.due : 0;

  const columns: ExportColumn<DebtorRow>[] = [
    { header: "Bemor ID", value: (r) => r.patientNumber, type: "number", width: 10 },
    { header: "F.I.Sh.", value: (r) => r.patientName, width: 28 },
    { header: "Telefon", value: (r) => formatPhone(r.phone), width: 18 },
    { header: "Qarzli tashriflar", value: (r) => r.bills, type: "number", total: true, width: 12 },
    { header: "Eng eski qarz", value: (r) => formatDate(r.oldest), width: 12 },
    { header: "Kun", value: (r) => daysSince(r.oldest, today), type: "number", width: 8 },
    { header: "Qarz", value: (r) => r.due, type: "money", total: true, width: 16 },
  ];

  return (
    <div className="space-y-4" data-testid="debtors-tab">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Jami qarz" value={s ? money(s.due) : "—"} hint="Barcha kunlar bo'yicha" icon={AlertTriangle} tone={s?.due ? "rose" : "emerald"} isLoading={isLoading} />
        <StatCard index={1} label="Qarzdorlar" value={s ? s.debtors : "—"} hint={s ? `${s.bills} ta qarzli hisobvaraq` : undefined} icon={Users} isLoading={isLoading} />
        <StatCard index={2} label="30 kundan eski qarz" value={s ? money(stale) : "—"} hint={s ? `${s.byAge.quarter.debtors + s.byAge.older.debtors} ta bemor` : undefined} icon={Clock} tone={stale ? "amber" : "emerald"} isLoading={isLoading} onClick={() => setAge("older")} />
        <StatCard index={3} label="Bu hafta paydo bo'lgan" value={s ? money(s.byAge.week.due) : "—"} hint={s ? `${s.byAge.week.debtors} ta bemor` : undefined} icon={Receipt} tone="violet" isLoading={isLoading} onClick={() => setAge("week")} />
      </div>

      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Qarz yoshi">
          {(["all", ...DEBT_AGES] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={age === a}
              onClick={() => setAge(a)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", age === a ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
              data-testid={`debt-age-${a}`}
            >
              {a === "all" ? "Hammasi" : DEBT_AGE_LABELS[a]}
              {s && <span className="ml-1 tabular opacity-80">({a === "all" ? s.debtors : s.byAge[a].debtors})</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="F.I.Sh., ID yoki telefon…" className="lg:w-64" data-testid="input-search-debtors" />
          {can("data.export") && (
            <ExportButtons
              testIdPrefix="export-debtors"
              disabled={isLoading}
              build={() => ({ filename: `qarzdorlar-${today}`, title: "Kassa: qarzdorlar", subtitle: `${formatDate(today)} holatiga · ${age === "all" ? "barcha" : DEBT_AGE_LABELS[age]} · ${rows.length} ta bemor`, columns, rows })}
            />
          )}
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="Qarzdor yo'q" description={data?.rows.length ? "Bu tanlov bo'yicha qarzdor topilmadi." : "Barcha hisobvaraqlar to'langan."} />
        ) : (
          <div className="overflow-x-hidden md:overflow-x-auto">
            {/* On phones the extra columns fold into the first one, so nothing needs to scroll sideways. */}
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Bemor</TableHead>
                  <TableHead className="hidden md:table-cell">Eng eski qarz</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Tashriflar</TableHead>
                  <TableHead className="text-right">Qarz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const a = debtAge(r.oldest, today);
                  const expanded = open === r.patientId;
                  return (
                    <Fragment key={r.patientId}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(expanded ? null : r.patientId)} aria-expanded={expanded} data-testid={`row-debtor-${r.patientNumber}`}>
                        <TableCell>
                          <p className="flex items-center gap-1.5 font-medium">
                            {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            {r.patientName}
                          </p>
                          <p className="pl-5 text-xs text-muted-foreground">
                            <span className="tabular">#{r.patientNumber}</span>
                            {r.phone && (
                              <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="ml-2 inline-flex items-center gap-1 hover:text-primary">
                                <Phone className="h-3 w-3" />
                                {formatPhone(r.phone)}
                              </a>
                            )}
                          </p>
                          <p className="pl-5 text-xs md:hidden">
                            <Badge variant="outline" className={cn("mt-1 font-medium", AGE_TONE[a])}>
                              {daysSince(r.oldest, today)} kun · {formatDate(r.oldest)} dan
                            </Badge>
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={cn("font-medium", AGE_TONE[a])} data-testid={`debt-age-badge-${r.patientNumber}`}>
                            {daysSince(r.oldest, today)} kun
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground tabular">
                            {formatDate(r.oldest)}
                            {r.latest !== r.oldest ? ` — ${formatDate(r.latest)}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="hidden text-right tabular sm:table-cell">{r.bills}</TableCell>
                        <TableCell className="text-right">
                          <Money value={r.due} className="font-semibold text-rose-700 dark:text-rose-300" />
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={4} className="bg-muted/30">
                            {/* w-0 min-w-full: the bills fill the row but never widen the table. */}
                            <div className="w-0 min-w-full space-y-2 py-1">
                              <OwingBills patientId={r.patientId} onOpenBill={onOpenBill} />
                              <Link href={`/patients/${r.patientId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                                <UserRound className="h-3.5 w-3.5" />
                                Bemor kartasi
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
