import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import {
  Ban,
  Banknote,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  FlaskConical,
  Landmark,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  cancelExpenseSchema,
  insertExpenseSchema,
  localDayString,
  type Expense,
  type ExpenseCategory,
  type ExpenseSummary,
  type PaymentMethod,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, Money, PageHeader, Pagination, SectionCard, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput, SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDate, formatDateTime, money, moneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

// ------------------------------------------------------------------ meta

/** One glyph and colour per category, used on badges, the breakdown and the form. */
const CATEGORY_META: Record<ExpenseCategory, { icon: LucideIcon; tone: string; bar: string }> = {
  Reaktivlar: { icon: FlaskConical, tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300", bar: "bg-emerald-500" },
  "Ish haqi": { icon: Users, tone: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300", bar: "bg-sky-500" },
  Ijara: { icon: Building2, tone: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300", bar: "bg-violet-500" },
  Kommunal: { icon: Zap, tone: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300", bar: "bg-amber-500" },
  Jihoz: { icon: Wrench, tone: "bg-slate-500/10 text-slate-700 border-slate-500/25 dark:text-slate-300", bar: "bg-slate-500" },
  Soliq: { icon: Landmark, tone: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300", bar: "bg-rose-500" },
  Boshqa: { icon: Package, tone: "bg-zinc-500/10 text-zinc-700 border-zinc-500/25 dark:text-zinc-300", bar: "bg-zinc-400" },
};
const categoryMeta = (c: string) => CATEGORY_META[c as ExpenseCategory] ?? CATEGORY_META.Boshqa;

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = { naqd: Banknote, karta: CreditCard, "o'tkazma": Landmark };
const methodLabel = (m: string) => PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m;

/** Shared by the Excel and PDF writers — see lib/export.ts. */
const EXPORT_COLUMNS: ExportColumn<Expense>[] = [
  { header: "Sana", value: (e) => formatDate(e.spentOn), width: 12 },
  { header: "Kategoriya", value: (e) => e.category, width: 14 },
  { header: "Oluvchi", value: (e) => e.payee ?? "", width: 22 },
  { header: "Izoh", value: (e) => e.note ?? "", width: 32 },
  { header: "To'lov", value: (e) => methodLabel(e.method), width: 14 },
  { header: "Kiritdi", value: (e) => e.createdByName ?? "", width: 18 },
  { header: "Summa", value: (e) => e.amount, type: "money", width: 16, total: true },
];

// ---------------------------------------------------------------- periods

type Range = { from: string; to: string };
const day = (d: Date) => localDayString(d);

/** The ranges an owner actually asks about, in the order they ask. */
const PRESETS: { key: string; label: string; range: () => Range }[] = [
  {
    key: "month",
    label: "Bu oy",
    range: () => {
      const n = new Date();
      return { from: day(new Date(n.getFullYear(), n.getMonth(), 1)), to: day(n) };
    },
  },
  {
    key: "lastMonth",
    label: "O'tgan oy",
    range: () => {
      const n = new Date();
      return { from: day(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: day(new Date(n.getFullYear(), n.getMonth(), 0)) };
    },
  },
  {
    key: "30",
    label: "30 kun",
    range: () => {
      const n = new Date();
      return { from: day(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), to: day(n) };
    },
  },
  {
    key: "quarter",
    label: "Chorak",
    range: () => {
      const n = new Date();
      return { from: day(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)), to: day(n) };
    },
  },
  {
    key: "year",
    label: "Bu yil",
    range: () => {
      const n = new Date();
      return { from: day(new Date(n.getFullYear(), 0, 1)), to: day(n) };
    },
  },
];

/**
 * Daily bars for a month, monthly bars for a year: past about two months a
 * bar per day is too thin to read.
 */
function chartSeries(daily: ExpenseSummary["daily"]) {
  if (daily.length <= 62) {
    return daily.map((d) => ({
      label: `${d.date.slice(8, 10)}.${d.date.slice(5, 7)}`,
      full: formatDate(d.date),
      amount: d.amount,
    }));
  }
  const months = new Map<string, number>();
  for (const d of daily) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.amount);
  return [...months.entries()].map(([m, amount]) => ({
    label: `${m.slice(5, 7)}.${m.slice(2, 4)}`,
    full: `${m.slice(5, 7)}.${m.slice(0, 4)}`,
    amount,
  }));
}

type ExpenseResponse = { items: Expense[]; total: number; total_amount: number };

// =================================================================== page

export default function Expenses() {
  const { toast } = useToast();
  const { can } = useAuth();
  const canManage = can("expenses.manage");

  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState<Range>(PRESETS[0].range);
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [showCancelled, setShowCancelled] = useState(false);
  const [page, setPage] = useState(0);

  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Expense | null>(null);

  useEffect(() => setPage(0), [range, category, method, debouncedSearch, showCancelled]);

  const filters = new URLSearchParams({
    from: range.from,
    to: range.to,
    ...(category !== "all" && { category }),
    ...(method !== "all" && { method }),
    ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
    status: showCancelled ? "all" : "active",
  });
  const listUrl = `/api/expenses?${filters}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;

  const { data, isLoading, isFetching } = useQuery<ExpenseResponse>({
    queryKey: [listUrl],
    placeholderData: keepPreviousData,
  });
  const { data: summary, isLoading: summaryLoading } = useQuery<ExpenseSummary>({
    queryKey: [`/api/expenses/summary?from=${range.from}&to=${range.to}`],
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtered = category !== "all" || method !== "all" || Boolean(debouncedSearch.trim());

  const delta = useMemo(() => {
    if (!summary || summary.previous.total === 0) return null;
    return ((summary.total - summary.previous.total) / summary.previous.total) * 100;
  }, [summary]);

  const series = useMemo(() => chartSeries(summary?.daily ?? []), [summary]);
  const topCategory = summary?.byCategory[0];

  const pickPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setRange(p.range());
  };
  const setDate = (patch: Partial<Range>) => {
    setPreset("custom");
    setRange((r) => ({ ...r, ...patch }));
  };
  const resetFilters = () => {
    setCategory("all");
    setMethod("all");
    setSearch("");
  };

  const isCancelled = (e: Expense) => e.status === "cancelled";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Moliya"
        title="Xarajatlar"
        description="Klinika xarajatlari — hisobotdagi sof foyda shu yerdan hisoblanadi"
        actions={
          <>
            <ExportButtons
              testIdPrefix="export-expenses"
              disabled={isLoading}
              build={() => ({
                filename: "xarajatlar",
                title: "Xarajatlar",
                subtitle: `${formatDate(range.from)} — ${formatDate(range.to)} · ${items.length} ta yozuv (${page + 1}-sahifa, jami ${total} ta)`,
                columns: EXPORT_COLUMNS,
                rows: items.filter((e) => !isCancelled(e)),
              })}
            />
            {can("data.export") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild aria-label="Butun davrni CSV yuklab olish">
                    <a href={`/api/export/expenses.csv?${filters}`} data-testid="link-export-expenses">
                      <Database className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Filtr bo'yicha butun davr (CSV)</TooltipContent>
              </Tooltip>
            )}
            {canManage && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="shadow-brand"
                data-testid="button-add-expense"
              >
                <Plus className="mr-2 h-4 w-4" />
                Xarajat qo'shish
              </Button>
            )}
          </>
        }
      />

      {/* ------------------------------------------------------------ period */}
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => pickPreset(p.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                preset === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`preset-${p.key}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => e.target.value && setDate({ from: e.target.value })}
            className="h-9 w-[150px]"
            aria-label="Boshlanish sanasi"
            data-testid="input-expense-from"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => e.target.value && setDate({ to: e.target.value })}
            className="h-9 w-[150px]"
            aria-label="Tugash sanasi"
            data-testid="input-expense-to"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          icon={Wallet}
          tone="rose"
          label="Davr xarajati"
          value={money(summary?.total ?? 0, false)}
          suffix="so'm"
          isLoading={summaryLoading}
          hint={
            delta === null ? (
              "O'tgan davrda xarajat yo'q"
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  delta > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {delta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}% o'tgan davrga nisbatan
              </span>
            )
          }
        />
        <StatCard
          index={1}
          icon={Receipt}
          label="Yozuvlar"
          value={summary?.count ?? 0}
          isLoading={summaryLoading}
          hint={
            summary?.cancelled.count
              ? `${summary.cancelled.count} ta bekor qilingan hisobga olinmadi`
              : "Faol xarajatlar soni"
          }
        />
        <StatCard
          index={2}
          icon={BarChart3}
          tone="violet"
          label="O'rtacha xarajat"
          value={money(summary?.average ?? 0, false)}
          suffix="so'm"
          isLoading={summaryLoading}
          hint={summary?.largest ? `Eng kattasi: ${money(summary.largest)}` : "—"}
        />
        <StatCard
          index={3}
          icon={topCategory ? categoryMeta(topCategory.category).icon : Package}
          tone="amber"
          label="Eng katta yo'nalish"
          value={topCategory?.category ?? "—"}
          isLoading={summaryLoading}
          hint={
            topCategory && summary?.total
              ? `${money(topCategory.amount)} · ${Math.round((topCategory.amount / summary.total) * 100)}%`
              : "Ma'lumot yo'q"
          }
        />
      </div>

      {/* ---------------------------------------------------- chart + split */}
      <div className="grid gap-5 xl:grid-cols-5">
        <SectionCard
          className="xl:col-span-3"
          icon={BarChart3}
          title="Xarajatlar dinamikasi"
          description={(summary?.daily.length ?? 0) > 62 ? "Oylar bo'yicha" : "Kunlar bo'yicha"}
        >
          {summaryLoading ? (
            <div className="h-[260px] rounded-xl skeleton-shimmer" />
          ) : (summary?.total ?? 0) === 0 ? (
            <EmptyState icon={BarChart3} title="Bu davrda xarajat yo'q" description="Davrni o'zgartirib ko'ring." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tickFormatter={(v: number) => moneyShort(v)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.6)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(_l, p) => (p?.[0]?.payload as { full?: string } | undefined)?.full ?? ""}
                  formatter={(v: number) => [money(v), "Xarajat"]}
                />
                <Bar dataKey="amount" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          icon={Wallet}
          title="Yo'nalishlar bo'yicha"
          description="Bosib, ro'yxatni shu kategoriya bilan filtrlang"
          bodyClassName="space-y-1.5"
        >
          {summaryLoading ? (
            <div className="h-[220px] rounded-xl skeleton-shimmer" />
          ) : !summary || summary.byCategory.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Ma'lumot yo'q</p>
          ) : (
            <>
              {summary.byCategory.map((c) => {
                const meta = categoryMeta(c.category);
                const share = summary.total ? (c.amount / summary.total) * 100 : 0;
                const active = category === c.category;
                return (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => setCategory(active ? "all" : c.category)}
                    className={cn(
                      "w-full rounded-xl border p-2.5 text-left transition-colors hover:bg-muted/40",
                      active ? "border-primary/40 bg-primary/[0.04]" : "border-transparent",
                    )}
                    data-testid={`breakdown-${c.category}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("icon-tile h-8 w-8 shrink-0 border", meta.tone)}>
                        <meta.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {c.category}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{c.count} ta</span>
                          </span>
                          <Money value={c.amount} className="shrink-0 text-sm font-semibold" />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", meta.bar)} style={{ width: `${share}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right text-[11px] tabular text-muted-foreground">
                            {share.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {summary.byMethod.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t pt-3">
                  {summary.byMethod.map((m) => {
                    const Icon = METHOD_ICONS[m.method as PaymentMethod] ?? Wallet;
                    return (
                      <Badge key={m.method} variant="secondary" className="gap-1.5 font-normal">
                        <Icon className="h-3 w-3" />
                        {methodLabel(m.method)} · <span className="font-semibold tabular">{moneyShort(m.amount)}</span>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* ------------------------------------------------------------ ledger */}
      <div className="card-premium overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Oluvchi yoki izoh bo'yicha qidirish"
            className="lg:max-w-xs"
            data-testid="input-search-expenses"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="lg:w-44" data-testid="select-filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha kategoriyalar</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="lg:w-48" data-testid="select-filter-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha to'lov usullari</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="mr-1 h-3.5 w-3.5" />
              Tozalash
            </Button>
          )}
          <div className="flex items-center gap-3 lg:ml-auto">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showCancelled} onCheckedChange={setShowCancelled} data-testid="switch-show-cancelled" />
              Bekor qilinganlar
            </label>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={filtered ? "Hech narsa topilmadi" : "Bu davrda xarajat yo'q"}
            description={
              filtered
                ? "Filtrlarni o'zgartirib ko'ring."
                : "Xarajat qo'shsangiz, hisobotdagi sof foyda shunga qarab hisoblanadi."
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={resetFilters}>
                  Filtrlarni tozalash
                </Button>
              ) : canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Xarajat qo'shish
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Sana</TableHead>
                  <TableHead>Kategoriya</TableHead>
                  <TableHead>Oluvchi va izoh</TableHead>
                  <TableHead className="hidden md:table-cell">To'lov</TableHead>
                  <TableHead className="hidden lg:table-cell">Kiritdi</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => {
                  const meta = categoryMeta(e.category);
                  const MethodIcon = METHOD_ICONS[e.method] ?? Wallet;
                  const off = isCancelled(e);
                  return (
                    <TableRow key={e.id} className={cn(off && "bg-muted/30")} data-testid={`row-expense-${e.id}`}>
                      <TableCell className={cn("tabular text-muted-foreground", off && "line-through")}>
                        {formatDate(e.spentOn)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1.5 font-medium", meta.tone, off && "opacity-50")}>
                          <meta.icon className="h-3 w-3" />
                          {e.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[340px]">
                        <p className={cn("truncate text-sm font-medium", off && "text-muted-foreground line-through")}>
                          {e.payee || <span className="font-normal text-muted-foreground">Oluvchi ko'rsatilmagan</span>}
                        </p>
                        {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
                        {off && (
                          <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                            <Ban className="h-3 w-3" />
                            Bekor qilingan: {e.cancelReason}
                            <span className="text-muted-foreground">
                              · {e.cancelledByName}, {formatDateTime(e.cancelledAt)}
                            </span>
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MethodIcon className="h-3.5 w-3.5" />
                          {methodLabel(e.method)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {e.createdByName || "—"}
                        {e.updatedAt && <span className="block text-[11px]">tahrirlangan</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={e.amount} className={cn("font-semibold", off && "text-muted-foreground line-through")} />
                      </TableCell>
                      <TableCell>
                        {canManage && !off && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Amallar" data-testid={`menu-expense-${e.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(e);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setCancelling(e)}
                                data-testid={`button-cancel-expense-${e.id}`}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Bekor qilish
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {filtered ? "Filtr bo'yicha jami" : "Davr bo'yicha jami"} · {total} ta yozuv
            </span>
            <Money value={data?.total_amount ?? 0} className="font-bold" />
          </div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} isFetching={isFetching} />
      </div>

      <ExpenseDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} />
      <CancelDialog
        expense={cancelling}
        onClose={() => setCancelling(null)}
        onDone={() => {
          setCancelling(null);
          toast({ title: "Xarajat bekor qilindi", description: "Yozuv saqlanib qoldi, hisobotlarga kirmaydi" });
        }}
      />
    </div>
  );
}

// ================================================================= dialogs

function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: Expense | null;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<ExpenseCategory>("Reaktivlar");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("naqd");
  const [payee, setPayee] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(() => localDayString(new Date()));
  const [error, setError] = useState<string | null>(null);

  const { data: payees = [] } = useQuery<string[]>({ queryKey: ["/api/expenses/payees"], enabled: open });

  useEffect(() => {
    if (!open) return;
    setCategory((expense?.category as ExpenseCategory) ?? "Reaktivlar");
    setAmount(expense?.amount ?? 0);
    setMethod(expense?.method ?? "naqd");
    setPayee(expense?.payee ?? "");
    setNote(expense?.note ?? "");
    setSpentOn(expense?.spentOn ?? localDayString(new Date()));
    setError(null);
  }, [open, expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      // The server's own schema, so the form and the API cannot disagree.
      const parsed = insertExpenseSchema.safeParse({ category, amount, method, payee, note, spentOn });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri");
      const res = expense
        ? await apiRequest("PATCH", `/api/expenses/${expense.id}`, parsed.data)
        : await apiRequest("POST", "/api/expenses", parsed.data);
      return (await res.json()) as Expense;
    },
    onSuccess: (row) => {
      invalidateApi("/api/expenses", "/api/reports");
      toast({
        title: expense ? "Xarajat yangilandi" : "Xarajat qo'shildi",
        description: `${row.category} · ${money(row.amount)}`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="icon-tile h-10 w-10 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{expense ? "Xarajatni tahrirlash" : "Yangi xarajat"}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {expense ? "O'zgarishlar audit jurnaliga yoziladi." : "Hisobotda sof foydadan ayiriladi."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          id="expense-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Kategoriya</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => {
                const meta = CATEGORY_META[c];
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-medium transition-all",
                      active ? cn(meta.tone, "ring-2 ring-primary/30") : "text-muted-foreground hover:bg-muted/50",
                    )}
                    data-testid={`category-${c}`}
                  >
                    <meta.icon className="h-4 w-4" />
                    <span className="w-full truncate text-center">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Summa</Label>
              <MoneyInput id="amount" value={amount} onChange={setAmount} data-testid="input-expense-amount" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spentOn">Sana</Label>
              <Input
                id="spentOn"
                type="date"
                value={spentOn}
                max={localDayString(new Date())}
                onChange={(e) => setSpentOn(e.target.value)}
                data-testid="input-expense-date"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>To'lov usuli</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                      method === m ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
                    )}
                    data-testid={`method-${m}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{PAYMENT_METHOD_LABELS[m]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payee">Kimga to'landi</Label>
            <Input
              id="payee"
              list="payee-options"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Masalan: Medtexnika MChJ"
              data-testid="input-expense-payee"
            />
            <datalist id="payee-options">
              {payees.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Izoh</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: gemoglobin reaktivi, 2 quti"
              data-testid="input-expense-note"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="expense-form"
            disabled={mutation.isPending || amount <= 0}
            data-testid="button-save-expense"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cancellation needs a reason: it is the one thing an auditor will ask about a
 * cancelled payment, and "noto'g'ri kiritilgan" is a fine answer.
 */
function CancelDialog({
  expense,
  onClose,
  onDone,
}: {
  expense: Expense | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason("");
    setError(null);
  }, [expense]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = cancelExpenseSchema.safeParse({ reason });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      await apiRequest("POST", `/api/expenses/${expense!.id}/cancel`, parsed.data);
    },
    onSuccess: () => {
      invalidateApi("/api/expenses", "/api/reports");
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  const quick = ["Noto'g'ri kiritilgan", "Ikki marta kiritilgan", "To'lov amalga oshmadi"];

  return (
    <Dialog open={Boolean(expense)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xarajatni bekor qilish</DialogTitle>
          <DialogDescription>
            <b>{expense?.category}</b> — {money(expense?.amount ?? 0)}. Yozuv o'chirilmaydi: tarixda "bekor qilingan"
            sifatida qoladi va hech qaysi hisobotga kirmaydi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Sabab</Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun bekor qilinmoqda"
            data-testid="input-cancel-reason"
          />
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setReason(q)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Orqaga
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.trim().length < 3}
            data-testid="button-confirm-cancel"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bekor qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
