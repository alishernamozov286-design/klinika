/**
 * Qoldiq va yaroqlilik muddati (B5.4, TZ §7.1, §7.3): stock by batch with
 * where it came from, the expiry state of each batch, what is running low,
 * and the warnings TZ §7.3 asks for. Expired stock is still on the shelf
 * until it is written off — from here, in one step. Rules: shared/inventory.ts.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CircleAlert, Coins, PackageSearch, Trash2, TrendingDown } from "lucide-react";
import type { InventoryBatchView, InventoryItemView } from "@shared/schema";
import {
  EXPIRY_SOON_DAYS,
  EXPIRY_STATE_LABELS,
  EXPIRY_WATCH_DAYS,
  INVENTORY_KIND_SHORT,
  daysLeft,
  expiryState,
  fmtQty,
  inventoryKey,
  lineTotal,
  type ExpiryState,
  type StockAlerts,
} from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, MeterBar, Money, SectionCard, StatCard, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import { NewIssueDialog, type IssuePreset } from "@/components/inventory/issues";
import type { ExportColumn } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatDate, money } from "@/lib/format";

export type StockWindow = "all" | "expired" | "soon" | "watch";
type Window = StockWindow;

const STATE_TONE: Record<ExpiryState, string> = {
  expired: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  soon: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  watch: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  none: "border-border bg-muted text-muted-foreground",
};

/** "12 kun qoldi" / "3 kun oldin o'tgan" / "bugun tugaydi". */
function expiryText(expiresOn: string | null, today: string): string {
  if (!expiresOn) return "Muddatsiz";
  const d = daysLeft(expiresOn, today);
  if (d < 0) return `${-d} kun oldin o'tgan`;
  if (d === 0) return "Bugun tugaydi";
  return `${d} kun qoldi`;
}

export function ExpiryBadge({ expiresOn, today }: { expiresOn: string | null; today: string }) {
  const st = expiryState(expiresOn, today);
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATE_TONE[st])} title={EXPIRY_STATE_LABELS[st]}>
      {st === "expired" && <AlertTriangle className="mr-1 h-3 w-3" />}
      {expiryText(expiresOn, today)}
    </Badge>
  );
}

/** The warnings, above every Ombor tab and on the storekeeper's home page. */
export type StockAlertTarget = Window | "low" | "consumption";

export function StockAlertsBanner({ alerts, onOpen, className }: { alerts: StockAlerts | undefined; onOpen: (w: StockAlertTarget) => void; className?: string }) {
  if (!alerts) return null;
  const parts: { key: StockAlertTarget; text: string; tone: string }[] = [];
  if (alerts.expired.batches > 0)
    parts.push({ key: "expired", text: `${alerts.expired.batches} ta partiyaning muddati o'tgan (${money(alerts.expired.value)}) — hisobdan chiqaring`, tone: "text-rose-700 dark:text-rose-300" });
  if (alerts.soon.batches > 0)
    parts.push({ key: "soon", text: `${alerts.soon.batches} ta partiya ${EXPIRY_SOON_DAYS} kun ichida tugaydi`, tone: "text-amber-800 dark:text-amber-300" });
  if (alerts.lowStock.length > 0)
    parts.push({ key: "low", text: `${alerts.lowStock.length} ta mahsulot kam qolgan`, tone: "text-amber-800 dark:text-amber-300" });
  if (alerts.consumptionShort > 0)
    parts.push({
      key: "consumption",
      text: `${alerts.consumptionShort} ta laboratoriya sarfi qoldiqdan chiqmadi — kirimni tekshiring`,
      tone: "text-amber-800 dark:text-amber-300",
    });
  if (parts.length === 0) return null;
  const severe = alerts.expired.batches > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4 text-sm sm:flex-row sm:items-center",
        severe ? "border-rose-500/30 bg-rose-500/5" : "border-amber-500/30 bg-amber-500/5",
        className,
      )}
      role="alert"
      data-testid="stock-alerts"
    >
      <CircleAlert className={cn("h-5 w-5 shrink-0", severe ? "text-rose-600" : "text-amber-600")} />
      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <button key={p.key} type="button" onClick={() => onOpen(p.key)} className={cn("text-left font-medium underline-offset-2 hover:underline", p.tone)} data-testid={`stock-alert-${p.key}`}>
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const EXPORT_COLUMNS: ExportColumn<InventoryBatchView & { today: string }>[] = [
  { header: "Mahsulot", value: (b) => b.itemName, width: 30 },
  { header: "Turi", value: (b) => INVENTORY_KIND_SHORT[b.kind], width: 16 },
  { header: "LOT", value: (b) => b.lotNumber ?? "", width: 12 },
  { header: "Yaroqlilik muddati", value: (b) => (b.expiresOn ? formatDate(b.expiresOn) : ""), width: 14 },
  { header: "Holat", value: (b) => EXPIRY_STATE_LABELS[expiryState(b.expiresOn, b.today)], width: 18 },
  { header: "Qoldiq", value: (b) => b.remaining, type: "number", width: 10 },
  { header: "Birlik", value: (b) => b.unit, width: 9 },
  { header: "Xarid narxi", value: (b) => b.purchasePrice, type: "money", width: 13 },
  { header: "Qiymati", value: (b) => lineTotal(b.remaining, b.purchasePrice), type: "money", width: 14, total: true },
  { header: "Kirim", value: (b) => (b.receiptNumber ? `№${b.receiptNumber} · ${b.supplier ?? ""}` : ""), width: 22 },
];

