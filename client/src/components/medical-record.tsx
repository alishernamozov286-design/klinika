/**
 * Clinical-record building blocks (B3.2–B3.3): the record's status badge,
 * its read-only view, version history, the allergy list, and the electronic
 * medical card that brings them together (TZ §5.1.2).
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ClipboardList,
  FileClock,
  FileSignature,
  FileText,
  FlaskConical,
  History,
  Loader2,
  NotebookPen,
  Plus,
  Send,
  ShieldAlert,
  Stethoscope,
  X,
} from "lucide-react";
import {
  RECORD_CODE_FOR,
  type RecordCodeField,
  RECORD_FIELDS,
  RECORD_FIELD_LABELS,
  type MedicalCard,
  type MedicalRecordVersion,
  type MedicalRecordWithDetails,
  type PatientAllergy,
  type RecordField,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, FlagBadge, SectionCard, TableSkeleton } from "@/components/ui-kit";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReferralList } from "@/components/referrals";
import { IcdCodeBadge, useIcdLabels } from "@/components/icd-picker";
import { VisitSummaryDialog } from "@/components/visit-summary-dialog";

// ------------------------------------------------------------------ status

export function RecordStatusBadge({ record, className }: { record: Pick<MedicalRecordWithDetails, "status" | "version">; className?: string }) {
  return record.status === "signed" ? (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300", className)}
      data-testid="badge-record-signed"
    >
      <FileSignature className="h-3 w-3" />
      Tasdiqlangan{record.version > 1 ? ` · v${record.version}` : ""}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap border-amber-500/30 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-300", className)}
      data-testid="badge-record-draft"
    >
      <NotebookPen className="h-3 w-3" />
      Qoralama
    </Badge>
  );
}

// --------------------------------------------------------------- read view

const DIAGNOSIS_FIELDS = new Set<RecordField>(["preliminaryDiagnosis", "finalDiagnosis"]);

/** The six fields as a document: empty ones are left out, diagnoses stand out. */
export function RecordReadView({
  record,
  dense,
}: {
  record: Partial<Record<RecordField | RecordCodeField, string | null>>;
  dense?: boolean;
}) {
  const codeOf = (f: RecordField) => (f === "preliminaryDiagnosis" || f === "finalDiagnosis" ? record[RECORD_CODE_FOR[f]] ?? null : null);
  const labels = useIcdLabels([record.preliminaryDiagnosisCode, record.finalDiagnosisCode]);
  const filled = RECORD_FIELDS.filter((f) => record[f]?.trim() || codeOf(f));
  if (filled.length === 0) return <p className="text-sm text-muted-foreground">Yozuv bo'sh.</p>;
  return (
    <dl className={cn("grid gap-x-6", dense ? "gap-y-3" : "gap-y-4 sm:grid-cols-2")}>
      {filled.map((f) => (
        <div
          key={f}
          className={cn(
            !dense && (f === "complaints" || f === "anamnesis" || f === "examination" || f === "recommendations") && "sm:col-span-2",
            DIAGNOSIS_FIELDS.has(f) && "rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2",
          )}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{RECORD_FIELD_LABELS[f]}</dt>
          {codeOf(f) && (
            <dd className="mt-1">
              <IcdCodeBadge code={codeOf(f)!} label={labels.get(codeOf(f)!)} />
            </dd>
          )}
          {record[f]?.trim() && (
            <dd className={cn("mt-1 whitespace-pre-wrap text-sm leading-relaxed", DIAGNOSIS_FIELDS.has(f) && "font-medium")}>{record[f]}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** "Tasdiqladi: Karimov A., 05.11.2026 14:20 · tuzatish: sabab" */
export function RecordSignature({ record }: { record: MedicalRecordWithDetails }) {
  if (record.status !== "signed") return null;
  return (
    <p className="text-xs text-muted-foreground">
      Tasdiqladi: <span className="font-medium text-foreground">{record.signedByName ?? record.doctorName}</span>,{" "}
      {formatDateTime(record.signedAt)}
      {record.amendReason && (
        <>
          {" "}
          · oxirgi tuzatish sababi: <span className="italic">{record.amendReason}</span>
        </>
      )}
    </p>
  );
}

// ---------------------------------------------------------------- versions

/** Every signed version a correction replaced (TZ §5.2), newest first. */
export function RecordVersionsDialog({
  record,
  onOpenChange,
}: {
  record: MedicalRecordWithDetails | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: versions = [], isLoading } = useQuery<MedicalRecordVersion[]>({
    queryKey: [`/api/records/${record?.id}/versions`],
    enabled: Boolean(record),
  });
  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Yozuv tarixi
          </DialogTitle>
          <DialogDescription>
            Tasdiqlangan yozuvga kiritilgan har bir tuzatishdan oldingi nusxa saqlanadi va o'zgartirilmaydi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {record && (
            <div className="rounded-xl border border-emerald-500/25 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Joriy versiya · v{record.version}</p>
                <RecordStatusBadge record={record} />
              </div>
              <RecordReadView record={record} dense />
              <div className="mt-3">
                <RecordSignature record={record} />
              </div>
            </div>
          )}
          {isLoading ? (
            <TableSkeleton rows={2} />
          ) : versions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Bu yozuvga tuzatish kiritilmagan.</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-xl border bg-muted/20 p-4" data-testid={`record-version-${v.version}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">v{v.version}</p>
                  <p className="text-xs text-muted-foreground">
                    Almashtirildi: {formatDateTime(v.replacedAt)}, {v.replacedByName ?? "—"}
                  </p>
                </div>
                <RecordReadView record={v} dense />
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  Tuzatish sababi: {v.replaceReason}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------- allergies

/**
 * Allergies (TZ §5.1.2). Shown loudly — they are the one thing a doctor must
 * not miss — and never deleted: a wrong entry is marked inactive with why.
 */
export function AllergyPanel({
  patientId,
  allergies,
  canEdit,
  compact,
}: {
  patientId: string;
  allergies: PatientAllergy[];
  canEdit: boolean;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [allergen, setAllergen] = useState("");
  const [reaction, setReaction] = useState("");
  const [removing, setRemoving] = useState<PatientAllergy | null>(null);
  const [reason, setReason] = useState("");
  const active = allergies.filter((a) => a.isActive);
  const inactive = allergies.filter((a) => !a.isActive);

  const refresh = () => invalidateApi(`/api/patients/${patientId}/medical`);

  const add = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/patients/${patientId}/allergies`, { allergen, reaction: reaction || null });
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Allergiya qo'shildi", description: allergen });
      setAllergen("");
      setReaction("");
      setAdding(false);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Qo'shilmadi", description: err.message }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/allergies/${removing!.id}/deactivate`, { reason });
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Allergiya faol emas deb belgilandi" });
      setRemoving(null);
      setReason("");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  return (
    <SectionCard
      icon={ShieldAlert}
      title="Allergiyalar"
      description={active.length ? `${active.length} ta faol` : "Ma'lum allergiya yo'q"}
      action={
        canEdit && !adding ? (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} data-testid="button-add-allergy">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Qo'shish
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {active.length === 0 && !adding && <p className="text-sm text-muted-foreground">Allergiya qayd etilmagan.</p>}
        {active.length > 0 && (
          <ul className="space-y-2" data-testid="list-allergies">
            {active.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{a.allergen}</p>
                  {a.reaction && <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{a.reaction}</p>}
                  {!compact && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.createdByName ?? "—"}, {formatDateTime(a.createdAt)}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground"
                    onClick={() => setRemoving(a)}
                    aria-label="Faol emas deb belgilash"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input
              value={allergen}
              onChange={(e) => setAllergen(e.target.value)}
              placeholder="Allergen (masalan, penitsillin)"
              autoFocus
              maxLength={120}
              data-testid="input-allergen"
            />
            <Input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="Reaksiya (ixtiyoriy)" maxLength={200} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Bekor qilish
              </Button>
              <Button size="sm" onClick={() => add.mutate()} disabled={allergen.trim().length < 2 || add.isPending} data-testid="button-save-allergy">
                {add.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Saqlash
              </Button>
            </div>
          </div>
        )}
        {!compact && inactive.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Faol emas ({inactive.length})</summary>
            <ul className="mt-2 space-y-1">
              {inactive.map((a) => (
                <li key={a.id} className="line-through decoration-muted-foreground/40">
                  {a.allergen}
                  <span className="no-underline"> — {a.removeReason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allergiyani faol emas deb belgilash</DialogTitle>
            <DialogDescription>
              "{removing?.allergen}" o'chirilmaydi — tarixda sababi bilan qoladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="allergy-reason">Sabab</Label>
            <Input id="allergy-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: xato kiritilgan" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Ortga
            </Button>
            <Button onClick={() => remove.mutate()} disabled={reason.trim().length < 3 || remove.isPending}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

/** The red strip at the top of the examination window. */
export function AllergyAlert({ allergies }: { allergies: PatientAllergy[] }) {
  const active = allergies.filter((a) => a.isActive);
  if (active.length === 0) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
      role="alert"
      data-testid="alert-allergies"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">Allergiya: </span>
        {active.map((a, i) => (
          <span key={a.id}>
            {i > 0 && ", "}
            <span className="font-semibold">{a.allergen}</span>
            {a.reaction && <span className="opacity-80"> ({a.reaction})</span>}
          </span>
        ))}
      </p>
    </div>
  );
}

// ------------------------------------------------------- the medical card

/** Lab results, newest first. */
export function LabResultsTable({ results, limit }: { results: MedicalCard["labResults"]; limit?: number }) {
  if (results === null) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Laboratoriya natijalarini ko'rish uchun buyurtmalarni ko'rish ruxsati kerak.</p>;
  }
  if (results.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Natija hali yo'q.</p>;
  const rows = limit ? results.slice(0, limit) : results;
  return (
    <div className="overflow-x-auto">
      <Table className="table-premium">
        <TableHeader>
          <TableRow>
            <TableHead>Sana</TableHead>
            <TableHead>Tahlil</TableHead>
            <TableHead className="text-right">Natija</TableHead>
            <TableHead className="hidden sm:table-cell">Me'yor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.orderId}-${i}`}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDay(r.date)}</TableCell>
              <TableCell className="text-sm">{r.testName}</TableCell>
              <TableCell className="text-right">
                <span className="font-semibold tabular">{r.result}</span>
                {r.unit && <span className="ml-1 text-xs text-muted-foreground">{r.unit}</span>}
                {r.flag && r.flag !== "normal" && <FlagBadge flag={r.flag} className="ml-2" />}
              </TableCell>
              <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">{r.referenceRange ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Diagnosis history (TZ §5.2), from signed records only. */
export function DiagnosisTimeline({ diagnoses }: { diagnoses: MedicalCard["diagnoses"] }) {
  const labels = useIcdLabels(diagnoses.map((d) => d.code));
  if (diagnoses.length === 0) return <p className="text-sm text-muted-foreground">Tasdiqlangan tashxis yo'q.</p>;
  return (
    <ol className="space-y-2.5">
      {diagnoses.map((d) => (
        <li key={`${d.recordId}-${d.kind}`} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            {d.code && <IcdCodeBadge code={d.code} label={d.text ? null : labels.get(d.code)} className="mb-0.5" />}
            {d.text && <p className="text-sm font-medium">{d.text}</p>}
            <p className="text-xs text-muted-foreground">
              {formatDay(d.date)} · {d.doctorName} ({d.specialty}) · {d.kind === "final" ? "yakuniy" : "dastlabki"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The electronic medical record (TZ §5.1.2) as a patient-card tab:
 * allergies, diagnosis history, every examination, lab results.
 */
export function MedicalCardPanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery<MedicalCard>({
    queryKey: [`/api/patients/${patientId}/medical`],
    refetchOnMount: "always",
  });
  const [versionsOf, setVersionsOf] = useState<MedicalRecordWithDetails | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [summaryOf, setSummaryOf] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="card-premium">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="panel-medical-card">
      <AllergyAlert allergies={data.allergies} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <AllergyPanel patientId={patientId} allergies={data.allergies} canEdit={false} />
          <SectionCard icon={ClipboardList} title="Tashxislar tarixi" description="Tasdiqlangan ko'riklardan">
            <DiagnosisTimeline diagnoses={data.diagnoses} />
          </SectionCard>
        </div>

        <SectionCard icon={Stethoscope} title="Ko'riklar" description={`${data.records.length} ta yozuv`} flush>
          {data.records.length === 0 ? (
            <EmptyState icon={FileClock} title="Ko'rik yozuvi yo'q" description="Shifokor qabulida yozilgan ko'riklar shu yerda ko'rinadi." />
          ) : (
            <div className="divide-y">
              {data.records.map((r) => {
                const expanded = open === r.id;
                return (
                  <div key={r.id} className="px-5 py-4" data-testid={`medical-record-${r.id}`}>
                    <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(expanded ? null : r.id)}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {formatDay(r.date)} {r.startTime && <span className="font-mono text-xs font-normal text-muted-foreground">{r.startTime}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.doctorName} · {r.specialty}
                        </p>
                        {(r.finalDiagnosis || r.preliminaryDiagnosis) && !expanded && (
                          <p className="mt-1 line-clamp-1 text-sm">{r.finalDiagnosis ?? r.preliminaryDiagnosis}</p>
                        )}
                      </div>
                      <RecordStatusBadge record={r} />
                    </button>
                    {expanded && (
                      <div className="mt-4 space-y-3">
                        <RecordReadView record={r} />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <RecordSignature record={r} />
                          {r.status === "signed" && (
                            <Button size="sm" variant="outline" onClick={() => setSummaryOf(r.id)} data-testid={`button-summary-${r.id}`}>
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              Xulosa (PDF)
                            </Button>
                          )}
                          {r.version > 1 && (
                            <Button size="sm" variant="ghost" onClick={() => setVersionsOf(r)}>
                              <History className="mr-1.5 h-3.5 w-3.5" />
                              Tarix ({r.version - 1} ta tuzatish)
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard icon={FlaskConical} title="Laboratoriya natijalari" flush>
        <div className="p-1">
          <LabResultsTable results={data.labResults} />
        </div>
      </SectionCard>

      {data.referrals && (
        <SectionCard
          icon={Send}
          title="Yo'llanmalar"
          description="Tahlillar, UZI va boshqa tekshiruvlar, konsultatsiyalar"
          flush
        >
          <ReferralList referrals={data.referrals} emptyText="Yo'llanma berilmagan" />
        </SectionCard>
      )}

      <RecordVersionsDialog record={versionsOf} onOpenChange={(o) => !o && setVersionsOf(null)} />
      <VisitSummaryDialog recordId={summaryOf} onOpenChange={(o) => !o && setSummaryOf(null)} />
    </div>
  );
}
