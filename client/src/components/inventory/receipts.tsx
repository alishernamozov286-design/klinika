/**
 * Kirim (B5.2, TZ §7.3): receipt documents — supplier, LOT, expiry, quantity,
 * purchase price. Each line becomes a batch; a receipt is cancelled (with a
 * reason) only while nothing from it has been used. Rules: shared/inventory.ts.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, PackagePlus, Plus, Printer, Trash2, Truck, XCircle } from "lucide-react";
import type { InventoryItemView, StockReceiptDetail, StockReceiptView } from "@shared/schema";
import { MAX_RECEIPT_LINES, isLotTracked, lineTotal } from "@shared/inventory";
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
import { MoneyInput } from "@/components/inputs";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

const qty = (n: number) => String(Number(n.toFixed(3)));
const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function Receipts({ items }: { items: InventoryItemView[] }) {
  const { can } = useAuth();
  const { data: receipts = [], isLoading } = useQuery<StockReceiptView[]>({ queryKey: ["/api/inventory/receipts"], refetchOnMount: "always" });
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const live = receipts.filter((r) => !r.cancelledAt);
  const month = todayLocal().slice(0, 7);
  const thisMonth = live.filter((r) => r.receivedOn.startsWith(month));
  const suppliers = useMemo(() => Array.from(new Set(receipts.map((r) => r.supplier))).sort((a, b) => a.localeCompare(b)), [receipts]);

  return (
    <div className="space-y-4">
      <div className="card-premium flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Kirim hujjatlari</p>
          <p className="text-sm text-muted-foreground">
            Bu oy {thisMonth.length} ta kirim, jami {money(thisMonth.reduce((s, r) => s + r.total, 0))}. Har bir qator LOT va yaroqlilik muddati bilan alohida partiya bo'ladi.
          </p>
        </div>
        {can("inventory.receive") && (
          <Button className="shrink-0 shadow-brand" onClick={() => setCreating(true)} data-testid="button-new-receipt">
            <PackagePlus className="mr-2 h-4 w-4" />
            Yangi kirim
          </Button>
        )}
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : receipts.length === 0 ? (
          <EmptyState icon={Truck} title="Kirim hujjati yo'q" description="Yetkazib beruvchidan kelgan mahsulotni LOT, muddati, miqdori va xarid narxi bilan rasmiylashtiring." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">№</TableHead>
                  <TableHead>Yetkazib beruvchi</TableHead>
                  <TableHead className="hidden md:table-cell">Sana</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Qatorlar</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="hidden lg:table-cell">Kim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id} className={cn("cursor-pointer", r.cancelledAt && "opacity-55")} onClick={() => setOpenId(r.id)} data-testid={`row-receipt-${r.number}`}>
                    <TableCell>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold tabular text-muted-foreground">№{r.number}</span>
                      {r.cancelledAt && (
                        <Badge variant="outline" className="mt-1 block w-fit border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300">
                          Bekor qilingan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{r.supplier}</p>
                      {r.documentNumber && <p className="text-xs text-muted-foreground">Hujjat: {r.documentNumber}</p>}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular md:table-cell">{formatDate(r.receivedOn)}</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">{r.lineCount}</TableCell>
                    <TableCell className={cn("text-right", r.cancelledAt && "line-through")}>
                      <Money value={r.total} />
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{r.createdByName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewReceiptDialog open={creating} onClose={() => setCreating(false)} items={items} suppliers={suppliers} onCreated={(id) => setOpenId(id)} />
      <ReceiptDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- new receipt

/** A line field's label, shown only where the header row is not (phones). */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 lg:space-y-0">
      <span className="text-xs font-medium text-muted-foreground lg:hidden">{label}</span>
      {children}
    </label>
  );
}

type Line = { key: number; itemId: string; lotNumber: string; expiresOn: string; quantity: string; purchasePrice: number };
let lineSeq = 0;
const blankLine = (): Line => ({ key: ++lineSeq, itemId: "", lotNumber: "", expiresOn: "", quantity: "", purchasePrice: 0 });

