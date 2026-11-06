import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FilePenLine,
  ChevronRight,
  Clock,
  Hourglass,
  IdCard,
  Loader2,
  Megaphone,
  Stethoscope,
  Undo2,
  UserRoundX,
  Users,
} from "lucide-react";
import type { AppointmentWithDetails, DoctorCabinet, DoctorWithDetails, RecordStatus } from "@shared/schema";
import { nextInLine } from "@shared/appointment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AppointmentBadge,
  Avatar,
  EmptyState,
  PageHeader,
  PatientNumber,
  PhoneText,
  QueueTicket,
  SectionCard,
  StatCard,
  TableSkeleton,
} from "@/components/ui-kit";
import { useAppointmentStatus } from "@/components/appointment-actions";
import { RecordStatusBadge } from "@/components/medical-record";
import { ApiError, apiRequest, invalidateApi } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ageGender, dayKey, elapsed, formatDay, formatDayLong, formatTime, shiftDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "12 daq." since a timestamp, ticking with `now`. */
/**
 * Shifokor kabineti (TZ §5.1.1): today's list, the waiting room, the
 * patient in the chair, and appointments left open on earlier days.
 *
 * "Tugallanmagan tibbiy kartalar" will be the examination records once B3.3
 * lands; until then an appointment that was started and never finished is
 * what is unfinished.
 */
