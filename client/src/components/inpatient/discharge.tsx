/**
 * Chiqarish va epikriz (B6.7, TZ §8.1.5) on the case history page: the
 * epicrisis drafted from the stay and edited (every save a version), the
 * discharge that closes the stay, the PDF; after discharge the signed
 * document, corrected only with a reason. Rules: shared/epicrisis.ts.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, History, Loader2, LogOut, Pencil, Printer, Save, Sparkles } from "lucide-react";
import type { AdmissionView, EpicrisisDocument, EpicrisisVersion, EpicrisisView } from "@shared/schema";
import {
  EPICRISIS_FIELDS,
  EPICRISIS_FIELD_HINTS,
  EPICRISIS_FIELD_LABELS,
  EPICRISIS_MAX,
  dischargeProblem,
  epicrisisChanges,
  epicrisisTextOf,
  normalizeEpicrisis,
  type EpicrisisField,
} from "@shared/epicrisis";
import { icdDisplayName } from "@shared/icd10";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/ui-kit";
import { IcdCodeBadge, IcdPicker } from "@/components/icd-picker";
import { ApiError, apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime, money } from "@/lib/format";
import { buildEpicrisisPdf, epicrisisFilename } from "@/lib/epicrisis-pdf";

type Fields = Record<EpicrisisField | "finalDiagnosisCode", string>;
const fieldsOf = (v: EpicrisisVersion | null): Fields => ({
  finalDiagnosis: v?.finalDiagnosis ?? "",
  finalDiagnosisCode: v?.finalDiagnosisCode ?? "",
  treatmentSummary: v?.treatmentSummary ?? "",
  epicrisis: v?.epicrisis ?? "",
  recommendations: v?.recommendations ?? "",
});
const localNow = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function DischargeSection({ admission }: { admission: AdmissionView }) {
  const { toast } = useToast();
  const key = `/api/admissions/${admission.id}/epicrisis`;
  const { data: v } = useQuery<EpicrisisView>({ queryKey: [key], refetchOnMount: "always" });
  const current = v?.current ?? null;
  const [fields, setFields] = useState<Fields>(() => fieldsOf(null));
  const [base, setBase] = useState<number | null>(null);
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState("");
  const [stale, setStale] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [discharging, setDischarging] = useState(false);

  // The saved version is taken in when it arrives and nothing is being typed over it.
  useEffect(() => {
    if (!v) return;
    if (base === null || (base !== (current?.version ?? 0) && !dirtyOf(fields, current))) {
      setFields(fieldsOf(current));
      setBase(current?.version ?? 0);
    }
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps

  const editing = Boolean(v?.can.write) || (Boolean(v?.can.amend) && amending);
  const text = normalizeEpicrisis(fields);
  const changed = epicrisisChanges(current ? epicrisisTextOf(current) : null, text);
  const dirty = changed.length > 0 && base === (current?.version ?? 0);

  const save = useMutation({
    mutationFn: async () =>
      (await (await apiRequest("POST", key, { baseVersion: base ?? 0, ...text, reason: admission.status === "discharged" ? reason.trim() || null : null })).json()) as EpicrisisVersion,
    onSuccess: (saved) => {
      setBase(saved.version);
      setFields(fieldsOf(saved));
      setAmending(false);
      setReason("");
      setStale(false);
      invalidateApi(key);
      toast({ title: `Epikriz saqlandi — ${saved.version}-versiya` });
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 409) setStale(true);
      toast({ title: "Saqlanmadi", description: e.message, variant: "destructive" });
    },
  });

  /** Fills the parts still empty from the stay; what the doctor wrote stays. */
  const autofill = () => {
    if (!v) return;
    const d = v.draft;
    const next = { ...fields };
    let filled = 0;
    for (const f of EPICRISIS_FIELDS) {
      if (!next[f].trim() && d[f]) {
        next[f] = d[f]!;
        filled++;
      }
    }
    if (!next.finalDiagnosisCode && d.finalDiagnosisCode) {
      next.finalDiagnosisCode = d.finalDiagnosisCode;
      filled++;
    }
    setFields(next);
    toast({ title: filled ? `Avto-to'ldirildi: ${filled} ta bo'lim` : "To'ldiriladigan bo'sh bo'lim yo'q", description: filled ? "Kasallik tarixi, kuzatuvlar, muolajalar va tahlillardan. Tekshirib, tahrirlang va saqlang." : "Bo'limni tozalasangiz, qayta to'ldiriladi." });
  };

  const missing = dischargeProblem(current ? epicrisisTextOf(current) : null);
  const status =
    admission.status === "discharged" ? `Chiqarilgan ${formatDateTime(admission.dischargedAt!)} · ${admission.dischargedByName ?? "—"}` : current ? `Qoralama · ${current.version}-versiya · ${current.savedByName ?? "—"}, ${formatDateTime(current.savedAt)}` : "Hali yozilmagan";

  return (
    <SectionCard
      icon={LogOut}
      title="Chiqarish va epikriz"
      description={status}
      action={
        <div className="flex flex-wrap justify-end gap-1">
          {(v?.versionCount ?? 0) > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)} data-testid="button-epicrisis-versions">
              <History className="mr-1.5 h-4 w-4" />
              Tarix ({v!.versionCount})
            </Button>
          )}
          {current && (
            <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)} data-testid="button-epicrisis-pdf">
              <FileText className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
          )}
        </div>
      }
    >
      {!v ? (
        <div className="h-40 skeleton-shimmer rounded-lg" />
      ) : editing ? (
        <div className="space-y-5" data-testid="epicrisis-form">
          {stale && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200" data-testid="epicrisis-stale">
              Epikrizni boshqa oynada kimdir o'zgartirdi — matningizni nusxalab, sahifani yangilang.
            </p>
          )}
          {v.can.write && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Bo'sh bo'limlarni kasallik tarixi, kuzatuvlar, bajarilgan muolajalar va tahlillardan to'ldirish.</span>
              <Button size="sm" variant="outline" onClick={autofill} data-testid="button-epicrisis-autofill">
                <Sparkles className="mr-1.5 h-4 w-4" />
                Avto-to'ldirish
              </Button>
            </div>
          )}
          {EPICRISIS_FIELDS.map((f) => (
            <div key={f} className="space-y-1.5">
              <Label htmlFor={`epi-${f}`}>
                {EPICRISIS_FIELD_LABELS[f]}
                {f !== "treatmentSummary" && <span className="ml-0.5 text-destructive">*</span>}
              </Label>
              <Textarea
                id={`epi-${f}`}
                value={fields[f]}
                onChange={(e) => setFields((x) => ({ ...x, [f]: e.target.value }))}
                placeholder={EPICRISIS_FIELD_HINTS[f]}
                rows={f === "epicrisis" ? 10 : f === "finalDiagnosis" ? 2 : 5}
                maxLength={EPICRISIS_MAX[f]}
                data-testid={`input-epicrisis-${f}`}
              />
              {f === "finalDiagnosis" && (
                <IcdPicker
                  value={fields.finalDiagnosisCode || null}
                  testId="icd-epicrisis"
                  onChange={(code, entry) => setFields((x) => ({ ...x, finalDiagnosisCode: code ?? "", finalDiagnosis: code && entry && !x.finalDiagnosis.trim() ? icdDisplayName(entry) : x.finalDiagnosis }))}
                />
              )}
            </div>
          ))}
          {admission.status === "discharged" && (
            <div className="space-y-1.5">
              <Label htmlFor="epi-reason">Tuzatish sababi *</Label>
              <Input id="epi-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Nima va nega tuzatilmoqda" data-testid="input-epicrisis-reason" />
            </div>
          )}
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground" data-testid="epicrisis-dirty">
              {dirty ? `O'zgargan: ${changed.join(", ")}` : current ? "Saqlangan" : "* — chiqarish uchun majburiy. Har saqlash yangi versiya."}
            </p>
            <div className="flex flex-wrap gap-2">
              {amending && (
                <Button variant="ghost" onClick={() => (setAmending(false), setFields(fieldsOf(current)), setReason(""))}>
                  Bekor
                </Button>
              )}
              <Button variant="outline" onClick={() => save.mutate()} disabled={!dirty || save.isPending || stale || (admission.status === "discharged" && reason.trim().length < 3)} data-testid="button-save-epicrisis">
                {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Saqlash
              </Button>
              {v.can.discharge && (
                <Button onClick={() => setDischarging(true)} disabled={dirty} title={dirty ? "Avval epikrizni saqlang" : undefined} data-testid="button-discharge">
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Chiqarish
                </Button>
              )}
            </div>
          </div>
          {v.can.discharge && missing && !dirty && (
            <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="epicrisis-missing">
              {missing}
            </p>
          )}
        </div>
      ) : !current ? (
        <p className="text-sm text-muted-foreground">Epikriz yozilmagan{admission.status === "active" ? " — uni davolovchi shifokor bemorni chiqarishdan oldin to'ldiradi." : "."}</p>
      ) : (
        <div className="space-y-4">
          <EpicrisisRead version={current} />
          {v.can.amend && (
            <Button variant="outline" size="sm" onClick={() => setAmending(true)} data-testid="button-amend-epicrisis">
              <Pencil className="mr-1.5 h-4 w-4" />
              Tuzatish kiritish
            </Button>
          )}
        </div>
      )}
      {discharging && <DischargeDialog admission={admission} missing={missing} onClose={() => setDischarging(false)} />}
      <EpicrisisPdfDialog admissionId={pdfOpen ? admission.id : null} onClose={() => setPdfOpen(false)} />
      <EpicrisisVersionsDialog admissionId={admission.id} open={versionsOpen} onOpenChange={setVersionsOpen} />
    </SectionCard>
  );
}

