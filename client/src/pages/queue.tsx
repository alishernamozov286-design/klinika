import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Hourglass,
  IdCard,
  MoreVertical,
  MoveRight,
  Plus,
  Stethoscope,
  Undo2,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type AppointmentWithDetails,
  type DoctorWithDetails,
} from "@shared/schema";
import { weekdayOf } from "@shared/appointment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AppointmentBadge,
  EmptyState,
  Money,
  PageHeader,
  PatientNumber,
  PhoneText,
  QueueTicket,
  StatCard,
  TableSkeleton,
} from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { CancelAppointmentDialog, useAppointmentStatus } from "@/components/appointment-actions";
import type { ExportColumn } from "@/lib/export-types";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, dayKey, formatDay, formatDayLong, formatTime, shiftDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const EXPORT_COLUMNS: ExportColumn<AppointmentWithDetails>[] = [
  { header: "Navbat", value: (a) => a.queueNumber, type: "number", width: 8 },
  { header: "Vaqt", value: (a) => a.startTime, width: 8 },
  { header: "Bemor", value: (a) => `№${a.patientNumber} ${a.patientName}`, width: 30 },
  { header: "Telefon", value: (a) => a.patientPhone, width: 18 },
  { header: "Shifokor", value: (a) => a.doctorName, width: 26 },
  { header: "Xizmat", value: (a) => a.serviceName ?? "Shifokor ko'rigi", width: 24 },
  { header: "Narx", value: (a) => a.price, type: "money", width: 14 },
  { header: "Holat", value: (a) => APPOINTMENT_STATUS_LABELS[a.status], width: 14 },
];

type StatusFilter = "active" | "all" | AppointmentStatus;

/**
 * Navbat (TZ §4.1.4): the day's appointments across all doctors — book,
 * check patients in as they arrive, move or cancel bookings. The doctor's
 * side of the same list is the cabinet (/cabinet).
 */
