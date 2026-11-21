/**
 * To'lovni qaytarish (B7.4, TZ §9.2, §9.1 "Qaytarilgan to'lovlar"): the
 * request from a bill, the approval by someone else who may refund, the payout
 * from the cashier's open shift, and the desk's list of refunds.
 * Rules: shared/refund.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Landmark, Loader2, Printer, ShieldCheck, Undo2, XCircle } from "lucide-react";
import type { Bill, PaymentMethod, RefundView } from "@shared/schema";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/schema";
import { REFUND_STATUS_LABELS, refundAvailable, type RefundStatus } from "@shared/refund";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, StatCard, TableSkeleton } from "@/components/ui-kit";
import { MoneyInput } from "@/components/inputs";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { RefundSlipDialog } from "@/components/cashier/receipt-slip";
import { useCashDesk } from "@/components/cashier/shift";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = { naqd: Banknote, karta: CreditCard, "o'tkazma": Landmark };
const STATUS_TONE: Record<RefundStatus, string> = {
  requested: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const refreshRefunds = () => invalidateApi("/api/refunds", "/api/bills", "/api/cash-shifts", "/api/cashier", "/api/orders", "/api/patients");

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATUS_TONE[status])} data-testid={`refund-status-${status}`}>
      {REFUND_STATUS_LABELS[status]}
    </Badge>
  );
}

/** What a bill can still refund (its credit, less open requests). */
export const billRefundable = (bill: Bill) => refundAvailable(bill.lines, bill.refunds);

// ---------------------------------------------------------------- request

export function RefundRequestDialog({ bill, open, onOpenChange }: { bill: Bill; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const available = billRefundable(bill);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("naqd");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const value = amount ?? available;
  const mutation = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/bills/${bill.visitId}/refunds`, { amount: value, method, reason: reason.trim() })).json()) as RefundView,
    onSuccess: (r) => {
      refreshRefunds();
      onOpenChange(false);
      setAmount(null);
      setReason("");
      toast({ title: `Qaytarish №${r.number} so'raldi`, description: "Vakolatli xodimga tasdiq uchun yuborildi" });
    },
    onError: (e: Error) => setError(e.message),
  });
  const problem = value <= 0 ? "Summani kiriting" : value > available ? `Ko'pi bilan ${money(available)}` : reason.trim().length < 5 ? "Sababini yozing (kamida 5 belgi)" : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-primary" />
            Qaytarish so'rovi
          </DialogTitle>
          <DialogDescription>
            {bill.patient.fullName} · #{bill.patient.patientNumber}. Ortiqcha to'langan summadan qaytariladi; vakolatli xodim tasdiqlagach pul smenadan beriladi (TZ §9.2).
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!problem) mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Summa</Label>
            <MoneyInput id="refund-amount" value={value} onChange={setAmount} data-testid="input-refund-amount" />
            <p className="text-xs text-muted-foreground">Qaytarish mumkin: {money(available)}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Qanday qaytariladi</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Qaytarish usuli">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICON[m];
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => setMethod(m)}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors", method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
                    data-testid={`refund-method-${m}`}
                  >
                    <Icon className="h-4 w-4" />
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Sabab</Label>
            <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Masalan: tahlil bekor qilindi, bemor kelmadi" data-testid="input-refund-reason" />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-refund-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="shadow-brand" disabled={Boolean(problem) || mutation.isPending} data-testid="button-confirm-refund-request">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              {money(value)} so'rash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- actions

