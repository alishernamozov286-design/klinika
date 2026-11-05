import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, Check, GitMerge, Loader2 } from "lucide-react";
import type { DuplicateCandidate, Patient } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/inputs";
import { PatientNumber } from "@/components/ui-kit";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Folds a duplicate card into the real one (TZ §4.2).
 *
 * The likely matches are offered first, found by the same rules that warn at
 * registration; any card can be searched for when the duplicate was entered
 * too differently to match. The confirmation spells out which card survives,
 * because that is the one thing that cannot be undone.
 */
export function MergePatientDialog({ source, onClose }: { source: Patient | null; onClose: () => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Patient | null>(null);
  const debounced = useDebounced(search.trim(), 300);

  useEffect(() => {
    setSearch("");
    setTarget(null);
  }, [source]);

  const { data: suggested = [] } = useQuery<DuplicateCandidate[]>({
    queryKey: ["/api/patients/check-duplicates", "merge", source?.id],
    queryFn: async () =>
      (
        await apiRequest("POST", "/api/patients/check-duplicates", {
          fullName: source!.fullName,
          phone: source!.phone,
          birthDate: source!.birthDate ?? undefined,
          passport: source!.passport ?? undefined,
          pinfl: source!.pinfl ?? undefined,
          excludeId: source!.id,
        })
      ).json(),
    enabled: Boolean(source),
  });

  const { data: found } = useQuery<{ items: Patient[] }>({
    queryKey: [`/api/patients?search=${encodeURIComponent(debounced)}&limit=8`],
    enabled: Boolean(source) && debounced.length >= 2,
  });

  const options: { patient: Patient; note?: string }[] = debounced.length >= 2
    ? (found?.items ?? []).filter((p) => p.id !== source?.id).map((p) => ({ patient: p }))
    : suggested.map((c) => ({ patient: c.patient, note: c.reasons.join(", ") }));

  const merge = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/patients/${source!.id}/merge`, { intoId: target!.id });
      return (await res.json()) as { orders: number; contacts: number };
    },
    onSuccess: (moved) => {
      invalidateApi("/api/patients", "/api/orders", "/api/stats");
      toast({
        title: "Kartalar birlashtirildi",
        description: `№${target!.patientNumber} ${target!.fullName} · ${moved.orders} ta buyurtma ko'chirildi`,
      });
      onClose();
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Birlashtirilmadi", description: err.message }),
  });

  return (
    <Dialog open={Boolean(source)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="icon-tile h-10 w-10 bg-primary/10 text-primary">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Dublikat kartani birlashtirish</DialogTitle>
              <DialogDescription className="mt-0.5">
                Buyurtmalar, aloqalar va Telegram ulanishi asosiy kartaga o'tadi, dublikat karta o'chadi.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!target ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">№{source?.patientNumber} {source?.fullName}</b> qaysi kartaning dublikati?
            </p>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Asosiy kartani qidirish: ism, telefon, raqam"
              data-testid="input-merge-search"
            />
            {!debounced && suggested.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ehtimoliy dublikatlar</p>
            )}
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {options.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {debounced ? "Hech kim topilmadi" : "O'xshash karta topilmadi — qidiruvdan foydalaning"}
                </p>
              ) : (
                options.map(({ patient, note }) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => setTarget(patient)}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    data-testid={`merge-target-${patient.patientNumber}`}
                  >
                    <PatientNumber value={patient.patientNumber} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{patient.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatPhone(patient.phone)}
                        {patient.birthDate && ` · ${formatDate(patient.birthDate)}`}
                        {note && <span className="text-amber-700 dark:text-amber-300"> · {note}</span>}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <CardLine patient={source!} label="Dublikat — o'chadi" tone="muted" />
            <div className="flex justify-center text-muted-foreground">
              <ArrowDown className="h-4 w-4" />
            </div>
            <CardLine patient={target} label="Asosiy karta — qoladi" tone="primary" />
            <p className="pt-2 text-xs text-muted-foreground">
              Asosiy kartadagi bo'sh maydonlar (tug'ilgan sana, hujjat, manzil) dublikatdan to'ldiriladi, mavjudlari
              o'zgarmaydi. Bu amalni ortga qaytarib bo'lmaydi.
            </p>
          </div>
        )}

        <DialogFooter>
          {target ? (
            <>
              <Button variant="outline" onClick={() => setTarget(null)}>
                Orqaga
              </Button>
              <Button onClick={() => merge.mutate()} disabled={merge.isPending} data-testid="button-confirm-merge">
                {merge.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Birlashtirish
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardLine({ patient, label, tone }: { patient: Patient; label: string; tone: "muted" | "primary" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "primary" ? "border-primary/40 bg-primary/[0.05]" : "border-dashed opacity-80",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">
        <span className="tabular text-muted-foreground">№{patient.patientNumber}</span> {patient.fullName}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatPhone(patient.phone)}
        {patient.birthDate && ` · ${formatDate(patient.birthDate)}`}
      </p>
    </div>
  );
}
