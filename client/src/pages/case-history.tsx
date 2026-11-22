/**
 * Kasallik tarixi (B6.4, TZ §8.1.3): one stay's clinical history — the
 * doctor's text (every save a new version), the daily observations of doctors
 * and nurses with their trend, the lab results and examinations of the stay.
 * Rules: shared/case-history.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ClipboardList, FlaskConical, History, Loader2, Plus, Save, Stethoscope, Activity, RotateCcw, XCircle, FileSearch } from "lucide-react";
import type { AdmissionObservation, CaseHistoryVersion, CaseHistoryView } from "@shared/schema";
import {
  CASE_FIELDS,
  CASE_FIELD_HINTS,
  CASE_FIELD_LABELS,
  CASE_FIELD_MAX,
  VITALS,
  VITAL_SPEC,
  caseChanges,
  caseTextOf,
  formatVital,
  normalizeCase,
  observationProblem,
  vitalFlag,
  type CaseField,
  type CaseText,
  type Vital,
  type Vitals,
} from "@shared/case-history";
import { ADMISSION_STATUS_LABELS, stayDay } from "@shared/inpatient";
import { icdDisplayName } from "@shared/icd10";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader, PatientNumber, SectionCard } from "@/components/ui-kit";
import { AllergyAlert, LabResultsTable } from "@/components/medical-record";
import { IcdCodeBadge, IcdPicker, useIcdLabels } from "@/components/icd-picker";
import { TextPromptDialog } from "@/components/qc/qc-ui";
import { ApiError, apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { OrdersSection } from "@/components/inpatient/procedures";
import { cn } from "@/lib/utils";
import { dayKey, formatDateTime, formatDay, formatTime } from "@/lib/format";

type Fields = Record<CaseField | "diagnosisCode", string>;
const EMPTY: Fields = { complaints: "", anamnesis: "", examination: "", diagnosis: "", diagnosisCode: "", treatmentPlan: "" };
const fieldsOf = (v: CaseHistoryVersion | null): Fields =>
  v ? { complaints: v.complaints ?? "", anamnesis: v.anamnesis ?? "", examination: v.examination ?? "", diagnosis: v.diagnosis ?? "", diagnosisCode: v.diagnosisCode ?? "", treatmentPlan: v.treatmentPlan ?? "" } : EMPTY;

export default function CaseHistoryPage() {
  const [, params] = useRoute("/inpatient/stays/:id");
  const id = params?.id ?? "";
  const key = `/api/admissions/${id}/history`;
  const { data, isLoading, error } = useQuery<CaseHistoryView>({ queryKey: [key], enabled: Boolean(id), refetchOnMount: "always" });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 skeleton-shimmer rounded-xl" />
        <div className="h-96 skeleton-shimmer rounded-xl" />
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Kasallik tarixi ochilmadi"
        description={error instanceof ApiError ? error.message : "Statsionar karta topilmadi"}
        action={
          <Button variant="outline" asChild>
            <Link href="/inpatient">Statsionarga qaytish</Link>
          </Button>
        }
      />
    );
  }
  const a = data.admission;
  const today = dayKey(new Date());
  return (
    <div className="space-y-6" data-testid="case-history-page">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" asChild>
          <Link href="/inpatient">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Statsionar
          </Link>
        </Button>
        <PageHeader
          eyebrow={`Statsionar karta №${a.number}`}
          title="Kasallik tarixi"
          description={`${a.departmentName}${a.current ? ` · palata ${a.current.wardName}, yotoq ${a.current.bedLabel}` : ""}`}
          actions={
            <Badge variant="outline" className={cn("font-medium", a.status === "active" ? "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300" : "text-muted-foreground")}>
              {ADMISSION_STATUS_LABELS[a.status]}
            </Badge>
          }
        />
      </div>

      <div className="card-premium flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="case-patient">
        <div className="flex min-w-0 items-center gap-3">
          <PatientNumber value={a.patientNumber} size="sm" />
          <div className="min-w-0">
            <Link href={`/patients/${a.patientId}`} className="block truncate font-semibold hover:underline">
              {a.patientName}
            </Link>
            <p className="text-xs text-muted-foreground">
              Yotqizilgan {formatDateTime(a.admittedAt)}
              {a.status === "active" ? ` · ${stayDay(dayKey(new Date(a.admittedAt)), today)}-kun` : ""}
              {a.plannedDischargeOn ? ` · chiqarish rejasi ${formatDay(a.plannedDischargeOn)}` : ""}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{a.doctorName}</span>
          {a.doctorSpecialty && <span className="text-muted-foreground">· {a.doctorSpecialty}</span>}
        </p>
      </div>
      <AllergyAlert allergies={data.allergies} />
      {a.reason && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Yotqizish sababi:</span> {a.reason}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <CaseHistoryForm view={data} queryKey={key} />
          <OrdersSection admissionId={a.id} active={a.status === "active"} />
          <Observations view={data} queryKey={key} />
        </div>
        <div className="min-w-0 space-y-6">
          <SectionCard icon={FlaskConical} title="Laboratoriya natijalari" description="Yotgan davrida berilgan buyurtmalar, tasdiqlangan natijalar" flush>
            <div data-testid="case-lab">
              <LabResultsTable results={data.labResults} />
            </div>
          </SectionCard>
          <SectionCard icon={FileSearch} title="Tekshiruvlar" description="Yotgan davridagi tasdiqlangan ko'riklar va konsultatsiyalar">
            {data.exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tekshiruv yo'q.</p>
            ) : (
              <ul className="space-y-3" data-testid="case-exams">
                {data.exams.map((e) => (
                  <li key={e.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDay(e.date)} · {e.doctorName}
                    </p>
                    {e.diagnosis && <p className="mt-1.5">{e.diagnosis}</p>}
                    {e.conclusion && <p className="mt-1 line-clamp-3 whitespace-pre-line text-muted-foreground">{e.conclusion}</p>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the doctor's text

function CaseHistoryForm({ view, queryKey }: { view: CaseHistoryView; queryKey: string }) {
  const { toast } = useToast();
  const current = view.current;
  const [fields, setFields] = useState<Fields>(() => fieldsOf(current));
  const [base, setBase] = useState(current?.version ?? 0);
  const [stale, setStale] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const labels = useIcdLabels([current?.diagnosisCode]);

  const text: CaseText = normalizeCase(fields);
  const changed = caseChanges(current ? caseTextOf(current) : null, text);
  const dirty = (current?.version ?? 0) === base && changed.length > 0;

  // A newer version arriving (another tab, a reload) is taken in only when nothing is being typed.
  useEffect(() => {
    if ((current?.version ?? 0) !== base && !dirty) {
      setFields(fieldsOf(current));
      setBase(current?.version ?? 0);
    }
  }, [current?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/admissions/${view.admission.id}/history`, { baseVersion: base, ...text })).json()) as CaseHistoryVersion,
    onSuccess: (v) => {
      setBase(v.version);
      setFields(fieldsOf(v));
      setStale(false);
      invalidateApi(queryKey);
      toast({ title: `Kasallik tarixi saqlandi — ${v.version}-versiya` });
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 409) setStale(true);
      toast({ title: "Saqlanmadi", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && view.can.write) {
        e.preventDefault();
        if (dirty && !save.isPending) save.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reload = () => {
    setStale(false);
    setBase(-1); // let the effect take the fresh version in
    invalidateApi(queryKey);
  };
  useEffect(() => {
    if (base === -1 && current) {
      setFields(fieldsOf(current));
      setBase(current.version);
    }
  }, [base, current]);

  const meta = current ? `${current.version}-versiya · ${current.savedByName ?? "—"}, ${formatDateTime(current.savedAt)}` : "Hali yozilmagan";

  return (
    <SectionCard
      icon={ClipboardList}
      title="Kasallik tarixi"
      description={meta}
      action={
        view.versionCount > 1 ? (
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} data-testid="button-case-versions">
            <History className="mr-1.5 h-4 w-4" />
            Tarix ({view.versionCount})
          </Button>
        ) : undefined
      }
    >
      {stale && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between" data-testid="case-stale">
          <span>Kasallik tarixini boshqa oynada kimdir o'zgartirdi. Matningizni nusxalab oling va oxirgi holatni yuklang.</span>
          <Button size="sm" variant="outline" onClick={reload} data-testid="button-case-reload">
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Oxirgi holat
          </Button>
        </div>
      )}
      {view.can.write ? (
        <div className="space-y-5">
          {CASE_FIELDS.map((f) => (
            <div key={f} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`case-${f}`}>{CASE_FIELD_LABELS[f]}</Label>
                <span className={cn("text-[11px] tabular text-muted-foreground", fields[f].length > CASE_FIELD_MAX && "text-destructive")}>
                  {fields[f].length > CASE_FIELD_MAX * 0.8 ? `${fields[f].length}/${CASE_FIELD_MAX}` : ""}
                </span>
              </div>
              <Textarea
                id={`case-${f}`}
                value={fields[f]}
                onChange={(e) => setFields((x) => ({ ...x, [f]: e.target.value }))}
                placeholder={CASE_FIELD_HINTS[f]}
                rows={f === "diagnosis" ? 2 : 4}
                maxLength={CASE_FIELD_MAX}
                data-testid={`input-case-${f}`}
              />
              {f === "diagnosis" && (
                <IcdPicker
                  value={fields.diagnosisCode || null}
                  testId="icd-case-diagnosis"
                  onChange={(code, entry) => {
                    setFields((x) => ({ ...x, diagnosisCode: code ?? "", diagnosis: code && entry && !x.diagnosis.trim() ? icdDisplayName(entry) : x.diagnosis }));
                  }}
                />
              )}
            </div>
          ))}
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground" data-testid="case-dirty">
              {dirty ? `O'zgargan: ${changed.join(", ")}` : current ? "Saqlangan" : "Har saqlash yangi versiya bo'lib qoladi; oldingi matn o'chmaydi."}
            </p>
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending || stale} data-testid="button-save-case">
              {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Saqlash
              <kbd className="ml-2 hidden rounded border bg-background/20 px-1 text-[10px] sm:inline">Ctrl S</kbd>
            </Button>
          </div>
        </div>
      ) : !current ? (
        <p className="text-sm text-muted-foreground" data-testid="case-empty">
          Kasallik tarixi hali yozilmagan{view.admission.status === "active" ? " — uni davolovchi shifokor yozadi." : "."}
        </p>
      ) : (
        <CaseReadView version={current} codeLabel={current.diagnosisCode ? labels.get(current.diagnosisCode) : null} />
      )}
      <CaseVersionsDialog admissionId={view.admission.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </SectionCard>
  );
}

function CaseReadView({ version, codeLabel }: { version: CaseHistoryVersion; codeLabel?: ReturnType<ReturnType<typeof useIcdLabels>["get"]> | null }) {
  return (
    <dl className="space-y-4 text-sm" data-testid="case-read">
      {CASE_FIELDS.map((f) => (
        <div key={f}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CASE_FIELD_LABELS[f]}</dt>
          <dd className="mt-1 whitespace-pre-line">
            {f === "diagnosis" && version.diagnosisCode && <IcdCodeBadge code={version.diagnosisCode} label={version.diagnosis ? null : codeLabel} className="mb-1" />}
            {version[f] ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CaseVersionsDialog({ admissionId, open, onOpenChange }: { admissionId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: versions = [] } = useQuery<CaseHistoryVersion[]>({ queryKey: [`/api/admissions/${admissionId}/history/versions`], enabled: open, refetchOnMount: "always" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Kasallik tarixi versiyalari</DialogTitle>
          <DialogDescription>Har saqlash alohida versiya; hech biri o'chirilmaydi. Eng yangisi tepada.</DialogDescription>
        </DialogHeader>
        <ol className="min-h-0 space-y-4 overflow-y-auto pr-1" data-testid="case-versions">
          {versions.map((v, i) => {
            const prev = versions[i + 1];
            const changes = caseChanges(prev ? caseTextOf(prev) : null, caseTextOf(v));
            return (
              <li key={v.id} className="rounded-xl border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {v.version}-versiya {i === 0 && <Badge variant="outline" className="ml-1">joriy</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.savedByName ?? "—"} · {formatDateTime(v.savedAt)}
                  </p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{prev ? `O'zgargan: ${changes.join(", ")}` : "Birinchi yozuv"}</p>
                <CaseReadView version={v} />
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

// ---------------------------------------------------------------- daily observations

const localNow = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const numberOf = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  return t === "" ? null : Number(t);
};
const FLAG_TONE = { high: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300", low: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300" } as const;

/** One reading as a chip: "T° 38.2 ↑", "AQB 150/95 ↑". */
function VitalChips({ o }: { o: AdmissionObservation }) {
  const chips: { key: string; label: string; flag: "high" | "low" | null }[] = [];
  for (const v of VITALS) {
    if (v === "diastolic" || o[v] === null) continue;
    if (v === "systolic") {
      const flag = vitalFlag("systolic", o.systolic) ?? vitalFlag("diastolic", o.diastolic);
      chips.push({ key: v, label: `AQB ${o.systolic}/${o.diastolic}`, flag });
    } else {
      chips.push({ key: v, label: `${VITAL_SPEC[v].short} ${formatVital(v, o[v])}${v === "temperature" ? "°" : v === "spo2" ? "%" : ""}`, flag: vitalFlag(v, o[v]) });
    }
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Badge key={c.key} variant="outline" className={cn("font-medium tabular", c.flag ? FLAG_TONE[c.flag] : "text-foreground")} data-testid={`vital-${c.key}`}>
          {c.label}
          {c.flag === "high" ? " ↑" : c.flag === "low" ? " ↓" : ""}
        </Badge>
      ))}
    </div>
  );
}