/** The buttons a refund offers this user, in its status. */
export function RefundActions({ refund, onSlip, compact }: { refund: RefundView; onSlip: (id: string) => void; compact?: boolean }) {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const { data: desk } = useCashDesk();
  const [prompt, setPrompt] = useState<"reject" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = refund.requestedBy === user?.id;

  const act = useMutation({
    mutationFn: async ({ action, body }: { action: "approve" | "reject" | "pay" | "cancel"; body?: Record<string, unknown> }) =>
      (await (await apiRequest("POST", `/api/refunds/${refund.id}/${action}`, body ?? {})).json()) as RefundView,
    onSuccess: (r, { action }) => {
      refreshRefunds();
      setPrompt(null);
      const titles = { approve: "tasdiqlandi", reject: "rad etildi", pay: "bemorga berildi", cancel: "bekor qilindi" } as const;
      toast({ title: `Qaytarish №${r.number} ${titles[action]}`, description: action === "pay" ? `${money(r.amount)} — chekni chop eting` : undefined });
      if (action === "pay") onSlip(r.id);
    },
    onError: (e: Error) => {
      setError(e.message);
      if (!prompt) toast({ variant: "destructive", title: "Bajarilmadi", description: e.message });
    },
  });

  const size = compact ? "sm" : "default";
  const canDecide = can("payments.refund") && refund.status === "requested";
  const canPay = can("payments.create") && refund.status === "approved";
  const canCancel = (refund.status === "requested" || refund.status === "approved") && (can("payments.refund") || (own && can("payments.create")));

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canDecide &&
        (own ? (
          <span className="text-xs text-muted-foreground" data-testid="refund-own-request">
            O'zingiz so'ragansiz — boshqa xodim tasdiqlaydi
          </span>
        ) : (
          <>
            <Button size={size} className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={act.isPending} onClick={() => act.mutate({ action: "approve" })} data-testid={`button-approve-refund-${refund.number}`}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              Tasdiqlash
            </Button>
            <Button
              size={size}
              variant="outline"
              disabled={act.isPending}
              onClick={() => {
                setError(null);
                setPrompt("reject");
              }}
              data-testid={`button-reject-refund-${refund.number}`}
            >
              Rad etish
            </Button>
          </>
        ))}
      {canPay &&
        (desk?.shift ? (
          <Button size={size} className="shadow-brand" disabled={act.isPending} onClick={() => act.mutate({ action: "pay" })} data-testid={`button-pay-refund-${refund.number}`}>
            {act.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
            {money(refund.amount)} berish
          </Button>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-300" data-testid="refund-needs-shift">
            Pulni berish uchun smenani oching
          </span>
        ))}
      {refund.status === "paid" && (
        <Button size={size} variant="outline" onClick={() => onSlip(refund.id)} data-testid={`button-refund-slip-${refund.number}`}>
          <Printer className="mr-1.5 h-4 w-4" />
          Chek
        </Button>
      )}
      {canCancel && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Bekor qilish"
          aria-label="Qaytarishni bekor qilish"
          disabled={act.isPending}
          onClick={() => {
            setError(null);
            setPrompt("cancel");
          }}
          data-testid={`button-cancel-refund-${refund.number}`}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      )}
      <TextPromptDialog
        open={prompt !== null}
        onOpenChange={(o) => !o && setPrompt(null)}
        title={prompt === "reject" ? `Qaytarish №${refund.number} rad etilsinmi?` : `Qaytarish №${refund.number} bekor qilinsinmi?`}
        description={prompt === "reject" ? "So'ragan xodimga sababi bilan xabar boradi." : "So'rov yopiladi, ortiqcha to'lov yana qaytarish uchun bo'shaydi. Yozuv o'chirilmaydi."}
        label="Sabab"
        confirmLabel={prompt === "reject" ? "Rad etish" : "Bekor qilish"}
        destructive
        pending={act.isPending}
        error={error}
        onConfirm={(text) => (prompt === "reject" ? act.mutate({ action: "reject", body: { note: text } }) : act.mutate({ action: "cancel", body: { reason: text } }))}
        testId={`refund-${prompt ?? "prompt"}`}
      />
    </div>
  );
}

