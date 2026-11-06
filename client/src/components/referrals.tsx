/**
 * Yo'llanma (TZ §5.1.4, B3.5): the doctor sends the patient on — to the lab,
 * to an examination (UZI and others), or to a specialist — and the desk books
 * what needs booking. One row and one badge everywhere a referral appears:
 * the examination window, the patient card, the medical card and the desk.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Ban,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FlaskConical,
  Loader2,
  ScanLine,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  REFERRAL_EXAM_SERVICE_KINDS,
  REFERRAL_KIND_LABELS,
  REFERRAL_STAGE_LABELS,
  SERVICE_KIND_LABELS,
  type AppointmentWithDetails,
  type DoctorWithDetails,
  type ReferralKind,
  type ReferralStage,
  type ReferralWithDetails,
  type ServiceWithDetails,
  type Test,
} from "@shared/schema";
import { isOpenStage, referralSubject } from "@shared/referral";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  Money,
  PatientNumber,
  SectionCard,
} from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatDay, money } from "@/lib/format";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ visuals

const KIND_ICONS: Record<
  ReferralKind,
  React.ComponentType<{ className?: string }>
> = {
  lab: FlaskConical,
  exam: ScanLine,
  consult: UserRound,
};

const KIND_TILES: Record<ReferralKind, string> = {
  lab: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  exam: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  consult: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const STAGE_STYLES: Record<ReferralStage, string> = {
  awaiting_booking:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  scheduled: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_lab:
    "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  done: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-border bg-muted text-muted-foreground",
};

const STAGE_ICONS: Record<
  ReferralStage,
  React.ComponentType<{ className?: string }>
> = {
  awaiting_booking: CalendarClock,
  scheduled: CalendarCheck2,
  in_lab: FlaskConical,
  done: CheckCircle2,
  cancelled: XCircle,
};

export function ReferralStageBadge({
  stage,
  className,
}: {
  stage: ReferralStage;
  className?: string;
}) {
  const Icon = STAGE_ICONS[stage];
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 whitespace-nowrap font-medium",
        STAGE_STYLES[stage],
        className,
      )}
      data-testid={`badge-referral-${stage}`}
    >
      <Icon className="h-3 w-3" />
      {REFERRAL_STAGE_LABELS[stage]}
    </Badge>
  );
}

/** "To'lanmagan" / "Qisman" / "To'langan" for the lab order behind a referral. */
function paidLabel(o: NonNullable<ReferralWithDetails["order"]>) {
  if (o.paidAmount >= o.totalAmount)
    return {
      text: "to'langan",
      tone: "text-emerald-700 dark:text-emerald-400",
    };
  if (o.paidAmount > 0)
    return {
      text: `qisman to'langan, qoldiq ${money(o.totalAmount - o.paidAmount)}`,
      tone: "text-amber-700 dark:text-amber-300",
    };
  return {
    text: `to'lanmagan, ${money(o.totalAmount)}`,
    tone: "text-rose-600 dark:text-rose-400",
  };
}

