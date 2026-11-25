/**
 * Cheklar (B7.6, TZ §15.7 "Chek"): the slip of a receipt (to'lov cheki) and of
 * a refund handed out (qaytarish cheki, B7.4), for an 80 mm thermal roll
 * (72 mm printable) — also prints as a narrow column on A4.
 *
 * Printing goes through a copy of the slip portalled straight onto <body>
 * while the dialog is open: the print stylesheet then hides every other child
 * of <body> (the bill dialog underneath included), so only the chek reaches
 * paper. Every print is counted on the server first; any after the first comes
 * out marked "NUSXA", and so does a print that bypassed the button (Ctrl+P).
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Printer, ReceiptText } from "lucide-react";
import type { LabSettings, ReceiptSlipView, RefundSlipView } from "@shared/schema";
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

/** Paper, header and footer shared by every chek. */
function SlipFrame({ clinic, logo, copy, printedAt, children }: { clinic: LabSettings; logo: string | null; copy: boolean; printedAt?: string; children: ReactNode }) {
  return (
    <div className="receipt-slip w-[72mm] max-w-full bg-white px-3 py-4 font-mono text-[11px] leading-snug text-black" data-testid="receipt-slip">
      {copy && (
        <p className="mb-2 border border-black py-0.5 text-center text-xs font-bold tracking-widest" data-testid="slip-copy">
          NUSXA
        </p>
      )}
      <div className="text-center">
        {logo && <img src={logo} alt="" className="mx-auto mb-1 max-h-10 max-w-[48mm] object-contain grayscale" />}
        <p className="text-sm font-bold uppercase">{clinic.labName}</p>
        {clinic.tagline && <p>{clinic.tagline}</p>}
        {clinic.address && <p>{clinic.address}</p>}
        {clinic.phone && <p>Tel: {clinic.phone}</p>}
        {clinic.licenseNumber && <p>Litsenziya: {clinic.licenseNumber}</p>}
      </div>
      <Rule />
      {children}
      <Rule />
      <p className="text-center">Sog' bo'ling! Tashrifingiz uchun rahmat.</p>
      {printedAt && <p className="mt-1 text-center opacity-70">Chop etildi: {formatDateTime(printedAt)}</p>}
    </div>
  );
}

