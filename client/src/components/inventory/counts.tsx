/**
 * Inventarizatsiya (B5.5, TZ §7.1): the shelf counted batch by batch, the
 * difference between the ledger and the shelf posted as a correction.
 *
 * Each line is saved as it is counted (Enter moves to the next one), so a
 * long count survives a closed tab. The "Hisobda" number of a counted line is
 * what the ledger said at that moment; issues made afterwards are not a
 * shortage. Rules: shared/inventory.ts summarizeCount / planCountPost.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ClipboardCheck, ClipboardList, FileText, Loader2, Play, Printer, ScanLine, XCircle } from "lucide-react";
import type { InventoryBatchView, StockCountDetail, StockCountLine, StockCountView } from "@shared/schema";
import {
  COUNT_STATUS_LABELS,
  INVENTORY_KINDS,
  INVENTORY_KIND_LABELS,
  QTY_EPSILON,
  countDelta,
  countScopeLabel,
  fmtQty,
  lineTotal,
  summarizeCount,
  type CountStatus,
  type CountSummary,
  type InventoryKind,
} from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, MeterBar, Money, TableSkeleton } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { ExpiryBadge } from "@/components/inventory/stock";
import { apiRequest, invalidateApi, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const STATUS_TONE: Record<CountStatus, string> = {
  open: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  posted: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const lot = (l: { lotNumber: string | null }) => (l.lotNumber ? `LOT ${l.lotNumber}` : "LOT yo'q");
/** The ledger figure a line is compared with: frozen once counted, live until then. */
const ledgerOf = (l: StockCountLine) => (l.counted === null ? l.remaining : l.expected);
const signed = (n: number) => (n > 0 ? `+${fmtQty(n)}` : n < 0 ? `−${fmtQty(-n)}` : "0");
const parseQty = (s: string) => Number(s.trim().replace(",", "."));