/** One refund on a bill. */
export function RefundItem({ refund, onSlip }: { refund: RefundView; onSlip: (id: string) => void }) {
  const Icon = METHOD_ICON[refund.method];
  return (
    <li className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-start", (refund.status === "rejected" || refund.status === "cancelled") && "opacity-70")} data-testid={`refund-${refund.number}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="icon-tile mt-0.5 h-8 w-8 shrink-0 bg-rose-500/10 text-rose-700 dark:text-rose-300">
          <Undo2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            Qaytarish №{refund.number} · <span className="tabular">{money(refund.amount)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              {PAYMENT_METHOD_LABELS[refund.method]}
            </span>
            <RefundStatusBadge status={refund.status} />
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(refund.requestedAt)} · {refund.requestedByName ?? "—"}: {refund.reason}
          </p>
          <RefundTrail refund={refund} />
        </div>
      </div>
      <RefundActions refund={refund} onSlip={onSlip} compact />
    </li>
  );
}

function RefundTrail({ refund: r }: { refund: RefundView }) {
  return (
    <div className="mt-0.5 space-y-0.5 text-xs">
      {r.decidedAt && (
        <p className={r.status === "rejected" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}>
          {r.status === "rejected" ? "Rad etdi" : "Tasdiqladi"}: {r.decidedByName}, {formatDateTime(r.decidedAt)}
          {r.decisionNote ? ` — ${r.decisionNote}` : ""}
        </p>
      )}
      {r.paidAt && (
        <p className="text-emerald-700 dark:text-emerald-400">
          Berildi: {r.paidByName}, {formatDateTime(r.paidAt)}
          {r.shiftNumber ? ` · Smena №${r.shiftNumber}` : ""}
        </p>
      )}
      {r.cancelledAt && (
        <p className="text-muted-foreground">
          Bekor qildi: {r.cancelledByName}, {formatDateTime(r.cancelledAt)} — {r.cancelReason}
        </p>
      )}
    </div>
  );
}