/** To'lov cheki: one receipt. */
export function ReceiptSlip({ view, printNumber, printedAt }: { view: ReceiptSlipView; printNumber: number; printedAt?: string }) {
  const r = view.receipt;
  const f = slipFigures(r, printNumber);
  return (
    <SlipFrame clinic={view.clinic} logo={view.logo} copy={f.copy} printedAt={printedAt}>
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
        {r.shares.map((s) => {
          const items = view.items?.[`${s.source}:${s.sourceId}`] ?? [];
          return (
            <div key={`${s.source}-${s.sourceId}`}>
              <div className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{s.title}</span>
                <span className="shrink-0 tabular">{money(s.amount, false)}</span>
              </div>
              {/* A lab order's tests by name, at the price on the order (the line above is what was paid). */}
              {items.length > 0 && (
                <div className="mb-0.5 mt-0.5 space-y-px pl-2 text-[10px] leading-tight" data-testid="slip-items">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">· {it.name}</span>
                      <span className="shrink-0 tabular">{money(it.price, false)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
    </SlipFrame>
  );
}

/** Qaytarish cheki: a refund handed out (B7.4), signed by the patient who took the money. */
export function RefundSlip({ view, printNumber, printedAt }: { view: RefundSlipView; printNumber: number; printedAt?: string }) {
  const r = view.refund;
  return (
    <SlipFrame clinic={view.clinic} logo={view.logo} copy={printNumber > 1} printedAt={printedAt}>
      <p className="text-center text-xs font-bold">QAYTARISH CHEKI</p>
      <p className="mb-1 text-center">Qaytarish № {r.number}</p>
      <Row label="Sana" value={formatDateTime(r.paidAt ?? r.requestedAt)} />
      <Row label="Tashrif" value={formatDate(r.visitDate)} />
      <Row label="Bemor" value={r.patientName} />
      <Row label="Bemor ID" value={`#${r.patientNumber}`} />
      <Row label="Kassir" value={r.paidByName ?? "—"} />
      {r.shiftNumber !== null && <Row label="Smena" value={`№ ${r.shiftNumber}`} />}
      <Row label="Tasdiqladi" value={r.decidedByName ?? "—"} />
      <Rule />
      <div className="space-y-1" data-testid="slip-lines">
        {(r.lines ?? []).map((l) => (
          <div key={`${l.source}-${l.sourceId}`} className="flex justify-between gap-3">
            <span className="min-w-0 break-words">{l.title}</span>
            <span className="shrink-0 tabular">−{money(l.amount, false)}</span>
          </div>
        ))}
      </div>
      <Rule />
      <div className="text-sm">
        <Row label="QAYTARILDI" value={money(r.amount)} strong />
      </div>
      <Row label="Usul" value={PAYMENT_METHOD_LABELS[r.method]} />
      <p className="mt-1">Sabab: {r.reason}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span>Pulni oldim:</span>
        <span className="mb-0.5 w-28 border-b border-black" />
      </div>
    </SlipFrame>
  );
}

/**
 * The dialog around a chek: preview, the print counted first, the portal that
 * reaches paper. `printNumber` is what the slip shows: the print under way, or
 * between prints the next one (the count plus one).
 */
function SlipDialog<V>({
  open,
  onClose,
  queryKey,
  printUrl,
  title,
  countOf,
  setCount,
  printable = true,
  render,
}: {
  open: boolean;
  onClose: () => void;
  queryKey: string;
  printUrl: string;
  title: (v: V | undefined) => string;
  countOf: (v: V) => number;
  setCount: (v: V, n: number) => V;
  /** Whether this chek may be printed at all (a refund only once it is paid out). */
  printable?: boolean | ((v: V) => boolean);
  render: (v: V, printNumber: number, printedAt?: string) => ReactNode;
}) {
  const { can } = useAuth();
  const { toast } = useToast();
  const { data: view } = useQuery<V>({ queryKey: [queryKey], enabled: open, refetchOnMount: "always" });
  const [printed, setPrinted] = useState<{ number: number; at: string } | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

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
  useEffect(() => setPrinted(null), [queryKey]);

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
    mutationFn: async () => (await (await apiRequest("POST", printUrl)).json()) as { printCount: number },
    onSuccess: ({ printCount }) => {
      queryClient.setQueryData<V>([queryKey], (v) => (v ? setCount(v, printCount) : v));
      setPrinted({ number: printCount, at: new Date().toISOString() });
      setPendingPrint(true);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Chop etilmadi", description: e.message }),
  });

  const count = view ? countOf(view) : 0;
  const canPrint = view && can("payments.create") && (typeof printable === "function" ? printable(view) : printable);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            {title(view)}
          </DialogTitle>
          <DialogDescription>{view ? (count ? `${count} marta chop etilgan — keyingisi "NUSXA" belgisi bilan chiqadi` : "Hali chop etilmagan") : "Yuklanmoqda…"}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 bg-muted/40">
          <div className="flex justify-center p-5">
            {view ? <div className="rounded-sm shadow-lg ring-1 ring-black/5">{render(view, printed?.number ?? count + 1, printed?.at)}</div> : <div className="h-96 w-[72mm] skeleton-shimmer rounded" />}
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          {canPrint && (
            <Button className="shadow-brand" onClick={() => print.mutate()} disabled={print.isPending || pendingPrint} data-testid="button-print-slip">
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
            {render(view, printed?.number ?? Math.max(count + 1, 2), printed?.at)}
          </div>,
          document.body,
        )}
    </Dialog>
  );
}

export function ReceiptSlipDialog({ receiptId, onClose }: { receiptId: string | null; onClose: () => void }) {
  return (
    <SlipDialog<ReceiptSlipView>
      open={Boolean(receiptId)}
      onClose={onClose}
      queryKey={`/api/receipts/${receiptId}/slip`}
      printUrl={`/api/receipts/${receiptId}/print`}
      title={(v) => (v ? `Chek · Kvitansiya №${v.receipt.number}` : "Chek")}
      countOf={(v) => v.receipt.printCount}
      setCount={(v, printCount) => ({ ...v, receipt: { ...v.receipt, printCount } })}
      render={(v, n, at) => <ReceiptSlip view={v} printNumber={n} printedAt={at} />}
    />
  );
}

export function RefundSlipDialog({ refundId, onClose }: { refundId: string | null; onClose: () => void }) {
  return (
    <SlipDialog<RefundSlipView>
      open={Boolean(refundId)}
      onClose={onClose}
      queryKey={`/api/refunds/${refundId}/slip`}
      printUrl={`/api/refunds/${refundId}/print`}
      title={(v) => (v ? `Qaytarish cheki · №${v.refund.number}` : "Qaytarish cheki")}
      countOf={(v) => v.refund.printCount}
      setCount={(v, printCount) => ({ ...v, refund: { ...v.refund, printCount } })}
      printable={(v) => v.refund.status === "paid"}
      render={(v, n, at) => <RefundSlip view={v} printNumber={n} printedAt={at} />}
    />
  );
}