function NewReceiptDialog({
  open,
  onClose,
  items,
  suppliers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: InventoryItemView[];
  suppliers: string[];
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const active = items.filter((i) => i.isActive);
  const byId = new Map(items.map((i) => [i.id, i]));
  const [supplier, setSupplier] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [receivedOn, setReceivedOn] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSupplier("");
    setDocumentNumber("");
    setReceivedOn(todayLocal());
    setNotes("");
    setLines([blankLine()]);
    setError(null);
  }, [open]);

  // An error is about what was sent; once the form changes it no longer applies.
  useEffect(() => setError(null), [supplier, documentNumber, receivedOn, lines]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const parsedQty = (l: Line) => Number(l.quantity.replace(",", "."));
  const total = lines.reduce((s, l) => s + (parsedQty(l) > 0 ? lineTotal(parsedQty(l), l.purchasePrice) : 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const filled = lines.filter((l) => l.itemId);
      const res = await apiRequest("POST", "/api/inventory/receipts", {
        supplier,
        documentNumber: documentNumber || null,
        receivedOn,
        notes: notes || null,
        lines: filled.map((l) => ({
          itemId: l.itemId,
          lotNumber: l.lotNumber || null,
          expiresOn: l.expiresOn || null,
          quantity: l.quantity.trim() === "" ? Number.NaN : parsedQty(l),
          purchasePrice: l.purchasePrice,
        })),
      });
      return (await res.json()) as StockReceiptDetail;
    },
    onSuccess: (r) => {
      invalidateApi("/api/inventory");
      toast({ title: `Kirim №${r.number} saqlandi`, description: `${r.lines.length} ta partiya omborga qo'shildi` });
      onClose();
      onCreated(r.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Yangi kirim hujjati</DialogTitle>
          <DialogDescription>Reagent, kalibrator, nazorat materiali va dori uchun LOT va yaroqlilik muddati majburiy. Muddati o'tgan mahsulot qabul qilinmaydi.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 border-y">
          <form
            id="receipt-form"
            className="space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rc-supplier">Yetkazib beruvchi</Label>
                <Input id="rc-supplier" list="receipt-suppliers" value={supplier} onChange={(e) => setSupplier(e.target.value)} data-testid="input-receipt-supplier" />
                <datalist id="receipt-suppliers">
                  {suppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-doc">Hujjat raqami (faktura, nakladnoy)</Label>
                <Input id="rc-doc" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="font-mono" data-testid="input-receipt-doc" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-date">Kirim sanasi</Label>
                <Input id="rc-date" type="date" value={receivedOn} max={todayLocal()} onChange={(e) => setReceivedOn(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="hidden grid-cols-[2.2fr_1fr_1fr_0.8fr_1.1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground lg:grid">
                <span>Mahsulot</span>
                <span>LOT</span>
                <span>Yaroqlilik muddati</span>
                <span>Miqdor</span>
                <span>Xarid narxi (birlik)</span>
                <span className="text-right">Summa</span>
                <span className="w-8" />
              </div>
              {lines.map((l, idx) => {
                const it = byId.get(l.itemId);
                const tracked = it ? isLotTracked(it.kind) : false;
                const q = parsedQty(l);
                return (
                  <div
                    key={l.key}
                    className="grid gap-2 rounded-xl border bg-muted/20 p-3 lg:grid-cols-[2.2fr_1fr_1fr_0.8fr_1.1fr_1fr_auto] lg:items-center lg:border-0 lg:bg-transparent lg:p-0"
                    data-testid={`receipt-line-${idx}`}
                  >
                    {/* On a phone each field carries its own label; on a wide screen the header row does. */}
                    <Field label="Mahsulot">
                      <Select value={l.itemId} onValueChange={(v) => setLine(l.key, { itemId: v })}>
                        <SelectTrigger aria-label="Mahsulot" data-testid={`select-line-item-${idx}`}>
                          <SelectValue placeholder="Mahsulotni tanlang" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {active.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} <span className="text-muted-foreground">· {i.unit}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2 lg:contents">
                      <Field label={tracked ? "LOT *" : "LOT"}>
                        <Input
                          aria-label="LOT"
                          placeholder={tracked ? "LOT *" : "LOT"}
                          value={l.lotNumber}
                          onChange={(e) => setLine(l.key, { lotNumber: e.target.value })}
                          className={cn("font-mono", tracked && !l.lotNumber && "border-amber-500/60")}
                          data-testid={`input-line-lot-${idx}`}
                        />
                      </Field>
                      <Field label={tracked ? "Yaroqlilik muddati *" : "Yaroqlilik muddati"}>
                        <Input
                          aria-label="Yaroqlilik muddati"
                          type="date"
                          min={todayLocal()}
                          value={l.expiresOn}
                          onChange={(e) => setLine(l.key, { expiresOn: e.target.value })}
                          className={cn(tracked && !l.expiresOn && "border-amber-500/60")}
                          data-testid={`input-line-exp-${idx}`}
                        />
                      </Field>
                      <Field label={it ? `Miqdor, ${it.unit}` : "Miqdor"}>
                        <Input
                          aria-label="Miqdor"
                          inputMode="decimal"
                          placeholder={it ? it.unit : "0"}
                          value={l.quantity}
                          onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                          className="text-right tabular"
                          title={it ? it.unit : undefined}
                          data-testid={`input-line-qty-${idx}`}
                        />
                      </Field>
                      <Field label="Xarid narxi (birlik)">
                        <MoneyInput value={l.purchasePrice} onChange={(v) => setLine(l.key, { purchasePrice: v })} data-testid={`input-line-price-${idx}`} />
                      </Field>
                    </div>
                    <div className="flex items-center justify-between gap-2 lg:contents">
                      <p className="text-sm font-semibold tabular lg:text-right">
                        <span className="mr-1 font-normal text-muted-foreground lg:hidden">Summa:</span>
                        {q > 0 ? money(lineTotal(q, l.purchasePrice)) : "—"}
                      </p>
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
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lines.length >= MAX_RECEIPT_LINES}
                onClick={() => setLines((ls) => [...ls, blankLine()])}
                data-testid="button-add-line"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Qator qo'shish
              </Button>
              {active.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-300">Katalogda faol mahsulot yo'q — avval "Mahsulotlar" tabida qo'shing.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rc-notes">Izoh</Label>
              <Textarea id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ixtiyoriy" />
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            {error ? (
              <p className="text-destructive" data-testid="text-receipt-error">
                {error}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {lines.filter((l) => l.itemId).length} ta qator · jami <span className="font-semibold text-foreground tabular">{money(total)}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" form="receipt-form" disabled={save.isPending} className="shadow-brand" data-testid="button-save-receipt">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirimni saqlash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- receipt detail

function ReceiptDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data: r } = useQuery<StockReceiptDetail>({ queryKey: [`/api/inventory/receipts/${id}`], enabled: Boolean(id), refetchOnMount: "always" });
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("POST", `/api/inventory/receipts/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      invalidateApi("/api/inventory");
      setCancelling(false);
      toast({ title: "Kirim bekor qilindi", description: "Uning partiyalari qoldiqdan chiqarildi" });
    },
    onError: (err: Error) => setCancelError(err.message),
  });

  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="no-print p-5 pb-4">
          <DialogTitle>Kirim hujjati {r ? `№${r.number}` : ""}</DialogTitle>
          <DialogDescription>{r ? `${r.supplier} · ${formatDate(r.receivedOn)}` : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 border-y bg-muted/30">
          <div className="p-6">
            {!r ? (
              <div className="h-64 skeleton-shimmer rounded-lg" />
            ) : (
              <div className="print-surface mx-auto max-w-[210mm] rounded bg-white p-8 text-black shadow-sm" data-testid="receipt-document">
                <div className="flex items-start justify-between border-b-2 border-black/80 pb-3">
                  <div>
                    <h2 className="text-xl font-bold">KIRIM HUJJATI № {r.number}</h2>
                    <p className="text-sm text-black/60">Sana: {formatDate(r.receivedOn)}</p>
                  </div>
                  {r.cancelledAt && (
                    <span className="rounded border-2 border-rose-600 px-3 py-1 text-sm font-bold uppercase text-rose-600" data-testid="stamp-cancelled">
                      Bekor qilingan
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <div>
                    <dt className="inline text-black/60">Yetkazib beruvchi: </dt>
                    <dd className="inline font-semibold">{r.supplier}</dd>
                  </div>
                  {r.documentNumber && (
                    <div>
                      <dt className="inline text-black/60">Hujjat raqami: </dt>
                      <dd className="inline font-mono">{r.documentNumber}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline text-black/60">Qabul qildi: </dt>
                    <dd className="inline">{r.createdByName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-black/60">Rasmiylashtirildi: </dt>
                    <dd className="inline">{formatDateTime(r.createdAt)}</dd>
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
                      <th className="py-2 text-right font-semibold">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l, i) => (
                      <tr key={l.id} className="border-b border-black/15" data-testid={`receipt-doc-line-${i}`}>
                        <td className="py-1.5 pr-2 tabular">{i + 1}</td>
                        <td className="py-1.5 pr-2">{l.itemName}</td>
                        <td className="py-1.5 pr-2 font-mono text-xs">{l.lotNumber ?? "—"}</td>
                        <td className="py-1.5 pr-2 tabular">{l.expiresOn ? formatDate(l.expiresOn) : "—"}</td>
                        <td className="py-1.5 pr-2 text-right tabular">
                          {qty(l.quantity)} {l.unit}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular">{money(l.purchasePrice, false)}</td>
                        <td className="py-1.5 text-right tabular">{money(lineTotal(l.quantity, l.purchasePrice), false)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="pt-3 text-right font-semibold">
                        Jami:
                      </td>
                      <td className="pt-3 text-right font-bold tabular">{money(r.total)}</td>
                    </tr>
                  </tfoot>
                </table>
                {r.notes && <p className="mt-4 text-sm">Izoh: {r.notes}</p>}
                {r.cancelledAt && (
                  <p className="mt-4 text-sm text-rose-700">
                    Bekor qilindi: {formatDateTime(r.cancelledAt)}, {r.cancelledByName}. Sabab: {r.cancelReason}
                  </p>
                )}
                <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
                  <div className="border-t border-black/50 pt-1 text-black/60">Topshirdi (yetkazib beruvchi)</div>
                  <div className="border-t border-black/50 pt-1 text-black/60">Qabul qildi: {r.createdByName}</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="no-print gap-2 p-4 sm:justify-between">
          <div>
            {r && !r.cancelledAt && can("inventory.manage") && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setCancelError(null);
                  setCancelling(true);
                }}
                data-testid="button-cancel-receipt"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Kirimni bekor qilish
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => window.print()} disabled={!r} data-testid="button-print-receipt">
              <Printer className="mr-2 h-4 w-4" />
              Chop etish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <TextPromptDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Kirim №${r?.number ?? ""} bekor qilinsinmi?`}
        description="Hujjat o'chirilmaydi. Uning partiyalari qoldiqdan chiqariladi. Mahsulotdan foydalanilgan bo'lsa, bekor qilib bo'lmaydi."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={cancel.isPending}
        error={cancelError}
        onConfirm={(reason) => cancel.mutate(reason)}
        testId="receipt-cancel"
      />
    </Dialog>
  );
}

