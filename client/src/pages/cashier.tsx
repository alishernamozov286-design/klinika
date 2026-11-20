/**
 * Kassa: bemor hisobvarag'i (B7.1, TZ §9.1 "Bemor hisobvarag'i", "Qarzdorlik",
 * §9.2 "Bir nechta xizmat uchun umumiy to'lov", "Qisman to'lov").
 *
 * One bill per visit: the consultation, UZI, procedures and lab orders of
 * that day on one sheet, paid with one payment that is split across what is
 * owed. Rules: shared/invoice.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, Banknote, CheckCircle2, CircleDollarSign, CreditCard, Landmark, Loader2, Printer, Receipt, UserRound, Wallet, XCircle } from "lucide-react";
import type { Bill, BillSummary, PaymentMethod } from "@shared/schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/schema";
import { BILL_STATUS_LABELS, lineDue, type BillFilter, type BillStatus } from "@shared/invoice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, PageHeader, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput, SearchInput } from "@/components/inputs";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { apiRequest, invalidateApi, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const STATUS_TONE: Record<BillStatus, string> = {
  empty: "border-border bg-muted text-muted-foreground",
  unpaid: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  partial: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  paid: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  overpaid: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};
const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { naqd: Banknote, karta: CreditCard, "o'tkazma": Landmark };

type Period = "today" | "yesterday" | "week" | "custom" | "all";

export default function Cashier() {
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(localDay());
  const [to, setTo] = useState(localDay());
  const [filter, setFilter] = useState<BillFilter>("all");
  const [search, setSearch] = useState("");
  const [openVisit, setOpenVisit] = useState<string | null>(null);

  const range = period === "today" ? [localDay(), localDay()] : period === "yesterday" ? [localDay(-1), localDay(-1)] : period === "week" ? [localDay(-6), localDay()] : period === "custom" ? [from, to] : [null, null];
  const params = new URLSearchParams();
  if (range[0]) params.set("from", range[0]);
  if (range[1]) params.set("to", range[1]);
  if (filter !== "all") params.set("status", filter);
  const { data: bills = [], isLoading } = useQuery<BillSummary[]>({ queryKey: [`/api/bills?${params.toString()}`], refetchOnMount: "always", refetchInterval: 30_000 });

  const q = search.trim().toLowerCase();
  const rows = bills.filter((b) => !q || b.patientName.toLowerCase().includes(q) || String(b.patientNumber).includes(q.replace("#", "")));
  const totals = useMemo(() => rows.reduce((s, b) => ({ amount: s.amount + b.totals.amount, paid: s.paid + b.totals.paid, due: s.due + b.totals.due }), { amount: 0, paid: 0, due: 0 }), [rows]);
  const debtors = rows.filter((b) => b.totals.due > 0).length;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Bugun" },
    { key: "yesterday", label: "Kecha" },
    { key: "week", label: "7 kun" },
    { key: "all", label: "Butun davr" },
    { key: "custom", label: "Davr…" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Kassa" title="Kassa" description="Bemor hisobvarag'i: bir tashrifdagi barcha xizmatlar — ko'rik, UZI, muolaja, laboratoriya — bitta to'lov bilan (TZ §9)" />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Hisobvaraqlar" value={rows.length} hint={debtors ? `${debtors} tasida qarz bor` : "Qarzdor yo'q"} icon={Receipt} isLoading={isLoading} />
        <StatCard index={1} label="Xizmatlar summasi" value={money(totals.amount)} icon={CircleDollarSign} tone="violet" isLoading={isLoading} />
        <StatCard index={2} label="To'langan" value={money(totals.paid)} icon={CheckCircle2} tone="emerald" isLoading={isLoading} />
        <StatCard index={3} label="Qarz" value={money(totals.due)} hint={totals.due ? "Qisman yoki to'lanmagan" : "Hammasi to'langan"} icon={AlertTriangle} tone={totals.due ? "rose" : "emerald"} isLoading={isLoading} />
      </div>

      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Davr">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", period === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
                data-testid={`bill-period-${p.key}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" aria-label="Davr boshi" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" aria-label="Davr oxiri" />
            </div>
          )}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Holat">
            {(
              [
                ["all", "Hammasi"],
                ["due", "Qarzdorlar"],
                ["settled", "To'langan"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                data-testid={`bill-filter-${k}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Bemor F.I.Sh. yoki ID…" className="lg:w-72" data-testid="input-search-bills" />
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={filter === "due" ? "Qarzdor yo'q" : "Hisobvaraq yo'q"}
            description={filter === "due" ? "Bu davrda to'lanmagan xizmat qolmagan." : "Bemor qabulga kelganda yoki lab buyurtmasi berilganda uning hisobvarag'i shu yerda paydo bo'ladi."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Bemor</TableHead>
                  <TableHead className="hidden md:table-cell">Sana</TableHead>
                  <TableHead className="hidden lg:table-cell">Xizmatlar</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Summa</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">To'langan</TableHead>
                  <TableHead className="text-right">Qarz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.visitId} className="cursor-pointer" onClick={() => setOpenVisit(b.visitId)} data-testid={`row-bill-${b.visitId}`}>
                    <TableCell>
                      <p className="font-medium">{b.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="tabular">#{b.patientNumber}</span>
                        {b.invoiceNumber ? ` · Hisobvaraq №${b.invoiceNumber}` : ""}
                        <span className="md:hidden"> · {formatDate(b.visitDate)}</span>
                      </p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular md:table-cell">{formatDate(b.visitDate)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {[b.appointments ? `${b.appointments} ta qabul` : "", b.orders ? `${b.orders} ta lab buyurtma` : ""].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={b.totals.amount} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={b.totals.paid} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("mb-1 font-medium", STATUS_TONE[b.totals.status])}>
                        {BILL_STATUS_LABELS[b.totals.status]}
                      </Badge>
                      {b.totals.due > 0 && <Money value={b.totals.due} className="block font-semibold text-rose-700 dark:text-rose-300" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <BillDialog visitId={openVisit} onClose={() => setOpenVisit(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- the bill

export function BillDialog({ visitId, onClose }: { visitId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const key = `/api/bills/${visitId}`;
  const { data: bill, isLoading } = useQuery<Bill>({ queryKey: [key], enabled: Boolean(visitId), refetchOnMount: "always" });
  const [amount, setAmount] = useState(0);
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("naqd");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const due = bill?.totals.due ?? 0;
  const value = touched ? amount : due;

  const refresh = (b: Bill) => {
    queryClient.setQueryData([key], b);
    invalidateApi("/api/bills", "/api/orders", "/api/reception", `/api/patients/${b.patient.id}`);
  };
  const reset = () => {
    setAmount(0);
    setTouched(false);
    setNote("");
    setError(null);
  };

  const pay = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/bills/${visitId}/payments`, { amount: value, method, note: note.trim() || null })).json()) as { bill: Bill; taken: number; change: number },
    onSuccess: (r) => {
      refresh(r.bill);
      reset();
      toast({
        title: `${money(r.taken)} qabul qilindi`,
        description: r.change > 0 ? `Qaytim: ${money(r.change)}` : r.bill.totals.due ? `Qoldi: ${money(r.bill.totals.due)}` : "Hisobvaraq to'liq to'landi",
      });
    },
    onError: (err: Error) => setError(err.message),
  });
  const open = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/bills/${visitId}/open`)).json()) as Bill,
    onSuccess: (b) => {
      refresh(b);
      setTimeout(() => window.print(), 150);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Ochilmadi", description: err.message }),
  });
  const voidReceipt = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (await (await apiRequest("POST", `/api/receipts/${id}/void`, { reason })).json()) as Bill,
    onSuccess: (b) => {
      refresh(b);
      setVoiding(null);
      toast({ title: "Kvitansiya bekor qilindi", description: "Summa xizmatlar qarziga qaytdi" });
    },
    onError: (err: Error) => setVoidError(err.message),
  });

  const print = () => (bill?.invoice ? window.print() : can("payments.create") ? open.mutate() : window.print());

  return (
    <Dialog
      open={Boolean(visitId)}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {bill?.invoice ? `Hisobvaraq №${bill.invoice.number}` : "Hisobvaraq"}
          </DialogTitle>
          <DialogDescription>{bill ? `${bill.patient.fullName} · #${bill.patient.patientNumber} · ${formatDate(bill.visitDate)}` : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          {isLoading || !bill ? (
            <div className="m-6 h-64 skeleton-shimmer rounded-lg" />
          ) : (
            <div className="space-y-5 p-6">
              <div className="print-surface rounded-xl border bg-card" data-testid="bill-sheet">
                {/* Printed: the clinic's bill; on screen the same table. */}
                <div className="hidden border-b-2 border-black/80 p-6 pb-3 print:block">
                  <h2 className="text-lg font-bold">HISOBVARAQ № {bill.invoice?.number ?? "—"}</h2>
                  <p className="text-sm">
                    Bemor: {bill.patient.fullName} (#{bill.patient.patientNumber}) · Sana: {formatDate(bill.visitDate)}
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Xizmat</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">To'langan</TableHead>
                      <TableHead className="text-right">Qoldiq</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bill.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          Bu tashrifda hisoblanadigan xizmat yo'q.
                        </TableCell>
                      </TableRow>
                    ) : (
                      bill.lines.map((l) => (
                        <TableRow key={`${l.source}-${l.sourceId}`} className={cn(l.cancelled && "opacity-60")} data-testid={`bill-line-${l.source}-${l.sourceId}`}>
                          <TableCell>
                            <p className="font-medium">
                              {l.title}
                              {l.cancelled && (
                                <Badge variant="outline" className="ml-2 border-rose-500/30 text-[10px] text-rose-700 dark:text-rose-300">
                                  bekor qilingan
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{l.detail}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={l.amount} />
                          </TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <Money value={l.paid} />
                          </TableCell>
                          <TableCell className="text-right">
                            {lineDue(l) > 0 ? <Money value={lineDue(l)} className="font-semibold text-rose-700 dark:text-rose-300" /> : <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">to'langan</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="grid gap-2 border-t bg-muted/30 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Jami</p>
                    <p className="text-lg font-bold tabular" data-testid="bill-total">
                      {money(bill.totals.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">To'langan</p>
                    <p className="text-lg font-bold tabular text-emerald-700 dark:text-emerald-400">{money(bill.totals.paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qarz</p>
                    <p className={cn("text-lg font-bold tabular", bill.totals.due ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")} data-testid="bill-due">
                      {money(bill.totals.due)}
                    </p>
                  </div>
                </div>
                {bill.totals.credit > 0 && (
                  <p className="flex items-start gap-2 border-t px-4 py-3 text-sm text-sky-800 dark:text-sky-200" data-testid="bill-credit">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {money(bill.totals.credit)} bekor qilingan yoki arzonlashgan xizmatga to'langan — bemorga qaytariladi (to'lovni qaytarish vakolatli shaxs tasdig'i bilan).
                  </p>
                )}
              </div>

              {can("payments.create") && due > 0 && (
                <form
                  className="rounded-xl border p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    pay.mutate();
                  }}
                  data-testid="bill-pay-form"
                >
                  <p className="mb-3 text-sm font-semibold">To'lov qabul qilish</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                      <Label htmlFor="bill-amount">Summa</Label>
                      <MoneyInput
                        id="bill-amount"
                        value={value}
                        onChange={(v) => {
                          setTouched(true);
                          setAmount(v);
                        }}
                        data-testid="input-bill-amount"
                      />
                      <p className="text-xs text-muted-foreground">
                        Qarz: {money(due)}. Kamroq bo'lsa — qisman to'lov (eng eski xizmatdan boshlab yopiladi); ko'p bo'lsa — ortig'i qaytim.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Usul</Label>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="To'lov usuli">
                        {PAYMENT_METHODS.map((m) => {
                          const Icon = METHOD_ICON[m];
                          return (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={method === m}
                              onClick={() => setMethod(m)}
                              className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                                method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40",
                              )}
                              data-testid={`bill-method-${m}`}
                            >
                              <Icon className="h-4 w-4" />
                              {PAYMENT_METHOD_LABELS[m]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)" maxLength={300} className="sm:col-span-2" />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-destructive" data-testid="text-bill-error">
                      {error}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" className="shadow-brand" disabled={pay.isPending || value <= 0} data-testid="button-take-payment">
                      {pay.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                      {money(value)} qabul qilish
                    </Button>
                  </div>
                </form>
              )}

              <div className="no-print space-y-2">
                <p className="text-sm font-semibold">Kvitansiyalar</p>
                {bill.receipts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Hisobvaraq orqali hali to'lov qabul qilinmagan.{bill.totals.paid > 0 ? " To'langan summa lab buyurtmasining o'zida olingan." : ""}</p>
                ) : (
                  <ul className="divide-y rounded-xl border" data-testid="bill-receipts">
                    {bill.receipts.map((r) => {
                      const Icon = METHOD_ICON[r.method];
                      return (
                        <li key={r.id} className={cn("flex items-start gap-3 p-3", r.voidedAt && "opacity-60")} data-testid={`receipt-${r.number}`}>
                          <div className="icon-tile mt-0.5 h-8 w-8 shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              Kvitansiya №{r.number} · <span className={cn("tabular", r.voidedAt && "line-through")}>{money(r.amount)}</span> · {PAYMENT_METHOD_LABELS[r.method]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(r.createdAt)} · {r.createdByName ?? "—"} · {r.shares.map((s) => `${s.title} ${money(s.amount)}`).join(" + ")}
                            </p>
                            {r.voidedAt && (
                              <p className="text-xs text-rose-700 dark:text-rose-300">
                                Bekor qilindi: {formatDateTime(r.voidedAt)}, {r.voidedByName}. Sabab: {r.voidReason}
                              </p>
                            )}
                          </div>
                          {!r.voidedAt && can("payments.delete") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Kvitansiyani bekor qilish"
                              aria-label="Kvitansiyani bekor qilish"
                              onClick={() => {
                                setVoidError(null);
                                setVoiding(r.id);
                              }}
                              data-testid={`button-void-receipt-${r.number}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
        <DialogFooter className="no-print gap-2 border-t p-4 sm:justify-between">
          {bill ? (
            <Button variant="ghost" asChild>
              <Link href={`/patients/${bill.patient.id}`}>
                <UserRound className="mr-2 h-4 w-4" />
                Bemor kartasi
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button variant="outline" onClick={print} disabled={!bill || open.isPending} data-testid="button-print-bill">
              {open.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Chop etish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <TextPromptDialog
        open={!!voiding}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Kvitansiya bekor qilinsinmi?"
        description="Kvitansiya va uning har bir ulushi bekor qilinadi, summa xizmatlar qarziga qaytadi. Yozuv o'chirilmaydi."
        label="Sabab"
        confirmLabel="Bekor qilish"
        destructive
        pending={voidReceipt.isPending}
        error={voidError}
        onConfirm={(reason) => voiding && voidReceipt.mutate({ id: voiding, reason })}
        testId="receipt-void"
      />
    </Dialog>
  );
}

