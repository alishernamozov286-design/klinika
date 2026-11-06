import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  ClipboardCheck,
  History,
  Loader2,
  PencilLine,
  Save,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { OrderTestVersion, OrderWithDetails, ResultFlag } from "@shared/schema";
import { RESULT_FLAGS } from "@shared/schema";
import { computeFlag } from "@shared/reference-range";
import { LINE_STATE_LABELS, labProgress, lineState, type LineState } from "@shared/lab-verification";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FLAG_LABELS, FLAG_STYLES, formatDateTime } from "@/lib/format";
import { MeterBar } from "@/components/ui-kit";
import { SampleResultWarning } from "@/components/sample-panel";
import { cn } from "@/lib/utils";

type Draft = {
  id: string;
  result: string;
  flag: ResultFlag | null;
  notes: string;
  /**
   * True once the laborant has pressed a flag button themselves.
   *
   * This is what stops the live suggestion from fighting the human: auto-detect
   * fills a blank, but the moment someone makes a choice it stops touching that
   * line. Mirrors resolveFlag() on the server, which applies the same rule when
   * the values are saved.
   */
  flagTouched: boolean;
};

const FLAG_ICONS: Record<ResultFlag, React.ComponentType<{ className?: string }>> = {
  low: ArrowDown,
  normal: Check,
  high: ArrowUp,
};

const STATE_STYLES: Record<LineState, string> = {
  empty: "border-border bg-muted text-muted-foreground",
  returned: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  verified: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function LineStateBadge({ state, className }: { state: LineState; className?: string }) {
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1 whitespace-nowrap text-[11px] font-medium", STATE_STYLES[state], className)}>
      {state === "verified" && <BadgeCheck className="h-3 w-3" />}
      {state === "returned" && <Undo2 className="h-3 w-3" />}
      {LINE_STATE_LABELS[state]}
    </Badge>
  );
}

const toDrafts = (order: OrderWithDetails): Draft[] =>
  order.items.map((item) => ({
    id: item.id,
    result: item.result ?? "",
    flag: item.flag ?? null,
    notes: item.notes ?? "",
    // A flag already on the line was decided by a human (or by a previous
    // save), so the suggestion must not overwrite it.
    flagTouched: item.flag != null,
  }));

/**
 * Entering and checking results (TZ §6.1.4–6.1.5). The laborant types values;
 * the lab head, in the same window, verifies what was entered or sends a line
 * back with a reason. A verified line is locked here — it is corrected through
 * "Tuzatish", which keeps the replaced value.
 */
