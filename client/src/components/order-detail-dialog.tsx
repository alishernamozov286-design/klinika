import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Ban,
  CircleDollarSign,
  ClipboardCheck,
  Loader2,
  Printer,
  Receipt,
  Send,
  XCircle,
} from "lucide-react";
import { PAYMENT_METHODS, type OrderWithDetails, type Payment, type PaymentMethod } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, money } from "@/lib/format";
import { FlagBadge, PaymentBadge, PhoneText, StatusBadge, TelegramBadge } from "@/components/ui-kit";
import { MoneyInput } from "@/components/inputs";
import { SamplePanel } from "@/components/sample-panel";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function OrderDetailDialog({
  open,
  onOpenChange,
  order: snapshot,
  onEnterResults,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails | null;
  onEnterResults?: (order: OrderWithDetails) => void;
  onPrint?: (order: OrderWithDetails) => void;
}) {
  const { toast } = useToast();
  const { can } = useAuth();

  // Callers hand over a row from a list, and list rows carry no payment
  // ledger. The dialog loads the full order itself, so the ledger is there
  // and every payment, void or edit made here shows up at once (the
  // mutations invalidate /api/orders, which covers this key too).
  const { data: full } = useQuery<OrderWithDetails>({
    queryKey: [`/api/orders/${snapshot?.id}`],
    enabled: open && Boolean(snapshot),
    refetchOnMount: "always",
  });
  const order = snapshot && full?.id === snapshot.id ? full : snapshot;

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/orders/${order!.id}`, payload);
      return (await res.json()) as OrderWithDetails;
    },
    onSuccess: () => {
      invalidateApi("/api/orders", "/api/stats", "/api/reception");
      toast({ title: "Buyurtma yangilandi" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Yangilanmadi", description: err.message });
    },
  });

  const telegramMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${order!.id}/telegram`);
      return (await res.json()) as OrderWithDetails;
    },
    onSuccess: () => {
      invalidateApi("/api/orders");
      toast({ title: "Natija Telegramga yuborildi" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Yuborilmadi", description: err.message });
    },
  });

  if (!order) return null;

  const debt = Math.max(0, order.totalAmount - order.paidAmount);
  const canEditPayment = can("payments.create");
  const linked = Boolean(order.patient?.telegramChatId);
  // Same rule as the results queue: every line item filled in.
  const ready = order.items.length > 0 && order.items.every((i) => Boolean(i.result));
  const canSendTelegram = ready && order.status !== "cancelled" && can("results.send");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="icon-tile h-10 w-10 bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <DialogTitle className="mr-1">
              Buyurtma <span className="tabular">#{order.orderNumber}</span>
            </DialogTitle>
            <StatusBadge status={order.status} />
            <PaymentBadge total={order.totalAmount} paid={order.paidAmount} />
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <span className="font-medium text-foreground">
              {order.patient?.fullName ?? "Noma'lum bemor"}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <PhoneText value={order.patient?.phone} asLink={false} />
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular">{formatDateTime(order.createdAt)}</span>
            <TelegramBadge chatId={order.patient?.telegramChatId} className="text-[11px]" />
            {order.referralNumber && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-medium text-primary">Yo'llanma №{order.referralNumber}</span>
              </>
            )}
            {order.referrer && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>Yo'naltirgan: {order.referrer}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-5">
            <SamplePanel order={order} />

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                Tahlillar ({order.items.length})
              </h4>
              <div className="space-y-1.5">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.testName}</p>
                      {item.result ? (
                        <p className="text-sm mt-0.5">
                          <span className="text-muted-foreground">Natija: </span>
                          <span className="font-semibold tabular">{item.result}</span>
                          {item.unit && <span className="text-muted-foreground"> {item.unit}</span>}
                          {item.referenceRange && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (me'yor: {item.referenceRange})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Natija kutilmoqda</p>
                      )}
                      {item.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{item.notes}</p>}
                      {item.enteredBy && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Kiritdi: {item.enteredBy}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm tabular text-muted-foreground">{money(item.price, false)}</span>
                      {item.flag && <FlagBadge flag={item.flag} className="text-[11px]" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {order.notes && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">Izoh</h4>
                <p className="text-sm rounded-lg border bg-muted/40 p-3">{order.notes}</p>
              </div>
            )}

            <div className="space-y-2 rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Jami summa</span>
                <span className="tabular">{money(order.totalAmount)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Chegirma</span>
                  <span className="tabular">−{money(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>To'langan</span>
                <span className="tabular">{money(order.paidAmount)}</span>
              </div>
              {debt > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between font-semibold text-rose-600 dark:text-rose-400">
                    <span>Qarzdorlik</span>
                    <span className="tabular">{money(debt)}</span>
                  </div>
                </>
              )}
            </div>

            {canSendTelegram && (
              <div className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Telegram</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {!linked
                        ? "Bemor botga ulanmagan — u /start bosib raqamini yuborishi kerak."
                        : order.telegramSentAt
                          ? `Yuborilgan: ${formatDateTime(order.telegramSentAt)}`
                          : "Hali yuborilmagan"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => telegramMutation.mutate()}
                    disabled={!linked || telegramMutation.isPending}
                    data-testid="button-send-telegram"
                  >
                    {telegramMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {order.telegramSentAt ? "Qayta yuborish" : "Telegramga yuborish"}
                  </Button>
                </div>
              </div>
            )}

            <PaymentLedger order={order} canEdit={canEditPayment && order.status !== "cancelled"} />
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t flex-wrap gap-2">
          {can("orders.cancel") && order.status !== "cancelled" && (
            <Button
              variant="outline"
              onClick={() => mutation.mutate({ status: "cancelled" })}
              disabled={mutation.isPending}
              className="mr-auto text-destructive"
              data-testid="button-cancel-order"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Bekor qilish
            </Button>
          )}
          {can("results.enter") && order.status !== "cancelled" && onEnterResults && (
            <Button variant="outline" onClick={() => onEnterResults(order)} data-testid="button-goto-results">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Natija kiritish
            </Button>
          )}
          {onPrint && (
            <Button onClick={() => onPrint(order)} data-testid="button-goto-print">
              <Printer className="h-4 w-4 mr-2" />
              Blanka
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The order's cash ledger: every payment and refund, who took it, and a form to
 * add the next one.
 *
 * A single editable "paid" figure was what this replaced. It could not answer
 * the only question a till reconciliation actually asks — who took which money,
 * when — and it let a correction silently overwrite a colleague's entry.
 */
function PaymentLedger({ order, canEdit }: { order: OrderWithDetails; canEdit: boolean }) {
  const { toast } = useToast();
  const { can } = useAuth();
  const debt = Math.max(0, order.totalAmount - order.paidAmount);

  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("naqd");

  // Default the box to whatever is still owed: the common case at the counter
  // is settling the balance, not a part payment.
  useEffect(() => setAmount(debt), [debt, order.id]);

  const add = useMutation({
    mutationFn: async (payload: { amount: number; method: PaymentMethod; note?: string }) => {
      const res = await apiRequest("POST", `/api/orders/${order.id}/payments`, payload);
      return (await res.json()) as OrderWithDetails;
    },
    onSuccess: (saved) => {
      invalidateApi("/api/orders", "/api/stats", "/api/reception");
      toast({
        title: "To'lov qayd etildi",
        description: `Qoldiq: ${money(Math.max(0, saved.totalAmount - saved.paidAmount))}`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Qayd etilmadi", description: err.message });
    },
  });

  const [voiding, setVoiding] = useState<Payment | null>(null);
  const rows = order.payments ?? [];

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
        To'lovlar tarixi ({rows.length})
      </h4>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Hali to'lov qilinmagan.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((p) => (
            <div
              key={p.id}
              className={cn("flex items-center gap-3 rounded-lg border p-2.5", p.voidedAt && "border-dashed bg-muted/30")}
              data-testid={`payment-row-${p.id}`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold tabular",
                    p.amount < 0 && "text-rose-600 dark:text-rose-400",
                    p.voidedAt && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {p.amount < 0 ? "−" : "+"}
                  {money(Math.abs(p.amount), false)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{p.method}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="tabular">{formatDateTime(p.createdAt)}</span>
                  {" · "}
                  {p.createdByName ?? "—"}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
                {p.voidedAt && (
                  <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                    Bekor qilingan · <span className="tabular">{formatDateTime(p.voidedAt)}</span> ·{" "}
                    {p.voidedByName ?? "—"}
                    {p.voidReason ? ` · ${p.voidReason}` : ""}
                  </p>
                )}
              </div>
              {can("payments.delete") && !p.voidedAt && (
                <button
                  type="button"
                  onClick={() => setVoiding(p)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="To'lov yozuvini bekor qilish"
                  title="Bekor qilish"
                  data-testid={`button-void-payment-${p.id}`}
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-3 space-y-2 rounded-xl border bg-muted/30 p-3">
          <div className="flex flex-wrap gap-2">
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="min-w-[8rem] flex-1"
              data-testid="input-payment-amount"
            />
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-32" data-testid="select-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => add.mutate({ amount, method })}
              disabled={add.isPending || amount <= 0}
              data-testid="button-add-payment"
            >
              {add.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CircleDollarSign className="mr-2 h-4 w-4" />
              )}
              Qabul qilish
            </Button>
          </div>

          {can("payments.refund") && order.paidAmount > 0 && (
            <button
              type="button"
              onClick={() => add.mutate({ amount: -amount, method, note: "Qaytarildi" })}
              disabled={add.isPending || amount <= 0}
              className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              Shu summani qaytarish (−{money(amount, false)})
            </button>
          )}
        </div>
      )}

      <VoidPaymentDialog payment={voiding} onOpenChange={(o) => !o && setVoiding(null)} />
    </div>
  );
}

/**
 * Strikes out a mistyped ledger entry. Nothing is deleted (TZ §10): the row
 * stays in the history with who voided it and why. Money actually handed back
 * to the patient is a refund, which is a different act.
 */
function VoidPaymentDialog({
  payment,
  onOpenChange,
}: {
  payment: Payment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onOpenChange(false);
  };

  const voidIt = useMutation({
    mutationFn: async (v: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/payments/${v.id}/void`, { reason: v.reason });
      return (await res.json()) as OrderWithDetails;
    },
    onSuccess: (saved) => {
      invalidateApi("/api/orders", "/api/stats", "/api/patients", "/api/reception");
      toast({
        title: "To'lov bekor qilindi",
        description: `Yozuv tarixda qoldi. To'langan: ${money(saved.paidAmount)}`,
      });
      close();
    },
    onError: (err: Error) => {
      invalidateApi("/api/orders");
      toast({ variant: "destructive", title: "Bekor qilinmadi", description: err.message });
    },
  });

  const ready = reason.trim().length >= 5;

  return (
    <Dialog open={Boolean(payment)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>To'lov yozuvini bekor qilish</DialogTitle>
          <DialogDescription>
            {payment &&
              `${payment.amount < 0 ? "−" : "+"}${money(Math.abs(payment.amount))} (${payment.method}), ${formatDateTime(payment.createdAt)}. `}
            Faqat xato kiritilgan yozuv uchun. Yozuv o'chirilmaydi, tarixda chizilgan holda qoladi va to'langan summaga qo'shilmaydi. Bemorga pul qaytarilgan bo'lsa, "qaytarish" amalidan foydalaning.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Sabab</Label>
          <Textarea
            id="void-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: summa ikki marta kiritilgan"
            autoFocus
            maxLength={300}
            data-testid="input-void-reason"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Ortga
          </Button>
          <Button
            variant="destructive"
            disabled={!ready || voidIt.isPending}
            onClick={() => payment && voidIt.mutate({ id: payment.id, reason: reason.trim() })}
            data-testid="button-confirm-void-payment"
          >
            {voidIt.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bekor qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