export default function Queue() {
  const { can } = useAuth();
  const canManage = can("appointments.manage");
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(false);
  const [moving, setMoving] = useState<AppointmentWithDetails | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentWithDetails | null>(null);
  const status = useAppointmentStatus();

  const { data: list = [], isLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: [`/api/appointments?date=${date}`],
    // The desk works from this screen all day; arrivals and calls change it.
    refetchInterval: 20_000,
    refetchOnMount: "always",
  });
  const { data: doctors = [] } = useQuery<DoctorWithDetails[]>({ queryKey: ["/api/doctors?active=1"] });

  // Doctors on duty that day, plus anyone who already has bookings on it.
  const dayDoctors = useMemo(() => {
    const wd = weekdayOf(date);
    const ids = new Set(list.map((a) => a.doctorId));
    const onDuty = doctors.filter((d) => d.schedule.some((s) => s.day === wd) || ids.has(d.id));
    const extra = [...ids].filter((id) => !onDuty.some((d) => d.id === id));
    return [
      ...onDuty.map((d) => ({ id: d.id, name: d.fullName, specialty: d.specialty })),
      ...extra.map((id) => {
        const a = list.find((x) => x.doctorId === id)!;
        return { id, name: a.doctorName, specialty: a.specialty };
      }),
    ];
  }, [doctors, list, date]);

  const live = list.filter((a) => a.status !== "cancelled");
  const count = (s: AppointmentStatus) => list.filter((a) => a.status === s).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(
      (a) =>
        (doctorFilter === "all" || a.doctorId === doctorFilter) &&
        (statusFilter === "all" ||
          (statusFilter === "active" ? a.status !== "cancelled" && a.status !== "no_show" : a.status === statusFilter)) &&
        (!q ||
          a.patientName.toLowerCase().includes(q) ||
          String(a.patientNumber) === q.replace(/^№|#/, "") ||
          a.patientPhone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~")),
    );
  }, [list, doctorFilter, statusFilter, search]);

  const isToday = date === today;
  const isPast = date < today;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Registratura"
        title="Navbat"
        description="Shifokorlar qabuliga yozish, kelganlarni belgilash va kunlik navbat"
        actions={
          canManage && (
            <Button onClick={() => setBooking(true)} className="shadow-brand" data-testid="button-new-appointment">
              <Plus className="mr-2 h-4 w-4" />
              Qabulga yozish
            </Button>
          )
        }
      />

      {/* -------------------------------------------------------- the day */}
      <div className="card-premium flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDay(date, -1))} aria-label="Oldingi kun" data-testid="button-queue-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 px-1">
            <p className="flex items-center gap-2 text-lg font-semibold leading-tight" data-testid="text-queue-date">
              <CalendarDays className="h-4 w-4 text-primary" />
              {formatDayLong(date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isToday ? "Bugun" : isPast ? "O'tgan kun" : `${formatDay(date)} — oldindan yozilganlar`}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDay(date, 1))} aria-label="Keyingi kun" data-testid="button-queue-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(today)} data-testid="button-queue-today">
              Bugun
            </Button>
          )}
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-full md:w-44"
          data-testid="input-queue-date"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Jami qabul" value={live.length} icon={CalendarCheck2} index={0} isLoading={isLoading} />
        <StatCard label="Kutmoqda" value={count("arrived")} icon={Hourglass} tone="amber" index={1} isLoading={isLoading} onClick={() => setStatusFilter("arrived")} />
        <StatCard label="Qabulda" value={count("in_progress")} icon={Stethoscope} tone="primary" index={2} isLoading={isLoading} onClick={() => setStatusFilter("in_progress")} />
        <StatCard label="Yakunlandi" value={count("completed")} icon={CheckCircle2} tone="emerald" index={3} isLoading={isLoading} onClick={() => setStatusFilter("completed")} />
        <StatCard
          label="Kelmadi / bekor"
          value={count("no_show") + count("cancelled")}
          icon={UserX}
          tone="rose"
          index={4}
          isLoading={isLoading}
          onClick={() => setStatusFilter("all")}
        />
      </div>

      {/* ------------------------------------------------- doctors on duty */}
      {dayDoctors.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="queue-doctor-chips">
          <DoctorChip active={doctorFilter === "all"} onClick={() => setDoctorFilter("all")} name="Barcha shifokorlar" count={live.length} />
          {dayDoctors.map((d) => {
            const mine = live.filter((a) => a.doctorId === d.id);
            return (
              <DoctorChip
                key={d.id}
                active={doctorFilter === d.id}
                onClick={() => setDoctorFilter(d.id)}
                name={d.name}
                sub={d.specialty}
                count={mine.length}
                waiting={mine.filter((a) => a.status === "arrived").length}
              />
            );
          })}
        </div>
      )}

      <div className="card-premium flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Bemor ismi, raqami yoki telefoni" className="sm:max-w-xs" data-testid="input-queue-search" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="sm:w-52" data-testid="select-queue-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Faol (bekorlarsiz)</SelectItem>
              <SelectItem value="all">Hammasi</SelectItem>
              {APPOINTMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]} ({count(s)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          testIdPrefix="export-queue"
          disabled={isLoading}
          build={() => ({
            filename: `navbat-${date}`,
            title: "Qabullar navbati",
            subtitle: `${formatDayLong(date)} · ${visible.length} ta qabul`,
            sheetName: "Navbat",
            orientation: "landscape",
            columns: EXPORT_COLUMNS,
            rows: visible,
          })}
        />
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={isPast ? "Bu kuni qabul bo'lmagan" : "Bu kunga hali hech kim yozilmagan"}
            description={
              doctors.length === 0
                ? "Avval Klinika → Shifokorlar bo'limida shifokor profili va ish jadvalini kiriting."
                : "Bemorni shifokor qabuliga yozing — navbat raqami avtomatik beriladi."
            }
            action={
              canManage && !isPast ? (
                <Button onClick={() => setBooking(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Qabulga yozish
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Navbat</TableHead>
                  <TableHead className="w-20">Vaqt</TableHead>
                  <TableHead>Bemor</TableHead>
                  <TableHead className="hidden md:table-cell">Shifokor</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Xizmat</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-[150px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Filtrga mos qabul yo'q
                    </TableCell>
                  </TableRow>
                )}
                {visible.map((a) => (
                  <TableRow
                    key={a.id}
                    className={cn(
                      (a.status === "cancelled" || a.status === "no_show") && "opacity-60",
                      a.status === "in_progress" && "bg-sky-500/[0.04]",
                    )}
                    data-testid={`row-appointment-${a.id}`}
                  >
                    <TableCell>
                      <QueueTicket number={a.queueNumber} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold tabular">{a.startTime}</span>
                      {a.arrivedAt && (
                        <p className="text-[11px] text-muted-foreground" title="Kelgan vaqti">
                          keldi {formatTime(a.arrivedAt)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/patients/${a.patientId}`} className="group block min-w-0">
                        <p className="flex items-center gap-2 font-medium group-hover:text-primary">
                          <PatientNumber value={a.patientNumber} size="sm" />
                          <span className="truncate">{a.patientName}</span>
                        </p>
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <PhoneText value={a.patientPhone} asLink={false} />
                        <span>{ageGender(a.patientAge, a.patientGender)}</span>
                      </p>
                      {a.reason && <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">«{a.reason}»</p>}
                      {a.cancelReason && <p className="mt-0.5 line-clamp-1 text-xs text-rose-600 dark:text-rose-400">Sabab: {a.cancelReason}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm font-medium">{a.doctorName}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {a.specialty}
                        {a.room && (
                          <span className="inline-flex items-center gap-0.5">
                            · <DoorOpen className="h-3 w-3" />
                            {a.room}
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      <p className="text-sm">{a.serviceName ?? "Shifokor ko'rigi"}</p>
                      <Money value={a.price} className="text-xs text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <AppointmentBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && a.status === "scheduled" && isToday && (
                          <Button
                            size="sm"
                            onClick={() => status.mutate({ appointment: a, status: "arrived" })}
                            disabled={status.isPending}
                            data-testid={`button-arrived-${a.id}`}
                          >
                            <UserCheck className="mr-1.5 h-4 w-4" />
                            Keldi
                          </Button>
                        )}
                        {canManage && a.status === "no_show" && isToday && (
                          <Button size="sm" variant="outline" onClick={() => status.mutate({ appointment: a, status: "arrived" })} disabled={status.isPending}>
                            <UserCheck className="mr-1.5 h-4 w-4" />
                            Keldi
                          </Button>
                        )}
                        <RowMenu
                          appointment={a}
                          canManage={canManage}
                          onMove={() => setMoving(a)}
                          onCancel={() => setCancelling(a)}
                          onStatus={(s) => status.mutate({ appointment: a, status: s })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AppointmentDialog
        open={booking}
        onOpenChange={setBooking}
        defaultDate={date}
        defaultDoctorId={doctorFilter === "all" ? null : doctorFilter}
        onSaved={(a) => setDate(a.date)}
      />
      <AppointmentDialog open={Boolean(moving)} onOpenChange={(o) => !o && setMoving(null)} appointment={moving} onSaved={(a) => setDate(a.date)} />
      <CancelAppointmentDialog appointment={cancelling} onOpenChange={(o) => !o && setCancelling(null)} />
    </div>
  );
}

function DoctorChip({
  active,
  onClick,
  name,
  sub,
  count,
  waiting,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  sub?: string;
  count: number;
  waiting?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/[0.07] shadow-sm" : "bg-card hover:bg-muted/50",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm font-medium leading-tight", active && "text-primary")}>{name}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold tabular">{count}</span>
      {Boolean(waiting) && (
        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold tabular text-amber-700 dark:text-amber-300" title="Kutmoqda">
          <Clock className="mr-0.5 inline h-3 w-3" />
          {waiting}
        </span>
      )}
    </button>
  );
}

function RowMenu({
  appointment: a,
  canManage,
  onMove,
  onCancel,
  onStatus,
}: {
  appointment: AppointmentWithDetails;
  canManage: boolean;
  onMove: () => void;
  onCancel: () => void;
  onStatus: (s: AppointmentStatus) => void;
}) {
  const open = a.status === "scheduled" || a.status === "arrived";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Amallar" data-testid={`button-appointment-menu-${a.id}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/patients/${a.patientId}`}>
            <IdCard className="mr-2 h-4 w-4" />
            Bemor kartasi
          </Link>
        </DropdownMenuItem>
        {canManage && a.status === "scheduled" && (
          <DropdownMenuItem onClick={onMove} data-testid={`button-move-${a.id}`}>
            <MoveRight className="mr-2 h-4 w-4" />
            Ko'chirish
          </DropdownMenuItem>
        )}
        {canManage && a.status === "arrived" && (
          <DropdownMenuItem onClick={() => onStatus("scheduled")}>
            <Undo2 className="mr-2 h-4 w-4" />
            "Keldi" belgisini bekor qilish
          </DropdownMenuItem>
        )}
        {canManage && open && (
          <>
            <DropdownMenuSeparator />
            {a.date <= dayKey(new Date()) && (
              <DropdownMenuItem onClick={() => onStatus("no_show")} data-testid={`button-noshow-${a.id}`}>
                <UserX className="mr-2 h-4 w-4" />
                Kelmadi
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onCancel} data-testid={`button-cancel-${a.id}`}>
              <XCircle className="mr-2 h-4 w-4" />
              Bekor qilish
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