const dirtyOf = (fields: Fields, current: EpicrisisVersion | null) => epicrisisChanges(current ? epicrisisTextOf(current) : null, normalizeEpicrisis(fields)).length > 0;

function EpicrisisRead({ version }: { version: EpicrisisVersion }) {
  return (
    <dl className="space-y-4 text-sm" data-testid="epicrisis-read">
      {EPICRISIS_FIELDS.map((f) => (
        <div key={f}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{EPICRISIS_FIELD_LABELS[f]}</dt>
          <dd className="mt-1 whitespace-pre-line">
            {f === "finalDiagnosis" && version.finalDiagnosisCode && <IcdCodeBadge code={version.finalDiagnosisCode} className="mb-1" />}
            {version[f] ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DischargeDialog({ admission, missing, onClose }: { admission: AdmissionView; missing: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const { toast } = useToast();
  const [at, setAt] = useState(localNow);
  const [error, setError] = useState<string | null>(null);
  const seesMoney = can("payments.create", "finance.view");
  const { data: charge } = useQuery<{ charge: { amount: number; days: number }; paid: number; due: number }>({
    queryKey: [`/api/admissions/${admission.id}/charge`],
    enabled: seesMoney,
    refetchOnMount: "always",
  });
  const go = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/admissions/${admission.id}/discharge`, { dischargedAt: new Date(at).toISOString() })).json()) as AdmissionView,
    onSuccess: () => {
      invalidateApi(`/api/admissions/${admission.id}`, "/api/admissions", "/api/inpatient", "/api/wards", "/api/procedure-tasks");
      toast({ title: `${admission.patientName} chiqarildi`, description: "Yotoq tozalashga o'tdi, tayinlovlar to'xtatildi. Epikrizni PDF qilib bering." });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bemorni chiqarish</DialogTitle>
          <DialogDescription>
            {admission.patientName} · statsionar karta №{admission.number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm" data-testid="discharge-dialog">
          <div className="space-y-1.5">
            <Label htmlFor="discharge-at">Chiqarilgan vaqt</Label>
            <Input id="discharge-at" type="datetime-local" value={at} max={localNow()} onChange={(e) => setAt(e.target.value)} data-testid="input-discharge-at" />
          </div>
          <ul className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <li>• Epikriz imzolangan hujjatga aylanadi (keyin faqat sabab bilan tuzatiladi).</li>
            <li>• Yotoq bo'shaydi va "tozalanmoqda" holatiga o'tadi.</li>
            <li>• Faol tayinlovlar to'xtaydi, rejadagi muolajalar bekor qilinadi.</li>
            <li>• Yotoq-kun hisobi chiqarilgan kunda to'xtaydi.</li>
          </ul>
          {seesMoney && charge && (
            <p className={cn("rounded-lg border p-3", charge.due > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")} data-testid="discharge-due">
              {charge.due > 0 ? `Hisobda qarz: ${money(charge.due)} — kassada yoping (chiqarishni to'xtatmaydi).` : "Statsionar hisobi to'langan."}
            </p>
          )}
          {missing && <p className="text-destructive">{missing}</p>}
          {error && (
            <p className="text-destructive" data-testid="discharge-error">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={() => go.mutate()} disabled={go.isPending || Boolean(missing)} data-testid="button-confirm-discharge">
            {go.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Chiqarish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EpicrisisVersionsDialog({ admissionId, open, onOpenChange }: { admissionId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: versions = [] } = useQuery<EpicrisisVersion[]>({ queryKey: [`/api/admissions/${admissionId}/epicrisis/versions`], enabled: open, refetchOnMount: "always" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Epikriz versiyalari</DialogTitle>
          <DialogDescription>Har saqlash alohida versiya; hech biri o'chirilmaydi. Eng yangisi tepada.</DialogDescription>
        </DialogHeader>
        <ol className="min-h-0 space-y-4 overflow-y-auto pr-1" data-testid="epicrisis-versions">
          {versions.map((x, i) => {
            const prev = versions[i + 1];
            return (
              <li key={x.id} className="rounded-xl border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {x.version}-versiya {i === 0 && <Badge variant="outline" className="ml-1">joriy</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {x.savedByName ?? "—"} · {formatDateTime(x.savedAt)}
                  </p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  {prev ? `O'zgargan: ${epicrisisChanges(epicrisisTextOf(prev), epicrisisTextOf(x)).join(", ")}` : "Birinchi yozuv"}
                  {x.reason ? ` · Tuzatish sababi: ${x.reason}` : ""}
                </p>
                <EpicrisisRead version={x} />
              </li>
            );
          })}
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The PDF, previewed exactly as it prints and saves; fetched fresh, as issuing it is logged. */
function EpicrisisPdfDialog({ admissionId, onClose }: { admissionId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const pdfRef = useRef<Awaited<ReturnType<typeof buildEpicrisisPdf>> | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const { data, error } = useQuery<EpicrisisDocument>({
    queryKey: [`/api/admissions/${admissionId}/epicrisis/document`],
    enabled: Boolean(admissionId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (!data || !admissionId) return;
    let cancelled = false;
    let made: string | null = null;
    buildEpicrisisPdf(data)
      .then((pdf) => {
        if (cancelled) return;
        pdfRef.current = pdf;
        made = String(pdf.output("bloburl"));
        setUrl(made);
      })
      .catch((err: Error) => toast({ variant: "destructive", title: "PDF tayyorlanmadi", description: err.message }));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
      pdfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, admissionId]);
  return (
    <Dialog open={Boolean(admissionId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Epikriz
          </DialogTitle>
          <DialogDescription>{data ? `${data.admission.patientName} · statsionar karta №${data.admission.number} · v${data.epicrisis.version}` : "Tayyorlanmoqda…"}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted/40">
          {error ? (
            <p className="p-8 text-center text-sm text-destructive">{(error as Error).message}</p>
          ) : !url ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF tayyorlanmoqda…
            </div>
          ) : (
            <iframe ref={frameRef} src={url} title="Epikriz" className="h-full w-full border-0" data-testid="frame-epicrisis" />
          )}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          <Button
            variant="outline"
            disabled={!url}
            onClick={() => {
              try {
                frameRef.current?.contentWindow?.focus();
                frameRef.current?.contentWindow?.print();
              } catch {
                if (url) window.open(url, "_blank");
              }
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Chop etish
          </Button>
          <Button disabled={!url || !data} onClick={() => data && pdfRef.current?.save(epicrisisFilename(data))} data-testid="button-download-epicrisis">
            <Download className="mr-2 h-4 w-4" />
            Yuklab olish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
