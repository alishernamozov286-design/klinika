import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  FileSignature,
  FileText,
  FlaskConical,
  History,
  IdCard,
  Loader2,
  NotebookPen,
  PencilLine,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import {
  RECORD_FIELDS,
  RECORD_FIELD_LABELS,
  type ExaminationData,
  type MedicalCard,
  type MedicalRecordWithDetails,
  type RecordField,
} from "@shared/schema";
import { changedFields, signProblem } from "@shared/medical-record";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AppointmentBadge,
  Avatar,
  EmptyState,
  PatientNumber,
  PhoneText,
  QueueTicket,
  SectionCard,
  TableSkeleton,
} from "@/components/ui-kit";
import {
  AllergyAlert,
  AllergyPanel,
  DiagnosisTimeline,
  LabResultsTable,
  RecordReadView,
  RecordSignature,
  RecordStatusBadge,
  RecordVersionsDialog,
} from "@/components/medical-record";
import { useAppointmentStatus } from "@/components/appointment-actions";
import { ExaminationReferrals } from "@/components/referrals";
import { VisitSummaryDialog } from "@/components/visit-summary-dialog";
import { ApiError, apiRequest, invalidateApi, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ageGender, formatDay, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Fields = Record<RecordField, string>;

const PLACEHOLDERS: Record<RecordField, string> = {
  complaints: "Bemor nimadan shikoyat qiladi, qachondan beri…",
  anamnesis: "Kasallik va hayot anamnezi, avvalgi davolanish, irsiyat…",
  examination: "Obyektiv ko'rik: umumiy holat, AQB, puls, harorat, a'zolar bo'yicha topilmalar…",
  preliminaryDiagnosis: "Dastlabki tashxis",
  finalDiagnosis: "Yakuniy tashxis",
  recommendations: "Davolash, tavsiyalar, qayta ko'rik muddati…",
};

const ROWS: Record<RecordField, number> = {
  complaints: 3,
  anamnesis: 4,
  examination: 5,
  preliminaryDiagnosis: 2,
  finalDiagnosis: 2,
  recommendations: 4,
};

const toFields = (r: Partial<Record<RecordField, string | null>> | null | undefined): Fields =>
  Object.fromEntries(RECORD_FIELDS.map((f) => [f, r?.[f] ?? ""])) as Fields;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

const AUTOSAVE_MS = 1200;

/**
 * Ko'rik oynasi (TZ §5.1.3): the doctor writes the examination while the
 * patient is in the room. Drafts save themselves; signing locks the record;
 * a signed record is corrected with a reason and its old text is kept
 * (TZ §5.2). The patient's medical record sits alongside (TZ §5.1.2).
 */
export default function Examination() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { can } = useAuth();
  const { toast } = useToast();
  const examKey = `/api/appointments/${id}/examination`;

  const { data, isLoading, error } = useQuery<ExaminationData>({ queryKey: [examKey], refetchOnMount: "always" });
  const patientId = data?.appointment.patientId;
  const medicalKey = `/api/patients/${patientId}/medical`;
  const { data: medical } = useQuery<MedicalCard>({
    queryKey: [medicalKey],
    enabled: Boolean(patientId) && can("records.read"),
    refetchOnMount: "always",
  });

  const record = data?.record ?? null;
  const appointment = data?.appointment;

  // ------------------------------------------------ open the record on arrival
  const opening = useRef(false);
  const openRecord = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", `/api/appointments/${id}/record`)).json()) as MedicalRecordWithDetails,
    onSuccess: (r) => {
      queryClient.setQueryData<ExaminationData>([examKey], (old) => (old ? { ...old, record: r } : old));
      invalidateApi("/api/cabinet");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Ko'rik yozuvi ochilmadi", description: err.message }),
  });
  useEffect(() => {
    if (data && data.canWrite && !data.record && !opening.current) {
      opening.current = true;
      openRecord.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="card-premium">
        <EmptyState
          icon={Stethoscope}
          title="Qabul topilmadi"
          description="Bu qabul mavjud emas yoki u sizning qabulingiz emas."
          action={
            <Button asChild variant="outline">
              <Link href="/cabinet">Kabinetga qaytish</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data || !appointment) {
    return (
      <div className="space-y-6">
        <div className="card-premium h-28 animate-pulse" />
        <div className="card-premium">
          <TableSkeleton rows={6} />
        </div>
      </div>
    );
  }

  const a = appointment;

  return (
    <div className="space-y-5">
      <Link href="/cabinet" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Kabinet
      </Link>

      {/* ------------------------------------------------------- the patient */}
      <section className="card-premium p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <QueueTicket number={a.queueNumber} className="h-12 min-w-[3.5rem] text-lg" />
            <Avatar name={a.patientName} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
                <PatientNumber value={a.patientNumber} size="sm" />
                <span className="truncate" data-testid="text-exam-patient">
                  {a.patientName}
                </span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span>{ageGender(a.patientAge, a.patientGender)}</span>
                <PhoneText value={a.patientPhone} asLink={false} />
                <span>
                  {formatDay(a.date)}, {a.startTime} · {a.serviceName ?? "Shifokor ko'rigi"}
                </span>
              </p>
              {a.reason && <p className="mt-1 text-sm">Murojaat sababi: {a.reason}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppointmentBadge status={a.status} />
            {record && <RecordStatusBadge record={record} />}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${a.patientId}`}>
                <IdCard className="mr-1.5 h-4 w-4" />
                Bemor kartasi
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {medical && <AllergyAlert allergies={medical.allergies} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {record ? (
            <RecordEditor
              key={`${record.id}:${record.status}:${record.version}`}
              record={record}
              examKey={examKey}
              canWrite={data.canWrite}
              canAmend={data.canAmend}
              canSign={can("records.sign")}
              appointmentStatus={a.status}
              onFinished={() => navigate("/cabinet")}
              appointment={a}
            />
          ) : data.canWrite ? (
            <div className="card-premium flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ko'rik yozuvi ochilmoqda…
            </div>
          ) : (
            <div className="card-premium">
              <EmptyState
                icon={FileText}
                title="Ko'rik yozuvi yo'q"
                description={
                  a.status === "scheduled" || a.status === "arrived"
                    ? "Ko'rik yozuvi bemor qabulga chaqirilgach ochiladi."
                    : "Bu qabul bo'yicha ko'rik yozuvi kiritilmagan."
                }
              />
            </div>
          )}
          {(data.canRefer || data.referrals.length > 0) && (
            <ExaminationReferrals appointment={a} referrals={data.referrals} canRefer={data.canRefer} />
          )}
        </div>

        {/* ---------------------------------------------- the medical record */}
        <aside className="space-y-5">
          {medical ? (
            <>
              <AllergyPanel patientId={a.patientId} allergies={medical.allergies} canEdit={data.canWrite} compact />
              <SectionCard icon={ClipboardList} title="Avvalgi tashxislar">
                <DiagnosisTimeline diagnoses={medical.diagnoses.filter((d) => d.recordId !== record?.id).slice(0, 8)} />
              </SectionCard>
              <SectionCard icon={FlaskConical} title="Oxirgi tahlillar" flush>
                <div className="p-1">
                  <LabResultsTable results={medical.labResults} limit={8} />
                </div>
              </SectionCard>
              <PastExaminations records={medical.records.filter((r) => r.id !== record?.id)} />
            </>
          ) : can("records.read") ? (
            <div className="card-premium">
              <TableSkeleton rows={4} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- the editor

function RecordEditor({
  record,
  examKey,
  canWrite,
  canAmend,
  canSign,
  appointmentStatus,
  appointment,
  onFinished,
}: {
  record: MedicalRecordWithDetails;
  examKey: string;
  canWrite: boolean;
  canAmend: boolean;
  canSign: boolean;
  appointmentStatus: ExaminationData["appointment"]["status"];
  appointment: ExaminationData["appointment"];
  onFinished: () => void;
}) {
  const { toast } = useToast();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [amending, setAmending] = useState(false);
  const [summaryOf, setSummaryOf] = useState<string | null>(null);

  if (record.status === "signed" && !amending) {
    return (
      <SectionCard
        icon={FileSignature}
        title="Ko'rik yozuvi"
        description={`${record.doctorName} · ${record.specialty}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSummaryOf(record.id)} data-testid="button-visit-summary">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Xulosa
            </Button>
            {record.version > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setVersionsOpen(true)} data-testid="button-record-history" aria-label="Tarix">
                <History className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Tarix</span>
              </Button>
            )}
            {canAmend && (
              <Button size="sm" variant="outline" onClick={() => setAmending(true)} data-testid="button-amend-record">
                <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                <span className="sm:hidden">Tuzatish</span>
                <span className="hidden sm:inline">Tuzatish kiritish</span>
              </Button>
            )}
          </div>
        }
      >
        <RecordReadView record={record} />
        <div className="mt-5 border-t pt-4">
          <RecordSignature record={record} />
        </div>
        <RecordVersionsDialog record={versionsOpen ? record : null} onOpenChange={setVersionsOpen} />
        <VisitSummaryDialog recordId={summaryOf} onOpenChange={(o) => !o && setSummaryOf(null)} />
        {appointmentStatus === "in_progress" && canWrite && <FinishAppointment appointment={appointment} onFinished={onFinished} />}
      </SectionCard>
    );
  }

  if (record.status === "signed" && amending) {
    return <AmendForm record={record} examKey={examKey} onDone={() => setAmending(false)} />;
  }

  if (!canWrite) {
    // Someone else's draft is never shown (the server filters it); this is
    // the author's own draft opened read-only on an appointment no longer writable.
    return (
      <SectionCard icon={NotebookPen} title="Ko'rik qoralamasi">
        <RecordReadView record={record} />
      </SectionCard>
    );
  }

  return (
    <DraftForm
      record={record}
      examKey={examKey}
      canSign={canSign}
      appointment={appointment}
      onSigned={(finished) => {
        toast({ title: "Ko'rik yozuvi tasdiqlandi", description: finished ? "Qabul yakunlandi" : undefined });
        if (finished) onFinished();
      }}
    />
  );
}

