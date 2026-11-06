/**
 * Outpatient clinic API: the service catalogue (B2.6, TZ §4.1.5), the
 * appointment book and queue (B2.7, §4.1.4) and the doctor's cabinet
 * (B3.1, §5.1.1).
 *
 * Who may do what:
 * - services: everyone signed in reads (prices are needed at the desk);
 *   services.manage edits.
 * - appointments: appointments.read sees every doctor's book;
 *   appointments.manage books, checks in, moves and cancels ("desk");
 *   appointments.serve works the doctor's own queue ("doctor"). The status
 *   machine in shared/appointment.ts decides which side may make each move.
 */
import type { Express, Request, Response } from "express";
import {
  APPOINTMENT_STATUS_LABELS,
  SERVICE_KIND_LABELS,
  appointmentStatusSchema,
  createAppointmentSchema,
  insertServiceSchema,
  rescheduleAppointmentSchema,
  updateServiceSchema,
  type AppointmentStatus,
  type AppointmentWithDetails,
  type DoctorCabinet,
  type DoctorDaySlots,
  type DoctorWithDetails,
  type PriceListItem,
  type ReceptionBoard,
  type ReferralWithDetails,
  type Service,
} from "@shared/schema";
import { RECEPTION_LIST_LIMIT, summarizeQueue } from "@shared/reception";
import { referralBookingProblem } from "@shared/referral";
import {
  bookingProblem,
  buildSlots,
  checkTransition,
  clockNow,
  fromMinutes,
  holdsSlot,
  isValidDay,
  needsReason,
  nextInLine,
  slotStarts,
  type Booking,
} from "@shared/appointment";
import { requireAuth } from "./auth";
import { hasPermission, requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, stringParam } from "./route-helpers";
import { storage } from "./storage";
import type { Appointment } from "@shared/schema";
import type { BookingCheck } from "./storage-types";

const money = (n: number) => `${n.toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;

/** "№14 Aliyev Vali" — how the desk names a patient in the log. */
const patientLabel = (a: Pick<AppointmentWithDetails, "patientNumber" | "patientName">) =>
  `№${a.patientNumber} ${a.patientName}`;

const when = (a: Pick<AppointmentWithDetails, "date" | "startTime">) => `${a.date} ${a.startTime}`;

/** A doctor who can take bookings, or the reason they cannot. */
async function bookableDoctor(id: string): Promise<{ doctor: DoctorWithDetails } | { error: string }> {
  const doctor = await storage.getDoctor(id);
  if (!doctor) return { error: "Shifokor topilmadi" };
  if (!doctor.isActive || !doctor.userActive) return { error: `${doctor.fullName} hozir qabul qilmaydi` };
  return { doctor };
}

/** The service picked for a booking — must exist and be on sale. */
async function pickedService(id: string | null | undefined): Promise<{ service: Service | null } | { error: string }> {
  if (!id) return { service: null };
  const service = await storage.getService(id);
  if (!service) return { error: "Xizmat topilmadi" };
  if (!service.isActive) return { error: `"${service.name}" xizmati hozir ko'rsatilmaydi` };
  return { service };
}

const toBookings = (list: Appointment[]): Booking[] =>
  list.map((a) => ({
    id: a.id,
    startTime: a.startTime,
    durationMinutes: a.durationMinutes,
    status: a.status,
    queueNumber: a.queueNumber,
  }));

/**
 * The check that runs inside the storage write, under the doctor-day lock:
 * the slot must still be free, and the patient must not already hold a live
 * booking with this doctor that day.
 */
function bookingCheck(opts: {
  doctor: DoctorWithDetails;
  date: string;
  startTime: string;
  patientId: string;
  ignoreId?: string;
}): BookingCheck {
  return (day) => {
    const twice = day.find(
      (a) => a.id !== opts.ignoreId && a.patientId === opts.patientId && holdsSlot(a.status) && a.status !== "completed",
    );
    if (twice) {
      return `Bemor bu kuni shu shifokorga allaqachon yozilgan (${twice.startTime}, navbat №${twice.queueNumber})`;
    }
    return bookingProblem({
      date: opts.date,
      startTime: opts.startTime,
      slotMinutes: opts.doctor.slotMinutes,
      starts: slotStarts(opts.doctor.schedule, opts.doctor.slotMinutes, opts.date),
      bookings: toBookings(day),
      now: clockNow(),
      ignoreId: opts.ignoreId,
    });
  };
}

