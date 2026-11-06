import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import type { LabSettings, OrderWithDetails } from "@shared/schema";
import { TUBES, tubesFor } from "@shared/lab-catalogue";
import { tubeBarcode } from "@shared/sample";
import { patientAge } from "@shared/patient-identity";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Code128 } from "@/components/barcode";
import { ageGender, formatDate } from "@/lib/format";

/**
 * The stickers that go on the containers (B4.3, TZ §6.1.3 "probirkani
 * belgilash").
 *
 * One label per container the order needs — EDTA, serum, urine… — each with
 * its own Code 128 code (TZ §2): the order's code plus the specimen letter,
 * "LAB-1042-E". Scanning any of them opens the order. The cap colour runs
 * down the left edge so a mislabelled tube is visible in the rack.
 *
 * A label is a 58×30 mm thermal sticker, not A4, and is needed at the draw,
 * long before any result — hence its own dialog and its own page size.
 */
export function SampleLabelDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithDetails | null;
}) {
  const { data: settings } = useQuery<LabSettings>({ queryKey: ["/api/settings"], enabled: open });

  /**
   * @page cannot be scoped with a selector, so the label's page size is put
   * behind a body class that only exists while this dialog is open. Without
   * it, printing a result blank would inherit the 58×30mm page.
   */
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("printing-label");
    return () => document.body.classList.remove("printing-label");
  }, [open]);

  if (!order) return null;

  const sample = order.sample;
  const patient = order.patient;
  const tubes = tubesFor(order.items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="no-print">
          <DialogTitle>Probirka yorliqlari</DialogTitle>
          <DialogDescription>
            {tubes.length} ta idish · har biriga alohida yorliq. Skanerlanganda buyurtma #{order.orderNumber} ochiladi.
          </DialogDescription>
        </DialogHeader>

        {!sample ? (
          <p className="no-print py-4 text-sm text-muted-foreground">
            Bu buyurtmada namuna yo'q — u namuna hisobi qo'shilishidan oldin yaratilgan.
          </p>
        ) : (
          <>
            {/* Rendered at label scale, so what is on screen is what comes out
                of the printer rather than a preview that looks fine and a
                sticker that does not fit. */}
            <div className="flex max-h-[60vh] flex-col items-center gap-3 overflow-y-auto py-1">
              {tubes.map((t) => {
                const code = tubeBarcode(order.orderNumber, t.sampleType);
                const tube = TUBES[t.sampleType];
                return (
                  <div
                    key={t.sampleType}
                    className="label-surface relative flex flex-col overflow-hidden rounded border bg-white py-1.5 pl-3 pr-2 text-black"
                    style={{ width: "58mm", height: "30mm" }}
                    data-testid={`label-${t.sampleType}`}
                  >
                    {/* The cap colour, down the edge. */}
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: tube.color }} aria-hidden />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[10px] font-bold leading-tight">{patient?.fullName ?? "—"}</p>
                      <p className="shrink-0 text-[8px] leading-tight">{ageGender(patientAge(patient), patient?.gender)}</p>
                    </div>
                    <Code128 value={code} className="mt-1 h-[11mm] w-full" />
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <p className="font-mono text-[11px] font-bold leading-none tracking-tight">{code}</p>
                      <p className="shrink-0 text-[8px] font-semibold leading-none">{tube.label}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[7.5px] leading-tight text-black/70">
                      {formatDate(order.createdAt)}
                      {patient ? ` · #${patient.patientNumber}` : ""}
                      {settings?.labName ? ` · ${settings.labName}` : ""} · {t.tests.join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="no-print">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Yopish
              </Button>
              <Button onClick={() => window.print()} data-testid="button-print-label">
                <Printer className="mr-2 h-4 w-4" />
                Chop etish ({tubes.length})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