export function ResultsDialog({
  open,
  onOpenChange,
  order: snapshot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails | null;
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const canEnter = can("results.enter");
  const canVerify = can("results.verify");
  const canAmend = can("results.amend");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [returning, setReturning] = useState<{ id: string; testName: string } | null>(null);
  const [amending, setAmending] = useState<OrderWithDetails["items"][number] | null>(null);
  const [history, setHistory] = useState<OrderWithDetails["items"][number] | null>(null);

  // The list hands over a snapshot; the dialog keeps the live order, so a
  // verification or a return shows at once.
  const orderKey = `/api/orders/${snapshot?.id}`;
  const { data: full } = useQuery<OrderWithDetails>({
    queryKey: [orderKey],
    enabled: open && Boolean(snapshot),
    refetchOnMount: "always",
  });
  const order = snapshot && full?.id === snapshot.id ? full : snapshot;

  /** Result fields in row order, so Enter can walk down the list. */
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const focusInput = (index: number) => {
    const next = inputsRef.current[index];
    if (!next) return;
    next.focus();
    next.select();
  };

  // Drafts are (re)built when the dialog opens on an order and whenever the
  // server's version of the lines changes — never while the user is typing.
  const stamp = order ? order.items.map((i) => `${i.id}:${i.result}:${i.flag}:${i.notes}:${i.verifiedAt}:${i.returnedAt}`).join("|") : "";
  useEffect(() => {
    if (!open || !order) return;
    setDrafts(toDrafts(order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id, stamp]);

  useEffect(() => {
    if (!open || !snapshot) return;
    // Land on the first line still waiting for a value, so reopening a
    // half-entered order resumes where the laborant left off.
    const firstOpen = snapshot.items.findIndex((i) => lineState(i) === "empty" || lineState(i) === "returned");
    const id = window.setTimeout(() => inputsRef.current[firstOpen === -1 ? 0 : firstOpen]?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open, snapshot?.id]);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  /**
   * Types a value and lets the reference range pick the flag — the same
   * computeFlag() the server uses, so the preview is exactly what is stored.
   */
  const typeResult = (item: { id: string; referenceRange: string | null }, value: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== item.id) return d;
        if (d.flagTouched) return { ...d, result: value };
        const auto = computeFlag(value, item.referenceRange, { gender: order?.patient?.gender });
        return { ...d, result: value, flag: auto };
      }),
    );
  };

  const refresh = () => invalidateApi("/api/orders", "/api/stats", "/api/reception", "/api/referrals", "/api/patients");

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${order!.id}/results`, {
        results: drafts.map((d) => ({ id: d.id, result: d.result || null, flag: d.flag, notes: d.notes || null })),
      });
      return (await res.json()) as OrderWithDetails;
    },
    onSuccess: (updated) => {
      refresh();
      const p = labProgress(updated.items);
      const entered = p.total - p.empty;
      toast({
        title: "Natijalar saqlandi",
        description:
          p.empty === 0
            ? p.review > 0
              ? `Barcha tahlillar kiritildi · ${p.review} tasi laboratoriya mudiri tasdig'ini kutmoqda`
              : "Barcha tahlillar kiritildi"
            : `${entered}/${p.total} ta tahlil kiritildi`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${order!.id}/verify`, {});
      return (await res.json()) as OrderWithDetails & { telegram?: { sent: boolean; reason?: string } };
    },
    onSuccess: (updated) => {
      refresh();
      const p = labProgress(updated.items);
      toast({
        title: p.released ? "Buyurtma to'liq tasdiqlandi" : "Natijalar tasdiqlandi",
        description: p.released
          ? `Blanka chop etishga tayyor${updated.telegram?.sent ? " · bemorga Telegramda yuborildi" : ""}`
          : `${p.verified}/${p.total} ta tahlil tasdiqlangan`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      invalidateApi(orderKey);
      toast({ variant: "destructive", title: "Tasdiqlanmadi", description: err.message });
    },
  });

  if (!order) return null;

  const saved = toDrafts(order);
  const dirty = drafts.some((d) => {
    const s = saved.find((x) => x.id === d.id);
    return s && (s.result.trim() !== d.result.trim() || s.flag !== d.flag || s.notes.trim() !== d.notes.trim());
  });
  const progress = labProgress(order.items);
  const filledCount = drafts.filter((d) => d.result.trim()).length;
  const abnormalCount = drafts.filter((d) => d.flag === "low" || d.flag === "high").length;
  const editable = canEnter && order.status !== "cancelled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl h-[86vh] flex flex-col gap-0 p-0"
        // Ctrl+Enter saves from anywhere in the form — the laborant's hands
        // never have to leave the number pad.
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && editable && dirty && !save.isPending) {
            e.preventDefault();
            save.mutate();
          }
        }}
      >
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="icon-tile h-10 w-10 bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{canVerify && progress.review > 0 && progress.empty === 0 ? "Natijalarni tekshirish" : "Natijalar"}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Buyurtma <span className="tabular">#{order.orderNumber}</span> · {order.patient?.fullName ?? "Noma'lum bemor"}
                {order.referralNumber ? ` · Yo'llanma №${order.referralNumber}` : ""}
              </DialogDescription>
            </div>
            <MeterBar
              className="hidden w-40 shrink-0 sm:block"
              value={progress.verified}
              max={progress.total}
              barClassName="bg-none bg-emerald-500"
              label={
                <>
                  <span>Tasdiqlangan</span>
                  <span className="tabular">
                    {progress.verified}/{progress.total}
                  </span>
                </>
              }
            />
          </div>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-4">
            <SampleResultWarning order={order} />

            {order.items.map((item, index) => {
              const draft = drafts.find((d) => d.id === item.id);
              if (!draft) return null;
              const state = lineState(item);
              const locked = state === "verified" || !editable;

              // Out of range is the thing a tired laborant must not miss, so it
              // colours the whole card, not just a badge in the corner.
              const abnormal = draft.flag === "low" || draft.flag === "high";
              const suggested = !draft.flagTouched && draft.flag !== null;

              return (
                <div
                  key={item.id}
                  data-testid={`result-row-${item.id}`}
                  className={cn(
                    "space-y-3 rounded-xl border bg-card p-4 shadow-xs transition-colors focus-within:border-primary/40",
                    draft.flag === "high" && "border-rose-500/40 bg-rose-500/[0.04]",
                    draft.flag === "low" && "border-sky-500/40 bg-sky-500/[0.04]",
                    state === "verified" && "bg-emerald-500/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.testName}</p>
                      {item.referenceRange && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Me'yor: {item.referenceRange}
                          {item.unit ? ` ${item.unit}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {abnormal && (
                        <Badge variant="outline" className={cn("gap-1 font-semibold", FLAG_STYLES[draft.flag!])}>
                          {draft.flag === "high" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {FLAG_LABELS[draft.flag!]}
                        </Badge>
                      )}
                      <LineStateBadge state={state} />
                    </div>
                  </div>

                  {state === "returned" && (
                    <p className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-700 dark:text-rose-300" data-testid={`text-returned-${item.id}`}>
                      <Undo2 className="mr-1 inline h-3.5 w-3.5" />
                      {item.returnedByName ?? "Laboratoriya mudiri"} qaytardi: {item.returnReason}
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <Label className="text-xs mb-1.5 block">Natija {item.unit ? `(${item.unit})` : ""}</Label>
                      <Input
                        ref={(el) => {
                          inputsRef.current[index] = el;
                        }}
                        value={draft.result}
                        readOnly={locked}
                        onChange={(e) => typeResult(item, e.target.value)}
                        onKeyDown={(e) => {
                          // Enter walks down the list, which is how results
                          // arrive off an analyser printout: one after another.
                          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            focusInput(index + 1);
                          }
                        }}
                        placeholder={locked ? "—" : "Qiymatni kiriting"}
                        data-testid={`input-result-${item.id}`}
                        className={cn(
                          "tabular",
                          locked && "cursor-default bg-muted/40",
                          draft.flag === "high" && "border-rose-500/50 text-rose-700 dark:text-rose-300",
                          draft.flag === "low" && "border-sky-500/50 text-sky-700 dark:text-sky-300",
                        )}
                      />
                    </div>

                    <div>
                      <Label className="mb-1.5 flex h-4 items-center gap-1 text-xs">
                        Baho
                        {suggested && !locked && (
                          <span className="flex items-center gap-0.5 text-[10px] font-normal text-primary">
                            <Sparkles className="h-2.5 w-2.5" />
                            avtomatik
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-1.5">
                        {RESULT_FLAGS.map((flag) => {
                          const Icon = FLAG_ICONS[flag];
                          const active = draft.flag === flag;
                          return (
                            <button
                              key={flag}
                              type="button"
                              disabled={locked}
                              onClick={() =>
                                // Pressing a flag — including pressing the active
                                // one to clear it — hands this line to the human.
                                update(item.id, { flag: active ? null : flag, flagTouched: true })
                              }
                              data-testid={`flag-${flag}-${item.id}`}
                              className={cn(
                                "flex h-10 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium transition-all disabled:cursor-default",
                                active ? cn(FLAG_STYLES[flag], "shadow-xs") : "text-muted-foreground hover:bg-muted disabled:hover:bg-transparent",
                                // A suggestion is drawn dashed so it never looks
                                // like somebody already checked it.
                                active && suggested && !locked && "border-dashed",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {FLAG_LABELS[flag]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <Input
                    value={draft.notes}
                    readOnly={locked}
                    onChange={(e) => update(item.id, { notes: e.target.value })}
                    placeholder={locked ? "" : "Izoh (ixtiyoriy)"}
                    className={cn("text-sm", locked && "cursor-default bg-muted/40")}
                  />

                  {/* who did what — the line's own audit trail */}
                  {(item.enteredBy || item.verifiedByName) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
                      <span>
                        {item.enteredBy && <>Kiritdi: {item.enteredBy}{item.completedAt ? `, ${formatDateTime(item.completedAt)}` : ""}</>}
                        {item.verifiedByName && (
                          <>
                            {item.enteredBy ? " · " : ""}
                            <ShieldCheck className="mr-0.5 inline h-3 w-3 text-emerald-600" />
                            Tasdiqladi: {item.verifiedByName}
                            {item.verifiedAt ? `, ${formatDateTime(item.verifiedAt)}` : ""}
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {item.version > 1 && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setHistory(item)} data-testid={`button-result-history-${item.id}`}>
                            <History className="mr-1 h-3.5 w-3.5" />
                            Tarix (v{item.version})
                          </Button>
                        )}
                        {state === "verified" && canAmend && order.status !== "cancelled" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAmending(item)} data-testid={`button-amend-${item.id}`}>
                            <PencilLine className="mr-1 h-3.5 w-3.5" />
                            Tuzatish
                          </Button>
                        )}
                        {state === "review" && canVerify && !dirty && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-rose-700 hover:text-rose-700 dark:text-rose-300"
                            onClick={() => setReturning({ id: item.id, testName: item.testName })}
                            data-testid={`button-return-${item.id}`}
                          >
                            <Undo2 className="mr-1 h-3.5 w-3.5" />
                            Qaytarish
                          </Button>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-3 border-t p-4 sm:flex-row sm:items-center">
          <div className="mr-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {abnormalCount > 0 && (
              <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                <ArrowUp className="h-3.5 w-3.5" />
                {abnormalCount} ta me'yordan tashqarida
              </span>
            )}
            {canVerify && dirty && progress.review > 0 && <span>Tasdiqlashdan oldin o'zgarishlarni saqlang</span>}
            {editable && !canVerify && (
              <span className="hidden sm:inline">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> keyingisi ·{" "}
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+Enter</kbd> saqlash
              </span>
            )}
            {!editable && <span>{filledCount}/{drafts.length} ta natija</span>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
          {editable && (
            <Button
              variant={canVerify && !dirty && progress.review > 0 ? "outline" : "default"}
              onClick={() => save.mutate()}
              disabled={save.isPending || !dirty}
              data-testid="button-save-results"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Saqlash
            </Button>
          )}
          {canVerify && progress.review > 0 && (
            <Button
              onClick={() => verify.mutate()}
              disabled={verify.isPending || dirty}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              data-testid="button-verify-results"
            >
              {verify.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BadgeCheck className="h-4 w-4 mr-2" />}
              Tasdiqlash ({progress.review})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <ReturnResultDialog orderId={order.id} line={returning} onOpenChange={(o) => !o && setReturning(null)} onDone={refresh} />
      <AmendResultDialog orderId={order.id} line={amending} gender={order.patient?.gender} onOpenChange={(o) => !o && setAmending(null)} onDone={refresh} />
      <ResultHistoryDialog orderId={order.id} line={history} onOpenChange={(o) => !o && setHistory(null)} />
    </Dialog>
  );
}

/** Sends one entered value back to the laborant, with the reason they will see. */
function ReturnResultDialog({
  orderId,
  line,
  onOpenChange,
  onDone,
}: {
  orderId: string;
  line: { id: string; testName: string } | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onOpenChange(false);
  };
  const send = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/return`, { itemIds: [line!.id], reason: reason.trim() });
    },
    onSuccess: () => {
      onDone();
      toast({ title: "Laborantga qaytarildi", description: line?.testName });
      close();
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Qaytarilmadi", description: err.message }),
  });
  return (
    <Dialog open={Boolean(line)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Natijani qaytarish</DialogTitle>
          <DialogDescription>
            "{line?.testName}" laborantga qayta tekshirish uchun qaytariladi. Sabab unga ko'rinadi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="return-reason">Sabab</Label>
          <Textarea
            id="return-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: qiymat klinik holatga mos emas, qayta o'lchang"
            autoFocus
            maxLength={300}
            data-testid="input-return-reason"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Ortga
          </Button>
          <Button onClick={() => send.mutate()} disabled={reason.trim().length < 3 || send.isPending} data-testid="button-confirm-return">
            {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Qaytarish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Corrects a verified value: the current one is kept as a version (TZ §6.1.5). */
function AmendResultDialog({
  orderId,
  line,
  gender,
  onOpenChange,
  onDone,
}: {
  orderId: string;
  line: OrderWithDetails["items"][number] | null;
  gender: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState("");
  const [flag, setFlag] = useState<ResultFlag | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (!line) return;
    setResult(line.result ?? "");
    setFlag(line.flag ?? null);
    setNotes(line.notes ?? "");
    setReason("");
  }, [line]);

  const amend = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${orderId}/items/${line!.id}/amend`, {
        result: result.trim(),
        flag,
        notes: notes.trim() || null,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      onDone();
      toast({ title: "Natija tuzatildi", description: `${line?.testName}: eski qiymat tarixda saqlandi` });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Tuzatilmadi", description: err.message }),
  });

  const changed = line && (result.trim() !== (line.result ?? "") || flag !== (line.flag ?? null) || (notes.trim() || null) !== (line.notes || null));

  return (
    <Dialog open={Boolean(line)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Natijani tuzatish · v{line?.version} → v{(line?.version ?? 1) + 1}</DialogTitle>
          <DialogDescription>
            {line?.testName}. Hozirgi qiymat ({line?.result}) o'zgartirilmasdan tarixga saqlanadi, yangi qiymat siz nomingizdan tasdiqlanadi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="amend-result">Yangi natija {line?.unit ? `(${line.unit})` : ""}</Label>
            <Input
              id="amend-result"
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setFlag(computeFlag(e.target.value, line?.referenceRange ?? null, { gender }));
              }}
              className="tabular"
              data-testid="input-amend-result"
            />
          </div>
          <div className="flex gap-1.5">
            {RESULT_FLAGS.map((f) => {
              const Icon = FLAG_ICONS[f];
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFlag(flag === f ? null : f)}
                  className={cn(
                    "flex h-9 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium",
                    flag === f ? FLAG_STYLES[f] : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {FLAG_LABELS[f]}
                </button>
              );
            })}
          </div>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Izoh (ixtiyoriy)" />
          <div className="space-y-1.5">
            <Label htmlFor="amend-reason">Tuzatish sababi</Label>
            <Textarea
              id="amend-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: qayta o'lchashda boshqa qiymat chiqdi"
              maxLength={300}
              data-testid="input-amend-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Ortga
          </Button>
          <Button onClick={() => amend.mutate()} disabled={!changed || !result.trim() || reason.trim().length < 5 || amend.isPending} data-testid="button-confirm-amend">
            {amend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tuzatish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Every value a line has held, newest first. */
function ResultHistoryDialog({
  orderId,
  line,
  onOpenChange,
}: {
  orderId: string;
  line: OrderWithDetails["items"][number] | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data = [], isLoading } = useQuery<OrderTestVersion[]>({
    queryKey: [`/api/orders/${orderId}/items/${line?.id}/versions`],
    enabled: Boolean(line),
  });
  return (
    <Dialog open={Boolean(line)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Natija tarixi · {line?.testName}</DialogTitle>
          <DialogDescription>Joriy qiymat va barcha oldingi tasdiqlangan qiymatlar.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {line && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] p-3 text-sm">
              <p className="font-semibold tabular">
                v{line.version} · {line.result} {line.unit ?? ""} <span className="text-xs font-normal text-muted-foreground">(joriy)</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Tasdiqladi: {line.verifiedByName ?? "—"}
                {line.verifiedAt ? `, ${formatDateTime(line.verifiedAt)}` : ""}
              </p>
            </div>
          )}
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Yuklanmoqda…</p>
          ) : (
            data.map((v) => (
              <div key={v.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold tabular">
                  v{v.version} · {v.result ?? "—"} {line?.unit ?? ""}
                  {v.flag && <span className="ml-1 text-xs font-normal text-muted-foreground">({FLAG_LABELS[v.flag]})</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Kiritdi: {v.enteredBy ?? "—"} · Tasdiqladi: {v.verifiedByName ?? "—"}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {formatDateTime(v.replacedAt)} · {v.replacedByName ?? "—"} tuzatdi: {v.replaceReason}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
