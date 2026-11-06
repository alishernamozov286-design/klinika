/**
 * Ko'rik xulosasi (B3.8): the signed examination as a PDF — previewed here
 * exactly as it will print and save, then printed or downloaded.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import type { VisitSummary } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { buildVisitSummaryPdf, visitSummaryFilename } from "@/lib/visit-summary-pdf";

export function VisitSummaryDialog({ recordId, onOpenChange }: { recordId: string | null; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const pdfRef = useRef<Awaited<ReturnType<typeof buildVisitSummaryPdf>> | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // Fetched fresh each time: issuing a document is logged, and must show the
  // record as it stands now (a correction may have landed since).
  const { data, error, isFetching } = useQuery<VisitSummary>({
    queryKey: [`/api/records/${recordId}/summary`],
    enabled: Boolean(recordId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!data || !recordId) return;
    let cancelled = false;
    let made: string | null = null;
    setBuilding(true);
    buildVisitSummaryPdf(data)
      .then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        made = String(pdf.output("bloburl"));
        setUrl(made);
      })
      .catch((err: Error) => toast({ variant: "destructive", title: "PDF tayyorlanmadi", description: err.message }))
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
      pdfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, recordId]);

  const loading = isFetching || building || (!url && !error);

  return (
    <Dialog open={Boolean(recordId)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Ko'rik xulosasi
          </DialogTitle>
          <DialogDescription>
            {data ? `${data.record.patientName} · ${data.record.doctorName} · v${data.record.version}` : "Tayyorlanmoqda…"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/40">
          {error ? (
            <p className="p-8 text-center text-sm text-destructive">{(error as Error).message}</p>
          ) : loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF tayyorlanmoqda…
            </div>
          ) : (
            <iframe ref={frameRef} src={url!} title="Ko'rik xulosasi" className="h-full w-full border-0" data-testid="frame-visit-summary" />
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
          <Button
            variant="outline"
            disabled={loading || Boolean(error)}
            onClick={() => {
              // The browser's own PDF viewer prints the very file shown.
              try {
                frameRef.current?.contentWindow?.focus();
                frameRef.current?.contentWindow?.print();
              } catch {
                if (url) window.open(url, "_blank");
              }
            }}
            data-testid="button-print-summary"
          >
            <Printer className="mr-2 h-4 w-4" />
            Chop etish
          </Button>
          <Button
            disabled={loading || Boolean(error)}
            onClick={() => data && pdfRef.current?.save(visitSummaryFilename(data))}
            data-testid="button-download-summary"
          >
            <Download className="mr-2 h-4 w-4" />
            PDF yuklab olish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
