/**
 * To'lov cheki (B7.6, TZ §15.7 "Chek"): the slip of one receipt, for an 80 mm
 * thermal roll (72 mm printable) — also prints as a narrow column on A4.
 *
 * Printing goes through a copy of the slip portalled straight onto <body>
 * while the dialog is open: the print stylesheet then hides every other child
 * of <body> (the bill dialog underneath included), so only the chek reaches
 * paper. Every print is counted on the server first; any after the first comes
 * out marked "NUSXA". Rules: slipFigures in shared/invoice.ts.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Printer, ReceiptText } from "lucide-react";
import type { ReceiptSlipView } from "@shared/schema";
import { PAYMENT_METHOD_LABELS } from "@shared/schema";
import { slipFigures } from "@shared/invoice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, money } from "@/lib/format";

/** Only while a chek is open: the page box of a receipt printer, whatever the app's A4 default. */
const PAGE_STYLE = "@media print { @page { size: auto; margin: 3mm; } }";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "font-bold")}>
      <span>{label}</span>
      <span className="text-right tabular">{value}</span>
    </div>
  );
}

const Rule = () => <div className="my-2 border-t border-dashed border-current opacity-60" />;

/** The slip itself — the same markup on screen and on paper. */
export function ReceiptSlip({ view, printNumber, printedAt }: { view: ReceiptSlipView; printNumber: number; printedAt?: string }) {
  const r = view.receipt;
  const f = slipFigures(r, printNumber);
  const c = view.clinic;
  return (
    <div className="receipt-slip w-[72mm] max-w-full bg-white px-3 py-4 font-mono text-[11px] leading-snug text-black" data-testid="receipt-slip">
      {f.copy && (
        <p className="mb-2 border border-black py-0.5 text-center text-xs font-bold tracking-widest" data-testid="slip-copy">
          NUSXA
        </p>
      )}
      <div className="text-center">
        {view.logo && <img src={view.logo} alt="" className="mx-auto mb-1 max-h-10 max-w-[48mm] object-contain grayscale" />}
        <p className="text-sm font-bold uppercase">{c.labName}</p>
        {c.tagline && <p>{c.tagline}</p>}
        {c.address && <p>{c.address}</p>}
        {c.phone && <p>Tel: {c.phone}</p>}
        {c.licenseNumber && <p>Litsenziya: {c.licenseNumber}</p>}
      </div>
      <Rule />
      <p className="text-center text-xs font-bold">TO'LOV CHEKI</p>
      <p className="mb-1 text-center">Kvitansiya № {r.number}</p>
      <Row label="Sana" value={formatDateTime(r.createdAt)} />
      <Row label="Hisobvaraq" value={`№ ${view.invoiceNumber} · ${formatDate(view.visitDate)}`} />
      <Row label="Bemor" value={view.patient.fullName} />
      <Row label="Bemor ID" value={`#${view.patient.patientNumber}`} />
      <Row label="Kassir" value={r.createdByName ?? "—"} />
      {view.shiftNumber !== null && <Row label="Smena" value={`№ ${view.shiftNumber}`} />}
      <Rule />
      <div className="space-y-1" data-testid="slip-lines">
        {r.shares.map((s) => (
          <div key={`${s.source}-${s.sourceId}`} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">{s.title}</span>
            <span className="shrink-0 tabular">{money(s.amount, false)}</span>
          </div>
        ))}
      </div>
      <Rule />
      <div className="text-sm">
        <Row label="JAMI" value={money(r.amount)} strong />
      </div>
      <Row label="To'lov usuli" value={PAYMENT_METHOD_LABELS[r.method]} />
      {f.change > 0 && (
        <>
          <Row label="Berildi" value={money(f.tendered!)} />
          <Row label="Qaytim" value={money(f.change)} strong />
        </>
      )}
      {f.dueAfter !== null && (f.paidInFull ? <p className="mt-1 text-center font-bold">Hisobvaraq to'liq to'landi</p> : <Row label="Qoldiq qarz" value={money(f.dueAfter)} strong />)}
      {r.note && <p className="mt-1">Izoh: {r.note}</p>}
      {r.voidedAt && (
        <div className="mt-2 border-2 border-black p-1 text-center" data-testid="slip-voided">
          <p className="text-xs font-bold tracking-wider">BEKOR QILINGAN</p>
          <p>
            {formatDateTime(r.voidedAt)} · {r.voidedByName}
          </p>
          <p>Sabab: {r.voidReason}</p>
        </div>
      )}
      <Rule />
      <p className="text-center">Sog' bo'ling! Tashrifingiz uchun rahmat.</p>
      {printedAt && <p className="mt-1 text-center opacity-70">Chop etildi: {formatDateTime(printedAt)}</p>}
    </div>
  );
}

