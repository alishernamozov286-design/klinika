/**
 * Ombor bosh sahifasi (B5.7, TZ §7.1): the month in money, the last 30 days
 * of in and out, what needs doing, and the latest documents. Every number is
 * from the stock ledger (shared/inventory-reports.ts).
 */
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  Beaker,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  PackageMinus,
  PackagePlus,
  Scale,
  Wallet,
} from "lucide-react";
import type { StockAlerts } from "@shared/inventory";
import type { InventoryOverview, RecentDocument } from "@shared/inventory-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard, StatCard } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { FlowChart } from "@/components/flow-chart";
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
          {isLoading || !o ? <div className="h-64 skeleton-shimmer rounded-lg" /> : <FlowChart days={o.daily} inLabel="Kirim" outLabel="Chiqim" emptyTitle="30 kunda harakat bo'lmagan" emptyDescription="Kirim yoki chiqim rasmiylashtirilgach, kunlik summa shu yerda ko'rinadi." />}
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