/** The bill's refunds block: the credit, the request button, and every refund asked on it. */
export function BillRefunds({ bill }: { bill: Bill }) {
  const { can } = useAuth();
  const [asking, setAsking] = useState(false);
  const [slip, setSlip] = useState<string | null>(null);
  const available = billRefundable(bill);
  if (!bill.refunds.length && !bill.totals.credit) return null;
  return (
    <div className="no-print space-y-2" data-testid="bill-refunds">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Qaytarishlar</p>
        {can("payments.create") && available > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAsking(true)} data-testid="button-request-refund">
            <Undo2 className="mr-1.5 h-4 w-4" />
            Qaytarish so'rovi ({money(available)})
          </Button>
        )}
      </div>
      {bill.refunds.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {bill.refunds.map((r) => (
            <RefundItem key={r.id} refund={r} onSlip={setSlip} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Hali qaytarish so'ralmagan.</p>
      )}
      <RefundRequestDialog bill={bill} open={asking} onOpenChange={setAsking} />
      <RefundSlipDialog refundId={slip} onClose={() => setSlip(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- the desk's list

type RefundFilter = "requested" | "approved" | "paid" | "closed" | "all";
const FILTERS: { key: RefundFilter; label: string }[] = [
  { key: "requested", label: "Tasdiq kutmoqda" },
  { key: "approved", label: "Berilishi kerak" },
  { key: "paid", label: "Qaytarilgan" },
  { key: "closed", label: "Rad / bekor" },
  { key: "all", label: "Hammasi" },
];
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/** Refunds waiting on this user: approvals for those who approve, payouts for cashiers. */
export function usePendingRefunds() {
  const { can } = useAuth();
  const visible = can("payments.create") || can("payments.refund") || can("finance.view");
  const { data: requested = [] } = useQuery<RefundView[]>({ queryKey: ["/api/refunds?status=requested"], enabled: visible, refetchOnMount: "always", refetchInterval: 30_000 });
  const { data: approved = [] } = useQuery<RefundView[]>({ queryKey: ["/api/refunds?status=approved"], enabled: visible, refetchOnMount: "always", refetchInterval: 30_000 });
  return { requested, approved, count: (can("payments.refund") ? requested.length : 0) + (can("payments.create") ? approved.length : 0) };
}

export function RefundsTab() {
  const { can } = useAuth();
  // Until one is picked, each opens on what waits for them: approvals for an approver, payouts for a cashier.
  const [picked, setFilter] = useState<RefundFilter | null>(null);
  const filter: RefundFilter = picked ?? (can("payments.refund") ? "requested" : can("payments.create") ? "approved" : "all");
  const [slip, setSlip] = useState<string | null>(null);
  const pending = usePendingRefunds();
  const params = new URLSearchParams();
  if (filter === "requested" || filter === "approved" || filter === "paid") params.set("status", filter);
  if (filter !== "requested" && filter !== "approved") {
    params.set("from", localDay(-29));
    params.set("to", localDay());
  }
  const { data: rows = [], isLoading } = useQuery<RefundView[]>({ queryKey: [`/api/refunds?${params.toString()}`], refetchOnMount: "always", refetchInterval: 30_000 });
  const shown = useMemo(() => (filter === "closed" ? rows.filter((r) => r.status === "rejected" || r.status === "cancelled") : rows), [rows, filter]);
  const { data: paid = [] } = useQuery<RefundView[]>({ queryKey: [`/api/refunds?status=paid&from=${localDay(-29)}&to=${localDay()}`], refetchOnMount: "always" });
  const paidSum = paid.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          index={0}
          label="Tasdiq kutmoqda"
          value={pending.requested.length}
          hint={pending.requested.length ? money(pending.requested.reduce((s, r) => s + r.amount, 0)) : "So'rov yo'q"}
          icon={AlertTriangle}
          tone={pending.requested.length ? "amber" : "emerald"}
          onClick={() => setFilter("requested")}
        />
        <StatCard
          index={1}
          label="Tasdiqlangan, berilmagan"
          value={pending.approved.length}
          hint={pending.approved.length ? money(pending.approved.reduce((s, r) => s + r.amount, 0)) : "Hammasi berilgan"}
          icon={ShieldCheck}
          tone={pending.approved.length ? "violet" : "emerald"}
          onClick={() => setFilter("approved")}
        />
        <StatCard index={2} label="Qaytarilgan (30 kun)" value={money(paidSum)} hint={`${paid.length} ta qaytarish`} icon={CheckCircle2} tone="rose" onClick={() => setFilter("paid")} />
      </div>
      <div className="card-premium flex flex-wrap items-center gap-1.5 p-3" role="group" aria-label="Holat">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}
            data-testid={`refund-filter-${f.key}`}
          >
            {f.label}
            {f.key === "requested" && pending.requested.length > 0 && <span className="ml-1 tabular">({pending.requested.length})</span>}
            {f.key === "approved" && pending.approved.length > 0 && <span className="ml-1 tabular">({pending.approved.length})</span>}
          </button>
        ))}
      </div>
      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : shown.length === 0 ? (
          <EmptyState icon={Undo2} title="Qaytarish yo'q" description={filter === "requested" ? "Tasdiq kutayotgan so'rov yo'q." : "Bu tanlov bo'yicha qaytarish topilmadi."} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead>Qaytarish</TableHead>
                  <TableHead className="hidden md:table-cell">So'radi</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Summa</TableHead>
                  <TableHead className="text-right">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id} data-testid={`row-refund-${r.number}`}>
                    <TableCell>
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        №{r.number} · {r.patientName}
                        <RefundStatusBadge status={r.status} />
                      </p>
                      <p className="text-sm font-semibold tabular sm:hidden">
                        {money(r.amount)} · {PAYMENT_METHOD_LABELS[r.method]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{r.patientNumber} · tashrif {formatDate(r.visitDate)} · {r.reason}
                      </p>
                      <RefundTrail refund={r} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-sm md:table-cell">
                      <p>{r.requestedByName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.requestedAt)}</p>
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={r.amount} className="font-semibold" />
                      <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABELS[r.method]}</p>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <RefundActions refund={r} onSlip={setSlip} compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <RefundSlipDialog refundId={slip} onClose={() => setSlip(null)} />
    </div>
  );
}
