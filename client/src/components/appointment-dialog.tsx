/**
 * Booking an appointment (B2.7, TZ §4.1.4): patient → doctor → service →
 * day → a free slot. The same dialog moves an existing booking, with the
 * patient fixed.
 *
 * The grid comes from the server (/api/doctors/:id/slots), which builds it
 * from the doctor's weekly timetable and the bookings already made; the
 * server re-checks the slot under a lock when saving, so a slot taken by
 * another registrar a second ago is refused with a clear message rather
 * than double-booked.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Clock, DoorOpen, Loader2, Stethoscope, UserPlus, X } from "lucide-react";
import {
  SERVICE_KIND_LABELS,
  WEEKDAY_SHORT,
  type AppointmentWithDetails,
  type DoctorDaySlots,
  type DoctorWithDetails,
  type Patient,
  type ServiceWithDetails,
} from "@shared/schema";
import { MAX_BOOKING_DAYS_AHEAD, weekdayOf } from "@shared/appointment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, Money, PatientNumber, PhoneText } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { PatientDialog } from "@/components/patient-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useDebounced } from "@/hooks/use-debounced";
import { useToast } from "@/hooks/use-toast";
import { dayKey, formatDay, formatDayLong, money, shiftDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_SERVICE = "doctor";

export function AppointmentDialog({
  open,
  onOpenChange,
  presetPatient,
  appointment,
  defaultDoctorId,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from a patient: skip the search. */
  presetPatient?: Patient | null;
  /** Present = move this booking. */
  appointment?: AppointmentWithDetails | null;
  defaultDoctorId?: string | null;
  defaultDate?: string | null;
  onSaved?: (a: AppointmentWithDetails) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 p-0 sm:max-w-4xl">
        {open && (
          <BookingForm
            key={appointment?.id ?? presetPatient?.id ?? "new"}
            presetPatient={presetPatient}
            appointment={appointment}
            defaultDoctorId={defaultDoctorId}
            defaultDate={defaultDate}
            onDone={(a) => {
              onSaved?.(a);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type PickedPatient = Pick<Patient, "id" | "fullName" | "phone" | "patientNumber">;

function BookingForm({
  presetPatient,
  appointment,
  defaultDoctorId,
  defaultDate,
  onDone,
  onCancel,
}: {
  presetPatient?: Patient | null;
  appointment?: AppointmentWithDetails | null;
  defaultDoctorId?: string | null;
  defaultDate?: string | null;
  onDone: (a: AppointmentWithDetails) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isMove = Boolean(appointment);
  const today = dayKey(new Date());

  const [patient, setPatient] = useState<PickedPatient | null>(
    appointment
      ? { id: appointment.patientId, fullName: appointment.patientName, phone: appointment.patientPhone, patientNumber: appointment.patientNumber }
      : (presetPatient ?? null),
  );
  const [patientSearch, setPatientSearch] = useState("");
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [doctorId, setDoctorId] = useState<string>(appointment?.doctorId ?? defaultDoctorId ?? "");
  const [serviceId, setServiceId] = useState<string>(appointment?.serviceId ?? DEFAULT_SERVICE);
  const [date, setDate] = useState<string>(appointment?.date ?? (defaultDate && defaultDate >= today ? defaultDate : today));
  const [startTime, setStartTime] = useState<string | null>(appointment?.startTime ?? null);
  const [reason, setReason] = useState(appointment?.reason ?? "");
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebounced(patientSearch.trim(), 250);
  const { data: patientsData, isFetching: searching } = useQuery<{ items: Patient[] }>({
    queryKey: [`/api/patients?search=${encodeURIComponent(debounced)}&limit=8`],
    enabled: !patient,
  });
  const { data: doctors = [] } = useQuery<DoctorWithDetails[]>({ queryKey: ["/api/doctors?active=1"] });
  const { data: services = [] } = useQuery<ServiceWithDetails[]>({ queryKey: ["/api/services?active=1"] });

  const doctor = doctors.find((d) => d.id === doctorId);
  const workdays = useMemo(() => new Set(doctor?.schedule.map((s) => s.day) ?? []), [doctor]);

  // A doctor who does not work on the chosen day: jump to their next working day.
  useEffect(() => {
    if (!doctor || isMove) return;
    if (workdays.size === 0 || workdays.has(weekdayOf(date))) return;
    for (let i = 1; i <= 14; i++) {
      const next = shiftDay(date, i);
      if (workdays.has(weekdayOf(next))) {
        setDate(next);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  const slotsKey = doctorId ? `/api/doctors/${doctorId}/slots?date=${date}` : null;
  const { data: grid, isFetching: loadingSlots } = useQuery<DoctorDaySlots>({
    queryKey: [slotsKey ?? "/api/doctors/none/slots"],
    enabled: Boolean(slotsKey),
    // Another registrar may be filling the same day.
    refetchInterval: 30_000,
  });

  // Keep the picked time only while it is still free (or is the booking being moved).
  useEffect(() => {
    if (!grid || !startTime) return;
    const slot = grid.slots.find((s) => s.startTime === startTime);
    const ownSlot = isMove && grid.date === appointment!.date && grid.doctorId === appointment!.doctorId && startTime === appointment!.startTime;
    if (!slot || (!slot.available && !ownSlot)) setStartTime(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  const chosenService = services.find((s) => s.id === serviceId);
  const price = chosenService ? chosenService.price : (doctor?.consultationPrice ?? 0);
  const relevantServices = useMemo(
    () =>
      services
        .filter((s) => !doctor?.departmentId || !s.departmentId || s.departmentId === doctor.departmentId)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
    [services, doctor],
  );

  const strip = useMemo(() => {
    // Seven days from the selected week's start (today at the earliest).
    const start = date < shiftDay(today, 3) ? today : shiftDay(date, -3);
    return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  }, [date, today]);
  const lastDay = shiftDay(today, MAX_BOOKING_DAYS_AHEAD);

  const save = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Bemorni tanlang");
      if (!doctorId) throw new Error("Shifokorni tanlang");
      if (!startTime) throw new Error("Qabul vaqtini tanlang");
      const body = {
        doctorId,
        serviceId: serviceId === DEFAULT_SERVICE ? null : serviceId,
        date,
        startTime,
        reason: reason.trim() || null,
      };
      const res = isMove
        ? await apiRequest("PATCH", `/api/appointments/${appointment!.id}`, body)
        : await apiRequest("POST", "/api/appointments", { ...body, patientId: patient.id });
      return (await res.json()) as AppointmentWithDetails;
    },
    onSuccess: (a) => {
      invalidateApi("/api/appointments", "/api/doctors", "/api/cabinet", "/api/services");
      toast({
        title: isMove ? "Qabul ko'chirildi" : `Qabulga yozildi — navbat №${a.queueNumber}`,
        description: `${a.patientName} · ${a.doctorName} · ${formatDay(a.date)} ${a.startTime}`,
      });
      onDone(a);
    },
    onError: (err: Error) => {
      setError(err.message);
      // The slot may have just gone: show the grid as it is now.
      if (slotsKey) invalidateApi(slotsKey.split("?")[0]);
    },
  });

  const canSave = Boolean(patient && doctorId && startTime) && !save.isPending;
  const freeCount = grid?.slots.filter((s) => s.available).length ?? 0;
  // Late in the day the morning's spent slots would push the free ones off
  // screen; they are hidden (a booking being moved keeps its own slot).
  const isOwnSlot = (t: string) =>
    isMove && grid?.date === appointment!.date && grid?.doctorId === appointment!.doctorId && t === appointment!.startTime;
  const shownSlots = grid?.slots.filter((s) => s.reason !== "past" || isOwnSlot(s.startTime)) ?? [];
  const hiddenPast = (grid?.slots.length ?? 0) - shownSlots.length;

  return (
    <>
      <DialogHeader className="border-b px-6 py-5">
        <DialogTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          {isMove ? "Qabulni ko'chirish" : "Qabulga yozish"}
        </DialogTitle>
        <DialogDescription>
          {isMove
            ? `Hozir: ${formatDay(appointment!.date)} ${appointment!.startTime}, ${appointment!.doctorName}, navbat №${appointment!.queueNumber}`
            : "Bemor, shifokor va bo'sh vaqtni tanlang. Navbat raqami avtomatik beriladi."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------------------------------------------------- who and what */}
        <div className="space-y-5 border-b p-5 lg:border-b-0 lg:border-r">
          <div>
            <Label className="mb-2 block">1. Bemor</Label>
            {patient ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={patient.fullName} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <PatientNumber value={patient.patientNumber} size="sm" />
                      <span className="truncate" data-testid="text-booking-patient">
                        {patient.fullName}
                      </span>
                    </p>
                    <PhoneText value={patient.phone} asLink={false} className="text-sm text-muted-foreground" />
                  </div>
                </div>
                {!isMove && !presetPatient && (
                  <Button variant="ghost" size="sm" onClick={() => setPatient(null)} data-testid="button-booking-clear-patient">
                    <X className="mr-1 h-4 w-4" />
                    O'zgartirish
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <SearchInput
                    value={patientSearch}
                    onChange={setPatientSearch}
                    placeholder="Raqam, ism yoki telefon..."
                    className="flex-1"
                    data-testid="input-booking-patient-search"
                  />
                  <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Yangi
                  </Button>
                </div>
                <div className="max-h-48 divide-y overflow-auto rounded-xl border">
                  {(patientsData?.items ?? []).length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      {searching ? "Qidirilmoqda..." : "Bemor topilmadi. \"Yangi\" tugmasi orqali qo'shing."}
                    </p>
                  ) : (
                    patientsData!.items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPatient(p)}
                        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/60"
                        data-testid={`option-booking-patient-${p.id}`}
                      >
                        <Avatar name={p.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            <PatientNumber value={p.patientNumber} size="sm" />
                            <span className="truncate">{p.fullName}</span>
                          </p>
                          <PhoneText value={p.phone} asLink={false} className="text-xs text-muted-foreground" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">2. Shifokor</Label>
            {doctors.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Qabul qiladigan shifokor yo'q. Klinika → Shifokorlar bo'limida profil va ish jadvalini kiriting.
              </p>
            ) : (
              <Select
                value={doctorId}
                onValueChange={(v) => {
                  setDoctorId(v);
                  setStartTime(null);
                  setServiceId(DEFAULT_SERVICE);
                  setError(null);
                }}
              >
                <SelectTrigger className="h-auto min-h-11 py-2" data-testid="select-booking-doctor">
                  <SelectValue placeholder="Shifokorni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id} data-testid={`option-booking-doctor-${d.id}`}>
                      <span className="font-medium">{d.fullName}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {d.specialty}
                        {d.room ? `, ${d.room}-xona` : ""}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {doctor && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {doctor.departmentName ?? "Bo'limsiz"}
                </span>
                {doctor.room && (
                  <span className="inline-flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    {doctor.room}-xona
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {doctor.slotMinutes} daq.
                </span>
                <span>
                  Ish kunlari:{" "}
                  {[...workdays]
                    .sort()
                    .map((d) => WEEKDAY_SHORT[d])
                    .join(", ") || "jadval yo'q"}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">3. Xizmat</Label>
            <Select value={serviceId} onValueChange={setServiceId} disabled={!doctor}>
              <SelectTrigger data-testid="select-booking-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SERVICE}>
                  Shifokor ko'rigi{doctor ? ` — ${money(doctor.consultationPrice)}` : ""}
                </SelectItem>
                {relevantServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    <span className="text-muted-foreground">
                      {" "}
                      · {SERVICE_KIND_LABELS[s.kind]} — {money(s.price)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="booking-reason" className="mb-2 block">
              4. Murojaat sababi <span className="font-normal text-muted-foreground">(ixtiyoriy)</span>
            </Label>
            <Textarea
              id="booking-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: bosh og'rig'i, takroriy ko'rik"
              maxLength={300}
              data-testid="input-booking-reason"
            />
          </div>
        </div>

        {/* --------------------------------------------------------------- when */}
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <Label>5. Sana va vaqt</Label>
            <Input
              type="date"
              value={date}
              min={today}
              max={lastDay}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  setStartTime(null);
                }
              }}
              className="h-8 w-40 text-sm"
              data-testid="input-booking-date"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-7 shrink-0"
              disabled={strip[0] <= today}
              onClick={() => setDate(shiftDay(strip[0], -1))}
              aria-label="Oldingi kunlar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="grid flex-1 grid-cols-7 gap-1">
              {strip.map((d) => {
                const wd = weekdayOf(d);
                const off = doctor ? !workdays.has(wd) : false;
                const selected = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDate(d);
                      setStartTime(null);
                    }}
                    disabled={d > lastDay}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60",
                      off && !selected && "border-dashed text-muted-foreground/60",
                    )}
                    data-testid={`button-booking-day-${d}`}
                  >
                    <span className="text-[10px] font-medium uppercase">{d === today ? "Bugun" : WEEKDAY_SHORT[wd]}</span>
                    <span className="text-sm font-semibold tabular">{Number(d.slice(8))}</span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-7 shrink-0"
              disabled={strip[6] >= lastDay}
              onClick={() => setDate(shiftDay(strip[6], 1))}
              aria-label="Keyingi kunlar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatDayLong(date)}</span>
              {grid?.works && <span>{freeCount} ta bo'sh vaqt</span>}
            </div>
            {!doctor ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Avval shifokorni tanlang</p>
            ) : loadingSlots && !grid ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !grid?.works ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CalendarX2 className="h-6 w-6" />
                Shifokor bu kuni qabul qilmaydi
              </div>
            ) : shownSlots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CalendarX2 className="h-6 w-6" />
                Bugungi qabul vaqti tugagan. Boshqa kunni tanlang.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" data-testid="grid-booking-slots">
                {shownSlots.map((s) => {
                  const own = isOwnSlot(s.startTime);
                  const selectable = s.available || own;
                  const selected = startTime === s.startTime;
                  const button = (
                    <button
                      key={s.startTime}
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        setStartTime(s.startTime);
                        setError(null);
                      }}
                      className={cn(
                        "h-10 w-full rounded-lg border text-sm font-medium tabular transition-all",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : selectable
                            ? "bg-background hover:border-primary/50 hover:bg-primary/[0.06]"
                            : s.reason === "taken"
                              ? "cursor-not-allowed border-transparent bg-rose-500/[0.08] text-rose-700/60 line-through dark:text-rose-300/60"
                              : "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground/50",
                      )}
                      data-testid={`slot-${s.startTime}`}
                    >
                      {s.startTime}
                    </button>
                  );
                  return s.takenBy && !own ? (
                    <Tooltip key={s.startTime}>
                      <TooltipTrigger asChild>
                        <span className="block">{button}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Band: №{s.takenBy.queueNumber} {s.takenBy.patientName}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    button
                  );
                })}
              </div>
            )}
            {grid?.works && (
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {hiddenPast > 0 && <span>{hiddenPast} ta o'tgan vaqt yashirildi ·</span>}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded border bg-background" />
                  bo'sh
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded bg-rose-500/20" />
                  band
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Qabul</span>
              <span className="font-medium" data-testid="text-booking-when">
                {startTime ? `${formatDay(date)}, ${startTime}` : "—"}
              </span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Narx</span>
              <Money value={price} className="text-lg font-bold" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">To'lov kassada qabul qilinadi.</p>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive" data-testid="text-booking-error">
              {error}
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button onClick={() => save.mutate()} disabled={!canSave} className="shadow-brand" data-testid="button-booking-save">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isMove ? "Ko'chirish" : "Qabulga yozish"}
        </Button>
      </DialogFooter>

      <PatientDialog open={newPatientOpen} onOpenChange={setNewPatientOpen} onSaved={(p) => setPatient(p)} />
    </>
  );
}
