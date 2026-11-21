/**
 * Kassa smenasi (B7.5, TZ §9.2 "Kassa smenasini yopish"): the bar on the cash
 * desk, opening, closing with the drawer count, the shift report (printable)
 * and the shifts list. Rules: shared/cash-shift.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, Landmark, Loader2, Lock, LockOpen, Printer, ScrollText, Wallet } from "lucide-react";
import type { CashDesk, PaymentMethod, ShiftReport, ShiftSummary } from "@shared/schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/schema";
import {
  COUNT_OUTCOME_LABELS,
  LONG_SHIFT_HOURS,
  SHIFT_ENTRY_LABELS,
  UZS_DENOMINATIONS,
  closeProblem,
  countOutcome,
  describeDuration,
  sumDenominations,
  type CountOutcome,
  type Denominations,
} from "@shared/cash-shift";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput } from "@/components/inputs";
import { ReceiptSlipDialog } from "@/components/cashier/receipt-slip";
import { apiRequest, invalidateApi, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, money } from "@/lib/format";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { naqd: Banknote, karta: CreditCard, "o'tkazma": Landmark };
const OUTCOME_TONE: Record<CountOutcome, string> = {
  match: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  short: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  over: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
};
const OUTCOME_ICON: Record<CountOutcome, typeof CheckCircle2> = { match: CheckCircle2, short: AlertTriangle, over: AlertTriangle };
const signed = (n: number) => (n > 0 ? `+${money(n)}` : n < 0 ? `−${money(-n)}` : money(0));

/** Whether this user handles money (and so has a shift of their own). Approving refunds (payments.refund) moves none. */
export function useHandlesMoney() {
  const { can } = useAuth();
  return can("payments.create");
}

/** The person at the desk: their open shift and what the last one left. */
export function useCashDesk() {
  const handles = useHandlesMoney();
  return useQuery<CashDesk>({ queryKey: ["/api/cash-shifts/current"], enabled: handles, refetchOnMount: "always", refetchInterval: 30_000 });
}

export const refreshShifts = () => invalidateApi("/api/cash-shifts", "/api/cashier");

// ---------------------------------------------------------------- bar

