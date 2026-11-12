/**
 * Reagent sarfi (B5.6, TZ §7.3, §11 Laboratoriya → Ombor).
 *
 *   Jurnal    every consumption of a period: by norm (written when a result
 *             is verified) and extra (real use beyond the norm), shortages.
 *   Normalar  per test: what one test uses. Proposed, then approved by the
 *             lab head; only an approved norm moves stock.
 *   Hisobot   TZ §13 "reagent sarfi" per item and per test, with export.
 *
 * Rules: shared/consumption.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Beaker,
  ClipboardList,
  FlaskConical,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Scale,
  TestTube2,
  TestTubes,
  XCircle,
} from "lucide-react";
import type { ConsumptionNormView, InventoryItemView, LabConsumptionView, Test } from "@shared/schema";
import {
  CONSUMABLE_KINDS,
  CONSUMPTION_KIND_LABELS,
  EXTRA_REASONS,
  EXTRA_REASON_LABELS,
  NORM_STATUS_LABELS,
  shortOf,
  type ConsumptionReport,
  type ExtraReason,
  type NormStatus,
} from "@shared/consumption";
import { fmtQty, inventoryKey } from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatCard, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import type { ExportColumn } from "@/lib/export-types";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const parseQty = (s: string) => Number(s.trim().replace(",", "."));

type Section = "journal" | "norms" | "report";
type Journal = { from: string; to: string; report: ConsumptionReport; entries: LabConsumptionView[]; total: number };

const NORM_TONE: Record<NormStatus, string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  retired: "border-border bg-muted text-muted-foreground",
};

export function Consumption({ items }: { items: InventoryItemView[] }) {
  const { can } = useAuth();
  const [section, setSection] = useState<Section>("journal");
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const range = from && to && from <= to;
  const { data: journal, isLoading } = useQuery<Journal>({
    queryKey: [`/api/consumption?from=${from}&to=${to}`],
    enabled: Boolean(range),
    refetchOnMount: "always",
  });
  const { data: norms = [] } = useQuery<ConsumptionNormView[]>({ queryKey: ["/api/consumption/norms"], refetchOnMount: "always" });
  const { data: short } = useQuery<{ entries: LabConsumptionView[] }>({ queryKey: ["/api/consumption?short=1"], refetchOnMount: "always" });
  const drafts = norms.filter((n) => n.status === "draft").length;

  const sections: { key: Section; label: string; icon: typeof Beaker; badge?: number }[] = [
    { key: "journal", label: "Jurnal", icon: History },
    { key: "norms", label: "Normalar", icon: Scale, badge: drafts },
    { key: "report", label: "Hisobot", icon: ClipboardList },
  ];

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Reagent sarfi</p>
          <p className="text-sm text-muted-foreground">
            Natija tasdiqlanganda tahlilning tasdiqlangan normasi bo'yicha ombordan avtomatik chiqadi. Normadan tashqari real sarf sabab bilan yoziladi.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border p-0.5" role="tablist" aria-label="Bo'lim">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={section === s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                section === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`consumption-section-${s.key}`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
              {!!s.badge && (
                <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular", section === s.key ? "bg-white/25" : "bg-amber-500/15 text-amber-800 dark:text-amber-300")}>
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ShortageBanner entries={short?.entries ?? []} quiet={section !== "journal"} />

      {section !== "norms" && (
        <div className="card-premium flex flex-wrap items-end gap-3 p-3">
          <div className="space-y-1">
            <Label htmlFor="cons-from" className="text-xs">
              Davr boshi
            </Label>
            <Input id="cons-from" type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" data-testid="input-consumption-from" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cons-to" className="text-xs">
              Davr oxiri
            </Label>
            <Input id="cons-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" data-testid="input-consumption-to" />
          </div>
          {!range && <p className="pb-2 text-sm text-destructive">Davrni to'g'ri tanlang</p>}
        </div>
      )}

      {section === "journal" && <JournalView journal={journal} isLoading={isLoading} items={items} canRecord={can("consumption.record")} canCancel={can("consumption.approve")} />}
      {section === "norms" && <NormsView norms={norms} items={items} canPropose={can("consumption.norms")} canApprove={can("consumption.approve")} />}
      {section === "report" && <ReportView journal={journal} isLoading={isLoading} canExport={can("data.export")} />}
    </div>
  );
}

// ---------------------------------------------------------------- shortages

/** The open shortages, or (on the journal, when there are none) a quiet "Qayta hisoblash" for missed consumptions. */
function ShortageBanner({ entries, quiet }: { entries: LabConsumptionView[]; quiet: boolean }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const reconcile = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", "/api/consumption/reconcile")).json()) as { consumed: number; settled: number; stillShort: number },
    onSuccess: (r) => {
      invalidateApi("/api/consumption", "/api/inventory");
      toast({
        title: "Sarf qayta hisoblandi",
        description: `${r.consumed} ta yangi sarf, ${r.settled} ta yetishmovchilik yopildi${r.stillShort ? `, ${r.stillShort} tasi qoldi` : ""}`,
      });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Hisoblanmadi", description: err.message }),
  });
  const canReconcile = can("inventory.issue") || can("consumption.approve");
  if (entries.length === 0) {
    return canReconcile && !quiet ? (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => reconcile.mutate()} disabled={reconcile.isPending} data-testid="button-reconcile">
          {reconcile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Qayta hisoblash
        </Button>
      </div>
    ) : null;
  }
  const byItem = new Map<string, { name: string; unit: string; q: number; n: number }>();
  for (const e of entries) {
    const x = byItem.get(e.itemId) ?? { name: e.itemName, unit: e.unit, q: 0, n: 0 };
    x.q += shortOf(e);
    x.n += 1;
    byItem.set(e.itemId, x);
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-center" role="alert" data-testid="consumption-shortage">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {entries.length} ta sarf qoldiqdan to'liq chiqmadi: omborda yaroqli partiya yetmagan. Natijalar to'xtatilmagan.
        </p>
        <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
          {Array.from(byItem.values())
            .map((x) => `${x.name}: ${fmtQty(x.q)} ${x.unit}`)
            .join(" · ")}
          . Kirimni rasmiylashtirib, "Qayta hisoblash"ni bosing.
        </p>
      </div>
      {canReconcile && (
        <Button variant="outline" className="shrink-0 bg-card" onClick={() => reconcile.mutate()} disabled={reconcile.isPending} data-testid="button-reconcile">
          {reconcile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Qayta hisoblash
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ journal

function JournalView({
  journal,
  isLoading,
  items,
  canRecord,
  canCancel,
}: {
  journal: Journal | undefined;
  isLoading: boolean;
  items: InventoryItemView[];
  canRecord: boolean;
  canCancel: boolean;
}) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState<LabConsumptionView | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const r = journal?.report;

  const cancel = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/consumption/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/consumption", "/api/inventory");
      setCancelling(null);
      toast({ title: "Sarf bekor qilindi", description: "Mahsulot o'z partiyalariga qaytarildi" });
    },
    onError: (err: Error) => setCancelError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Sarf qiymati" value={money(r?.value ?? 0)} hint="Xarid narxlarida" icon={Beaker} isLoading={isLoading} />
        <StatCard index={1} label="Bajarilgan tahlillar" value={r?.performed ?? 0} hint="Norma bo'yicha sarflangan" icon={TestTubes} tone="violet" isLoading={isLoading} />
        <StatCard index={2} label="Qo'shimcha sarf" value={r?.extraEntries ?? 0} hint="Normadan tashqari yozuvlar" icon={Plus} tone="amber" isLoading={isLoading} />
        <StatCard
          index={3}
          label="Yetishmovchilik"
          value={r?.shortEntries ?? 0}
          hint={r?.shortEntries ? "Qoldiqdan to'liq chiqmagan" : "Hammasi qoldiqdan chiqdi"}
          icon={AlertTriangle}
          tone={r?.shortEntries ? "rose" : "emerald"}
          isLoading={isLoading}
        />
      </div>

      <div className="card-premium overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <p className="text-sm text-muted-foreground">
            {journal ? `${journal.total} ta yozuv${journal.total > journal.entries.length ? `, oxirgi ${journal.entries.length} tasi ko'rsatilgan` : ""}` : " "}
          </p>
          {canRecord && (
            <Button className="shadow-brand" onClick={() => setRecording(true)} data-testid="button-record-extra">
              <Plus className="mr-2 h-4 w-4" />
              Qo'shimcha sarf
            </Button>
          )}
        </div>
        {isLoading ? (
          <TableSkeleton />
        ) : !journal || journal.entries.length === 0 ? (
          <EmptyState
            icon={Beaker}
            title="Bu davrda sarf yo'q"
            description="Tahlilga tasdiqlangan norma belgilangach, natija tasdiqlanganda sarf shu yerda paydo bo'ladi."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Vaqt</TableHead>
                  <TableHead>Nima uchun</TableHead>
                  <TableHead>Mahsulot</TableHead>
                  <TableHead className="text-right">Miqdor</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Qiymat</TableHead>
                  <TableHead className="hidden lg:table-cell">Kim</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.entries.map((e) => {
                  const s = shortOf(e);
                  return (
                    <TableRow key={e.id} className={cn(e.cancelledAt && "opacity-55")} data-testid={`row-consumption-${e.id}`}>
                      <TableCell className="hidden whitespace-nowrap text-sm tabular text-muted-foreground md:table-cell">{formatDateTime(e.createdAt)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "mb-1 font-medium",
                            e.kind === "norm" ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
                          )}
                        >
                          {e.kind === "extra" && e.reason ? EXTRA_REASON_LABELS[e.reason] : CONSUMPTION_KIND_LABELS[e.kind]}
                        </Badge>
                        <p className="text-sm">
                          {e.orderNumber ? <span className="mr-1 font-mono text-xs text-muted-foreground">#{e.orderNumber}</span> : null}
                          {e.testName ?? "—"}
                        </p>
                        {e.note && <p className="text-xs italic text-muted-foreground">{e.note}</p>}
                        {e.cancelledAt && <p className="text-xs text-rose-700 dark:text-rose-300">Bekor qilingan: {e.cancelReason}</p>}
                        <p className="text-xs text-muted-foreground md:hidden">{formatDateTime(e.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{e.itemName}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("font-semibold tabular", e.cancelledAt && "line-through")}>{fmtQty(e.quantity)}</span>{" "}
                        <span className="text-xs text-muted-foreground">{e.unit}</span>
                        {s > 0 && !e.cancelledAt && (
                          <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300" data-testid={`short-${e.id}`}>
                            {fmtQty(s)} yetishmadi
                          </span>
                        )}
                        {e.settledAt && s === 0 && <span className="block text-[11px] text-muted-foreground">keyin yopildi</span>}
                      </TableCell>
                      <TableCell className="hidden text-right tabular sm:table-cell">{money(e.value)}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{e.createdByName ?? "—"}</TableCell>
                      <TableCell>
                        {canCancel && e.kind === "extra" && !e.cancelledAt && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Bekor qilish"
                            aria-label="Bekor qilish"
                            onClick={() => {
                              setCancelError(null);
                              setCancelling(e);
                            }}
                            data-testid={`button-cancel-consumption-${e.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ExtraDialog open={recording} onClose={() => setRecording(false)} items={items} />
      <TextPromptDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Qo'shimcha sarf bekor qilinsinmi?"
        description={cancelling ? `${cancelling.itemName} ${fmtQty(cancelling.quantity)} ${cancelling.unit} o'zi olingan partiyalarga qaytariladi. Yozuv o'chirilmaydi.` : ""}
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={cancel.isPending}
        error={cancelError}
        onConfirm={(reason) => cancelling && cancel.mutate({ id: cancelling.id, reason })}
        testId="consumption-cancel"
      />
    </div>
  );
}

function useLabTests(enabled = true) {
  return useQuery<Test[]>({ queryKey: ["/api/tests?all=1"], enabled });
}

function ExtraDialog({ open, onClose, items }: { open: boolean; onClose: () => void; items: InventoryItemView[] }) {
  const { toast } = useToast();
  const { data: tests = [] } = useLabTests(open);
  const [itemId, setItemId] = useState("");
  const [testId, setTestId] = useState("none");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ExtraReason>("repeat");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const usable = items.filter((i) => i.isActive && CONSUMABLE_KINDS.includes(i.kind));
  const item = items.find((i) => i.id === itemId);
  const reset = () => {
    setItemId("");
    setTestId("none");
    setQuantity("");
    setReason("repeat");
    setNote("");
    setError(null);
  };
  const close = () => {
    onClose();
    reset();
  };
  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consumption", {
        itemId,
        testId: testId === "none" ? null : testId,
        quantity: quantity.trim() === "" ? Number.NaN : parseQty(quantity),
        reason,
        note: note.trim() || null,
      });
      return (await res.json()) as LabConsumptionView;
    },
    onSuccess: (c) => {
      invalidateApi("/api/consumption", "/api/inventory");
      const s = shortOf(c);
      toast({
        title: "Sarf yozildi",
        description: s > 0 ? `${fmtQty(s)} ${c.unit} qoldiqdan chiqmadi — yetishmovchilik sifatida belgilandi` : `${c.itemName} ${fmtQty(c.quantity)} ${c.unit} ombordan chiqdi`,
      });
      close();
    },
    onError: (err: Error) => setError(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Qo'shimcha sarf</DialogTitle>
          <DialogDescription>Normadan tashqari ishlatilgan miqdor: takroriy o'lchov, kalibratsiya, sifat nazorati yoki to'kilgan reagent. Muddati yaqin partiyadan chiqadi.</DialogDescription>
        </DialogHeader>
        <form
          id="extra-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Mahsulot</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger data-testid="select-extra-item">
                <SelectValue placeholder="Reagent yoki sarf materialini tanlang" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {usable.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}{" "}
                    <span className="text-muted-foreground">
                      · {fmtQty(i.onHand)} {i.unit}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="extra-qty">Miqdor{item ? `, ${item.unit}` : ""}</Label>
            <Input id="extra-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-right tabular" data-testid="input-extra-qty" />
          </div>
          <div className="space-y-1.5">
            <Label>Sabab</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ExtraReason)}>
              <SelectTrigger data-testid="select-extra-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTRA_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EXTRA_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tahlil (ixtiyoriy)</Label>
            <Select value={testId} onValueChange={setTestId}>
              <SelectTrigger data-testid="select-extra-test">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Tahlilga bog'lanmagan</SelectItem>
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="extra-note">Izoh{reason === "other" ? " (majburiy)" : ""}</Label>
            <Textarea id="extra-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nima bo'ldi" data-testid="input-extra-note" />
          </div>
          {error && (
            <p className="text-sm text-destructive sm:col-span-2" data-testid="text-extra-error">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Bekor qilish
          </Button>
          <Button type="submit" form="extra-form" disabled={save.isPending || !itemId} className="shadow-brand" data-testid="button-save-extra">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Yozish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------- norms

type NormFilter = "live" | "draft" | "all";

function NormsView({ norms, items, canPropose, canApprove }: { norms: ConsumptionNormView[]; items: InventoryItemView[]; canPropose: boolean; canApprove: boolean }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<NormFilter>("live");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ open: boolean; norm: ConsumptionNormView | null; preset?: { testId: string; itemId: string } }>({ open: false, norm: null });
  const [retiring, setRetiring] = useState<ConsumptionNormView | null>(null);
  const [retireError, setRetireError] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: async (n: ConsumptionNormView) => {
      await apiRequest("POST", `/api/consumption/norms/${n.id}/approve`);
      return n;
    },
    onSuccess: (n) => {
      invalidateApi("/api/consumption");
      toast({ title: "Norma tasdiqlandi", description: `"${n.testName}": ${n.itemName} ${fmtQty(n.quantity)} ${n.unit}. Endi natija tasdiqlanganda ombordan chiqadi.` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Tasdiqlanmadi", description: err.message }),
  });
  const retire = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/consumption/norms/${id}/retire`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/consumption");
      setRetiring(null);
      toast({ title: "Norma bekor qilindi" });
    },
    onError: (err: Error) => setRetireError(err.message),
  });

  const q = inventoryKey(search);
  const visible = norms.filter(
    (n) =>
      (filter === "all" || (filter === "draft" ? n.status === "draft" : n.status !== "retired")) &&
      (!q || inventoryKey(n.testName).includes(q) || inventoryKey(n.itemName).includes(q)),
  );
  const groups = useMemo(() => {
    const m = new Map<string, { testId: string; testName: string; rows: ConsumptionNormView[] }>();
    for (const n of visible) {
      const g = m.get(n.testId) ?? { testId: n.testId, testName: n.testName, rows: [] };
      g.rows.push(n);
      m.set(n.testId, g);
    }
    return Array.from(m.values());
  }, [visible]);
  const counts = {
    live: norms.filter((n) => n.status !== "retired").length,
    draft: norms.filter((n) => n.status === "draft").length,
    all: norms.length,
  };
  const approvedTests = new Set(norms.filter((n) => n.status === "approved").map((n) => n.testId)).size;

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Tahlil yoki mahsulot…" className="sm:w-72" data-testid="input-search-norms" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Normalar">
            {(
              [
                ["live", "Amaldagi va kutilayotgan"],
                ["draft", "Tasdiqlash kutilmoqda"],
                ["all", "Tarix bilan"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                )}
                data-testid={`norm-filter-${k}`}
              >
                {label} <span className="tabular opacity-70">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground xl:block">{approvedTests} ta tahlilda amaldagi norma</p>
          {canPropose && (
            <Button className="shrink-0 shadow-brand" onClick={() => setEditing({ open: true, norm: null })} data-testid="button-new-norm">
              <Plus className="mr-2 h-4 w-4" />
              Norma qo'shish
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={Scale}
            title={norms.length === 0 ? "Sarf normalari belgilanmagan" : "Mos norma topilmadi"}
            description={
              norms.length === 0
                ? "Har bir tahlil uchun bitta tahlilga qancha reagent ketishini kiriting (masalan, 100 testlik to'plam uchun 0,01 to'plam). Norma lab mudiri tasdiqlagach amalga kiradi."
                : "Qidiruv yoki filtrni o'zgartiring."
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((g) => (
            <section key={g.testId} className="card-premium overflow-hidden" data-testid={`norm-group-${g.testId}`}>
              <header className="flex items-center gap-2 border-b px-4 py-3">
                <div className="icon-tile h-8 w-8 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  <FlaskConical className="h-4 w-4" />
                </div>
                <p className="min-w-0 flex-1 truncate font-semibold">{g.testName}</p>
                {canPropose && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing({ open: true, norm: null, preset: { testId: g.testId, itemId: "" } })}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Mahsulot
                  </Button>
                )}
              </header>
              <ul className="divide-y">
                {g.rows.map((n) => (
                  <li key={n.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", n.status === "retired" && "opacity-60")} data-testid={`norm-${n.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{n.itemName}</p>
                        <Badge variant="outline" className={cn("text-[11px] font-medium", NORM_TONE[n.status])}>
                          {NORM_STATUS_LABELS[n.status]}
                        </Badge>
                        {!n.itemActive && <Badge variant="outline" className="text-[11px]">mahsulot faolsiz</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.status === "approved"
                          ? `Tasdiqladi ${n.approvedByName ?? "—"}, ${formatDate(n.approvedAt!)}`
                          : n.status === "draft"
                            ? `Taklif: ${n.createdByName ?? "—"}, ${formatDate(n.createdAt)}`
                            : `${formatDate(n.approvedAt ?? n.createdAt)} — ${formatDate(n.retiredAt!)} · ${n.retireReason ?? ""}`}
                      </p>
                      {n.notes && <p className="text-xs italic text-muted-foreground">{n.notes}</p>}
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="text-lg font-bold tabular">{fmtQty(n.quantity)}</span> <span className="text-xs text-muted-foreground">{n.unit} / tahlil</span>
                    </p>
                    <div className="flex shrink-0 gap-1">
                      {n.status === "draft" && canApprove && (
                        <Button size="sm" className="h-8" onClick={() => approve.mutate(n)} disabled={approve.isPending} data-testid={`button-approve-norm-${n.id}`}>
                          <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                          Tasdiqlash
                        </Button>
                      )}
                      {n.status === "draft" && canPropose && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Tahrirlash" aria-label="Tahrirlash" onClick={() => setEditing({ open: true, norm: n })} data-testid={`button-edit-norm-${n.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {n.status === "approved" && canPropose && !norms.some((x) => x.status === "draft" && x.testId === n.testId && x.itemId === n.itemId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          title="Yangi qiymatni taklif qilish"
                          onClick={() => setEditing({ open: true, norm: null, preset: { testId: n.testId, itemId: n.itemId } })}
                          data-testid={`button-change-norm-${n.id}`}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          O'zgartirish
                        </Button>
                      )}
                      {n.status !== "retired" && (canPropose || canApprove) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Bekor qilish"
                          aria-label="Bekor qilish"
                          onClick={() => {
                            setRetireError(null);
                            setRetiring(n);
                          }}
                          data-testid={`button-retire-norm-${n.id}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <NormDialog state={editing} onClose={() => setEditing({ open: false, norm: null })} items={items} norms={norms} />
      <TextPromptDialog
        open={!!retiring}
        onOpenChange={(o) => !o && setRetiring(null)}
        title="Norma bekor qilinsinmi?"
        description={
          retiring?.status === "approved"
            ? `"${retiring.testName}" uchun ${retiring.itemName} endi avtomatik sarflanmaydi. Oldingi sarflar o'zgarmaydi, norma tarixda qoladi.`
            : "Taklif tarixda qoladi."
        }
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={retire.isPending}
        error={retireError}
        onConfirm={(reason) => retiring && retire.mutate({ id: retiring.id, reason })}
        testId="norm-retire"
      />
    </div>
  );
}

function NormDialog({
  state,
  onClose,
  items,
  norms,
}: {
  state: { open: boolean; norm: ConsumptionNormView | null; preset?: { testId: string; itemId: string } };
  onClose: () => void;
  items: InventoryItemView[];
  norms: ConsumptionNormView[];
}) {
  const { toast } = useToast();
  const { data: tests = [] } = useLabTests(state.open);
  const editing = state.norm;
  const [testId, setTestId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<unknown>(null);
  // Reset on open only (the props are fresh objects every render).
  if (state.open && openedFor !== state) {
    setOpenedFor(state);
    setTestId(editing?.testId ?? state.preset?.testId ?? "");
    setItemId(editing?.itemId ?? state.preset?.itemId ?? "");
    setQuantity(editing ? fmtQty(editing.quantity) : "");
    setNotes(editing?.notes ?? "");
    setError(null);
  }
  const item = items.find((i) => i.id === itemId);
  const current = norms.find((n) => n.status === "approved" && n.testId === testId && n.itemId === itemId);
  const usable = items.filter((i) => (i.isActive && CONSUMABLE_KINDS.includes(i.kind)) || i.id === itemId);
  const q = parseQty(quantity);
  const save = useMutation({
    mutationFn: async () => {
      const body = { quantity: quantity.trim() === "" ? Number.NaN : q, notes: notes.trim() || null };
      if (editing) await apiRequest("PATCH", `/api/consumption/norms/${editing.id}`, body);
      else await apiRequest("POST", "/api/consumption/norms", { ...body, testId, itemId });
    },
    onSuccess: () => {
      invalidateApi("/api/consumption");
      toast({ title: editing ? "Taklif yangilandi" : "Norma taklif qilindi", description: "Lab mudiri tasdiqlagach amalga kiradi" });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });
  const locked = Boolean(editing) || Boolean(state.preset?.itemId);
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Taklifni tahrirlash" : current ? "Yangi norma taklifi" : "Sarf normasi"}</DialogTitle>
          <DialogDescription>
            Bitta tahlilga ketadigan miqdor, mahsulotning o'lchov birligida. Lab mudiri tasdiqlagach, natija tasdiqlanganda ombordan avtomatik chiqadi.
          </DialogDescription>
        </DialogHeader>
        <form
          id="norm-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Tahlil</Label>
            <Select value={testId} onValueChange={setTestId} disabled={locked || Boolean(state.preset?.testId)}>
              <SelectTrigger data-testid="select-norm-test">
                <SelectValue placeholder="Tahlilni tanlang" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {tests.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mahsulot</Label>
            <Select value={itemId} onValueChange={setItemId} disabled={locked}>
              <SelectTrigger data-testid="select-norm-item">
                <SelectValue placeholder="Reagent yoki sarf materiali" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {usable.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} <span className="text-muted-foreground">· {i.unit}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="norm-qty">1 tahlilga{item ? `, ${item.unit}` : ""}</Label>
              <Input id="norm-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="text-right tabular" placeholder="0,01" data-testid="input-norm-qty" />
            </div>
            <div className="self-end pb-2 text-sm text-muted-foreground" data-testid="text-norm-hint">
              {q > 0 && item ? `1 ${item.unit} ≈ ${fmtQty(Math.floor((1 / q) * 1000) / 1000)} ta tahlil` : current ? `Amaldagi: ${fmtQty(current.quantity)} ${current.unit}` : null}
            </div>
          </div>
          {current && !editing && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Amaldagi norma {fmtQty(current.quantity)} {current.unit}. Yangi qiymat tasdiqlanguncha amaldagisi ishlayveradi.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="norm-notes">Izoh</Label>
            <Textarea id="norm-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ixtiyoriy: manba (yo'riqnoma, to'plam hajmi)" />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-norm-error">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" form="norm-form" disabled={save.isPending || !testId || !itemId} className="shadow-brand" data-testid="button-save-norm">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Saqlash" : "Taklif qilish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- report

const ITEM_COLUMNS: ExportColumn<ConsumptionReport["byItem"][number]>[] = [
  { header: "Mahsulot", value: (r) => r.itemName, width: 32 },
  { header: "Birlik", value: (r) => r.unit, width: 9 },
  { header: "Norma bo'yicha", value: (r) => r.norm, type: "number", width: 14 },
  { header: "Qo'shimcha", value: (r) => r.extra, type: "number", width: 12 },
  { header: "Jami", value: (r) => r.total, type: "number", width: 10 },
  { header: "Yetishmadi", value: (r) => r.short, type: "number", width: 11 },
  { header: "Qiymati", value: (r) => r.value, type: "money", width: 14, total: true },
];
const TEST_COLUMNS: ExportColumn<ConsumptionReport["byTest"][number]>[] = [
  { header: "Tahlil", value: (r) => r.testName, width: 34 },
  { header: "Bajarildi", value: (r) => r.performed, type: "number", width: 11 },
  { header: "Reagent qiymati", value: (r) => r.value, type: "money", width: 16, total: true },
  { header: "1 tahlilga", value: (r) => (r.performed ? Math.round(r.value / r.performed) : 0), type: "money", width: 14 },
];

function ReportView({ journal, isLoading, canExport }: { journal: Journal | undefined; isLoading: boolean; canExport: boolean }) {
  const r = journal?.report;
  const period = journal ? `${formatDate(journal.from)} — ${formatDate(journal.to)}` : "";
  if (isLoading || !r) return <div className="card-premium h-64 skeleton-shimmer" />;
  if (r.byItem.length === 0) {
    return (
      <div className="card-premium">
        <EmptyState icon={ClipboardList} title="Bu davrda sarf yo'q" description="Davrni o'zgartiring yoki tahlillarga norma belgilang." />
      </div>
    );
  }
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className="card-premium overflow-hidden xl:col-span-3" data-testid="report-by-item">
        <header className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <p className="font-semibold">Mahsulotlar bo'yicha</p>
            <p className="text-xs text-muted-foreground">
              {period} · jami {money(r.value)}
            </p>
          </div>
          {canExport && (
            <ExportButtons
              testIdPrefix="export-consumption-items"
              build={() => ({ filename: "reagent-sarfi", title: "Reagent sarfi: mahsulotlar bo'yicha", subtitle: period, columns: ITEM_COLUMNS, rows: r.byItem })}
            />
          )}
        </header>
        <div className="overflow-x-auto">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Norma bo'yicha</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Qo'shimcha</TableHead>
                <TableHead className="text-right">Jami</TableHead>
                <TableHead className="text-right">Qiymat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.byItem.map((x) => (
                <TableRow key={x.itemId} data-testid={`report-item-${x.itemId}`}>
                  <TableCell className="font-medium">
                    {x.itemName}
                    {x.short > 0 && (
                      <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {fmtQty(x.short)} {x.unit} qoldiqdan chiqmagan
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{fmtQty(x.norm)}</TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{x.extra > 0 ? fmtQty(x.extra) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold tabular">{fmtQty(x.total)}</span> <span className="text-xs text-muted-foreground">{x.unit}</span>
                  </TableCell>
                  <TableCell className="text-right tabular">{money(x.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="card-premium overflow-hidden xl:col-span-2" data-testid="report-by-test">
        <header className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <p className="font-semibold">Tahlillar bo'yicha</p>
            <p className="text-xs text-muted-foreground">{r.performed} ta tahlil bajarildi</p>
          </div>
          {canExport && (
            <ExportButtons
              testIdPrefix="export-consumption-tests"
              build={() => ({ filename: "tahlil-tannarxi", title: "Reagent sarfi: tahlillar bo'yicha", subtitle: period, columns: TEST_COLUMNS, rows: r.byTest })}
            />
          )}
        </header>
        {r.byTest.length === 0 ? (
          <EmptyState icon={TestTube2} title="Tahlilga bog'langan sarf yo'q" description="Qo'shimcha sarf tahlilsiz yozilgan." />
        ) : (
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Tahlil</TableHead>
                <TableHead className="text-right">Bajarildi</TableHead>
                <TableHead className="text-right">1 tahlilga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.byTest.map((t) => (
                <TableRow key={t.testId}>
                  <TableCell className="font-medium">{t.testName}</TableCell>
                  <TableCell className="text-right tabular">{t.performed}</TableCell>
                  <TableCell className="text-right tabular">{t.performed ? money(Math.round(t.value / t.performed)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
