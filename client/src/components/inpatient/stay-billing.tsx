/**
 * B6.6 (TZ §8.2): the stay and the cash desk — what the stay has run up
 * (bed-days per ward at its frozen price, procedures done at their ordered
 * price), what was paid and what is owed, the bill it is on; and lab tests
 * ordered from the case history onto that same bill. Rules: shared/stay-bill.ts.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FlaskConical, Loader2, Receipt, Search, Wallet } from "lucide-react";
import type { OrderWithDetails, Test } from "@shared/schema";
import type { StayCharge } from "@shared/stay-bill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Money, SectionCard } from "@/components/ui-kit";
import { BillDialog } from "@/pages/cashier";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDay, money } from "@/lib/format";

type ChargeView = { visitId: string | null; charge: StayCharge; paid: number; due: number; credit: number };

/** Case history → "Statsionar hisobi": only for those who handle or see money. */
export function StayChargeCard({ admissionId }: { admissionId: string }) {
  const { can } = useAuth();
  const sees = can("payments.create", "finance.view");
  const { data: c } = useQuery<ChargeView>({ queryKey: [`/api/admissions/${admissionId}/charge`], enabled: sees, refetchOnMount: "always" });
  const [bill, setBill] = useState(false);
  if (!sees) return null;
  return (
    <SectionCard
      icon={Wallet}
      title="Statsionar hisobi"
      description="Yotoq-kun va muolajalar — bemor hisobvarag'ida bitta qator"
      action={
        c?.visitId ? (
          <Button size="sm" variant="outline" onClick={() => setBill(true)} data-testid="button-open-stay-bill">
            <Receipt className="mr-1.5 h-4 w-4" />
            Hisobvaraq
          </Button>
        ) : undefined
      }
    >
      {!c ? (
        <div className="h-28 skeleton-shimmer rounded-lg" />
      ) : (
        <div className="space-y-4 text-sm" data-testid="stay-charge">
          <table className="w-full">
            <tbody className="[&_td]:py-1">
              {c.charge.bedDays.map((b, i) => (
                <tr key={i}>
                  <td className="pr-2">
                    Palata {b.wardName}, yotoq {b.bedLabel}
                    <span className="block text-xs text-muted-foreground">
                      {formatDay(b.from)} – {formatDay(b.to)} · {b.days} kun × {money(b.dayPrice)}
                    </span>
                  </td>
                  <td className="text-right align-top tabular">{money(b.amount, false)}</td>
                </tr>
              ))}
              {c.charge.procedures.map((p) => (
                <tr key={p.orderId}>
                  <td className="pr-2">
                    {p.name}
                    <span className="block text-xs text-muted-foreground">
                      {p.done} marta × {money(p.unitPrice)}
                    </span>
                  </td>
                  <td className="text-right align-top tabular">{money(p.amount, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.charge.unpriced.length > 0 && (
            <p className="text-xs text-muted-foreground">Narxsiz (qo'lda yozilgan, hisobga kirmaydi): {c.charge.unpriced.map((u) => `${u.name} × ${u.done}`).join(", ")}</p>
          )}
          <dl className="space-y-1 border-t pt-3">
            {c.charge.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Chegirma</dt>
                <dd className="tabular">−{money(c.charge.discount, false)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <dt>Jami ({c.charge.days} yotoq-kun)</dt>
              <dd>
                <Money value={c.charge.amount} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">To'langan</dt>
              <dd className="tabular">{money(c.paid)}</dd>
            </div>
            <div className={cn("flex justify-between font-semibold", c.due > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-400")} data-testid="stay-due">
              <dt>{c.credit > 0 ? "Ortiqcha to'langan" : "Qarz"}</dt>
              <dd className="tabular">{money(c.credit > 0 ? c.credit : c.due)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Yotoq-kun har kuni o'sib boradi; oldindan to'lov olinadi, qolgani chiqishda.</p>
        </div>
      )}
      <BillDialog
        visitId={bill ? (c?.visitId ?? null) : null}
        onClose={() => {
          setBill(false);
          invalidateApi(`/api/admissions/${admissionId}/charge`);
        }}
      />
    </SectionCard>
  );
}

/** The doctor's lab order from the case history; it lands on the stay's bill, unpaid, for the desk. */
export function StayLabOrderButton({ admissionId, active }: { admissionId: string; active: boolean }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  if (!active || !can("procedures.prescribe")) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="button-stay-lab-order">
        <FlaskConical className="mr-1.5 h-4 w-4" />
        Tahlil buyurish
      </Button>
      {open && <LabOrderDialog admissionId={admissionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function LabOrderDialog({ admissionId, onClose }: { admissionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shown = useMemo(() => {
    const s = q.trim().toLocaleLowerCase("uz");
    return s ? tests.filter((t) => t.name.toLocaleLowerCase("uz").includes(s)) : tests;
  }, [tests, q]);
  const total = tests.filter((t) => picked.has(t.id)).reduce((s, t) => s + t.price, 0);
  const save = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/admissions/${admissionId}/lab-orders`, { testIds: [...picked], note: note.trim() || null })).json()) as OrderWithDetails,
    onSuccess: (o) => {
      invalidateApi(`/api/admissions/${admissionId}`);
      toast({ title: `Laboratoriya buyurtmasi #${o.orderNumber}`, description: "Statsionar hisobvarag'iga qo'shildi; natijalar kasallik tarixida ko'rinadi" });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Tahlil buyurish</DialogTitle>
          <DialogDescription>Buyurtma laboratoriyaga darhol tushadi va statsionar hisobvarag'iga qo'shiladi.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tahlilni qidiring" className="pl-9" data-testid="input-stay-lab-search" />
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-md border" data-testid="stay-lab-tests">
          {shown.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={picked.has(t.id)} onCheckedChange={() => toggle(t.id)} data-testid={`check-stay-lab-${t.id}`} />
                <span className="flex-1">{t.name}</span>
                <span className="text-xs tabular text-muted-foreground">{money(t.price, false)}</span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Topilmadi</li>}
        </ul>
        <div className="space-y-1.5">
          <Label htmlFor="stay-lab-note">Izoh (laboratoriyaga)</Label>
          <Textarea id="stay-lab-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="Shoshilinch; ertalab nahorga…" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground" data-testid="stay-lab-total">
            {picked.size} ta tahlil · {money(total)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => (picked.size ? save.mutate() : setError("Kamida bitta tahlilni tanlang"))} disabled={save.isPending} data-testid="button-save-stay-lab">
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Buyurish
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