/** Autosaving draft (B3.3). */
function DraftForm({
  record,
  examKey,
  canSign,
  appointment,
  onSigned,
}: {
  record: MedicalRecordWithDetails;
  examKey: string;
  canSign: boolean;
  appointment: ExaminationData["appointment"];
  onSigned: (finishedAppointment: boolean) => void;
}) {
  const { toast } = useToast();
  const [fields, setFields] = useState<Fields>(() => toFields(record));
  const [state, setState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(record.updatedAt);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // What the server has, and the revision it is at — refs, so the debounced
  // save always sends against the latest without re-creating timers.
  const server = useRef<Fields>(toFields(record));
  const revision = useRef(record.revision);
  const latest = useRef(fields);
  latest.current = fields;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const dirtyFields = useCallback(() => changedFields(server.current, latest.current), []);

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    const changed = dirtyFields();
    if (changed.length === 0) return true;
    const sent = { ...latest.current };
    const body: Record<string, unknown> = { revision: revision.current };
    for (const f of changed) body[f] = sent[f];
    setState("saving");
    const run = (async () => {
      try {
        const res = await apiRequest("PATCH", `/api/records/${record.id}`, body);
        const saved = (await res.json()) as MedicalRecordWithDetails;
        revision.current = saved.revision;
        for (const f of changed) server.current[f] = sent[f];
        setSavedAt(saved.updatedAt);
        setState(changedFields(server.current, latest.current).length ? "dirty" : "saved");
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setState("conflict");
        } else {
          setState("error");
          toast({ variant: "destructive", title: "Saqlanmadi", description: (err as Error).message });
        }
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [dirtyFields, record.id, toast]);

  /** Saves now if anything is pending; resolves false if it could not. */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return save();
  }, [save]);

  // Debounced autosave.
  useEffect(() => {
    if (state === "conflict") return;
    if (dirtyFields().length === 0) return;
    setState((s) => (s === "saving" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Ctrl+S saves at once; leaving with unsaved text asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyFields().length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [flush, dirtyFields]);

  // Save on the way out of the page (navigating inside the app).
  useEffect(() => () => void flush(), [flush]);

  const reload = () => {
    invalidateApi(examKey);
  };

  const problem = signProblem(fields);
  const status = useAppointmentStatus();

  const sign = async (finish: boolean) => {
    setSignError(null);
    setSigning(true);
    try {
      if (!(await flush())) return;
      await apiRequest("POST", `/api/records/${record.id}/sign`, { revision: revision.current });
      if (finish && appointment.status === "in_progress") {
        await status.mutateAsync({ appointment, status: "completed" });
      }
      invalidateApi(examKey, "/api/cabinet", `/api/patients/${appointment.patientId}/medical`);
      onSigned(finish && appointment.status === "in_progress");
    } catch (err) {
      setSignError((err as Error).message);
      if (err instanceof ApiError && err.status === 409) setState("conflict");
    } finally {
      setSigning(false);
    }
  };

  return (
    <SectionCard
      icon={Stethoscope}
      title="Ko'rik"
      description="Matn yozish davomida avtomatik saqlanadi (Ctrl+S — darhol)"
      action={<SaveIndicator state={state} savedAt={savedAt} onRetry={() => void flush()} />}
    >
      {state === "conflict" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200" role="alert">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Yozuv boshqa oynada o'zgartirilgan yoki tasdiqlangan. Bu yerdagi matn saqlanmadi.
          </span>
          <Button size="sm" variant="outline" onClick={reload}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Oxirgi holatni yuklash
          </Button>
        </div>
      )}

      <FieldGrid
        fields={fields}
        onChange={(f, v) => setFields((x) => ({ ...x, [f]: v }))}
        disabled={state === "conflict"}
        autoFocusFirst
      />

      {canSign && (
        <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className={cn("text-xs", problem ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {signError ?? (problem ? `Tasdiqlash uchun: ${problem.toLowerCase()}` : "Tasdiqlashga tayyor. Tasdiqlangan yozuv faqat sabab ko'rsatilgan tuzatish bilan o'zgaradi.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => sign(false)} disabled={Boolean(problem) || signing || state === "conflict"} data-testid="button-sign-record">
              {signing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
              Tasdiqlash
            </Button>
            {appointment.status === "in_progress" && (
              <Button
                onClick={() => sign(true)}
                disabled={Boolean(problem) || signing || state === "conflict"}
                className="bg-emerald-600 hover:bg-emerald-600/90"
                data-testid="button-sign-and-finish"
              >
                {signing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Tasdiqlash va qabulni yakunlash
              </Button>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/** The form's layout: one field per row, the two diagnoses side by side. */
const LAYOUT: RecordField[][] = [
  ["complaints"],
  ["anamnesis"],
  ["examination"],
  ["preliminaryDiagnosis", "finalDiagnosis"],
  ["recommendations"],
];

function FieldGrid({
  fields,
  onChange,
  disabled,
  autoFocusFirst,
  highlight = [],
}: {
  fields: Fields;
  onChange: (field: RecordField, value: string) => void;
  disabled?: boolean;
  autoFocusFirst?: boolean;
  /** Fields changed against the signed text — outlined while correcting. */
  highlight?: RecordField[];
}) {
  return (
    <div className="space-y-5">
      {LAYOUT.map((row) => (
        <div key={row.join()} className={cn(row.length > 1 && "grid gap-5 sm:grid-cols-2")}>
          {row.map((f) => (
            <div key={f} className={cn(highlight.includes(f) && "rounded-xl ring-2 ring-amber-500/30 ring-offset-2 ring-offset-background")}>
              <FieldBox
                field={f}
                value={fields[f]}
                onChange={(v) => onChange(f, v)}
                disabled={disabled}
                autoFocus={autoFocusFirst && f === "complaints"}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FieldBox({
  field,
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  field: RecordField;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const diagnosis = field === "preliminaryDiagnosis" || field === "finalDiagnosis";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`field-${field}`} className={cn(diagnosis && "text-primary")}>
          {RECORD_FIELD_LABELS[field]}
        </Label>
        {value.length > 3500 && <span className="text-[11px] text-muted-foreground tabular">{value.length}/4000</span>}
      </div>
      <Textarea
        id={`field-${field}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={ROWS[field]}
        maxLength={4000}
        placeholder={PLACEHOLDERS[field]}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn("resize-y leading-relaxed", diagnosis && "border-primary/25 bg-primary/[0.02] font-medium")}
        data-testid={`input-record-${field}`}
      />
    </div>
  );
}

function SaveIndicator({ state, savedAt, onRetry }: { state: SaveState; savedAt: string | null; onRetry: () => void }) {
  const base = "inline-flex items-center gap-1.5 text-xs";
  if (state === "saving" || state === "dirty") {
    return (
      <span className={cn(base, "text-muted-foreground")} data-testid="save-state">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saqlanmoqda…
      </span>
    );
  }
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className={cn(base, "text-destructive hover:underline")} data-testid="save-state">
        <CloudOff className="h-3.5 w-3.5" />
        Saqlanmadi — qayta urinish
      </button>
    );
  }
  if (state === "conflict") {
    return (
      <span className={cn(base, "text-amber-700 dark:text-amber-300")} data-testid="save-state">
        <AlertCircle className="h-3.5 w-3.5" />
        To'qnashuv
      </span>
    );
  }
  return (
    <span className={cn(base, "text-muted-foreground")} data-testid="save-state">
      <Cloud className="h-3.5 w-3.5" />
      {savedAt ? `Saqlandi ${formatTime(savedAt)}` : "Hali yozilmagan"}
    </span>
  );
}

/** Correcting a signed record (TZ §5.2): new text plus the reason; the old text is kept. */
function AmendForm({ record, examKey, onDone }: { record: MedicalRecordWithDetails; examKey: string; onDone: () => void }) {
  const { toast } = useToast();
  const [fields, setFields] = useState<Fields>(() => toFields(record));
  const [reason, setReason] = useState("");
  const changed = useMemo(() => changedFields(toFields(record), fields), [record, fields]);
  const problem = signProblem(fields);

  const amend = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/records/${record.id}/amend`, { ...fields, revision: record.revision, reason });
    },
    onSuccess: () => {
      invalidateApi(examKey, `/api/patients/${record.patientId}/medical`);
      toast({ title: `Tuzatish saqlandi — v${record.version + 1}`, description: "Oldingi versiya tarixda saqlandi" });
      onDone();
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  return (
    <SectionCard icon={PencilLine} title={`Tuzatish kiritish · v${record.version} → v${record.version + 1}`} description="Joriy matn o'zgartirilmasdan tarixga saqlanadi">
      <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        Tasdiqlangan tibbiy hujjat o'zgartirilmoqda. Tuzatish sizning nomingizdan qayta tasdiqlanadi va audit jurnaliga yoziladi.
      </div>
      <div className="space-y-5">
        <FieldGrid fields={fields} onChange={(f, v) => setFields((x) => ({ ...x, [f]: v }))} highlight={changed} />
        <div className="space-y-1.5">
          <Label htmlFor="amend-reason">Tuzatish sababi</Label>
          <Input
            id="amend-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: tahlil natijasi bo'yicha tashxis aniqlashtirildi"
            maxLength={300}
            data-testid="input-amend-reason"
          />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {changed.length === 0 ? "Hali o'zgarish yo'q" : problem ?? `O'zgargan: ${changed.map((f) => RECORD_FIELD_LABELS[f]).join(", ")}`}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Bekor qilish
          </Button>
          <Button
            onClick={() => amend.mutate()}
            disabled={changed.length === 0 || Boolean(problem) || reason.trim().length < 5 || amend.isPending}
            data-testid="button-save-amendment"
          >
            {amend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tuzatishni tasdiqlash
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

/** A signed record while the patient is still in: finishing is one click away. */
function FinishAppointment({ appointment, onFinished }: { appointment: ExaminationData["appointment"]; onFinished: () => void }) {
  const status = useAppointmentStatus();
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3">
      <p className="text-sm">Bemor hali qabulda.</p>
      <Button
        onClick={() => status.mutate({ appointment, status: "completed" }, { onSuccess: onFinished })}
        disabled={status.isPending}
        className="bg-emerald-600 hover:bg-emerald-600/90"
        data-testid="button-finish-appointment"
      >
        {status.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        Qabulni yakunlash
      </Button>
    </div>
  );
}

function PastExaminations({ records }: { records: MedicalRecordWithDetails[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <SectionCard icon={History} title="Avvalgi ko'riklar" description={records.length ? `${records.length} ta` : undefined} flush>
      {records.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">Avvalgi ko'rik yo'q</p>
      ) : (
        <div className="divide-y">
          {records.slice(0, 10).map((r) => (
            <div key={r.id} className="px-5 py-3">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full text-left">
                <p className="flex items-center justify-between gap-2 text-sm font-medium">
                  {formatDay(r.date)}
                  <RecordStatusBadge record={r} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.doctorName} · {r.specialty}
                </p>
                {open !== r.id && (r.finalDiagnosis || r.preliminaryDiagnosis) && (
                  <p className="mt-1 line-clamp-1 text-xs">{r.finalDiagnosis ?? r.preliminaryDiagnosis}</p>
                )}
              </button>
              {open === r.id && (
                <div className="mt-3">
                  <RecordReadView record={r} dense />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