export function Counts() {
  const { can } = useAuth();
  const canCount = can("inventory.count");
  const { data: counts = [], isLoading } = useQuery<StockCountView[]>({ queryKey: ["/api/inventory/counts"], refetchOnMount: "always" });
  const [creating, setCreating] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const open = counts.find((c) => c.status === "open");
  const last = counts.find((c) => c.status === "posted");

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Inventarizatsiya</p>
          <p className="text-sm text-muted-foreground">
            Har bir partiya sanaladi, hisobdagi va haqiqiy qoldiq farqi tasdiqlanganda qoldiqqa tuzatish bo'lib yoziladi.
            {last ? ` Oxirgisi: №${last.number}, ${formatDate(last.countedOn)}.` : " Hali o'tkazilmagan."}
          </p>
        </div>
        {canCount && !open && (
          <Button className="shrink-0 shadow-brand" onClick={() => setCreating(true)} data-testid="button-new-count">
            <Play className="mr-2 h-4 w-4" />
            Inventarizatsiyani boshlash
          </Button>
        )}
      </div>

      {open && <OpenCount id={open.id} canCount={canCount} onDocument={() => setDocId(open.id)} />}

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : counts.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Inventarizatsiya o'tkazilmagan"
            description="Sanoq butun ombor yoki tanlangan mahsulot turlari bo'yicha boshlanadi. Har bir partiyaning haqiqiy miqdori kiritiladi, farq dalolatnoma bilan qoladi."
            action={
              canCount ? (
                <Button onClick={() => setCreating(true)}>
                  <Play className="mr-2 h-4 w-4" />
                  Birinchi inventarizatsiya
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-24 sm:table-cell">№</TableHead>
                  <TableHead>Qamrov</TableHead>
                  <TableHead className="hidden md:table-cell">Sana</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Sanaldi</TableHead>
                  <TableHead className="text-right">Kamomad</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ortiqcha</TableHead>
                  <TableHead className="hidden lg:table-cell">Tasdiqladi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((c) => (
                  <TableRow key={c.id} className={cn("cursor-pointer", c.status === "cancelled" && "opacity-55")} onClick={() => setDocId(c.id)} data-testid={`row-count-${c.number}`}>
                    <TableCell className="hidden sm:table-cell">
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular text-muted-foreground">№{c.number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="mr-1.5 text-xs font-semibold tabular text-muted-foreground sm:hidden">№{c.number}</span>
                      <Badge variant="outline" className={cn("mb-1 font-medium", STATUS_TONE[c.status])}>
                        {COUNT_STATUS_LABELS[c.status]}
                      </Badge>
                      <p className="text-sm font-medium">{countScopeLabel(c.kinds)}</p>
                      {c.diffCount > 0 && c.status !== "cancelled" && <p className="text-xs text-muted-foreground">{c.diffCount} ta partiyada farq</p>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular md:table-cell">{formatDate(c.countedOn)}</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">
                      {c.countedCount}/{c.lineCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "posted" ? (
                        <span className={cn("tabular", c.shortageValue > 0 && "font-semibold text-rose-700 dark:text-rose-300")}>{money(c.shortageValue)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {c.status === "posted" ? (
                        <span className={cn("tabular", c.surplusValue > 0 && "font-semibold text-emerald-700 dark:text-emerald-300")}>{money(c.surplusValue)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {c.status === "posted" ? `${c.postedByName ?? "—"} · ${formatDateTime(c.postedAt!)}` : c.status === "cancelled" ? `Bekor: ${c.cancelReason}` : `Boshladi: ${c.createdByName ?? "—"}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewCountDialog open={creating} onClose={() => setCreating(false)} />
      <CountDocumentDialog id={docId} onClose={() => setDocId(null)} />
    </div>
  );
}

// ------------------------------------------------------------- the open count

type LineFilter = "all" | "todo" | "diff";

function OpenCount({ id, canCount, onDocument }: { id: string; canCount: boolean; onDocument: () => void }) {
  const { toast } = useToast();
  const key = `/api/inventory/counts/${id}`;
  const { data: c } = useQuery<StockCountDetail>({ queryKey: [key], refetchOnMount: "always" });
  const [filter, setFilter] = useState<LineFilter>("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ lineId: string; message: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const today = todayLocal();
  const summary = useMemo(() => (c ? summarizeCount(c.lines) : null), [c]);

  const save = useMutation({
    mutationFn: async (entry: { lineId: string; counted: number | null; note?: string | null }) => {
      setSaving(entry.lineId);
      const res = await apiRequest("PUT", `${key}/lines`, { entries: [entry] });
      return (await res.json()) as StockCountDetail;
    },
    onSuccess: (detail) => {
      queryClient.setQueryData([key], detail);
      setRowError(null);
      invalidateApi("/api/inventory/counts");
    },
    onError: (err: Error, entry) => setRowError({ lineId: entry.lineId, message: err.message }),
    onSettled: () => setSaving(null),
  });

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", `${key}/cancel`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/inventory/counts");
      setCancelling(false);
      toast({ title: "Inventarizatsiya bekor qilindi", description: "Qoldiq o'zgarmadi" });
    },
    onError: (err: Error) => setCancelError(err.message),
  });

  if (!c || !summary) return <div className="card-premium h-64 skeleton-shimmer" />;

  const q = search.trim().toLowerCase();
  const rows = c.lines.filter((l) => {
    if (filter === "todo" && (l.counted !== null || l.batchCancelled)) return false;
    if (filter === "diff" && countDelta(l) === 0) return false;
    return !q || l.itemName.toLowerCase().includes(q) || (l.lotNumber ?? "").toLowerCase().includes(q);
  });
  const filters: { key: LineFilter; label: string; n: number }[] = [
    { key: "all", label: "Hammasi", n: c.lines.length },
    { key: "todo", label: "Sanalmagan", n: summary.uncounted },
    { key: "diff", label: "Farqli", n: summary.shortage.lines + summary.surplus.lines },
  ];
  const focusRow = (i: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-count-row="${i}"]`);
    el?.focus();
    el?.select();
  };

  return (
    <section className="card-premium overflow-hidden" data-testid="open-count">
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">Inventarizatsiya №{c.number}</h3>
            <Badge variant="outline" className={cn("font-medium", STATUS_TONE.open)}>
              <ScanLine className="mr-1 h-3 w-3" />
              {COUNT_STATUS_LABELS.open}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {countScopeLabel(c.kinds)} · {formatDate(c.countedOn)} · boshladi {c.createdByName ?? "—"}
          </p>
          {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={onDocument} data-testid="button-count-document">
            <FileText className="mr-2 h-4 w-4" />
            Dalolatnoma
          </Button>
          {canCount && (
            <>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setCancelError(null);
                  setCancelling(true);
                }}
                data-testid="button-cancel-count"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Bekor qilish
              </Button>
              <Button className="shadow-brand" onClick={() => setPosting(true)} data-testid="button-post-count">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Tasdiqlash
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b p-5 xl:grid-cols-4">
        <div className="col-span-2 space-y-2 xl:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">Sanaldi</p>
          <p className="text-xl font-bold tabular sm:text-2xl" data-testid="count-progress">
            {summary.counted}
            <span className="text-base font-semibold text-muted-foreground">/{summary.counted + summary.uncounted}</span>
          </p>
          <MeterBar value={summary.counted} max={summary.counted + summary.uncounted} />
        </div>
        <CountFigure label="Mos keldi" value={String(summary.matched)} hint="partiya" />
        <CountFigure label="Kamomad" value={money(summary.shortage.value)} hint={`${summary.shortage.lines} ta partiya`} tone={summary.shortage.lines ? "rose" : undefined} testId="count-shortage" />
        <CountFigure label="Ortiqcha" value={money(summary.surplus.value)} hint={`${summary.surplus.lines} ta partiya`} tone={summary.surplus.lines ? "emerald" : undefined} testId="count-surplus" />
      </div>

      <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Mahsulot yoki LOT…" className="lg:w-80" data-testid="input-search-count" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Qatorlar">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
              )}
              data-testid={`count-filter-${f.key}`}
            >
              {f.label} <span className="tabular opacity-70">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Check} title={filter === "todo" ? "Hammasi sanaldi" : "Mos qator yo'q"} description={filter === "todo" ? "Farqlarni ko'rib chiqib, inventarizatsiyani tasdiqlang." : "Qidiruv yoki filtrni o'zgartiring."} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="table-premium">
            <TableHeader>
              <TableRow>
                <TableHead>Mahsulot va partiya</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Hisobda</TableHead>
                <TableHead className="text-right sm:w-40">Haqiqatda</TableHead>
                <TableHead className="hidden text-right md:table-cell">Farq</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l, i) => (
                <CountRow
                  key={`${l.id}:${l.counted ?? "-"}:${l.countedAt ?? ""}`}
                  line={l}
                  index={i}
                  today={today}
                  editable={canCount}
                  saving={saving === l.id}
                  error={rowError?.lineId === l.id ? rowError.message : null}
                  onSave={(counted) => save.mutate({ lineId: l.id, counted, note: l.note })}
                  onNext={() => focusRow(i + 1)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PostDialog open={posting} onClose={() => setPosting(false)} count={c} summary={summary} />
      <TextPromptDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Inventarizatsiya №${c.number} bekor qilinsinmi?`}
        description="Kiritilgan sanoq saqlanadi, lekin qoldiq o'zgarmaydi. Yangi inventarizatsiyani keyin boshlash mumkin."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={cancel.isPending}
        error={cancelError}
        onConfirm={(r) => cancel.mutate(r)}
        testId="count-cancel"
      />
    </section>
  );
}

function CountFigure({ label, value, hint, tone, testId }: { label: string; value: string; hint: string; tone?: "rose" | "emerald"; testId?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xl font-bold tabular sm:text-2xl",
          tone === "rose" && "text-rose-700 dark:text-rose-300",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
        )}
        data-testid={testId}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DeltaText({ line, className }: { line: StockCountLine; className?: string }) {
  if (line.counted === null) return <span className={cn("text-xs text-muted-foreground", className)}>sanalmagan</span>;
  const d = countDelta(line);
  if (d === 0)
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300", className)}>
        <Check className="h-3.5 w-3.5" />
        mos
      </span>
    );
  return (
    <span className={cn("text-sm font-semibold tabular", d < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300", className)}>
      {signed(d)} {line.unit}
      <span className="block text-[11px] font-normal text-muted-foreground">{money((d < 0 ? -1 : 1) * lineTotal(Math.abs(d), line.purchasePrice))}</span>
    </span>
  );
}

function CountRow({
  line,
  index,
  today,
  editable,
  saving,
  error,
  onSave,
  onNext,
}: {
  line: StockCountLine;
  index: number;
  today: string;
  editable: boolean;
  saving: boolean;
  error: string | null;
  onSave: (counted: number | null) => void;
  onNext: () => void;
}) {
  const [value, setValue] = useState(line.counted === null ? "" : fmtQty(line.counted));
  const [invalid, setInvalid] = useState(false);
  const committed = useRef(false);
  const ledger = ledgerOf(line);
  // Stock that moved after this line was counted: real, and not part of the difference.
  const movedSince = line.counted !== null && !line.batchCancelled ? line.remaining - line.expected : 0;

  const commit = () => {
    const raw = value.trim();
    if (raw === "") {
      setInvalid(false);
      if (line.counted !== null) onSave(null);
      return;
    }
    const n = parseQty(raw);
    if (!Number.isFinite(n) || n < 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (line.counted === null || Math.abs(n - line.counted) > QTY_EPSILON) onSave(n);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      committed.current = true;
      commit();
      onNext();
    } else if (e.key === "Escape") {
      setValue(line.counted === null ? "" : fmtQty(line.counted));
      setInvalid(false);
    }
  };

  return (
    <TableRow className={cn(line.batchCancelled && "opacity-55", line.counted === null && !line.batchCancelled && "bg-sky-500/[0.03]")} data-testid={`count-line-${line.id}`}>
      <TableCell>
        <p className="font-medium">{line.itemName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">{lot(line)}</span>
          {line.expiresOn && <ExpiryBadge expiresOn={line.expiresOn} today={today} />}
          {line.batchCancelled && (
            <Badge variant="outline" className="text-[10px]">
              Partiya bekor qilingan
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">
          Hisobda: <span className="tabular">{fmtQty(ledger)}</span> {line.unit}
        </p>
        {line.note && <p className="mt-1 text-xs italic text-muted-foreground">{line.note}</p>}
        {error && (
          <p className="mt-1 text-xs font-medium text-destructive" data-testid={`count-line-error-${line.id}`}>
            {error}
          </p>
        )}
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        <span className="font-semibold tabular">{fmtQty(ledger)}</span> <span className="text-xs text-muted-foreground">{line.unit}</span>
        {Math.abs(movedSince) > QTY_EPSILON && (
          <span className="block text-[11px] text-amber-700 dark:text-amber-300" title="Shu partiya sanalgandan keyin kirim yoki chiqim bo'lgan. U farqqa kirmaydi.">
            sanoqdan keyin {signed(movedSince)}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Input
            aria-label={`${line.itemName}, ${lot(line)}: haqiqiy miqdor`}
            inputMode="decimal"
            value={value}
            disabled={!editable || line.batchCancelled}
            placeholder="—"
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              if (committed.current) committed.current = false;
              else commit();
            }}
            onKeyDown={onKey}
            className={cn("h-9 w-20 text-right tabular sm:w-24", invalid && "border-destructive focus-visible:ring-destructive")}
            data-count-row={index}
            data-testid={`input-count-${line.id}`}
          />
          <span className="hidden w-12 truncate text-left text-xs text-muted-foreground sm:inline-block">{line.unit}</span>
        </div>
        <DeltaText line={line} className="mt-1 block text-right md:hidden" />
      </TableCell>
      <TableCell className="hidden text-right md:table-cell">
        <DeltaText line={line} />
      </TableCell>
      <TableCell>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          editable &&
          !line.batchCancelled &&
          line.counted === null && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-emerald-700"
              title="Hisobdagidek: sanaldi va mos keldi"
              aria-label="Hisobdagidek"
              onClick={() => {
                setValue(fmtQty(ledger));
                onSave(ledger);
              }}
              data-testid={`button-count-match-${line.id}`}
            >
              <Check className="h-4 w-4" />
            </Button>
          )
        )}
      </TableCell>
    </TableRow>
  );
}

function PostDialog({ open, onClose, count, summary }: { open: boolean; onClose: () => void; count: StockCountDetail; summary: CountSummary }) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const post = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/inventory/counts/${count.id}/post`);
      return (await res.json()) as StockCountDetail;
    },
    onSuccess: (c) => {
      invalidateApi("/api/inventory");
      onClose();
      toast({ title: `Inventarizatsiya №${c.number} tasdiqlandi`, description: c.diffCount ? `${c.diffCount} ta partiya qoldig'i tuzatildi` : "Farq topilmadi, qoldiq o'zgarmadi" });
    },
    onError: (err: Error) => setError(err.message),
  });
  const ready = summary.uncounted === 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        setError(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Inventarizatsiya №{count.number}ni tasdiqlash</DialogTitle>
          <DialogDescription>Har bir farq partiya qoldig'iga tuzatish bo'lib yoziladi. Tasdiqlangan inventarizatsiya bekor qilinmaydi.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-xl border text-sm">
          <div className="flex justify-between p-3">
            <dt className="text-muted-foreground">Sanalgan partiyalar</dt>
            <dd className="font-semibold tabular">
              {summary.counted}/{summary.counted + summary.uncounted}
            </dd>
          </div>
          <div className="flex justify-between p-3">
            <dt className="text-muted-foreground">Mos keldi</dt>
            <dd className="tabular">{summary.matched}</dd>
          </div>
          <div className="flex justify-between p-3">
            <dt className="text-muted-foreground">Kamomad</dt>
            <dd className="font-semibold tabular text-rose-700 dark:text-rose-300">
              {summary.shortage.lines} ta · {money(summary.shortage.value)}
            </dd>
          </div>
          <div className="flex justify-between p-3">
            <dt className="text-muted-foreground">Ortiqcha</dt>
            <dd className="font-semibold tabular text-emerald-700 dark:text-emerald-300">
              {summary.surplus.lines} ta · {money(summary.surplus.value)}
            </dd>
          </div>
        </dl>
        {!ready && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200" data-testid="text-count-not-ready">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {summary.uncounted} ta partiya hali sanalmagan. Hammasini sanang: hisobdagidek bo'lsa, qator yonidagi belgini bosing.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" data-testid="text-post-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Qaytish
          </Button>
          <Button disabled={!ready || post.isPending} onClick={() => post.mutate()} className="shadow-brand" data-testid="button-confirm-post">
            {post.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tasdiqlash va qoldiqni tuzatish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------- new count

function NewCountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: batches = [] } = useQuery<InventoryBatchView[]>({ queryKey: ["/api/inventory/batches"], enabled: open, refetchOnMount: "always" });
  const [countedOn, setCountedOn] = useState(todayLocal());
  const [whole, setWhole] = useState(true);
  const [kinds, setKinds] = useState<Set<InventoryKind>>(new Set());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = todayLocal();

  const perKind = useMemo(() => {
    const m = new Map<InventoryKind, { batches: number; items: Set<string> }>();
    for (const b of batches) {
      const e = m.get(b.kind) ?? { batches: 0, items: new Set<string>() };
      e.batches += 1;
      e.items.add(b.itemId);
      m.set(b.kind, e);
    }
    return m;
  }, [batches]);
  const chosen = whole ? INVENTORY_KINDS.filter((k) => perKind.has(k)) : INVENTORY_KINDS.filter((k) => kinds.has(k));
  const batchCount = chosen.reduce((s, k) => s + (perKind.get(k)?.batches ?? 0), 0);
  const itemCount = chosen.reduce((s, k) => s + (perKind.get(k)?.items.size ?? 0), 0);

  const reset = () => {
    setCountedOn(todayLocal());
    setWhole(true);
    setKinds(new Set());
    setNotes("");
    setError(null);
  };
  const create = useMutation({
    mutationFn: async () => {
      if (!whole && kinds.size === 0) throw new Error("Kamida bitta mahsulot turini tanlang");
      const res = await apiRequest("POST", "/api/inventory/counts", { countedOn, kinds: whole ? null : Array.from(kinds), notes: notes.trim() || null });
      return (await res.json()) as StockCountDetail;
    },
    onSuccess: (c) => {
      invalidateApi("/api/inventory/counts");
      toast({ title: `Inventarizatsiya №${c.number} boshlandi`, description: `${c.lineCount} ta partiya sanaladi` });
      onClose();
      reset();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Inventarizatsiyani boshlash</DialogTitle>
          <DialogDescription>
            Hozirgi qoldig'i bor har bir partiya sanoq ro'yxatiga tushadi. Sanoq davomida kirim va chiqim to'xtamaydi: har bir partiya sanalgan paytdagi hisob bilan solishtiriladi.
          </DialogDescription>
        </DialogHeader>
        <form
          id="count-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="count-date">Sana</Label>
              <Input id="count-date" type="date" value={countedOn} max={today} onChange={(e) => setCountedOn(e.target.value)} data-testid="input-count-date" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch checked={whole} onCheckedChange={setWhole} data-testid="switch-count-whole" />
              Butun ombor
            </label>
          </div>
          {!whole && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mahsulot turlari">
              {INVENTORY_KINDS.map((k) => {
                const n = perKind.get(k)?.batches ?? 0;
                const on = kinds.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    disabled={n === 0}
                    onClick={() =>
                      setKinds((s) => {
                        const next = new Set(s);
                        if (next.has(k)) next.delete(k);
                        else next.add(k);
                        return next;
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                    )}
                    data-testid={`count-kind-${k}`}
                  >
                    {INVENTORY_KIND_LABELS[k]} <span className="tabular opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="rounded-lg bg-muted/50 p-3 text-sm" data-testid="text-count-scope">
            {batchCount > 0 ? (
              <>
                <span className="font-semibold tabular">{batchCount}</span> ta partiya, <span className="font-semibold tabular">{itemCount}</span> ta mahsulot sanaladi.
              </>
            ) : (
              <span className="text-muted-foreground">Tanlangan turlarda qoldig'i bor partiya yo'q.</span>
            )}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="count-notes">Izoh</Label>
            <Textarea id="count-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ixtiyoriy: komissiya tarkibi, buyruq raqami" />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-count-error">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              reset();
            }}
          >
            Bekor qilish
          </Button>
          <Button type="submit" form="count-form" disabled={create.isPending || batchCount === 0} className="shadow-brand" data-testid="button-start-count">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Boshlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------- the act

function CountDocumentDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: c } = useQuery<StockCountDetail>({ queryKey: [`/api/inventory/counts/${id}`], enabled: Boolean(id), refetchOnMount: "always" });
  const [diffOnly, setDiffOnly] = useState(false);
  const summary = useMemo(() => (c ? summarizeCount(c.lines) : null), [c]);
  const lines = c ? c.lines.filter((l) => !diffOnly || countDelta(l) !== 0) : [];

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="no-print p-5 pb-4">
          <DialogTitle>Inventarizatsiya {c ? `№${c.number}` : ""}</DialogTitle>
          <DialogDescription>{c ? `${COUNT_STATUS_LABELS[c.status]} · ${countScopeLabel(c.kinds)} · ${formatDate(c.countedOn)}` : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 border-y bg-muted/30">
          <div className="p-6">
            {!c || !summary ? (
              <div className="h-64 skeleton-shimmer rounded-lg" />
            ) : (
              <div className="print-surface mx-auto max-w-[210mm] rounded bg-white p-8 text-black shadow-sm" data-testid="count-document">
                <div className="flex items-start justify-between gap-4 border-b-2 border-black/80 pb-3">
                  <div>
                    <h2 className="text-lg font-bold">INVENTARIZATSIYA DALOLATNOMASI № {c.number}</h2>
                    <p className="text-sm text-black/60">Sana: {formatDate(c.countedOn)}</p>
                  </div>
                  {c.status !== "posted" && (
                    <span
                      className={cn(
                        "rounded border-2 px-3 py-1 text-sm font-bold uppercase",
                        c.status === "cancelled" ? "border-rose-600 text-rose-600" : "border-sky-700 text-sky-700",
                      )}
                      data-testid="stamp-count-status"
                    >
                      {c.status === "cancelled" ? "Bekor qilingan" : "Qoralama"}
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <div className="col-span-2">
                    <dt className="inline text-black/60">Qamrov: </dt>
                    <dd className="inline font-semibold">{countScopeLabel(c.kinds)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-black/60">Boshladi: </dt>
                    <dd className="inline">
                      {c.createdByName ?? "—"}, {formatDateTime(c.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-black/60">Tasdiqladi: </dt>
                    <dd className="inline">{c.postedAt ? `${c.postedByName ?? "—"}, ${formatDateTime(c.postedAt)}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-black/60">Partiyalar: </dt>
                    <dd className="inline tabular">
                      {summary.counted} sanaldi, {summary.matched} mos, {summary.shortage.lines + summary.surplus.lines} farqli
                    </dd>
                  </div>
                </dl>
                <table className="mt-5 w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-y-2 border-black/70 text-left">
                      <th className="py-2 pr-2 font-semibold">№</th>
                      <th className="py-2 pr-2 font-semibold">Mahsulot</th>
                      <th className="py-2 pr-2 font-semibold">LOT</th>
                      <th className="py-2 pr-2 font-semibold">Muddati</th>
                      <th className="py-2 pr-2 text-right font-semibold">Hisobda</th>
                      <th className="py-2 pr-2 text-right font-semibold">Haqiqatda</th>
                      <th className="py-2 pr-2 text-right font-semibold">Farq</th>
                      <th className="py-2 pr-2 text-right font-semibold">Narx</th>
                      <th className="py-2 text-right font-semibold">Farq summasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, n) => {
                      const d = countDelta(l);
                      return (
                        <tr key={l.id} className={cn("border-b border-black/15", d !== 0 && "font-medium")} data-testid={`count-doc-line-${n}`}>
                          <td className="py-1.5 pr-2 tabular">{n + 1}</td>
                          <td className="py-1.5 pr-2">{l.itemName}</td>
                          <td className="py-1.5 pr-2 font-mono text-xs">{l.lotNumber ?? "—"}</td>
                          <td className="py-1.5 pr-2 tabular">{l.expiresOn ? formatDate(l.expiresOn) : "—"}</td>
                          <td className="py-1.5 pr-2 text-right tabular">
                            {fmtQty(ledgerOf(l))} {l.unit}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular">{l.counted === null ? "—" : `${fmtQty(l.counted)} ${l.unit}`}</td>
                          <td className={cn("py-1.5 pr-2 text-right tabular", d < 0 && "text-rose-700", d > 0 && "text-emerald-700")}>{l.counted === null ? "—" : signed(d)}</td>
                          <td className="py-1.5 pr-2 text-right tabular">{money(l.purchasePrice, false)}</td>
                          <td className={cn("py-1.5 text-right tabular", d < 0 && "text-rose-700", d > 0 && "text-emerald-700")}>
                            {d === 0 ? "—" : money((d < 0 ? -1 : 1) * lineTotal(Math.abs(d), l.purchasePrice), false)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={8} className="pt-3 text-right">
                        Kamomad ({summary.shortage.lines} ta partiya):
                      </td>
                      <td className="pt-3 text-right font-bold tabular text-rose-700" data-testid="count-doc-shortage">
                        {money(c.status === "posted" ? c.shortageValue : summary.shortage.value)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={8} className="pt-1 text-right">
                        Ortiqcha ({summary.surplus.lines} ta partiya):
                      </td>
                      <td className="pt-1 text-right font-bold tabular text-emerald-700">{money(c.status === "posted" ? c.surplusValue : summary.surplus.value)}</td>
                    </tr>
                  </tfoot>
                </table>
                {lines.length === 0 && <p className="mt-4 text-center text-sm text-black/60">Farq topilmadi: hisobdagi va haqiqiy qoldiq mos.</p>}
                {c.notes && <p className="mt-4 text-sm">Izoh: {c.notes}</p>}
                {c.cancelledAt && (
                  <p className="mt-4 text-sm text-rose-700">
                    Bekor qilindi: {formatDateTime(c.cancelledAt)}, {c.cancelledByName}. Sabab: {c.cancelReason}. Qoldiq o'zgarmadi.
                  </p>
                )}
                <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-8 text-sm">
                  <div className="border-t border-black/50 pt-1 text-black/60">Komissiya raisi</div>
                  <div className="border-t border-black/50 pt-1 text-black/60">Komissiya a'zolari</div>
                  <div className="border-t border-black/50 pt-1 text-black/60">Moddiy javobgar shaxs (omborchi)</div>
                  <div className="border-t border-black/50 pt-1 text-black/60">Tasdiqlayman (rahbar)</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="no-print gap-2 p-4 sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={diffOnly} onCheckedChange={setDiffOnly} data-testid="switch-count-diff-only" />
            Faqat farqlar
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => window.print()} disabled={!c} data-testid="button-print-count">
              <Printer className="mr-2 h-4 w-4" />
              Chop etish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
