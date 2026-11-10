/**
 * Chiqim (B5.3, TZ §7.1, §7.3): issues to a department ("qaysi bo'limga, kim
 * oldi") and write-offs. Each line is split across batches FEFO — nearest
 * expiry first, never an expired batch to a department — and the form shows
 * that split before saving, from the same rule the server applies
 * (shared/inventory.ts allocateFefo / planIssue).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, PackageMinus, Plus, Printer, Trash2, XCircle } from "lucide-react";
import type { DepartmentWithUsage, InventoryBatchView, InventoryItemView, StockIssueDetail, StockIssueView } from "@shared/schema";
import {
  ISSUE_KIND_LABELS,
  MAX_ISSUE_LINES,
  WRITEOFF_REASONS,
  WRITEOFF_REASON_LABELS,
  allocateFefo,
  fmtQty,
  lineTotal,
  type IssueKind,
  type WriteoffReason,
} from "@shared/inventory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, TableSkeleton } from "@/components/ui-kit";
import { TextPromptDialog } from "@/components/qc/qc-ui";
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
const AUTO = "__fefo__";

const KIND_TONE: Record<IssueKind, string> = {
  department: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  writeoff: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function Issues({ items }: { items: InventoryItemView[] }) {
  const { can } = useAuth();
  const { data: issues = [], isLoading } = useQuery<StockIssueView[]>({ queryKey: ["/api/inventory/issues"], refetchOnMount: "always" });
  const [creating, setCreating] = useState<IssueKind | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const month = todayLocal().slice(0, 7);
  const live = issues.filter((i) => !i.cancelledAt && i.issuedOn.startsWith(month));
  const toDepts = live.filter((i) => i.kind === "department");
  const writeoffs = live.filter((i) => i.kind === "writeoff");

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Chiqim hujjatlari</p>
          <p className="text-sm text-muted-foreground">
            Bu oy bo'limlarga {toDepts.length} ta ({money(toDepts.reduce((s, i) => s + i.total, 0))}), hisobdan chiqarilgan {writeoffs.length} ta (
            {money(writeoffs.reduce((s, i) => s + i.total, 0))}). Partiya muddati yaqinidan boshlab olinadi.
          </p>
        </div>
        {can("inventory.issue") && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCreating("writeoff")} data-testid="button-new-writeoff">
              <Trash2 className="mr-2 h-4 w-4" />
              Hisobdan chiqarish
            </Button>
            <Button className="shadow-brand" onClick={() => setCreating("department")} data-testid="button-new-issue">
              <PackageMinus className="mr-2 h-4 w-4" />
              Bo'limga berish
            </Button>
          </div>
        )}
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : issues.length === 0 ? (
          <EmptyState icon={Building2} title="Chiqim hujjati yo'q" description="Bo'limlarga berilgan va hisobdan chiqarilgan mahsulotlar shu yerda hujjat bo'lib qoladi." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">№</TableHead>
                  <TableHead>Qayerga</TableHead>
                  <TableHead className="hidden md:table-cell">Sana</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Partiyalar</TableHead>
                  <TableHead className="text-right">Tannarx</TableHead>
                  <TableHead className="hidden lg:table-cell">Berdi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={i.id} className={cn("cursor-pointer", i.cancelledAt && "opacity-55")} onClick={() => setOpenId(i.id)} data-testid={`row-issue-${i.number}`}>
                    <TableCell>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular text-muted-foreground">№{i.number}</span>
                      {i.cancelledAt && (
                        <Badge variant="outline" className="mt-1 block w-fit border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300">
                          Bekor qilingan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("mb-1 font-medium", KIND_TONE[i.kind])}>
                        {ISSUE_KIND_LABELS[i.kind]}
                      </Badge>
                      <p className="font-medium">{i.kind === "department" ? (i.departmentName ?? "—") : i.reason ? WRITEOFF_REASON_LABELS[i.reason] : "—"}</p>
                      {i.receivedBy && <p className="text-xs text-muted-foreground">Oldi: {i.receivedBy}</p>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular md:table-cell">{formatDate(i.issuedOn)}</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">{i.lineCount}</TableCell>
                    <TableCell className={cn("text-right", i.cancelledAt && "line-through")}>
                      <Money value={i.total} />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{i.createdByName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewIssueDialog kind={creating} onClose={() => setCreating(null)} items={items} onCreated={setOpenId} />
      <IssueDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ------------------------------------------------------------------- new issue

type Line = { key: number; itemId: string; quantity: string; batchId: string };
let seq = 0;
const blank = (): Line => ({ key: ++seq, itemId: "", quantity: "", batchId: AUTO });

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1 lg:space-y-0", className)}>
      <span className="text-xs font-medium text-muted-foreground lg:hidden">{label}</span>
      {children}
    </label>
  );
}

function NewIssueDialog({
  kind: initialKind,
  onClose,
  items,
  onCreated,
}: {
  kind: IssueKind | null;
  onClose: () => void;
  items: InventoryItemView[];
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const open = initialKind !== null;
  const { data: departments = [] } = useQuery<DepartmentWithUsage[]>({ queryKey: ["/api/departments"], enabled: open });
  const { data: batches = [] } = useQuery<InventoryBatchView[]>({ queryKey: ["/api/inventory/batches"], enabled: open, refetchOnMount: "always" });
  const [kind, setKind] = useState<IssueKind>("department");
  const [departmentId, setDepartmentId] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [reason, setReason] = useState<WriteoffReason>("expired");
  const [issuedOn, setIssuedOn] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const today = todayLocal();

  useEffect(() => {
    if (!open) return;
    setKind(initialKind!);
    setDepartmentId("");
    setReceivedBy("");
    setReason("expired");
    setIssuedOn(todayLocal());
    setNotes("");
    setLines([blank()]);
    setError(null);
  }, [open, initialKind]);
  useEffect(() => setError(null), [kind, departmentId, receivedBy, reason, issuedOn, lines]);

  const byItem = useMemo(() => {
    const m = new Map<string, InventoryBatchView[]>();
    for (const b of batches) m.set(b.itemId, [...(m.get(b.itemId) ?? []), b]);
    return m;
  }, [batches]);
  const stocked = items.filter((i) => i.onHand > 0);
  const itemById = new Map(items.map((i) => [i.id, i]));
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const qtyOf = (l: Line) => Number(l.quantity.replace(",", "."));

  /** What the server will do with each line, previewed with the same rule. */
  const previews = lines.map((l) => {
    const own = byItem.get(l.itemId) ?? [];
    const q = qtyOf(l);
    if (!l.itemId || !(q > 0)) return null;
    const pool = l.batchId === AUTO ? own : own.filter((b) => b.id === l.batchId);
    const r = allocateFefo(pool, q, today, { allowExpired: kind === "writeoff" });
    return { r, own };
  });
  const cost = previews.reduce((s, p) => {
    if (!p || !p.r.ok) return s;
    return s + p.r.allocations.reduce((x, a) => x + lineTotal(a.quantity, p.own.find((b) => b.id === a.batchId)?.purchasePrice ?? 0), 0);
  }, 0);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/inventory/issues", {
        kind,
        departmentId: kind === "department" ? departmentId || null : null,
        receivedBy: kind === "department" ? receivedBy || null : null,
        reason: kind === "writeoff" ? reason : null,
        issuedOn,
        notes: notes || null,
        lines: lines
          .filter((l) => l.itemId)
          .map((l) => ({ itemId: l.itemId, quantity: l.quantity.trim() === "" ? Number.NaN : qtyOf(l), batchId: l.batchId === AUTO ? null : l.batchId })),
      });
      return (await res.json()) as StockIssueDetail;
    },
    onSuccess: (i) => {
      invalidateApi("/api/inventory");
      toast({ title: `Chiqim №${i.number} saqlandi`, description: `${i.lines.length} ta partiyadan olindi` });
      onClose();
      onCreated(i.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{kind === "department" ? "Bo'limga berish" : "Hisobdan chiqarish"}</DialogTitle>
          <DialogDescription>
            {kind === "department"
              ? "Mahsulot muddati eng yaqin partiyadan boshlab olinadi. Muddati o'tgan partiya bo'limga berilmaydi."
              : "Muddati o'tgan yoki yaroqsiz mahsulot. Kerakli partiyani tanlang yoki avtomatik qoldiring."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 border-y">
          <form
            id="issue-form"
            className="space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Chiqim turi">
              {(["department", "writeoff"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid={`issue-kind-${k}`}
                >
                  {ISSUE_KIND_LABELS[k]}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {kind === "department" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Bo'lim</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger data-testid="select-issue-department">
                        <SelectValue placeholder="Tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="is-recv">Kim oldi</Label>
                    <Input id="is-recv" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="F.I.Sh." data-testid="input-issue-received" />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Sabab</Label>
                  <Select value={reason} onValueChange={(v) => setReason(v as WriteoffReason)}>
                    <SelectTrigger data-testid="select-issue-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WRITEOFF_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {WRITEOFF_REASON_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="is-date">Sana</Label>
                <Input id="is-date" type="date" value={issuedOn} max={today} onChange={(e) => setIssuedOn(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="hidden grid-cols-[2.2fr_1fr_1.6fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground lg:grid">
                <span>Mahsulot</span>
                <span>Miqdor</span>
                <span>Partiya</span>
                <span className="w-9" />
              </div>
              {lines.map((l, idx) => {
                const it = itemById.get(l.itemId);
                const own = byItem.get(l.itemId) ?? [];
                const p = previews[idx];
                return (
                  <div key={l.key} className="rounded-xl border bg-muted/20 p-3 lg:border-0 lg:bg-transparent lg:p-0" data-testid={`issue-line-${idx}`}>
                    <div className="grid gap-2 lg:grid-cols-[2.2fr_1fr_1.6fr_auto] lg:items-center">
                      <Field label="Mahsulot">
                        <Select value={l.itemId} onValueChange={(v) => setLine(l.key, { itemId: v, batchId: AUTO })}>
                          <SelectTrigger aria-label="Mahsulot" data-testid={`select-issue-item-${idx}`}>
                            <SelectValue placeholder="Mahsulotni tanlang" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {stocked.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name}{" "}
                                <span className="text-muted-foreground">
                                  · {fmtQty(i.onHand)} {i.unit}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={it ? `Miqdor, ${it.unit}` : "Miqdor"}>
                        <Input
                          aria-label="Miqdor"
                          inputMode="decimal"
                          placeholder={it ? it.unit : "0"}
                          value={l.quantity}
                          onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                          className="text-right tabular"
                          data-testid={`input-issue-qty-${idx}`}
                        />
                      </Field>
                      <Field label="Partiya">
                        <Select value={l.batchId} onValueChange={(v) => setLine(l.key, { batchId: v })} disabled={!l.itemId}>
                          <SelectTrigger aria-label="Partiya" data-testid={`select-issue-batch-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AUTO}>Avtomatik (muddati yaqini birinchi)</SelectItem>
                            {own.map((b) => {
                              const expired = !!b.expiresOn && b.expiresOn < today;
                              return (
                                <SelectItem key={b.id} value={b.id} disabled={expired && kind === "department"}>
                                  {b.lotNumber ? `LOT ${b.lotNumber}` : "LOT yo'q"} · {fmtQty(b.remaining)} {b.unit}
                                  {b.expiresOn ? ` · ${formatDate(b.expiresOn)}` : ""}
                                  {expired ? " · muddati o'tgan" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 justify-self-end text-muted-foreground"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        aria-label="Qatorni olib tashlash"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {p && (
                      <p className={cn("mt-1.5 px-1 text-xs", p.r.ok ? "text-muted-foreground" : "font-medium text-rose-600 dark:text-rose-400")} data-testid={`issue-preview-${idx}`}>
                        {p.r.ok
                          ? `Olinadi: ${p.r.allocations
                              .map((a) => {
                                const b = own.find((x) => x.id === a.batchId);
                                return `${b?.lotNumber ? `LOT ${b.lotNumber}` : "LOT yo'q"} — ${fmtQty(a.quantity)}`;
                              })
                              .join(" → ")}`
                          : `Yetarli emas: ${kind === "department" ? "muddati o'tmagan " : ""}qoldiq ${fmtQty(p.r.available)} ${it?.unit ?? ""}`}
                      </p>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" size="sm" disabled={lines.length >= MAX_ISSUE_LINES} onClick={() => setLines((ls) => [...ls, blank()])} data-testid="button-add-issue-line">
                <Plus className="mr-1.5 h-4 w-4" />
                Qator qo'shish
              </Button>
              {stocked.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-300">Omborda qoldig'i bor mahsulot yo'q — avval kirim qiling.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="is-notes">Izoh</Label>
              <Textarea id="is-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ixtiyoriy" />
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            {error ? (
              <p className="text-destructive" data-testid="text-issue-error">
                {error}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Tannarx: <span className="font-semibold tabular text-foreground">{money(cost)}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" form="issue-form" disabled={save.isPending} className="shadow-brand" data-testid="button-save-issue">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- issue detail

function IssueDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data: i } = useQuery<StockIssueDetail>({ queryKey: [`/api/inventory/issues/${id}`], enabled: Boolean(id), refetchOnMount: "always" });
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", `/api/inventory/issues/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/inventory");
      setCancelling(false);
      toast({ title: "Chiqim bekor qilindi", description: "Mahsulot o'z partiyalariga qaytarildi" });
    },
    onError: (err: Error) => setCancelError(err.message),
  });

  const title = i?.kind === "writeoff" ? "HISOBDAN CHIQARISH DALOLATNOMASI" : "CHIQIM HUJJATI (BO'LIMGA BERISH)";

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="no-print p-5 pb-4">
          <DialogTitle>Chiqim {i ? `№${i.number}` : ""}</DialogTitle>
          <DialogDescription>
            {i ? `${ISSUE_KIND_LABELS[i.kind]} · ${i.kind === "department" ? (i.departmentName ?? "") : i.reason ? WRITEOFF_REASON_LABELS[i.reason] : ""} · ${formatDate(i.issuedOn)}` : "Yuklanmoqda…"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 border-y bg-muted/30">
          <div className="p-6">
            {!i ? (
              <div className="h-64 skeleton-shimmer rounded-lg" />
            ) : (
              <div className="print-surface mx-auto max-w-[210mm] rounded bg-white p-8 text-black shadow-sm" data-testid="issue-document">
                <div className="flex items-start justify-between border-b-2 border-black/80 pb-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {title} № {i.number}
                    </h2>
                    <p className="text-sm text-black/60">Sana: {formatDate(i.issuedOn)}</p>
                  </div>
                  {i.cancelledAt && (
                    <span className="rounded border-2 border-rose-600 px-3 py-1 text-sm font-bold uppercase text-rose-600" data-testid="stamp-issue-cancelled">
                      Bekor qilingan
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  {i.kind === "department" ? (
                    <>
                      <div>
                        <dt className="inline text-black/60">Bo'lim: </dt>
                        <dd className="inline font-semibold">{i.departmentName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-black/60">Oldi: </dt>
                        <dd className="inline">{i.receivedBy ?? "—"}</dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt className="inline text-black/60">Sabab: </dt>
                      <dd className="inline font-semibold">{i.reason ? WRITEOFF_REASON_LABELS[i.reason] : "—"}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline text-black/60">Berdi: </dt>
                    <dd className="inline">{i.createdByName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-black/60">Rasmiylashtirildi: </dt>
                    <dd className="inline">{formatDateTime(i.createdAt)}</dd>
                  </div>
                </dl>
                <table className="mt-5 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y-2 border-black/70 text-left">
                      <th className="py-2 pr-2 font-semibold">№</th>
                      <th className="py-2 pr-2 font-semibold">Mahsulot</th>
                      <th className="py-2 pr-2 font-semibold">LOT</th>
                      <th className="py-2 pr-2 font-semibold">Muddati</th>
                      <th className="py-2 pr-2 text-right font-semibold">Miqdor</th>
                      <th className="py-2 pr-2 text-right font-semibold">Narx</th>
                      <th className="py-2 text-right font-semibold">Tannarx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {i.lines.map((l, n) => (
                      <tr key={l.movementId} className="border-b border-black/15" data-testid={`issue-doc-line-${n}`}>
                        <td className="py-1.5 pr-2 tabular">{n + 1}</td>
                        <td className="py-1.5 pr-2">{l.itemName}</td>
                        <td className="py-1.5 pr-2 font-mono text-xs">{l.lotNumber ?? "—"}</td>
                        <td className="py-1.5 pr-2 tabular">{l.expiresOn ? formatDate(l.expiresOn) : "—"}</td>
                        <td className="py-1.5 pr-2 text-right tabular">
                          {fmtQty(l.quantity)} {l.unit}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular">{money(l.purchasePrice, false)}</td>
                        <td className="py-1.5 text-right tabular">{money(lineTotal(l.quantity, l.purchasePrice), false)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="pt-3 text-right font-semibold">
                        Jami tannarx:
                      </td>
                      <td className="pt-3 text-right font-bold tabular">{money(i.total)}</td>
                    </tr>
                  </tfoot>
                </table>
                {i.notes && <p className="mt-4 text-sm">Izoh: {i.notes}</p>}
                {i.cancelledAt && (
                  <p className="mt-4 text-sm text-rose-700">
                    Bekor qilindi: {formatDateTime(i.cancelledAt)}, {i.cancelledByName}. Sabab: {i.cancelReason}
                  </p>
                )}
                <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
                  <div className="border-t border-black/50 pt-1 text-black/60">Berdi (omborchi): {i.createdByName}</div>
                  <div className="border-t border-black/50 pt-1 text-black/60">
                    {i.kind === "department" ? `Oldi: ${i.receivedBy ?? ""}` : "Tasdiqladi (komissiya)"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="no-print gap-2 p-4 sm:justify-between">
          <div>
            {i && !i.cancelledAt && can("inventory.manage") && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setCancelError(null);
                  setCancelling(true);
                }}
                data-testid="button-cancel-issue"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Chiqimni bekor qilish
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => window.print()} disabled={!i} data-testid="button-print-issue">
              <Printer className="mr-2 h-4 w-4" />
              Chop etish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <TextPromptDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Chiqim №${i?.number ?? ""} bekor qilinsinmi?`}
        description="Hujjat o'chirilmaydi. Har bir miqdor o'zi olingan partiyaga qaytariladi."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={cancel.isPending}
        error={cancelError}
        onConfirm={(r) => cancel.mutate(r)}
        testId="issue-cancel"
      />
    </Dialog>
  );
}