export function StockView({ items, initialWindow = "all" }: { items: InventoryItemView[]; initialWindow?: Window }) {
  const { can } = useAuth();
  const { data: batches = [], isLoading } = useQuery<InventoryBatchView[]>({ queryKey: ["/api/inventory/batches"], refetchOnMount: "always" });
  const { data: alerts } = useQuery<StockAlerts>({ queryKey: ["/api/inventory/alerts"], refetchOnMount: "always" });
  const today = alerts?.date ?? new Date().toISOString().slice(0, 10);
  const [win, setWin] = useState<Window>(initialWindow);
  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<IssuePreset | null>(null);

  const counts = useMemo(() => {
    const c = { all: batches.length, expired: 0, soon: 0, watch: 0 };
    for (const b of batches) {
      const st = expiryState(b.expiresOn, today);
      if (st === "expired") c.expired += 1;
      if (st === "soon") c.soon += 1;
      if (st === "soon" || st === "watch") c.watch += 1;
    }
    return c;
  }, [batches, today]);

  const q = inventoryKey(search);
  const rows = batches
    .filter((b) => {
      const st = expiryState(b.expiresOn, today);
      if (win === "expired" && st !== "expired") return false;
      if (win === "soon" && st !== "soon") return false;
      if (win === "watch" && st !== "soon" && st !== "watch") return false;
      return !q || inventoryKey(b.itemName).includes(q) || inventoryKey(b.lotNumber ?? "").includes(q) || inventoryKey(b.supplier ?? "").includes(q);
    })
    .sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") || a.itemName.localeCompare(b.itemName));
  const rowsValue = rows.reduce((s, b) => s + lineTotal(b.remaining, b.purchasePrice), 0);

  const chips: { key: Window; label: string; n: number }[] = [
    { key: "all", label: "Hammasi", n: counts.all },
    { key: "expired", label: "Muddati o'tgan", n: counts.expired },
    { key: "soon", label: `${EXPIRY_SOON_DAYS} kun ichida`, n: counts.soon },
    { key: "watch", label: `${EXPIRY_WATCH_DAYS} kun ichida`, n: counts.watch },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Ombor qiymati" value={money(alerts?.value ?? 0, false)} suffix="so'm" hint="Qoldiq xarid narxlarida" icon={Coins} isLoading={!alerts} />
        <StatCard
          index={1}
          label="Muddati o'tgan"
          value={alerts?.expired.batches ?? 0}
          hint={alerts && alerts.expired.batches > 0 ? `${money(alerts.expired.value)} — hisobdan chiqaring` : "Yo'q"}
          icon={AlertTriangle}
          tone={alerts && alerts.expired.batches > 0 ? "rose" : "emerald"}
          isLoading={!alerts}
          onClick={() => setWin("expired")}
        />
        <StatCard
          index={2}
          label={`${EXPIRY_SOON_DAYS} kun ichida tugaydi`}
          value={alerts?.soon.batches ?? 0}
          hint={alerts && alerts.soon.batches > 0 ? `${money(alerts.soon.value)} — avval shulardan bering` : "Yo'q"}
          icon={CalendarClock}
          tone={alerts && alerts.soon.batches > 0 ? "amber" : "emerald"}
          isLoading={!alerts}
          onClick={() => setWin("soon")}
        />
        <StatCard
          index={3}
          label="Kam qolgan"
          value={alerts?.lowStock.length ?? 0}
          hint="Yaroqli qoldiq minimaldan kam"
          icon={TrendingDown}
          tone={alerts && alerts.lowStock.length > 0 ? "rose" : "emerald"}
          isLoading={!alerts}
          onClick={() => document.getElementById("low-stock")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Muddat bo'yicha">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={win === c.key}
              onClick={() => setWin(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                win === c.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                c.key === "expired" && c.n > 0 && win !== c.key && "border-rose-500/40 text-rose-700 dark:text-rose-300",
              )}
              data-testid={`filter-expiry-${c.key}`}
            >
              {c.label} <span className="tabular opacity-70">{c.n}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Mahsulot, LOT yoki yetkazib beruvchi…" className="lg:w-80" data-testid="input-search-stock" />
          {can("data.export") && (
            <ExportButtons
              testIdPrefix="export-stock"
              disabled={isLoading}
              build={() => ({
                filename: "ombor-qoldiq",
                title: "Ombor qoldig'i partiyalar bo'yicha",
                subtitle: `${formatDate(today)} · ${chips.find((c) => c.key === win)!.label} · ${rows.length} ta partiya · ${money(rowsValue)}`,
                columns: EXPORT_COLUMNS,
                rows: rows.map((b) => ({ ...b, today })),
              })}
            />
          )}
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={batches.length === 0 ? "Omborda qoldiq yo'q" : "Mos partiya topilmadi"}
            description={batches.length === 0 ? "Kirim qilingan mahsulotlar shu yerda partiyalari bilan ko'rinadi." : "Filtr yoki qidiruvni o'zgartiring."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Mahsulot · LOT</TableHead>
                  <TableHead>Muddat</TableHead>
                  <TableHead className="w-44">Qoldiq</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Qiymati</TableHead>
                  <TableHead className="hidden lg:table-cell">Kirim</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => {
                  const expired = expiryState(b.expiresOn, today) === "expired";
                  return (
                    <TableRow key={b.id} className={cn(expired && "bg-rose-500/[0.03]")} data-testid={`row-batch-${b.id}`}>
                      <TableCell>
                        <p className="font-medium">{b.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {INVENTORY_KIND_SHORT[b.kind]} · <span className="font-mono">{b.lotNumber ? `LOT ${b.lotNumber}` : "LOT yo'q"}</span>
                        </p>
                      </TableCell>
                      <TableCell>
                        <ExpiryBadge expiresOn={b.expiresOn} today={today} />
                        {b.expiresOn && <p className="mt-1 text-xs tabular text-muted-foreground">{formatDate(b.expiresOn)}</p>}
                      </TableCell>
                      <TableCell>
                        <MeterBar
                          value={b.remaining}
                          max={b.quantity}
                          label={
                            <>
                              <span className="font-semibold tabular text-foreground">
                                {fmtQty(b.remaining)} {b.unit}
                              </span>
                              <span className="tabular">/ {fmtQty(b.quantity)}</span>
                            </>
                          }
                        />
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <Money value={lineTotal(b.remaining, b.purchasePrice)} />
                        <p className="text-xs tabular text-muted-foreground">{money(b.purchasePrice)} / {b.unit}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {b.receiptNumber ? (
                          <>
                            <p>
                              Kirim №{b.receiptNumber} · {b.receivedOn ? formatDate(b.receivedOn) : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{b.supplier}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {expired && can("inventory.issue") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-rose-500/40 text-rose-700 hover:text-rose-800 dark:text-rose-300"
                            onClick={() => setPreset({ itemId: b.itemId, batchId: b.id, quantity: b.remaining, reason: "expired" })}
                            data-testid={`button-writeoff-${b.id}`}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Hisobdan chiqarish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="border-t px-5 py-3 text-right text-sm text-muted-foreground">
              {rows.length} ta partiya · jami <span className="font-semibold tabular text-foreground">{money(rowsValue)}</span>
            </p>
          </div>
        )}
      </div>

      <div id="low-stock" className="scroll-mt-20">
        <SectionCard icon={TrendingDown} title="Kam qolgan mahsulotlar" description="Yaroqli (muddati o'tmagan) qoldiq minimal darajada yoki undan kam" flush>
          {!alerts ? (
            <TableSkeleton rows={2} />
          ) : alerts.lowStock.length === 0 ? (
            <EmptyState icon={TrendingDown} title="Hammasi yetarli" description="Minimal qoldiq belgilangan har bir mahsulot yetarli miqdorda bor." />
          ) : (
            <ul className="divide-y" data-testid="list-low-stock">
              {alerts.lowStock.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-6" data-testid={`low-${l.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{INVENTORY_KIND_SHORT[l.kind]}</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <MeterBar
                      value={Math.min(l.usable, l.minStock)}
                      max={l.minStock}
                      label={
                        <>
                          <span className={cn("font-semibold tabular", l.usable <= 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-300")}>
                            {fmtQty(l.usable)} {l.unit}
                          </span>
                          <span className="tabular">minimal {fmtQty(l.minStock)}</span>
                        </>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <NewIssueDialog kind={preset ? "writeoff" : null} preset={preset} onClose={() => setPreset(null)} items={items} />
    </div>
  );
}

/**
 * The storekeeper's home page card: the same warnings, with a way in. Quiet
 * (a single "all in order" line) when there is nothing to do.
 */
export function StockHomePanel({ onOpen }: { onOpen: (w: StockAlertTarget) => void }) {
  const { data: alerts, isLoading } = useQuery<StockAlerts>({ queryKey: ["/api/inventory/alerts"], refetchOnMount: "always" });
  const nothing = alerts && alerts.expired.batches === 0 && alerts.soon.batches === 0 && alerts.lowStock.length === 0 && alerts.consumptionShort === 0;
  return (
    <SectionCard icon={PackageSearch} title="Ombor" description="Muddat va qoldiq ogohlantirishlari (TZ §7.3)" bodyClassName="p-5">
      {isLoading || !alerts ? (
        <div className="h-16 skeleton-shimmer rounded-lg" />
      ) : nothing ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" data-testid="stock-home-ok">
          Hammasi joyida: muddati o'tgan yoki yaqinlashgan partiya yo'q, qoldiqlar yetarli. Ombor qiymati {money(alerts.value)}.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="stock-home-alerts">
          {[
            { key: "expired" as const, n: alerts.expired.batches, label: "partiyaning muddati o'tgan", tone: "text-rose-600 dark:text-rose-400" },
            { key: "soon" as const, n: alerts.soon.batches, label: `partiya ${EXPIRY_SOON_DAYS} kun ichida tugaydi`, tone: "text-amber-700 dark:text-amber-300" },
            { key: "low" as const, n: alerts.lowStock.length, label: "mahsulot kam qolgan", tone: "text-amber-700 dark:text-amber-300" },
          ].map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => onOpen(x.key)}
              className="rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
              data-testid={`stock-home-${x.key}`}
            >
              <p className={cn("text-2xl font-bold tabular", x.n > 0 ? x.tone : "text-muted-foreground")}>{x.n}</p>
              <p className="text-xs text-muted-foreground">{x.label}</p>
            </button>
          ))}
          {alerts.consumptionShort > 0 && (
            <button
              type="button"
              onClick={() => onOpen("consumption")}
              className="text-left text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-300 sm:col-span-3"
              data-testid="stock-home-consumption"
            >
              {alerts.consumptionShort} ta laboratoriya sarfi qoldiqdan chiqmadi — kirimni tekshiring
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