function Observations({ view, queryKey }: { view: CaseHistoryView; queryKey: string }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<AdmissionObservation | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [showVoided, setShowVoided] = useState(false);
  const live = view.observations.filter((o) => !o.voidedAt);
  const shown = showVoided ? view.observations : live;
  const voidedCount = view.observations.length - live.length;
  const me = useMeId();

  const strike = useMutation({
    mutationFn: async (reason: string) => (await apiRequest("POST", `/api/observations/${voiding!.id}/void`, { reason })).json(),
    onSuccess: () => {
      setVoiding(null);
      setVoidError(null);
      invalidateApi(queryKey);
      toast({ title: "Kuzatuv bekor qilindi" });
    },
    onError: (e: Error) => setVoidError(e.message),
  });

  return (
    <SectionCard
      icon={Activity}
      title="Kundalik kuzatuv"
      description="Harorat, bosim, puls va holat — shifokor va hamshira yozuvlari"
      action={
        view.can.observe && !adding ? (
          <Button size="sm" onClick={() => setAdding(true)} data-testid="button-add-observation">
            <Plus className="mr-1.5 h-4 w-4" />
            Kuzatuv
          </Button>
        ) : undefined
      }
    >
      {adding && <ObservationForm admissionId={view.admission.id} queryKey={queryKey} onDone={() => setAdding(false)} />}
      {live.length > 0 && <VitalTrends observations={live} />}
      {shown.length === 0 ? (
        !adding && <p className="text-sm text-muted-foreground">Kuzatuv hali yo'q.</p>
      ) : (
        <ol className="space-y-2" data-testid="observation-list">
          {shown.map((o) => {
            const mine = o.authorId === me;
            const canVoid = !o.voidedAt && view.admission.status === "active" && ((view.can.observe && mine) || view.can.voidAny);
            return (
              <li key={o.id} className={cn("rounded-lg border p-3", o.voidedAt && "bg-muted/40")} data-testid={`observation-${o.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("min-w-0 space-y-1.5", o.voidedAt && "opacity-60 line-through decoration-muted-foreground/60")}>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground tabular">
                        {formatDay(dayKey(new Date(o.observedAt)))}, {formatTime(o.observedAt)}
                      </span>{" "}
                      · {o.authorName ?? "—"}
                      {o.authorRole ? ` (${o.authorRole.toLowerCase()})` : ""}
                    </p>
                    <VitalChips o={o} />
                    {o.note && <p className="whitespace-pre-line text-sm">{o.note}</p>}
                  </div>
                  {canVoid && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" title="Xato yozuvni bekor qilish" aria-label="Xato yozuvni bekor qilish" onClick={() => setVoiding(o)} data-testid={`button-void-observation-${o.id}`}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {o.voidedAt && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Bekor qilingan: {o.voidReason} — {o.voidedByName ?? "—"}, {formatDateTime(o.voidedAt)}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {voidedCount > 0 && (
        <Button variant="ghost" size="sm" className="mt-2 h-auto px-0 text-xs text-primary hover:bg-transparent hover:underline" onClick={() => setShowVoided((x) => !x)} data-testid="button-toggle-voided">
          {showVoided ? "Bekor qilinganlarni yashirish" : `Bekor qilinganlarni ko'rsatish (${voidedCount})`}
        </Button>
      )}
      <TextPromptDialog
        open={Boolean(voiding)}
        onOpenChange={(o) => !o && setVoiding(null)}
        title="Kuzatuv bekor qilinsinmi?"
        description="Yozuv o'chirilmaydi — sabab bilan bekor qilingan deb belgilanadi va tarixda qoladi."
        label="Sabab"
        confirmLabel="Kuzatuvni bekor qilish"
        destructive
        pending={strike.isPending}
        error={voidError}
        onConfirm={(r) => strike.mutate(r)}
        testId="observation-void"
      />
    </SectionCard>
  );
}

function useMeId(): string | null {
  return useAuth().user?.id ?? null;
}

function ObservationForm({ admissionId, queryKey, onDone }: { admissionId: string; queryKey: string; onDone: () => void }) {
  const { toast } = useToast();
  const [at, setAt] = useState(localNow);
  const [values, setValues] = useState<Record<Vital, string>>({ temperature: "", pulse: "", systolic: "", diastolic: "", respiration: "", spo2: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const vitals = useMemo(() => Object.fromEntries(VITALS.map((v) => [v, numberOf(values[v])])) as Vitals, [values]);

  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admissions/${admissionId}/observations`, { observedAt: new Date(at).toISOString(), ...vitals, note: note.trim() || null })).json(),
    onSuccess: () => {
      invalidateApi(queryKey);
      toast({ title: "Kuzatuv yozildi" });
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });
  const submit = () => {
    const bad = VITALS.find((v) => vitals[v] !== null && Number.isNaN(vitals[v]));
    const problem = bad ? `${VITAL_SPEC[bad].label}: raqam kiriting` : observationProblem(vitals, note);
    if (problem) return setError(problem);
    setError(null);
    add.mutate();
  };
  const field = (v: Vital, placeholder: string) => (
    <Input
      inputMode="decimal"
      value={values[v]}
      onChange={(e) => setValues((x) => ({ ...x, [v]: e.target.value }))}
      placeholder={placeholder}
      aria-label={VITAL_SPEC[v].label}
      className={cn("tabular", vitalFlag(v, numberOf(values[v])) && "border-amber-500")}
      data-testid={`input-vital-${v}`}
    />
  );

  return (
    <div className="mb-5 space-y-4 rounded-xl border bg-muted/30 p-4" data-testid="observation-form">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="obs-at">Vaqt</Label>
          <Input id="obs-at" type="datetime-local" value={at} max={localNow()} onChange={(e) => setAt(e.target.value)} data-testid="input-observation-at" />
        </div>
        <div className="space-y-1.5">
          <Label>Harorat, °C</Label>
          {field("temperature", "36.6")}
        </div>
        <div className="space-y-1.5">
          <Label>Arterial qon bosimi</Label>
          <div className="flex items-center gap-1.5">
            {field("systolic", "120")}
            <span className="text-muted-foreground">/</span>
            {field("diastolic", "80")}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Puls, /min</Label>
          {field("pulse", "72")}
        </div>
        <div className="space-y-1.5">
          <Label>Nafas soni, /min</Label>
          {field("respiration", "16")}
        </div>
        <div className="space-y-1.5">
          <Label>SpO₂, %</Label>
          {field("spo2", "98")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="obs-note">Holat, dinamika</Label>
        <Textarea id="obs-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={CASE_FIELD_MAX} placeholder="Umumiy holat, shikoyatlar, davolashga javob…" data-testid="input-observation-note" />
      </div>
      {error && (
        <p className="text-sm text-destructive" data-testid="observation-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Bekor
        </Button>
        <Button onClick={submit} disabled={add.isPending} data-testid="button-save-observation">
          {add.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Yozish
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- trends

/**
 * Temperature and pulse over the stay: one chart each (different scales never
 * share an axis), a 2px line with point markers, the usual range as a quiet
 * band, and a hover readout per point.
 */
function VitalTrends({ observations }: { observations: AdmissionObservation[] }) {
  const series = (["temperature", "pulse"] as const)
    .map((v) => ({ v, points: observations.filter((o) => o[v] !== null).map((o) => ({ t: Date.parse(o.observedAt), value: o[v] as number })).sort((a, b) => a.t - b.t) }))
    .filter((s) => s.points.length >= 2);
  if (series.length === 0) return null;
  return (
    <div className="mb-5 grid gap-4 md:grid-cols-2" data-testid="vital-trends">
      {series.map((s) => (
        <TrendChart key={s.v} vital={s.v} points={s.points} />
      ))}
    </div>
  );
}

function TrendChart({ vital, points }: { vital: "temperature" | "pulse"; points: { t: number; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const spec = VITAL_SPEC[vital];
  const W = 320;
  const H = 120;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  const values = points.map((p) => p.value);
  const lo = Math.min(spec.low, ...values);
  const hi = Math.max(spec.high, ...values);
  const span = hi - lo || 1;
  const yMin = lo - span * 0.15;
  const yMax = hi + span * 0.15;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const fmt = (v: number) => (vital === "temperature" ? v.toFixed(1) : String(Math.round(v)));
  const h = hover !== null ? points[hover] : null;
  // Within one day the axis names the hours; across days, the days.
  const sameDay = dayKey(new Date(t0)) === dayKey(new Date(t1));
  const tick = (t: number) => (sameDay ? formatTime(new Date(t).toISOString()) : formatDay(dayKey(new Date(t))));
  return (
    <figure className="rounded-lg border p-3" data-testid={`trend-${vital}`}>
      <figcaption className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">
          {spec.label}, {spec.unit}
        </span>
        <span className="tabular text-muted-foreground">{h ? `${formatDateTime(new Date(h.t).toISOString())} — ${fmt(h.value)}` : `oxirgi ${fmt(points[points.length - 1].value)}`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${spec.label}: ${points.map((p) => fmt(p.value)).join(", ")}`} onMouseLeave={() => setHover(null)}>
        <rect x={pad.l} y={y(spec.high)} width={W - pad.l - pad.r} height={Math.max(0, y(spec.low) - y(spec.high))} className="fill-emerald-500/10" />
        {[spec.low, spec.high].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="3 3" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] tabular">
              {fmt(v)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const out = vitalFlag(vital, p.value);
          return (
            <g key={i}>
              <circle cx={x(p.t)} cy={y(p.value)} r={hover === i ? 5 : 4} className={cn("stroke-background", out ? "fill-rose-500" : "fill-primary")} strokeWidth={2} />
              <rect x={x(p.t) - 12} y={pad.t} width={24} height={H - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
        <text x={pad.l} y={H - 5} className="fill-muted-foreground text-[9px]">
          {tick(t0)}
        </text>
        <text x={W - pad.r} y={H - 5} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {tick(t1)}
        </text>
      </svg>
    </figure>
  );
}