/** True when the signed-in user is the doctor of this appointment and may serve. */
const isOwnDoctor = (req: Request, a: Pick<AppointmentWithDetails, "doctorUserId">) =>
  hasPermission(req, "appointments.serve") && a.doctorUserId === req.user!.id;

export function registerClinicRoutes(app: Express) {
  // ------------------------------------------------------------- services

  app.get(
    "/api/services",
    requireAuth,
    handle(async (req, res) => {
      res.json(await storage.listServices({ activeOnly: req.query.active === "1" }).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  /**
   * The clinic price list (TZ §9.1 "Xizmatlar narxlari"): services and lab
   * tests in one list, each still edited in its own catalogue.
   */
  app.get(
    "/api/price-list",
    requireAuth,
    handle(async (req, res) => {
      const activeOnly = req.query.active === "1";
      const [svc, tests] = await Promise.all([
        storage.listServices({ activeOnly }).catch((e) => emptyIfMissing(e, [])),
        storage.listTests({ activeOnly }),
      ]);
      const items: PriceListItem[] = [
        ...svc.map((s) => ({
          source: "service" as const,
          id: s.id,
          name: s.name,
          kind: s.kind,
          group: s.departmentName,
          price: s.price,
          isActive: s.isActive,
        })),
        ...tests.map((t) => ({
          source: "test" as const,
          id: t.id,
          name: t.name,
          kind: "laboratoriya" as const,
          group: t.category,
          price: t.price,
          isActive: t.isActive,
        })),
      ];
      res.json(items);
    }),
  );

  /** Names are compared without case or surrounding space: "UZI" and "uzi " are one service. */
  async function serviceNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const key = name.trim().toLowerCase();
    return (await storage.listServices()).some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === key);
  }

  async function departmentProblem(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    const dept = await storage.getDepartment(id);
    if (!dept) return "Bo'lim topilmadi";
    if (!dept.isActive) return `"${dept.name}" bo'limi yopilgan`;
    return null;
  }

  app.post(
    "/api/services",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const input = insertServiceSchema.parse(req.body);
      if (await serviceNameTaken(input.name)) return res.status(409).json({ message: "Bunday nomli xizmat allaqachon bor" });
      const deptError = await departmentProblem(input.departmentId);
      if (deptError) return res.status(400).json({ message: deptError });
      const service = await storage.createService(input, actorOf(req));
      await audit(
        req,
        "create",
        "service",
        service.id,
        `"${service.name}" xizmati qo'shildi (${SERVICE_KIND_LABELS[service.kind]}, ${money(service.price)})`,
      );
      res.status(201).json(service);
    }),
  );

  app.patch(
    "/api/services/:id",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const input = updateServiceSchema.parse(req.body);
      const before = await storage.getService(req.params.id);
      if (!before) return res.status(404).json({ message: "Xizmat topilmadi" });
      if (input.name && (await serviceNameTaken(input.name, before.id))) {
        return res.status(409).json({ message: "Bunday nomli xizmat allaqachon bor" });
      }
      if (input.departmentId && input.departmentId !== before.departmentId) {
        const deptError = await departmentProblem(input.departmentId);
        if (deptError) return res.status(400).json({ message: deptError });
      }
      const service = await storage.updateService(before.id, input, actorOf(req));
      if (!service) return res.status(404).json({ message: "Xizmat topilmadi" });

      const changes: string[] = [];
      if (input.name && input.name !== before.name) changes.push(`nomi: ${before.name} → ${service.name}`);
      if (input.kind && input.kind !== before.kind) changes.push(`turi: ${SERVICE_KIND_LABELS[service.kind]}`);
      if (input.price !== undefined && input.price !== before.price) {
        changes.push(`narx: ${money(before.price)} → ${money(service.price)}`);
      }
      if (input.departmentId !== undefined && (input.departmentId ?? null) !== before.departmentId) {
        changes.push(`bo'lim: ${service.departmentName ?? "—"}`);
      }
      if (input.isActive !== undefined && input.isActive !== before.isActive) {
        changes.push(service.isActive ? "qayta yoqildi" : "to'xtatildi");
      }
      await audit(req, "update", "service", service.id, `"${service.name}" xizmati — ${changes.join(", ") || "tavsif yangilandi"}`);
      res.json(service);
    }),
  );

  app.delete(
    "/api/services/:id",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const service = (await storage.listServices()).find((s) => s.id === req.params.id);
      if (!service) return res.status(404).json({ message: "Xizmat topilmadi" });
      // Booked appointments keep pointing at it — prices in history must stay explainable.
      if (service.appointmentCount > 0) {
        return res.status(409).json({
          message: `Bu xizmat ${service.appointmentCount} ta qabulda ishlatilgan. O'chirish o'rniga to'xtating (nofaol qiling)`,
        });
      }
      await storage.deleteService(service.id);
      await audit(req, "delete", "service", service.id, `"${service.name}" xizmati o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // --------------------------------------------------------- appointments

  /**
   * The appointment book. With appointments.read: any day, any doctor. A
   * patient's own history is also open to whoever may read patient cards —
   * the card shows it — but nothing broader.
   */
  app.get(
    "/api/appointments",
    requireAuth,
    handle(async (req, res) => {
      const patientId = stringParam(req.query.patientId);
      const canAll = hasPermission(req, "appointments.read");
      if (!canAll && !(patientId && hasPermission(req, "patients.read"))) {
        return res.status(403).json({ message: "Bu amal uchun ruxsatingiz yo'q" });
      }
      const date = stringParam(req.query.date);
      if (date && !isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      if (!date && !patientId) return res.status(400).json({ message: "Sana yoki bemor ko'rsatilishi kerak" });
      const list = await storage
        .listAppointments({ date, patientId, doctorId: stringParam(req.query.doctorId) })
        .catch((e) => emptyIfMissing(e, []));
      res.json(list);
    }),
  );

  /** The booking grid for one doctor and day. */
  app.get(
    "/api/doctors/:id/slots",
    requirePermission("appointments.manage", "appointments.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date);
      if (!date || !isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      const doctor = await storage.getDoctor(req.params.id);
      if (!doctor) return res.status(404).json({ message: "Shifokor topilmadi" });

      const starts = doctor.isActive && doctor.userActive ? slotStarts(doctor.schedule, doctor.slotMinutes, date) : [];
      const day = await storage.listAppointments({ doctorId: doctor.id, date }).catch((e) => emptyIfMissing(e, []));
      const bookings: Booking[] = day.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        durationMinutes: a.durationMinutes,
        status: a.status,
        patientName: a.patientName,
        queueNumber: a.queueNumber,
      }));
      const result: DoctorDaySlots = {
        doctorId: doctor.id,
        date,
        works: starts.length > 0,
        slotMinutes: doctor.slotMinutes,
        slots: buildSlots(starts, doctor.slotMinutes, bookings, date, clockNow()),
      };
      res.json(result);
    }),
  );

  app.post(
    "/api/appointments",
    requirePermission("appointments.manage"),
    handle(async (req, res) => {
      const input = createAppointmentSchema.parse(req.body);
      const patient = await storage.getPatient(input.patientId);
      if (!patient) return res.status(400).json({ message: "Bemor topilmadi" });
      const found = await bookableDoctor(input.doctorId);
      if ("error" in found) return res.status(400).json({ message: found.error });
      const picked = await pickedService(input.serviceId);
      if ("error" in picked) return res.status(400).json({ message: picked.error });
      const { doctor } = found;

      // Booking a doctor's referral: it must be for this patient, this service
      // or this specialist. The storage write re-checks it is still unbooked.
      let referralNumber: number | null = null;
      if (input.referralId) {
        if (!hasPermission(req, "referrals.read")) return res.status(403).json({ message: "Yo'llanmalarni ko'rish uchun ruxsatingiz yo'q" });
        const referral = await storage.getReferral(input.referralId);
        if (!referral) return res.status(404).json({ message: "Yo'llanma topilmadi" });
        const problem = referralBookingProblem(referral, {
          patientId: patient.id,
          doctorId: doctor.id,
          doctorSpecialty: doctor.specialty,
          serviceId: input.serviceId,
        });
        if (problem) return res.status(400).json({ message: problem });
        referralNumber = referral.referralNumber;
      }

      const appointment = await storage.createAppointment(
        {
          ...input,
          durationMinutes: doctor.slotMinutes,
          // A chosen service sets the price; otherwise the doctor's consultation fee.
          price: picked.service?.price ?? doctor.consultationPrice,
        },
        actorOf(req),
        bookingCheck({ doctor, date: input.date, startTime: input.startTime, patientId: patient.id }),
      );
      await audit(
        req,
        "create",
        "appointment",
        appointment.id,
        `${patientLabel(appointment)} — ${appointment.doctorName} qabuliga yozildi (${when(appointment)}, navbat №${appointment.queueNumber})${
          referralNumber ? `, yo'llanma №${referralNumber} bo'yicha` : ""
        }`,
      );
      res.status(201).json(appointment);
    }),
  );

  /** Moves a booking that has not happened yet. */
  app.patch(
    "/api/appointments/:id",
    requirePermission("appointments.manage"),
    handle(async (req, res) => {
      const input = rescheduleAppointmentSchema.parse(req.body);
      const before = await storage.getAppointment(req.params.id);
      if (!before) return res.status(404).json({ message: "Qabul topilmadi" });
      if (before.status !== "scheduled") {
        return res.status(409).json({ message: "Faqat \"yozildi\" holatidagi qabulni ko'chirish mumkin" });
      }

      const doctorId = input.doctorId ?? before.doctorId;
      const found = await bookableDoctor(doctorId);
      if ("error" in found) return res.status(400).json({ message: found.error });
      const { doctor } = found;
      const serviceId = input.serviceId !== undefined ? input.serviceId : before.serviceId;
      const picked = await pickedService(serviceId);
      if ("error" in picked && serviceId !== before.serviceId) return res.status(400).json({ message: picked.error });
      const service = "service" in picked ? picked.service : null;

      // A referral's booking stays what the referral asked for.
      if (before.referralId) {
        const referral = await storage.getReferral(before.referralId);
        const problem =
          referral &&
          referralBookingProblem(
            { ...referral, status: "active" },
            { patientId: before.patientId, doctorId: doctor.id, doctorSpecialty: doctor.specialty, serviceId },
          );
        if (problem) return res.status(400).json({ message: problem });
      }

      const date = input.date ?? before.date;
      const startTime = input.startTime ?? before.startTime;
      // The price only follows the catalogue when the doctor or service changes;
      // a pure time move keeps what the patient was told.
      const repriced = doctorId !== before.doctorId || serviceId !== before.serviceId;
      const appointment = await storage.rescheduleAppointment(
        before.id,
        {
          doctorId,
          date,
          startTime,
          durationMinutes: doctor.slotMinutes,
          serviceId,
          price: repriced ? (service?.price ?? doctor.consultationPrice) : before.price,
          reason: input.reason !== undefined ? input.reason : before.reason,
        },
        actorOf(req),
        bookingCheck({ doctor, date, startTime, patientId: before.patientId, ignoreId: before.id }),
      );

      const changes: string[] = [];
      if (when(before) !== when(appointment)) changes.push(`${when(before)} → ${when(appointment)}`);
      if (before.doctorId !== appointment.doctorId) changes.push(`shifokor: ${before.doctorName} → ${appointment.doctorName}`);
      if (before.queueNumber !== appointment.queueNumber || before.date !== appointment.date) {
        changes.push(`navbat №${appointment.queueNumber}`);
      }
      if (before.price !== appointment.price) changes.push(`narx: ${money(before.price)} → ${money(appointment.price)}`);
      await audit(req, "update", "appointment", appointment.id, `${patientLabel(appointment)} — qabul ko'chirildi: ${changes.join(", ") || "izoh yangilandi"}`);
      res.json(appointment);
    }),
  );

  /** Applies one move of the status machine, checked for who may make it. */
  async function changeStatus(req: Request, res: Response, appointment: AppointmentWithDetails, to: AppointmentStatus, reason: string | null) {
    const desk = hasPermission(req, "appointments.manage");
    const ownDoctor = isOwnDoctor(req, appointment);
    const verdict = checkTransition(appointment.status, to, { desk, ownDoctor });
    if (!verdict.ok) return res.status(verdict.status).json({ message: verdict.message });

    if (needsReason(to) && (!reason || reason.length < 3)) {
      return res.status(400).json({ message: "Bekor qilish sababini yozing" });
    }
    const today = clockNow().date;
    if ((to === "arrived" && appointment.status !== "in_progress") || to === "in_progress") {
      if (appointment.date !== today) {
        return res.status(400).json({
          message: to === "arrived" ? "Bemorni faqat qabul kuni \"keldi\" deb belgilash mumkin" : "Qabulni faqat belgilangan kuni boshlash mumkin",
        });
      }
    }
    if (to === "in_progress") {
      // One patient at a time: the cabinet must finish (or send back) the current one first.
      const current = (await storage.listAppointments({ doctorId: appointment.doctorId, date: today, statuses: ["in_progress"] })).find(
        (a) => a.id !== appointment.id,
      );
      if (current) {
        return res.status(409).json({ message: `Avval joriy qabulni yakunlang: ${patientLabel(current)} (navbat №${current.queueNumber})` });
      }
    }

    const updated = await storage.setAppointmentStatus(appointment.id, { from: appointment.status, to, reason }, actorOf(req));
    const label = APPOINTMENT_STATUS_LABELS[to].toLowerCase();
    await audit(
      req,
      "update",
      "appointment",
      updated.id,
      `${patientLabel(updated)} — ${updated.doctorName} qabuli (${when(updated)}): ${APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()} → ${label}${
        to === "cancelled" && reason ? ` (sabab: ${reason})` : ""
      }`,
    );
    return res.json(updated);
  }

  app.post(
    "/api/appointments/:id/status",
    requirePermission("appointments.manage", "appointments.serve"),
    handle(async (req, res) => {
      const { status, reason } = appointmentStatusSchema.parse(req.body);
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.status(404).json({ message: "Qabul topilmadi" });
      // A doctor without desk rights only ever touches their own queue.
      if (!hasPermission(req, "appointments.manage") && appointment.doctorUserId !== req.user!.id) {
        return res.status(404).json({ message: "Qabul topilmadi" });
      }
      return changeStatus(req, res, appointment, status, reason);
    }),
  );

  // ------------------------------------------------------ doctor's cabinet

  /**
   * Registratura bosh sahifasi (TZ §4.1.1): today's patients, the queue, who
   * has arrived, new registrations and how today's bills stand.
   *
   * One endpoint for the whole board, so the desk's home screen is two
   * parallel queries. Each section follows its own permission — the queue
   * needs appointments.read, the bills orders.read (money finance.view), new
   * registrations patients.read — and comes back null without it.
   */
  // Laboratoriya bosh sahifasi (TZ §6.1.1). Counts only, no money, so
  // orders.read is enough; the rules are in shared/lab-board.ts.
  app.get(
    "/api/lab-board",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date) ?? clockNow().date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      res.json(await storage.getLabBoard(date));
    }),
  );

  app.get(
    "/api/reception",
    requirePermission("appointments.read", "orders.read"),
    handle(async (req, res) => {
      const clock = clockNow();
      const date = stringParam(req.query.date) ?? clock.date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });

      const seesQueue = hasPermission(req, "appointments.read");
      const [day, list, waitingReferrals] = await Promise.all([
        storage.getReceptionDay(date),
        seesQueue
          ? storage.listAppointments({ date }).catch((e) => emptyIfMissing(e, [] as AppointmentWithDetails[]))
          : Promise.resolve(null),
        hasPermission(req, "referrals.read")
          ? storage.listReferrals({ awaitingBooking: true, limit: 200 }).catch((e) => emptyIfMissing(e, [] as ReferralWithDetails[]))
          : Promise.resolve(null),
      ]);

      const now = fromMinutes(clock.minutes);
      const seesMoney = hasPermission(req, "finance.view");
      const board: ReceptionBoard = {
        date,
        now,
        patientsToday: day.patientsToday,
        newPatients: hasPermission(req, "patients.read") ? day.newPatients : null,
        payments: hasPermission(req, "orders.read")
          ? seesMoney
            ? day.payments
            : { ...day.payments, billed: null, collected: null, due: null }
          : null,
        queue: list ? summarizeQueue(list, { isToday: date === clock.date, now }) : null,
        referrals: waitingReferrals ? { total: waitingReferrals.length, items: waitingReferrals.slice(0, RECEPTION_LIST_LIMIT) } : null,
      };
      res.json(board);
    }),
  );

  /**
   * The doctor's day (TZ §5.1.1): today's list, who is waiting, who has been
   * seen, and appointments started on an earlier day but never finished.
   * A manager with appointments.read may open any doctor's cabinet to look.
   */
  app.get(
    "/api/cabinet",
    requirePermission("appointments.serve", "appointments.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date) ?? clockNow().date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });

      const requested = stringParam(req.query.doctorId);
      let doctor: DoctorWithDetails | undefined;
      if (requested && hasPermission(req, "appointments.read")) {
        doctor = await storage.getDoctor(requested);
      } else {
        doctor = await storage.getDoctorByUser(req.user!.id).catch((e) => emptyIfMissing(e, undefined));
      }
      if (!doctor) {
        return res.status(404).json({
          message: "Sizga shifokor profili biriktirilmagan. Administrator Klinika → Shifokorlar bo'limida profil ochadi",
          code: "NO_DOCTOR_PROFILE",
        });
      }

      const [appointments, unfinished] = await Promise.all([
        storage.listAppointments({ doctorId: doctor.id, date }).catch((e) => emptyIfMissing(e, [])),
        storage
          .listAppointments({ doctorId: doctor.id, beforeDate: clockNow().date, statuses: ["in_progress"] })
          .catch((e) => emptyIfMissing(e, [])),
      ]);
      // Examination records (B3.3): the state of each of the day's, and every
      // record this doctor has not signed yet. Empty before db:medical.
      const [dayRecords, draftRecords] = await Promise.all([
        storage.listRecords({ appointmentIds: appointments.map((a) => a.id) }).catch((e) => emptyIfMissing(e, [])),
        storage.listRecords({ doctorId: doctor.id, status: "draft" }).catch((e) => emptyIfMissing(e, [])),
      ]);
      const cabinet: DoctorCabinet = {
        doctor,
        date,
        appointments,
        unfinished,
        recordStatus: Object.fromEntries(dayRecords.map((r) => [r.appointmentId, r.status])),
        draftRecords,
      };
      res.json(cabinet);
    }),
  );

  /** "Keyingi bemor": calls in the first arrived patient of today's queue. */
  app.post(
    "/api/cabinet/call-next",
    requirePermission("appointments.serve"),
    handle(async (req, res) => {
      const doctor = await storage.getDoctorByUser(req.user!.id);
      if (!doctor) return res.status(404).json({ message: "Sizga shifokor profili biriktirilmagan" });
      const today = await storage.listAppointments({ doctorId: doctor.id, date: clockNow().date });
      const next = nextInLine(today);
      if (!next) return res.status(409).json({ message: "Navbatda kutayotgan bemor yo'q" });
      return changeStatus(req, res, next, "in_progress", null);
    }),
  );
}

