/**
 * Chegirma (B7.2, TZ §9.2 "Chegirmalar"): the discount dialog of a bill and the
 * list of discounts given on it. The preview is the server's own rule
 * (shared/discount.ts planDiscount), so what is shown is what is saved.
 */
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgePercent, Loader2 } from "lucide-react";
import type { Bill, BillDiscount } from "@shared/schema";
import { DISCOUNT_MODES, DISCOUNT_MODE_LABELS, describeDiscount, planDiscount, type DiscountMode } from "@shared/discount";
import { lineDue } from "@shared/invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyInput } from "@/components/inputs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime, money } from "@/lib/format";

export function DiscountDialog({ bill, open, onOpenChange, onDone }: { bill: Bill; open: boolean; onOpenChange: (o: boolean) => void; onDone: (b: Bill) => void }) {
  const { toast } = useToast();
  const owing = bill.lines.filter((l) => lineDue(l) > 0);
  const [target, setTarget] = useState<string>("all");
  const [mode, setMode] = useState<DiscountMode>("percent");
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const picked = target === "all" ? null : owing.find((l) => `${l.source}:${l.sourceId}` === target) ?? null;
  const plan = useMemo(() => planDiscount(bill.lines, mode, value, picked ? { source: picked.source, sourceId: picked.sourceId } : null), [bill.lines, mode, value, picked]);
  const problem = !value ? "Qiymatni kiriting" : mode === "percent" && value > 100 ? "Foiz 100 dan oshmasin" : !plan.total ? "Chegirma qilinadigan to'lanmagan summa yo'q" : reason.trim().length < 5 ? "Sababini yozing (kamida 5 belgi)" : null;

  const mutation = useMutation({
    mutationFn: async () =>
      (await (
        await apiRequest("POST", `/api/bills/${bill.visitId}/discounts`, {
          mode,
          value,
          target: picked ? { source: picked.source, sourceId: picked.sourceId } : null,
          reason: reason.trim(),
        })
      ).json()) as { bill: Bill; discount: BillDiscount },
    onSuccess: ({ bill: b, discount }) => {
      onDone(b);
      onOpenChange(false);
      setValue(0);
      setReason("");
      setTarget("all");
      toast({ title: `Chegirma: ${describeDiscount(discount.mode, discount.value, discount.total)}`, description: b.totals.due ? `Qarz endi ${money(b.totals.due)}` : "Hisobvaraq to'liq yopildi" });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            Chegirma
          </DialogTitle>
          <DialogDescription>Faqat to'lanmagan qismga beriladi. To'langan pul qaytarish orqali (vakolatli xodim tasdig'i bilan) qaytariladi.</DialogDescription>
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
            <Label htmlFor="discount-target">Nimaga</Label>
            <select
              id="discount-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              data-testid="select-discount-target"
            >
              <option value="all">Butun hisobvaraq ({money(bill.totals.due)} to'lanmagan)</option>
              {owing.map((l) => (
                <option key={`${l.source}:${l.sourceId}`} value={`${l.source}:${l.sourceId}`}>
                  {l.title} — {money(lineDue(l))} to'lanmagan
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <Label>Turi</Label>
              <div className="flex w-fit rounded-lg border p-0.5" role="group" aria-label="Chegirma turi">
                {DISCOUNT_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      setValue(0);
                    }}
                    className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    data-testid={`discount-mode-${m}`}
                  >
                    {DISCOUNT_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount-value">{mode === "percent" ? "Foiz" : "Summa"}</Label>
              {mode === "percent" ? (
                <div className="relative">
                  <Input
                    id="discount-value"
                    inputMode="numeric"
                    value={value || ""}
                    onChange={(e) => setValue(Math.min(100, Math.trunc(Number(e.target.value.replace(/\D/g, "")) || 0)))}
                    className="pr-8 text-right tabular"
                    placeholder="0"
                    data-testid="input-discount-value"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              ) : (
                <MoneyInput id="discount-value" value={value} onChange={setValue} data-testid="input-discount-value" />
              )}
            </div>
          </div>

          {plan.total > 0 && (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm" data-testid="discount-preview">
              {plan.lines.map((l) => (
                <div key={`${l.source}:${l.sourceId}`} className="flex justify-between gap-3">
                  <span className="truncate">{l.title}</span>
                  <span className="shrink-0 tabular text-amber-700 dark:text-amber-300">−{money(l.amount)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                <span>Chegirma</span>
                <span className="tabular" data-testid="discount-total">
                  {money(plan.total)}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Qarz bo'ladi</span>
                <span className="tabular">{money(bill.totals.due - plan.total)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="discount-reason">Sabab</Label>
            <Textarea id="discount-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder="Masalan: pensioner, nogironlik guruhi, rahbar ko'rsatmasi" data-testid="input-discount-reason" />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-discount-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" className="shadow-brand" disabled={Boolean(problem) || mutation.isPending} title={problem ?? undefined} data-testid="button-confirm-discount">
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgePercent className="mr-2 h-4 w-4" />}
              {plan.total ? `${money(plan.total)} chegirma` : "Chegirma berish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The discounts given on a bill, newest first. */
export function BillDiscounts({ discounts }: { discounts: BillDiscount[] }) {
  if (!discounts.length) return null;
  return (
    <div className="no-print space-y-2" data-testid="bill-discounts">
      <p className="text-sm font-semibold">Chegirmalar</p>
      <ul className="divide-y rounded-xl border">
        {discounts.map((d) => (
          <li key={d.id} className="flex items-start gap-3 p-3" data-testid={`discount-${d.id}`}>
            <div className="icon-tile mt-0.5 h-8 w-8 shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <BadgePercent className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{describeDiscount(d.mode, d.value, d.total)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(d.createdAt)} · {d.createdByName ?? "—"} · {d.lines.map((l) => `${l.title} −${money(l.amount)}`).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">Sabab: {d.reason}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