export function ShiftBar() {
  const { data: desk, isLoading } = useCashDesk();
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  if (isLoading || !desk) return <div className="h-24 skeleton-shimmer rounded-xl" />;
  const shift = desk.shift;

  return (
    <>
      {!shift ? (
        <div className="card-premium flex flex-col gap-3 border-amber-500/30 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="shift-bar-closed">
          <div className="flex items-start gap-3">
            <div className="icon-tile h-10 w-10 shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Smena ochilmagan</p>
              <p className="text-sm text-muted-foreground">
                To'lov qabul qilish va qaytarish uchun kassa smenasini oching.
                {desk.last ? ` Oldingi Smena №${desk.last.number} kassada ${money(desk.last.carriedCash)} qoldirgan.` : ""}
              </p>
            </div>
          </div>
          <Button className="shadow-brand" onClick={() => setOpening(true)} data-testid="button-open-shift">
            <LockOpen className="mr-2 h-4 w-4" />
            Smenani ochish
          </Button>
        </div>
      ) : (
        <div className="card-premium p-4" data-testid="shift-bar-open">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="icon-tile h-10 w-10 shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  Smena №{shift.number}
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    ochiq
                  </Badge>
                </p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(shift.openedAt)} dan · {describeDuration(shift.hours)}
                </p>
                {shift.hours >= LONG_SHIFT_HOURS && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Smena {LONG_SHIFT_HOURS} soatdan ortiq ochiq — yopishni unutmang
                  </p>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Kassada bo'lishi kerak</dt>
                <dd className="text-lg font-bold tabular" data-testid="shift-expected">
                  {money(shift.totals.expectedCash)}
                </dd>
              </div>
              {PAYMENT_METHODS.map((m) => (
                <div key={m}>
                  <dt className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[m]}</dt>
                  <dd className="font-semibold tabular">{money(shift.totals.byMethod[m].net)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReport(shift.id)} data-testid="button-shift-report">
                <ScrollText className="mr-2 h-4 w-4" />
                Hisobot
              </Button>
              <Button onClick={() => setClosing(true)} data-testid="button-close-shift">
                <Lock className="mr-2 h-4 w-4" />
                Smenani yopish
              </Button>
            </div>
          </div>
        </div>
      )}
      <OpenShiftDialog open={opening} onOpenChange={setOpening} desk={desk} />
      {shift && (
        <CloseShiftDialog
          open={closing}
          onOpenChange={setClosing}
          shift={shift}
          onClosed={(id) => {
            setClosing(false);
            setReport(id);
          }}
        />
      )}
      <ShiftReportDialog shiftId={report} onClose={() => setReport(null)} />
    </>
  );
}

// ---------------------------------------------------------------- open

export function OpenShiftDialog({ open, onOpenChange, desk }: { open: boolean; onOpenChange: (o: boolean) => void; desk: CashDesk | undefined }) {
  const { toast } = useToast();
  const suggested = desk?.last?.carriedCash ?? 0;
  const [cash, setCash] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const value = cash ?? suggested;
  const mutation = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", "/api/cash-shifts", { openingCash: value, note: note.trim() || null })).json()) as ShiftReport,
    onSuccess: (s) => {
      queryClient.setQueryData(["/api/cash-shifts/current"], { shift: s, last: desk?.last ?? null } satisfies CashDesk);
      refreshShifts();
      onOpenChange(false);
      setCash(null);
      setNote("");
      toast({ title: `Smena №${s.number} ochildi`, description: `Kassada: ${money(s.openingCash)}` });
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kassa smenasini ochish</DialogTitle>
          <DialogDescription>Kassadagi boshlang'ich naqd pulni sanab kiriting. Smena davomidagi har bir to'lov shu smenaga yoziladi.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="shift-opening">Kassadagi naqd (boshlang'ich)</Label>
            <MoneyInput id="shift-opening" value={value} onChange={setCash} data-testid="input-shift-opening" />
            {desk?.last && (
              <p className={cn("text-xs", value !== suggested ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                Oldingi Smena №{desk.last.number} kassada {money(suggested)} qoldirgan{value !== suggested ? " — farqni izohda yozing" : ""}.
              </p>
            )}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)" maxLength={500} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="shadow-brand" disabled={mutation.isPending} data-testid="button-confirm-open-shift">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockOpen className="mr-2 h-4 w-4" />}
              Smenani ochish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- close

export function CloseShiftDialog({
  open,
  onOpenChange,
  shift,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift: ShiftSummary;
  onClosed: (id: string) => void;
}) {
  const { toast } = useToast();
  const [byNotes, setByNotes] = useState(false);
  const [notes, setNotes] = useState<Denominations>({});
  const [typed, setTyped] = useState<number | null>(null);
  const [carried, setCarried] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = shift.totals;
  const counted = byNotes ? sumDenominations(notes) : (typed ?? 0);
  const entered = byNotes ? counted > 0 || Object.keys(notes).length > 0 : typed !== null;
  const diff = counted - t.expectedCash;
  const outcome = countOutcome(diff);
  const OutcomeIcon = OUTCOME_ICON[outcome];
  const problem = entered ? closeProblem({ countedCash: counted, carriedCash: carried, note }, t.expectedCash) : "Kassadagi naqd pulni sanab kiriting";

  const mutation = useMutation({
    mutationFn: async () =>
      (await (
        await apiRequest("POST", `/api/cash-shifts/${shift.id}/close`, {
          countedCash: counted,
          carriedCash: carried,
          expectedCash: t.expectedCash,
          denominations: byNotes ? notes : null,
          note: note.trim() || null,
        })
      ).json()) as ShiftReport,
    onSuccess: (s) => {
      queryClient.setQueryData([`/api/cash-shifts/${s.id}`], s);
      refreshShifts();
      toast({ title: `Smena №${s.number} yopildi`, description: s.difference ? `${COUNT_OUTCOME_LABELS[countOutcome(s.difference)]}: ${money(Math.abs(s.difference))}` : "Kassa mos keldi" });
      setNotes({});
      setTyped(null);
      setCarried(0);
      setNote("");
      onClosed(s.id);
    },
    onError: (e: Error) => {
      setError(e.message);
      refreshShifts();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Smena №{shift.number} ni yopish</DialogTitle>
          <DialogDescription>
            {shift.cashierName} · {formatDateTime(shift.openedAt)} dan · {describeDuration(shift.hours)}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <form
            id="close-shift-form"
            className="space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!problem) mutation.mutate();
            }}
          >
            <div className="rounded-xl border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Boshlang'ich naqd</span>
                <Money value={t.openingCash} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ Naqd qabul qilindi</span>
                <Money value={t.byMethod.naqd.taken} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">− Naqd qaytarildi</span>
                <Money value={t.byMethod.naqd.refunded} />
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <span>Kassada bo'lishi kerak</span>
                <span className="tabular" data-testid="close-expected">
                  {money(t.expectedCash)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Kassaga kirmaydi: terminal {money(t.byMethod.karta.net)}, bank o'tkazmasi {money(t.byMethod["o'tkazma"].net)} — ular terminal hisoboti va bank ko'chirmasi bilan solishtiriladi.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="shift-counted">Kassada sanalgan naqd</Label>
                <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setByNotes((v) => !v)} data-testid="toggle-denominations">
                  {byNotes ? "Summani to'g'ridan-to'g'ri kiritish" : "Kupyuralar bo'yicha sanash"}
                </button>
              </div>
              {byNotes ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="denominations">
                  {UZS_DENOMINATIONS.map((d) => (
                    <label key={d} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 text-right font-medium tabular">{money(d, false)}</span>
                      <span className="text-muted-foreground">×</span>
                      <Input
                        inputMode="numeric"
                        className="h-8 w-14 shrink-0 px-2 text-right tabular"
                        value={notes[String(d)] ?? ""}
                        onChange={(e) => {
                          const n = Math.max(0, Math.trunc(Number(e.target.value.replace(/\D/g, "")) || 0));
                          setNotes((prev) => ({ ...prev, [String(d)]: n }));
                        }}
                        aria-label={`${money(d)} soni`}
                        data-testid={`input-note-${d}`}
                      />
                    </label>
                  ))}
                  <p className="col-span-full text-right text-sm font-semibold tabular">Jami: {money(counted)}</p>
                </div>
              ) : (
                <MoneyInput id="shift-counted" value={typed ?? ""} onChange={setTyped} data-testid="input-shift-counted" />
              )}
            </div>

            {entered && (
              <div className={cn("flex items-center gap-3 rounded-xl border p-3", OUTCOME_TONE[outcome])} data-testid="close-outcome">
                <OutcomeIcon className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">
                    {COUNT_OUTCOME_LABELS[outcome]}
                    {diff !== 0 && <span className="tabular"> {signed(diff)}</span>}
                  </p>
                  <p className="text-xs opacity-80">{outcome === "match" ? "Sanalgan summa kutilgan summaga teng." : "Smena baribir yopiladi; farq va uning sababi hisobotda qoladi."}</p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shift-carried">Kassada qoldiriladi (keyingi smena uchun)</Label>
                <MoneyInput id="shift-carried" value={carried} onChange={setCarried} data-testid="input-shift-carried" />
              </div>
              <div className="space-y-1.5">
                <Label>Topshiriladi</Label>
                <p className="flex h-10 items-center justify-end rounded-md border bg-muted/30 px-3 font-semibold tabular" data-testid="close-handover">
                  {money(Math.max(0, counted - carried))}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shift-note">Izoh{diff !== 0 && entered ? " (majburiy: farq sababi)" : ""}</Label>
              <Textarea id="shift-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} data-testid="input-shift-note" />
            </div>
            {(error || (entered && problem)) && (
              <p className="text-sm text-destructive" data-testid="text-close-error">
                {error ?? problem}
              </p>
            )}
          </form>
        </ScrollArea>
        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="close-shift-form" disabled={Boolean(problem) || mutation.isPending} data-testid="button-confirm-close-shift">
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Smenani yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- report

export function ShiftReportDialog({ shiftId, onClose }: { shiftId: string | null; onClose: () => void }) {
  const { user, can } = useAuth();
  const handles = useHandlesMoney();
  const { data: r } = useQuery<ShiftReport>({ queryKey: [`/api/cash-shifts/${shiftId}`], enabled: Boolean(shiftId), refetchOnMount: "always" });
  const [closing, setClosing] = useState(false);
  const [slipFor, setSlipFor] = useState<string | null>(null);
  const mayClose = r && !r.closedAt && (r.cashierId === user?.id ? handles : can("shifts.manage"));

  return (
    <Dialog open={Boolean(shiftId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            {r ? `Smena №${r.number} hisoboti` : "Smena hisoboti"}
          </DialogTitle>
          <DialogDescription>{r ? (r.closedAt ? "Yakuniy hisobot (smena yopilgan)" : "Oraliq hisobot (smena ochiq)") : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          {!r ? (
            <div className="m-6 h-64 skeleton-shimmer rounded-lg" />
          ) : (
            <div className="print-surface space-y-5 p-6 text-sm" data-testid="shift-report">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div>
                  <h2 className="text-lg font-bold">
                    SMENA HISOBOTI № {r.number} <span className="text-sm font-normal text-muted-foreground">({r.closedAt ? "yakuniy" : "oraliq"})</span>
                  </h2>
                  <p>Kassir: {r.cashierName}</p>
                  <p>
                    Ochildi: {formatDateTime(r.openedAt)}
                    {r.closedAt ? ` · Yopildi: ${formatDateTime(r.closedAt)}${r.closedByName && r.closedBy !== r.cashierId ? ` (${r.closedByName})` : ""}` : ""} · {describeDuration(r.hours)}
                  </p>
                </div>
                {r.closedAt ? (
                  <Badge variant="outline" className={cn("font-medium", OUTCOME_TONE[countOutcome(r.difference ?? 0)])} data-testid="report-outcome">
                    {COUNT_OUTCOME_LABELS[countOutcome(r.difference ?? 0)]}
                    {r.difference ? ` ${signed(r.difference)}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    ochiq
                  </Badge>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To'lov usuli</TableHead>
                    <TableHead className="text-right">Qabul qilindi</TableHead>
                    <TableHead className="text-right">Qaytarildi</TableHead>
                    <TableHead className="text-right">Sof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PAYMENT_METHODS.map((m) => (
                    <TableRow key={m} data-testid={`report-method-${m}`}>
                      <TableCell>{PAYMENT_METHOD_LABELS[m]}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.totals.byMethod[m].taken} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={r.totals.byMethod[m].refunded} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Money value={r.totals.byMethod[m].net} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Jami</TableCell>
                    <TableCell className="text-right">
                      <Money value={r.totals.taken} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={r.totals.refunded} />
                    </TableCell>
                    <TableCell className="text-right" data-testid="report-net">
                      <Money value={r.totals.net} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                {r.totals.payments} ta to'lov, {r.totals.refunds} ta qaytarish
                {r.totals.voided.count ? `; bekor qilingan: ${r.totals.voided.count} ta (${money(r.totals.voided.amount)}) — hisobga kirmaydi` : ""}.
              </p>

              <div className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2">
                <Figure label="Boshlang'ich naqd" value={r.totals.openingCash} />
                <Figure label="Kassada bo'lishi kerak" value={r.totals.expectedCash} strong testId="report-expected" />
                {r.closedAt && (
                  <>
                    <Figure label="Sanalgan" value={r.countedCash ?? 0} strong testId="report-counted" />
                    <Figure label="Farq" text={signed(r.difference ?? 0)} />
                    <Figure label="Topshirildi" value={(r.countedCash ?? 0) - (r.carriedCash ?? 0)} />
                    <Figure label="Kassada qoldirildi" value={r.carriedCash ?? 0} />
                  </>
                )}
              </div>
              {(r.openingNote || r.closingNote) && (
                <div className="space-y-1 text-sm">
                  {r.openingNote && <p>Ochishdagi izoh: {r.openingNote}</p>}
                  {r.closingNote && <p data-testid="report-note">Yopishdagi izoh: {r.closingNote}</p>}
                </div>
              )}
              {r.denominations && (
                <div className="print-avoid-break">
                  <p className="mb-1 font-semibold">Kupyuralar</p>
                  <p className="text-muted-foreground">
                    {Object.entries(r.denominations)
                      .sort((a, b) => Number(b[0]) - Number(a[0]))
                      .map(([d, n]) => `${money(Number(d), false)} × ${n}`)
                      .join(" · ")}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-2 font-semibold">Smena davomidagi amallar ({r.entries.length})</p>
                {r.entries.length === 0 ? (
                  <p className="text-muted-foreground">Bu smenada to'lov qayd etilmagan.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vaqt</TableHead>
                        <TableHead>Amal</TableHead>
                        <TableHead className="hidden sm:table-cell">Bemor</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.entries.map((e) => {
                        const Icon = METHOD_ICON[e.method];
                        return (
                          <TableRow key={e.key} className={cn(e.voidedAt && "opacity-60")} data-testid={`report-entry-${e.kind}`}>
                            <TableCell className="whitespace-nowrap tabular">{formatTime(e.createdAt)}</TableCell>
                            <TableCell>
                              <p className="font-medium">{e.title}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Icon className="h-3 w-3" />
                                {SHIFT_ENTRY_LABELS[e.kind]} · {PAYMENT_METHOD_LABELS[e.method]}
                                <span className="sm:hidden"> · {e.patientName ?? "—"}</span>
                              </p>
                              {e.voidedAt && <p className="text-xs text-rose-700 dark:text-rose-300">Bekor qilingan: {e.voidReason}</p>}
                              {e.kind === "receipt" && (
                                <button type="button" className="no-print mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setSlipFor(e.key)} data-testid={`report-slip-${e.key}`}>
                                  <Printer className="h-3 w-3" />
                                  Chek
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {e.patientName ?? "—"}
                              {e.patientNumber ? <span className="text-xs text-muted-foreground"> #{e.patientNumber}</span> : null}
                            </TableCell>
                            <TableCell className={cn("text-right font-medium tabular", e.voidedAt && "line-through", e.amount < 0 && "text-rose-700 dark:text-rose-300")}>{signed(e.amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="hidden grid-cols-2 gap-8 pt-10 print:grid">
                <p className="border-t border-black pt-1">Kassir: {r.cashierName}</p>
                <p className="border-t border-black pt-1">Qabul qilib oldi:</p>
              </div>
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="no-print gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!r} data-testid="button-print-shift">
            <Printer className="mr-2 h-4 w-4" />
            Chop etish
          </Button>
          {mayClose && (
            <Button onClick={() => setClosing(true)} data-testid="button-report-close-shift">
              <Lock className="mr-2 h-4 w-4" />
              Smenani yopish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <ReceiptSlipDialog receiptId={slipFor} onClose={() => setSlipFor(null)} />
      {r && !r.closedAt && <CloseShiftDialog open={closing} onOpenChange={setClosing} shift={r} onClosed={() => setClosing(false)} />}
    </Dialog>
  );
}

function Figure({ label, value, text, strong, testId }: { label: string; value?: number; text?: string; strong?: boolean; testId?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular", strong && "font-bold")} data-testid={testId}>
        {text ?? money(value ?? 0)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- list

type ShiftPeriod = "today" | "week" | "month" | "all";
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function ShiftsTab() {
  const { can } = useAuth();
  const all = can("shifts.read");
  const [period, setPeriod] = useState<ShiftPeriod>("week");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [cashier, setCashier] = useState("all");
  const [report, setReport] = useState<string | null>(null);
  const params = new URLSearchParams();
  const from = period === "today" ? localDay() : period === "week" ? localDay(-6) : period === "month" ? localDay(-29) : null;
  if (from) {
    params.set("from", from);
    params.set("to", localDay());
  }
  if (onlyOpen) params.set("status", "open");
  const { data: shifts = [], isLoading } = useQuery<ShiftSummary[]>({ queryKey: [`/api/cash-shifts?${params.toString()}`], refetchOnMount: "always", refetchInterval: 60_000 });
  const cashiers = useMemo(() => Array.from(new Map(shifts.map((s) => [s.cashierId, s.cashierName])).entries()), [shifts]);
  const rows = shifts.filter((s) => cashier === "all" || s.cashierId === cashier);
  const sums = rows.reduce(
    (acc, s) => ({
      net: acc.net + s.totals.net,
      open: acc.open + (s.closedAt ? 0 : 1),
      short: acc.short + Math.min(0, s.difference ?? 0),
      over: acc.over + Math.max(0, s.difference ?? 0),
    }),
    { net: 0, open: 0, short: 0, over: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Smenalar" value={rows.length} hint={sums.open ? `${sums.open} tasi ochiq` : "Hammasi yopilgan"} icon={Wallet} isLoading={isLoading} />
        <StatCard index={1} label="Sof tushum" value={money(sums.net)} hint="Barcha usullar, qaytarishlarsiz" icon={Banknote} tone="emerald" isLoading={isLoading} />
        <StatCard index={2} label="Kamomad" value={money(-sums.short)} icon={AlertTriangle} tone={sums.short ? "rose" : "emerald"} isLoading={isLoading} />
        <StatCard index={3} label="Ortiqcha" value={money(sums.over)} icon={AlertTriangle} tone={sums.over ? "amber" : "emerald"} isLoading={isLoading} />
      </div>
      <div className="card-premium flex flex-wrap items-center gap-2 p-3">
        {(
          [
            ["today", "Bugun"],
            ["week", "7 kun"],
            ["month", "30 kun"],
            ["all", "Butun davr"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={period === k}
            onClick={() => setPeriod(k)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
            data-testid={`shift-period-${k}`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <button
          type="button"
          aria-pressed={onlyOpen}
          onClick={() => setOnlyOpen((v) => !v)}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", onlyOpen ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
          data-testid="shift-filter-open"
        >
          Faqat ochiqlar
        </button>
        {all && cashiers.length > 1 && (
          <select className="h-8 rounded-md border bg-card px-2 text-xs" value={cashier} onChange={(e) => setCashier(e.target.value)} aria-label="Kassir">
            <option value="all">Barcha kassirlar</option>
            {cashiers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="Smena yo'q" description="Bu davrda kassa smenasi ochilmagan." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Smena</TableHead>
                  <TableHead className="hidden md:table-cell">Vaqt</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Naqd</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Terminal</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">O'tkazma</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Kutilgan</TableHead>
                  <TableHead className="text-right">Kassa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const outcome = countOutcome(s.difference ?? 0);
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setReport(s.id)} data-testid={`row-shift-${s.number}`}>
                      <TableCell>
                        <p className="font-medium">Smena №{s.number}</p>
                        <p className="text-xs text-muted-foreground">{s.cashierName}</p>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm md:table-cell">
                        <p className="tabular">{formatDateTime(s.openedAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.closedAt ? `${formatTime(s.closedAt)} gacha` : "hali ochiq"} · {describeDuration(s.hours)}
                        </p>
                      </TableCell>
                      {PAYMENT_METHODS.map((m) => (
                        <TableCell key={m} className="hidden text-right lg:table-cell">
                          <Money value={s.totals.byMethod[m].net} />
                        </TableCell>
                      ))}
                      <TableCell className="hidden text-right sm:table-cell">
                        <Money value={s.totals.expectedCash} />
                      </TableCell>
                      <TableCell className="text-right">
                        {s.closedAt ? (
                          <Badge variant="outline" className={cn("font-medium", OUTCOME_TONE[outcome])}>
                            {COUNT_OUTCOME_LABELS[outcome]}
                            {s.difference ? ` ${signed(s.difference)}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            ochiq
                          </Badge>
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
      <ShiftReportDialog shiftId={report} onClose={() => setReport(null)} />
    </div>
  );
}