export function ReceiptSlipDialog({ receiptId, onClose }: { receiptId: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const key = `/api/receipts/${receiptId}/slip`;
  const { data: view } = useQuery<ReceiptSlipView>({ queryKey: [key], enabled: Boolean(receiptId), refetchOnMount: "always" });
  // The print under way (its number and time); between prints the slip shows the next one: the count plus one.
  const [printed, setPrinted] = useState<{ number: number; at: string } | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const open = Boolean(receiptId);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("printing-receipt");
    const style = document.createElement("style");
    style.textContent = PAGE_STYLE;
    document.head.appendChild(style);
    return () => {
      document.body.classList.remove("printing-receipt");
      style.remove();
    };
  }, [open]);
  useEffect(() => setPrinted(null), [receiptId]);

  // Print once React has drawn the slip with this print's number (copy mark, time).
  useEffect(() => {
    if (!pendingPrint || !printed) return;
    const t = setTimeout(() => {
      // window.print() returns once the page has gone to the printer; after it the preview shows the next print (a copy).
      window.print();
      setPendingPrint(false);
      setPrinted(null);
    }, 120);
    return () => clearTimeout(t);
  }, [pendingPrint, printed]);

  const print = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/receipts/${receiptId}/print`)).json()) as { printCount: number },
    onSuccess: ({ printCount }) => {
      queryClient.setQueryData<ReceiptSlipView>([key], (v) => (v ? { ...v, receipt: { ...v.receipt, printCount } } : v));
      setPrinted({ number: printCount, at: new Date().toISOString() });
      setPendingPrint(true);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Chop etilmadi", description: e.message }),
  });

  const count = view?.receipt.printCount ?? 0;
  const shownNumber = printed?.number ?? count + 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            {view ? `Chek · Kvitansiya №${view.receipt.number}` : "Chek"}
          </DialogTitle>
          <DialogDescription>
            {view ? (count ? `${count} marta chop etilgan — keyingisi "NUSXA" belgisi bilan chiqadi` : "Hali chop etilmagan") : "Yuklanmoqda…"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 bg-muted/40">
          <div className="flex justify-center p-5">
            {view ? (
              <div className="rounded-sm shadow-lg ring-1 ring-black/5">
                <ReceiptSlip view={view} printNumber={shownNumber} printedAt={printed?.at} />
              </div>
            ) : (
              <div className="h-96 w-[72mm] skeleton-shimmer rounded" />
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          {can("payments.create") && (
            <Button className="shadow-brand" onClick={() => print.mutate()} disabled={!view || print.isPending || pendingPrint} data-testid="button-print-slip">
              {print.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {count ? "Nusxa chop etish" : "Chekni chop etish"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      {open &&
        view &&
        createPortal(
          <div className="receipt-print-root" aria-hidden>
            {/* A print that did not go through the button (Ctrl+P) was never counted: it can only ever be a copy. */}
            <ReceiptSlip view={view} printNumber={printed?.number ?? Math.max(count + 1, 2)} printedAt={printed?.at} />
          </div>,
          document.body,
        )}
    </Dialog>
  );
}