export default function Cabinet() {
  const { can, user } = useAuth();
  const canServe = can("appointments.serve");
  const canViewOthers = can("appointments.read");
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [viewDoctor, setViewDoctor] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const params = new URLSearchParams({ date });
  if (viewDoctor) params.set("doctorId", viewDoctor);
  const { data, isLoading, error } = useQuery<DoctorCabinet>({
    queryKey: [`/api/cabinet?${params.toString()}`],
    // Until real-time updates (B8.1) arrive, the waiting room refreshes itself —
    // and it is never shown from cache when coming back to it.
    refetchInterval: 15_000,
    refetchOnMount: "always",
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const { data: doctors = [] } = useQuery<DoctorWithDetails[]>({
    queryKey: ["/api/doctors?active=1"],
    enabled: canViewOthers,
  });

  const noProfile = error instanceof ApiError && error.status === 404;
  const isToday = date === today;
  // Status moves are the doctor's own; a manager viewing someone else's cabinet only looks.
  const isOwn = Boolean(data && data.doctor.userId === user?.id && canServe);
  const actionable = isOwn && isToday;

  const list = data?.appointments ?? [];
  const current = list.find((a) => a.status === "in_progress");
  const waiting = useMemo(
    () => list.filter((a) => a.status === "arrived").sort((a, b) => a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber),
    [list],
  );
  const booked = list.filter((a) => a.status === "scheduled");
  const done = list.filter((a) => a.status === "completed").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const missed = list.filter((a) => a.status === "no_show");
  const total = list.filter((a) => a.status !== "cancelled").length;
  const next = nextInLine(list);

  const status = useAppointmentStatus();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const recordStatus = data?.recordStatus ?? {};
  // Drafts of today's patient in the chair are worked on above; the rest are unfinished paperwork.
  const drafts = (data?.draftRecords ?? []).filter((r) => r.appointmentId !== current?.id);
  const callNext = useMutation({
    mutationFn: async () => (await (await apiRequest("POST", "/api/cabinet/call-next")).json()) as AppointmentWithDetails,
    onSuccess: (a) => {
      invalidateApi("/api/cabinet", "/api/appointments", "/api/reception");
      toast({ title: `Navbat №${a.queueNumber} — qabulga chaqirildi`, description: a.patientName });
      // The doctor called them in to examine them: open the examination window.
      navigate(`/cabinet/visit/${a.id}`);
    },
    onError: (err: Error) => {
      invalidateApi("/api/cabinet");
      toast({ variant: "destructive", title: "Chaqirilmadi", description: err.message });
    },
  });

  if (noProfile && !viewDoctor) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Shifokor" title="Kabinet" />
        <div className="card-premium">
          <EmptyState
            icon={Stethoscope}
            title="Shifokor profili biriktirilmagan"
            description={
              canViewOthers
                ? "Sizning hisobingizda shifokor profili yo'q. Boshqa shifokor kabinetini ko'rish uchun pastdan tanlang."
                : "Administrator Klinika → Shifokorlar bo'limida sizga shifokor profili va ish jadvalini ochishi kerak."
            }
            action={
              canViewOthers && doctors.length > 0 ? (
                <Select value={viewDoctor} onValueChange={setViewDoctor}>
                  <SelectTrigger className="w-72" data-testid="select-cabinet-doctor">
                    <SelectValue placeholder="Shifokorni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.fullName} — {d.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  const doctor = data?.doctor;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isOwn ? "Mening kabinetim" : "Shifokor kabineti"}
        title={doctor?.fullName ?? "Kabinet"}
        description={
          doctor
            ? [doctor.specialty, doctor.departmentName, doctor.room ? `${doctor.room}-xona` : null].filter(Boolean).join(" · ")
            : undefined
        }
        actions={
          canViewOthers && doctors.length > 0 ? (
            <Select value={viewDoctor || doctor?.id || ""} onValueChange={setViewDoctor}>
              <SelectTrigger className="w-64" data-testid="select-cabinet-doctor">
                <SelectValue placeholder="Shifokor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <div className="card-premium flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDay(date, -1))} aria-label="Oldingi kun">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-1">
            <p className="text-lg font-semibold leading-tight" data-testid="text-cabinet-date">
              {formatDayLong(date)}
            </p>
            <p className="text-xs text-muted-foreground">{isToday ? "Bugungi qabul" : formatDay(date)}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDay(date, 1))} aria-label="Keyingi kun">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
              Bugun
            </Button>
          )}
        </div>
        {actionable && (
          <Button
            size="lg"
            onClick={() => callNext.mutate()}
            disabled={!next || Boolean(current) || callNext.isPending}
            className="shadow-brand"
            data-testid="button-call-next"
            title={current ? "Avval joriy qabulni yakunlang" : !next ? "Kutayotgan bemor yo'q" : undefined}
          >
            {callNext.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
            Keyingi bemorni chaqirish
            {next && !current && <span className="ml-2 rounded bg-white/20 px-1.5 text-xs">№{next.queueNumber}</span>}
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={isToday ? "Bugungi qabul" : "Qabullar"} value={total} icon={CalendarClock} index={0} isLoading={isLoading} />
        <StatCard label="Kutmoqda" value={waiting.length} icon={Hourglass} tone="amber" index={1} isLoading={isLoading} />
        <StatCard label="Qabul qilindi" value={done.length} icon={CheckCircle2} tone="emerald" index={2} isLoading={isLoading} />
        <StatCard label="Kelmadi" value={missed.length} icon={UserRoundX} tone="rose" index={3} isLoading={isLoading} />
      </div>

      {data && data.unfinished.length > 0 && (
        <SectionCard
          icon={AlertTriangle}
          title="Tugallanmagan qabullar"
          description="Oldingi kunlarda boshlangan, lekin yakunlanmagan"
          flush
        >
          <div className="divide-y">
            {data.unfinished.map((a) => (
              <PatientRow key={a.id} a={a} now={now} showDate>
                {isOwn && (
                  <Button size="sm" variant="outline" onClick={() => status.mutate({ appointment: a, status: "completed" })} disabled={status.isPending}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Yakunlash
                  </Button>
                )}
              </PatientRow>
            ))}
          </div>
        </SectionCard>
      )}

      {isOwn && drafts.length > 0 && (
        <SectionCard
          icon={FilePenLine}
          title="Tugallanmagan tibbiy kartalar"
          description="Tasdiqlanmagan ko'rik yozuvlari"
          flush
          action={<Badge variant="secondary">{drafts.length}</Badge>}
        >
          <div className="divide-y" data-testid="list-draft-records">
            {drafts.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="w-24 shrink-0">
                  <p className="text-sm font-semibold tabular">{formatDay(r.date)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{r.startTime}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <PatientNumber value={r.patientNumber} size="sm" />
                    <span className="truncate">{r.patientName}</span>
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {r.complaints ?? "Hali hech narsa yozilmagan"}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/cabinet/visit/${r.appointmentId}`}>
                    <FilePenLine className="mr-1.5 h-4 w-4" />
                    Davom ettirish
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ------------------------------------------------ patient in the chair */}
      {current && (
        <div className="card-premium overflow-hidden border-sky-500/30" data-testid="card-current-patient">
          <div className="flex items-center gap-2 border-b bg-sky-500/[0.06] px-5 py-3 text-sm font-medium text-sky-800 dark:text-sky-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            Qabulda
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(current.startedAt)} dan beri · {elapsed(current.startedAt, now)}
            </span>
          </div>
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <QueueTicket number={current.queueNumber} className="h-12 min-w-[3.5rem] text-lg" />
              <Avatar name={current.patientName} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <PatientNumber value={current.patientNumber} size="sm" />
                  <span className="truncate" data-testid="text-current-patient">
                    {current.patientName}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                  <span>{ageGender(current.patientAge, current.patientGender)}</span>
                  <PhoneText value={current.patientPhone} asLink={false} />
                  <span>{current.serviceName ?? "Shifokor ko'rigi"}</span>
                </p>
                {current.reason && <p className="mt-1 text-sm">Murojaat sababi: {current.reason}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="shadow-brand" data-testid="button-open-examination">
                <Link href={`/cabinet/visit/${current.id}`}>
                  <FilePenLine className="mr-2 h-4 w-4" />
                  Ko'rik oynasi
                  {recordStatus[current.id] && (
                    <span className="ml-2 rounded bg-white/20 px-1.5 text-[11px]">
                      {recordStatus[current.id] === "signed" ? "tasdiqlangan" : "qoralama"}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/patients/${current.patientId}`}>
                  <IdCard className="mr-2 h-4 w-4" />
                  Bemor kartasi
                </Link>
              </Button>
              {isOwn && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => status.mutate({ appointment: current, status: "arrived" })}
                    disabled={status.isPending}
                    title="Masalan, avval tahlil topshirib kelishi uchun"
                    data-testid="button-return-to-queue"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Navbatga qaytarish
                  </Button>
                  <Button
                    onClick={() => status.mutate({ appointment: current, status: "completed" })}
                    disabled={status.isPending}
                    className="bg-emerald-600 hover:bg-emerald-600/90"
                    data-testid="button-complete-appointment"
                  >
                    {status.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Qabulni yakunlash
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card-premium">
          <TableSkeleton rows={4} />
        </div>
      ) : total === 0 && !current ? (
        <div className="card-premium">
          <EmptyState
            icon={CalendarClock}
            title={isToday ? "Bugun qabulga yozilganlar yo'q" : "Bu kuni qabul yo'q"}
            description="Registratura bemorni qabulingizga yozganda shu yerda paydo bo'ladi."
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            icon={BellRing}
            title="Kutayotganlar"
            description="Klinikaga kelgan, navbat kutmoqda"
            flush
            action={waiting.length ? <Badge variant="secondary">{waiting.length}</Badge> : undefined}
          >
            {waiting.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Hozircha hech kim kutmayapti</p>
            ) : (
              <div className="divide-y" data-testid="list-waiting">
                {waiting.map((a) => (
                  <PatientRow key={a.id} a={a} now={now} highlight={a.id === next?.id}>
                    {actionable && (
                      <Button
                        size="sm"
                        variant={a.id === next?.id ? "default" : "outline"}
                        disabled={Boolean(current) || status.isPending}
                        onClick={() => status.mutate({ appointment: a, status: "in_progress" })}
                        data-testid={`button-call-${a.id}`}
                      >
                        <Megaphone className="mr-1.5 h-4 w-4" />
                        Chaqirish
                      </Button>
                    )}
                  </PatientRow>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Users} title="Yozilganlar" description="Hali kelmagan" flush action={booked.length ? <Badge variant="secondary">{booked.length}</Badge> : undefined}>
            {booked.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Kelishi kutilayotgan bemor yo'q</p>
            ) : (
              <div className="divide-y">
                {booked.map((a) => (
                  <PatientRow key={a.id} a={a} now={now}>
                    {actionable && a.startTime <= new Date(now).toTimeString().slice(0, 5) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-600"
                        onClick={() => status.mutate({ appointment: a, status: "no_show" })}
                        disabled={status.isPending}
                        data-testid={`button-noshow-${a.id}`}
                      >
                        Kelmadi
                      </Button>
                    )}
                  </PatientRow>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={CheckCircle2}
            title="Qabul qilinganlar"
            flush
            className="xl:col-span-2"
            action={done.length ? <Badge variant="secondary">{done.length}</Badge> : undefined}
          >
            {done.length === 0 && missed.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Hali qabul yakunlanmagan</p>
            ) : (
              <div className="divide-y">
                {[...done, ...missed].map((a) => (
                  <PatientRow key={a.id} a={a} now={now} record={recordStatus[a.id]}>
                    {a.status === "completed" && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/cabinet/visit/${a.id}`} data-testid={`button-record-${a.id}`}>
                          <FilePenLine className="mr-1.5 h-4 w-4" />
                          {recordStatus[a.id] ? "Ko'rik yozuvi" : "Yozuv kiritish"}
                        </Link>
                      </Button>
                    )}
                  </PatientRow>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function PatientRow({
  a,
  now,
  children,
  highlight,
  showDate,
  record,
}: {
  a: AppointmentWithDetails;
  now: number;
  children?: React.ReactNode;
  highlight?: boolean;
  showDate?: boolean;
  /** The examination record's state, when one exists. */
  record?: RecordStatus;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 px-5 py-3", highlight && "bg-amber-500/[0.05]")} data-testid={`cabinet-row-${a.id}`}>
      <QueueTicket number={a.queueNumber} />
      <div className="w-14 shrink-0">
        <p className="font-mono text-sm font-semibold tabular">{a.startTime}</p>
        {showDate && <p className="text-[11px] text-muted-foreground">{formatDay(a.date)}</p>}
      </div>
      <Link href={`/patients/${a.patientId}`} className="group min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium group-hover:text-primary">
          <PatientNumber value={a.patientNumber} size="sm" />
          <span className="truncate">{a.patientName}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{ageGender(a.patientAge, a.patientGender)}</span>
          {a.reason && <span className="italic">«{a.reason}»</span>}
          {a.status === "arrived" && a.arrivedAt && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <Hourglass className="h-3 w-3" />
              {elapsed(a.arrivedAt, now)} kutmoqda
            </span>
          )}
          {a.status === "completed" && a.completedAt && <span>yakunlandi {formatTime(a.completedAt)}</span>}
        </p>
      </Link>
      <div className="flex items-center gap-2">
        {a.status !== "arrived" && a.status !== "scheduled" && <AppointmentBadge status={a.status} />}
        {record && <RecordStatusBadge record={{ status: record, version: 1 }} />}
        {children}
      </div>
    </div>
  );
}