/** One referral, as every list shows it. Actions go in `children`. */
export function ReferralRow({
  r,
  showPatient,
  showIssuer = true,
  children,
}: {
  r: ReferralWithDetails;
  showPatient?: boolean;
  showIssuer?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = KIND_ICONS[r.kind];
  const cancelled = r.stage === "cancelled";
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 px-5 py-3.5",
        cancelled && "opacity-70",
      )}
      data-testid={`referral-row-${r.id}`}
    >
      <div
        className={cn("icon-tile mt-0.5 h-9 w-9 shrink-0", KIND_TILES[r.kind])}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-mono text-xs font-semibold text-muted-foreground">
            №{r.referralNumber}
          </span>
          {showPatient && (
            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
              <PatientNumber value={r.patientNumber} size="sm" />
              <span className="truncate">{r.patientName}</span>
              <span className="text-muted-foreground/60">·</span>
            </span>
          )}
          <span
            className={cn(
              "font-semibold",
              cancelled && "line-through decoration-1",
            )}
          >
            {referralSubject(r)}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {REFERRAL_KIND_LABELS[r.kind]}
          {r.kind === "exam" && r.serviceKind
            ? ` · ${SERVICE_KIND_LABELS[r.serviceKind]}`
            : ""}
          {" · "}
          <span className="tabular">{formatDateTime(r.createdAt)}</span>
          {showIssuer && ` · ${r.doctorName} (${r.specialty})`}
        </p>

        {r.order && !cancelled && (
          <p className="mt-1 text-xs">
            Tahlil buyurtmasi{" "}
            <span className="font-semibold tabular">
              #{r.order.orderNumber}
            </span>
            {" · "}
            {r.order.verified}/{r.order.tests} tasdiqlangan
            {" · "}
            <span className={paidLabel(r.order).tone}>
              {paidLabel(r.order).text}
            </span>
          </p>
        )}
        {r.order && !cancelled && r.order.results.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`referral-results-${r.id}`}>
            {r.order.results.map((x) => (
              <span
                key={x.testName}
                className={cn(
                  "inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-xs",
                  x.flag === "high" && "border-rose-500/30 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300",
                  x.flag === "low" && "border-sky-500/30 bg-sky-500/[0.06] text-sky-700 dark:text-sky-300",
                )}
                title={x.referenceRange ? `Me'yor: ${x.referenceRange}` : undefined}
              >
                <span className="text-muted-foreground">{x.testName}</span>
                <span className="font-semibold tabular">{x.result}</span>
                {x.unit && <span className="text-[10px] text-muted-foreground">{x.unit}</span>}
                {x.flag === "high" ? "↑" : x.flag === "low" ? "↓" : null}
              </span>
            ))}
            {r.order.verified < r.order.tests && (
              <span className="text-[11px] italic text-muted-foreground">yana {r.order.tests - r.order.verified} tasi tasdiqlanmagan</span>
            )}
          </div>
        )}
        {r.booking && (
          <p className="mt-1 text-xs">
            <span className="font-medium">
              {formatDay(r.booking.date)}, {r.booking.startTime}
            </span>
            {" · "}
            {r.booking.doctorName} · navbat №{r.booking.queueNumber}
          </p>
        )}
        {r.note && (
          <p className="mt-1 text-xs italic text-foreground/80">«{r.note}»</p>
        )}
        {cancelled && r.cancelReason && (
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
            Bekor qilindi{r.cancelledByName ? ` (${r.cancelledByName})` : ""}:{" "}
            {r.cancelReason}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ReferralStageBadge stage={r.stage} />
        {children}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- cancelling

export function CancelReferralDialog({
  referral,
  onOpenChange,
}: {
  referral: ReferralWithDetails | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onOpenChange(false);
  };
  const cancel = useMutation({
    mutationFn: async (v: { id: string; reason: string }) =>
      (await (
        await apiRequest("POST", `/api/referrals/${v.id}/cancel`, {
          reason: v.reason,
        })
      ).json()) as ReferralWithDetails,
    onSuccess: (r) => {
      invalidateReferrals(r.patientId);
      toast({
        title: `Yo'llanma №${r.referralNumber} bekor qilindi`,
        description: r.order
          ? `Tahlil buyurtmasi #${r.order.orderNumber} ham bekor qilindi`
          : undefined,
      });
      close();
    },
    onError: (err: Error) => {
      if (referral) invalidateReferrals(referral.patientId);
      toast({
        variant: "destructive",
        title: "Bekor qilinmadi",
        description: err.message,
      });
    },
  });

  return (
    <Dialog open={Boolean(referral)} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yo'llanmani bekor qilish</DialogTitle>
          <DialogDescription>
            {referral &&
              `№${referral.referralNumber} · ${referralSubject(referral)}. `}
            Yo'llanma o'chirilmaydi, tarixda "bekor qilingan" bo'lib qoladi.
            {referral?.kind === "lab" &&
              " To'lanmagan va natijasi yo'q tahlil buyurtmasi ham bekor qilinadi."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="referral-cancel-reason">Sabab</Label>
          <Textarea
            id="referral-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: bemor boshqa klinikada tekshiruvdan o'tadi"
            autoFocus
            maxLength={300}
            data-testid="input-referral-cancel-reason"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Ortga
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || cancel.isPending}
            onClick={() =>
              referral &&
              cancel.mutate({ id: referral.id, reason: reason.trim() })
            }
            data-testid="button-confirm-cancel-referral"
          >
            {cancel.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Bekor qilish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Everything a referral change can move: the window, the card, the desk, the lab. */
function invalidateReferrals(patientId: string) {
  invalidateApi(
    "/api/appointments",
    "/api/referrals",
    "/api/reception",
    "/api/orders",
    "/api/stats",
    `/api/patients/${patientId}/medical`,
    `/api/patients/${patientId}/card`,
  );
}

// ---------------------------------------------------------------- issuing

/**
 * The doctor's referral form. One tab per kind (TZ §5.1.4): lab tests from the
 * lab catalogue, examinations from the service catalogue, a specialist by
 * specialty and optionally by name.
 */
export function ReferralDialog({
  appointment,
  kind,
  onOpenChange,
}: {
  appointment: Pick<
    AppointmentWithDetails,
    "id" | "patientId" | "patientName" | "patientNumber" | "doctorId"
  >;
  /** Null = closed; otherwise the tab it opens on. */
  kind: ReferralKind | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(kind)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl">
        {kind && (
          <ReferralForm
            key={kind}
            appointment={appointment}
            initialKind={kind}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReferralForm({
  appointment,
  initialKind,
  onDone,
}: {
  appointment: Pick<
    AppointmentWithDetails,
    "id" | "patientId" | "patientName" | "patientNumber" | "doctorId"
  >;
  initialKind: ReferralKind;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [kind, setKind] = useState<ReferralKind>(initialKind);
  const [search, setSearch] = useState("");
  const [testIds, setTestIds] = useState<Set<string>>(new Set());
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());
  const [specialty, setSpecialty] = useState("");
  const [targetDoctorId, setTargetDoctorId] = useState("any");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: services = [] } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services?active=1"],
  });
  const { data: doctors = [] } = useQuery<DoctorWithDetails[]>({
    queryKey: ["/api/doctors?active=1"],
  });

  const q = search.trim().toLowerCase();
  const testGroups = useMemo(() => {
    const groups = new Map<string, Test[]>();
    for (const t of tests) {
      if (!t.isActive) continue;
      if (
        q &&
        !t.name.toLowerCase().includes(q) &&
        !t.category.toLowerCase().includes(q)
      )
        continue;
      const list = groups.get(t.category) ?? [];
      list.push(t);
      groups.set(t.category, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tests, q]);
  const exams = useMemo(
    () =>
      services
        .filter((s) =>
          (REFERRAL_EXAM_SERVICE_KINDS as readonly string[]).includes(s.kind),
        )
        .filter((s) => !q || s.name.toLowerCase().includes(q))
        .sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
        ),
    [services, q],
  );
  const specialties = useMemo(
    () =>
      Array.from(
        new Set(
          doctors
            .filter((d) => d.id !== appointment.doctorId)
            .map((d) => d.specialty),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [doctors, appointment.doctorId],
  );
  const specialists = doctors.filter(
    (d) => d.specialty === specialty && d.id !== appointment.doctorId,
  );

  const chosenTests = tests.filter((t) => testIds.has(t.id));
  const chosenExams = services.filter((s) => serviceIds.has(s.id));
  const total =
    kind === "lab"
      ? chosenTests.reduce((s, t) => s + t.price, 0)
      : kind === "exam"
        ? chosenExams.reduce((s, x) => s + x.price, 0)
        : 0;
  const ready =
    kind === "lab"
      ? testIds.size > 0
      : kind === "exam"
        ? serviceIds.size > 0
        : Boolean(specialty) && note.trim().length >= 3;

  const toggle = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setError(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body =
        kind === "lab"
          ? { kind, testIds: [...testIds], note: note.trim() || null }
          : kind === "exam"
            ? { kind, serviceIds: [...serviceIds], note: note.trim() || null }
            : {
                kind,
                targetSpecialty: specialty,
                targetDoctorId:
                  targetDoctorId === "any" ? null : targetDoctorId,
                note: note.trim(),
              };
      const res = await apiRequest(
        "POST",
        `/api/appointments/${appointment.id}/referrals`,
        body,
      );
      return (await res.json()) as ReferralWithDetails[];
    },
    onSuccess: (made) => {
      invalidateReferrals(appointment.patientId);
      invalidateApi(`/api/appointments/${appointment.id}/examination`);
      const first = made[0];
      toast({
        title:
          made.length > 1
            ? `${made.length} ta yo'llanma berildi`
            : `Yo'llanma №${first.referralNumber} berildi`,
        description: first.order
          ? `Tahlil buyurtmasi #${first.order.orderNumber} laboratoriyaga tushdi. To'lov registraturada.`
          : "Registratura bemorni navbatga yozadi.",
      });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <>
      <DialogHeader className="border-b px-6 py-5">
        <DialogTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Yo'llanma berish
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-1.5">
          <PatientNumber value={appointment.patientNumber} size="sm" />
          <span className="font-medium text-foreground">
            {appointment.patientName}
          </span>
        </DialogDescription>
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setKind(v as ReferralKind);
            setSearch("");
            setError(null);
          }}
          className="pt-3"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lab" data-testid="tab-referral-lab">
              <FlaskConical className="mr-1.5 h-4 w-4" />
              Tahlil
            </TabsTrigger>
            <TabsTrigger value="exam" data-testid="tab-referral-exam">
              <ScanLine className="mr-1.5 h-4 w-4" />
              Tekshiruv
            </TabsTrigger>
            <TabsTrigger value="consult" data-testid="tab-referral-consult">
              <UserRound className="mr-1.5 h-4 w-4" />
              Konsultatsiya
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {kind !== "consult" && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              kind === "lab" ? "Tahlil yoki guruh nomi..." : "Tekshiruv nomi..."
            }
            data-testid="input-referral-search"
          />
        )}

        {kind === "lab" && (
          <div
            className="max-h-[42vh] space-y-4 overflow-y-auto rounded-xl border p-3"
            data-testid="list-referral-tests"
          >
            {testGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tahlil topilmadi
              </p>
            ) : (
              testGroups.map(([category, list]) => (
                <div key={category}>
                  <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {list.map((t) => (
                      <PickRow
                        key={t.id}
                        checked={testIds.has(t.id)}
                        onToggle={() => toggle(testIds, setTestIds, t.id)}
                        label={t.name}
                        price={t.price}
                        testId={`pick-test-${t.id}`}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {kind === "exam" && (
          <div
            className="max-h-[42vh] overflow-y-auto rounded-xl border p-3"
            data-testid="list-referral-exams"
          >
            {exams.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Katalogda UZI yoki boshqa tekshiruv yo'q. Klinika → Xizmatlar
                bo'limida qo'shiladi.
              </p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {exams.map((s) => (
                  <PickRow
                    key={s.id}
                    checked={serviceIds.has(s.id)}
                    onToggle={() => toggle(serviceIds, setServiceIds, s.id)}
                    label={s.name}
                    hint={`${SERVICE_KIND_LABELS[s.kind]}${s.departmentName ? ` · ${s.departmentName}` : ""}`}
                    price={s.price}
                    testId={`pick-service-${s.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {kind === "consult" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mutaxassislik</Label>
              <Select
                value={specialty}
                onValueChange={(v) => {
                  setSpecialty(v);
                  setTargetDoctorId("any");
                  setError(null);
                }}
              >
                <SelectTrigger data-testid="select-referral-specialty">
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {specialties.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Klinikada boshqa mutaxassis yo'q.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Shifokor{" "}
                <span className="font-normal text-muted-foreground">
                  (ixtiyoriy)
                </span>
              </Label>
              <Select
                value={targetDoctorId}
                onValueChange={setTargetDoctorId}
                disabled={!specialty}
              >
                <SelectTrigger data-testid="select-referral-doctor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">
                    Istalgan{" "}
                    {specialty ? specialty.toLowerCase() : "mutaxassis"}
                  </SelectItem>
                  {specialists.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName}
                      {d.room ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {d.room}-xona
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="referral-note">
            {kind === "consult" ? "Konsultatsiya sababi" : "Ko'rsatma"}{" "}
            {kind !== "consult" && (
              <span className="font-normal text-muted-foreground">
                (ixtiyoriy)
              </span>
            )}
          </Label>
          <Textarea
            id="referral-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={
              kind === "consult"
                ? "Masalan: EKGda o'zgarishlar, kardiolog xulosasi kerak"
                : "Masalan: tashxisni aniqlashtirish uchun, och qoringa"
            }
            data-testid="input-referral-note"
          />
        </div>

        {error && (
          <p
            className="rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive"
            data-testid="text-referral-error"
          >
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {kind === "lab" &&
            (testIds.size ? (
              <>
                {testIds.size} ta tahlil ·{" "}
                <Money
                  value={total}
                  className="font-semibold text-foreground"
                />
              </>
            ) : (
              "Tahlillarni belgilang"
            ))}
          {kind === "exam" &&
            (serviceIds.size ? (
              <>
                {serviceIds.size} ta tekshiruv ·{" "}
                <Money
                  value={total}
                  className="font-semibold text-foreground"
                />
              </>
            ) : (
              "Tekshiruvlarni belgilang"
            ))}
          {kind === "consult" &&
            "Registratura bemorni mutaxassis qabuliga yozadi"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Bekor qilish
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!ready || save.isPending}
            className="shadow-brand"
            data-testid="button-referral-save"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Yo'llanma berish
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function PickRow({
  checked,
  onToggle,
  label,
  hint,
  price,
  testId,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  price: number;
  testId: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
        checked
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-transparent hover:bg-muted/60",
      )}
      data-testid={testId}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {hint && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs tabular text-muted-foreground">
        {money(price, false)}
      </span>
    </label>
  );
}

// ------------------------------------------------------------- the panels

/** The examination window's referrals: issue, follow, cancel (TZ §5.1.4). */
export function ExaminationReferrals({
  appointment,
  referrals,
  canRefer,
}: {
  appointment: AppointmentWithDetails;
  referrals: ReferralWithDetails[];
  canRefer: boolean;
}) {
  const [issuing, setIssuing] = useState<ReferralKind | null>(null);
  const [cancelling, setCancelling] = useState<ReferralWithDetails | null>(
    null,
  );

  return (
    <SectionCard
      icon={Send}
      title="Yo'llanmalar"
      description={
        referrals.length
          ? `Shu qabulda ${referrals.length} ta`
          : "Tahlil, tekshiruv, konsultatsiya"
      }
      flush
    >
      {/* Below the header rather than in it: on a phone three buttons would squeeze the title out. */}
      {canRefer && (
        <div className="flex flex-wrap gap-2 border-b bg-muted/20 px-5 py-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIssuing("lab")}
            data-testid="button-refer-lab"
          >
            <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
            Tahlil
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIssuing("exam")}
            data-testid="button-refer-exam"
          >
            <ScanLine className="mr-1.5 h-3.5 w-3.5" />
            Tekshiruv
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIssuing("consult")}
            data-testid="button-refer-consult"
          >
            <UserRound className="mr-1.5 h-3.5 w-3.5" />
            Konsultatsiya
          </Button>
        </div>
      )}
      {referrals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          {canRefer
            ? "Hali yo'llanma berilmagan. Laboratoriya buyurtmasi darhol laboratoriyaga tushadi, tekshiruv va konsultatsiyaga registratura yozadi."
            : "Bu qabulda yo'llanma berilmagan."}
        </p>
      ) : (
        <div className="divide-y">
          {referrals.map((r) => (
            <ReferralRow key={r.id} r={r} showIssuer={false}>
              {/* A booked referral is released by cancelling its booking first (the desk's job). */}
              {canRefer && isOpenStage(r.stage) && r.stage !== "scheduled" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setCancelling(r)}
                  aria-label="Yo'llanmani bekor qilish"
                  title="Bekor qilish"
                  data-testid={`button-cancel-referral-${r.id}`}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
            </ReferralRow>
          ))}
        </div>
      )}
      <ReferralDialog
        appointment={appointment}
        kind={issuing}
        onOpenChange={(o) => !o && setIssuing(null)}
      />
      <CancelReferralDialog
        referral={cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
      />
    </SectionCard>
  );
}

/**
 * A list of referrals with the desk's actions: book what is waiting, cancel
 * what the patient will not use. Used by the patient card, the medical card
 * and the registratura board.
 */
export function ReferralList({
  referrals,
  showPatient,
  emptyText = "Yo'llanma yo'q",
  limit,
}: {
  referrals: ReferralWithDetails[];
  showPatient?: boolean;
  emptyText?: string;
  limit?: number;
}) {
  const { can } = useAuth();
  const [booking, setBooking] = useState<ReferralWithDetails | null>(null);
  const [cancelling, setCancelling] = useState<ReferralWithDetails | null>(
    null,
  );
  const shown = limit ? referrals.slice(0, limit) : referrals;

  if (referrals.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title={emptyText}
        description="Shifokor qabulda bergan yo'llanmalar shu yerda ko'rinadi."
      />
    );
  }
  return (
    <>
      <div className="divide-y">
        {shown.map((r) => (
          <ReferralRow key={r.id} r={r} showPatient={showPatient}>
            {r.stage === "awaiting_booking" && can("appointments.manage") && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setBooking(r)}
                data-testid={`button-book-referral-${r.id}`}
              >
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                Navbatga yozish
              </Button>
            )}
            {isOpenStage(r.stage) &&
              r.stage !== "scheduled" &&
              can("referrals.manage") && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setCancelling(r)}
                  aria-label="Yo'llanmani bekor qilish"
                  title="Bekor qilish"
                  data-testid={`button-desk-cancel-referral-${r.id}`}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
          </ReferralRow>
        ))}
      </div>
      <AppointmentDialog
        open={Boolean(booking)}
        onOpenChange={(o) => !o && setBooking(null)}
        referral={booking}
        onSaved={() => booking && invalidateReferrals(booking.patientId)}
      />
      <CancelReferralDialog
        referral={cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
      />
    </>
  );
}

/** The patient card's referrals (desk view), loaded on their own. */
export function PatientReferrals({ patientId }: { patientId: string }) {
  const { data = [], isLoading } = useQuery<ReferralWithDetails[]>({
    queryKey: [`/api/referrals?patientId=${patientId}`],
    refetchOnMount: "always",
  });
  const open = data.filter((r) => isOpenStage(r.stage)).length;
  return (
    <SectionCard
      icon={Send}
      title="Yo'llanmalar"
      description={
        isLoading
          ? undefined
          : open
            ? `${open} tasi bajarilmagan`
            : `${data.length} ta`
      }
      flush
    >
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Yuklanmoqda…</p>
      ) : (
        <ReferralList referrals={data} />
      )}
    </SectionCard>
  );
}
