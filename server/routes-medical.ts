/**
 * Clinical records API: the examination window (B3.3, TZ §5.1.3), the
 * electronic medical record (B3.2, §5.1.2) and allergies, with signing and
 * versioned correction (§5.2).
 *
 * Who may do what:
 * - records.read: open a patient's medical record and examination history.
 * - records.write: the appointment's own doctor writes the examination and
 *   records allergies. Nobody else writes into another doctor's record.
 * - records.sign: the author signs; a signed record is locked.
 * - records.amend: the author corrects a signed record — the replaced text
 *   is kept as a version, with who replaced it and why.
 */
import type { Express, Request } from "express";
import {
  REFERRAL_KIND_LABELS,
  amendRecordSchema,
  cancelReferralSchema,
  createReferralSchema,
  insertAllergySchema,
  removeAllergySchema,
  saveRecordSchema,
  signRecordSchema,
  type ExaminationData,
  type LabResultEntry,
  type MedicalCard,
  type MedicalRecordWithDetails,
  type OrderWithDetails,
  type Patient,
  type ReferralWithDetails,
  type VisitSummary,
} from "@shared/schema";
import { isExamServiceKind, referralSubject } from "@shared/referral";
import { releasedLines } from "@shared/lab-verification";
import { changedFields, diagnosisHistory, fieldList, pickFields, signProblem } from "@shared/medical-record";
import { patientAge } from "@shared/patient-identity";
import { hasPermission, requirePermission } from "./rbac";
import { audit, emptyIfMissing, handle, logPatientView, stringParam } from "./route-helpers";
import type { NewReferrals } from "./storage-types";
import { storage } from "./storage";
import { localDay } from "./storage-types";

/** The examination can be written while the patient is in, and after (finishing the notes). */
const WRITABLE_APPOINTMENT = new Set(["in_progress", "completed"]);

const patientLabel = (p: { patientNumber: number; fullName?: string; patientName?: string }) =>
  `№${p.patientNumber} ${p.fullName ?? p.patientName}`;

/** The signed-in user is the doctor of this appointment / record. */
const isAuthor = (req: Request, x: { doctorUserId: string }) => x.doctorUserId === req.user!.id;

/**
 * Draft autosaves arrive every few seconds; logging each would bury the
 * trail. One "draft edited" line per record per editor per ten minutes —
 * signing and every correction are always logged in full.
 */
const DRAFT_LOG_EVERY_MS = 10 * 60_000;
const lastDraftLogged = new Map<string, number>();
function shouldLogDraft(req: Request, recordId: string): boolean {
  const key = `${req.user!.id}:${recordId}`;
  const now = Date.now();
  if (now - (lastDraftLogged.get(key) ?? 0) < DRAFT_LOG_EVERY_MS) return false;
  lastDraftLogged.set(key, now);
  if (lastDraftLogged.size > 20_000) lastDraftLogged.clear();
  return true;
}

/** Drafts belong to their author until signed; nobody else sees half-written notes. */
const visibleTo = (req: Request) => (r: MedicalRecordWithDetails) => r.status === "signed" || isAuthor(req, r);

export function registerMedicalRoutes(app: Express) {
  // ------------------------------------------------------ examination window

  /** Everything the examination window needs, in one request. */
  app.get(
    "/api/appointments/:id/examination",
    requirePermission("records.read", "appointments.serve"),
    handle(async (req, res) => {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.status(404).json({ message: "Qabul topilmadi" });
      const own = isAuthor(req, appointment);
      // A doctor without records.read sees only their own patients' examinations.
      if (!own && !hasPermission(req, "records.read")) return res.status(404).json({ message: "Qabul topilmadi" });

      const seesReferrals = own || hasPermission(req, "referrals.read");
      const [record, referrals] = await Promise.all([
        storage.getRecordByAppointment(appointment.id).catch((e) => emptyIfMissing(e, undefined)),
        seesReferrals
          ? storage.listReferrals({ appointmentId: appointment.id }).catch((e) => emptyIfMissing(e, [] as ReferralWithDetails[]))
          : Promise.resolve([] as ReferralWithDetails[]),
      ]);
      await logPatientView(req, { id: appointment.patientId, patientNumber: appointment.patientNumber, fullName: appointment.patientName }, "ko'rik yozuvi ochildi");

      const data: ExaminationData = {
        appointment,
        record: record && visibleTo(req)(record) ? record : null,
        canWrite: own && hasPermission(req, "records.write") && WRITABLE_APPOINTMENT.has(appointment.status),
        canAmend: own && hasPermission(req, "records.amend"),
        referrals,
        canRefer: own && hasPermission(req, "referrals.create") && WRITABLE_APPOINTMENT.has(appointment.status),
      };
      res.json(data);
    }),
  );

  /** Opens the examination record for an appointment (idempotent). */
  app.post(
    "/api/appointments/:id/record",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment || !isAuthor(req, appointment)) return res.status(404).json({ message: "Qabul topilmadi" });
      if (!WRITABLE_APPOINTMENT.has(appointment.status)) {
        return res.status(400).json({ message: "Ko'rik yozuvini faqat qabul boshlangandan keyin ochish mumkin" });
      }
      const existed = await storage.getRecordByAppointment(appointment.id);
      const record =
        existed ??
        (await storage.openRecord(
          {
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            visitId: appointment.visitId,
          },
          { id: req.user!.id, name: req.user!.fullName },
        ));
      if (!existed) {
        await audit(req, "create", "record", record.id, `${patientLabel(appointment)} — ko'rik yozuvi ochildi (${appointment.date} ${appointment.startTime})`);
      }
      res.status(existed ? 200 : 201).json(record);
    }),
  );

  /** Saves draft text (autosave). Refused once signed, or when another tab saved in between. */
  app.patch(
    "/api/records/:id",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const { revision, ...fields } = saveRecordSchema.parse(req.body);
      const before = await storage.getRecord(req.params.id);
      if (!before || !isAuthor(req, before)) return res.status(404).json({ message: "Yozuv topilmadi" });
      if (before.status !== "draft") {
        return res.status(409).json({ message: "Yozuv tasdiqlangan. O'zgartirish uchun \"Tuzatish kiritish\"dan foydalaning" });
      }
      const record = await storage.saveRecordDraft(before.id, revision, fields, { id: req.user!.id, name: req.user!.fullName });
      const changed = changedFields(before, { ...pickFields(before), ...fields });
      if (changed.length && shouldLogDraft(req, record.id)) {
        await audit(req, "update", "record", record.id, `${patientLabel(record)} — ko'rik qoralamasi tahrirlandi (${fieldList(changed)})`);
      }
      res.json(record);
    }),
  );

  /** Signs the draft: from now on the text is locked. */
  app.post(
    "/api/records/:id/sign",
    requirePermission("records.sign"),
    handle(async (req, res) => {
      const { revision } = signRecordSchema.parse(req.body);
      const before = await storage.getRecord(req.params.id);
      if (!before || !isAuthor(req, before)) return res.status(404).json({ message: "Yozuv topilmadi" });
      if (before.status !== "draft") return res.status(409).json({ message: "Yozuv allaqachon tasdiqlangan" });
      const problem = signProblem(before);
      if (problem) return res.status(400).json({ message: `Tasdiqlab bo'lmaydi: ${problem.toLowerCase()}` });
      const record = await storage.signRecord(before.id, revision, { id: req.user!.id, name: req.user!.fullName });
      await audit(
        req,
        "update",
        "record",
        record.id,
        `${patientLabel(record)} — ko'rik yozuvi tasdiqlandi (${record.finalDiagnosis ? "yakuniy tashxis" : "dastlabki tashxis"}: ${record.finalDiagnosis ?? record.preliminaryDiagnosis})`,
      );
      res.json(record);
    }),
  );

  /** Corrects a signed record; the replaced text is kept as a version. */
  app.post(
    "/api/records/:id/amend",
    requirePermission("records.amend"),
    handle(async (req, res) => {
      const { revision, reason, ...fields } = amendRecordSchema.parse(req.body);
      const before = await storage.getRecord(req.params.id);
      if (!before || !isAuthor(req, before)) return res.status(404).json({ message: "Yozuv topilmadi" });
      if (before.status !== "signed") return res.status(409).json({ message: "Qoralamani tuzatish shart emas — uni to'g'ridan-to'g'ri tahrirlang" });
      const changed = changedFields(before, fields);
      if (!changed.length) return res.status(400).json({ message: "Matnda o'zgarish yo'q" });
      const problem = signProblem(fields);
      if (problem) return res.status(400).json({ message: problem });
      const record = await storage.amendRecord(before.id, revision, fields, reason, { id: req.user!.id, name: req.user!.fullName });
      await audit(
        req,
        "update",
        "record",
        record.id,
        `${patientLabel(record)} — tasdiqlangan ko'rik yozuviga tuzatish (v${before.version} → v${record.version}): ${fieldList(changed)}. Sabab: ${reason}`,
      );
      res.json(record);
    }),
  );

  /** The versions a correction replaced, newest first. */
  app.get(
    "/api/records/:id/versions",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const record = await storage.getRecord(req.params.id);
      if (!record || !visibleTo(req)(record)) return res.status(404).json({ message: "Yozuv topilmadi" });
      res.json(await storage.listRecordVersions(record.id));
    }),
  );

  /**
   * Ko'rik xulosasi (TZ §5.2 "ko'rik xulosasini PDF shaklida chiqarish"; B3.8).
   * Only a signed record is a document. Every issue is logged: a medical
   * document leaving the system is exactly what the access trail is for.
   */
  app.get(
    "/api/records/:id/summary",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const record = await storage.getRecord(req.params.id);
      if (!record || !visibleTo(req)(record)) return res.status(404).json({ message: "Yozuv topilmadi" });
      if (record.status !== "signed") {
        return res.status(409).json({ message: "Xulosa faqat tasdiqlangan ko'rik yozuvidan chiqariladi" });
      }
      const [appointment, allergies, referrals, clinic] = await Promise.all([
        storage.getAppointment(record.appointmentId),
        storage.listAllergies(record.patientId).catch((e) => emptyIfMissing(e, [])),
        storage.listReferrals({ appointmentId: record.appointmentId }).catch((e) => emptyIfMissing(e, [] as ReferralWithDetails[])),
        storage.getSettings(),
      ]);
      const summary: VisitSummary = {
        record,
        appointment: appointment ?? null,
        allergies: allergies.filter((a) => a.isActive),
        // A cancelled referral is not part of what the patient was told to do.
        referrals: referrals.filter((r) => r.status !== "cancelled"),
        clinic,
        generatedAt: new Date().toISOString(),
        generatedBy: req.user!.fullName,
      };
      await audit(
        req,
        "export",
        "record",
        record.id,
        `${patientLabel(record)} — ko'rik xulosasi chiqarildi (${record.date}, ${record.doctorName}, v${record.version})`,
      );
      res.json(summary);
    }),
  );

  // -------------------------------------------------- electronic medical card

  /**
   * The electronic medical record (TZ §5.1.2): the person, allergies, every
   * examination, the diagnosis history and lab results — one summary.
   */
  app.get(
    "/api/patients/:id/medical",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      const seesLab = hasPermission(req, "orders.read");

      const seesReferrals = hasPermission(req, "referrals.read");
      const [allergies, records, orders, referrals] = await Promise.all([
        storage.listAllergies(patient.id, { includeInactive: true }).catch((e) => emptyIfMissing(e, [])),
        storage.listRecords({ patientId: patient.id }).catch((e) => emptyIfMissing(e, [])),
        seesLab ? storage.listOrders({ patientId: patient.id }) : Promise.resolve(null),
        seesReferrals
          ? storage.listReferrals({ patientId: patient.id }).catch((e) => emptyIfMissing(e, [] as ReferralWithDetails[]))
          : Promise.resolve(null),
      ]);
      await logPatientView(req, patient, "tibbiy kartasi ochildi");

      const visible = records.filter(visibleTo(req));
      const card: MedicalCard = {
        patient: { ...pickPatient(patient), ageYears: patientAge(patient) },
        allergies,
        records: visible,
        diagnoses: diagnosisHistory(visible),
        labResults: orders ? labResults(orders.items) : null,
        referrals,
      };
      res.json(card);
    }),
  );

  // -------------------------------------------------------------- referrals

  /**
   * Yo'llanma (TZ §5.1.4): the appointment's own doctor sends the patient on —
   * to the lab (the order is created at once and waits for payment at the
   * desk), to an examination from the catalogue, or to a specialist. The two
   * last are booked by the desk.
   */
  app.post(
    "/api/appointments/:id/referrals",
    requirePermission("referrals.create"),
    handle(async (req, res) => {
      const input = createReferralSchema.parse(req.body);
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment || !isAuthor(req, appointment)) return res.status(404).json({ message: "Qabul topilmadi" });
      if (!WRITABLE_APPOINTMENT.has(appointment.status)) {
        return res.status(400).json({ message: "Yo'llanmani faqat qabul boshlangandan keyin berish mumkin" });
      }

      const origin = {
        patientId: appointment.patientId,
        visitId: appointment.visitId,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        note: input.note,
      };
      let batch: NewReferrals;
      if (input.kind === "lab") {
        const catalogue = new Map((await storage.listTests()).map((t) => [t.id, t]));
        const missing = input.testIds.filter((id) => !catalogue.get(id)?.isActive);
        if (missing.length) return res.status(400).json({ message: "Tanlangan tahlillardan biri katalogda yo'q yoki to'xtatilgan" });
        batch = { ...origin, kind: "lab", testIds: input.testIds, referrer: `${appointment.doctorName}, ${appointment.specialty}` };
      } else if (input.kind === "exam") {
        const services = new Map((await storage.listServices()).map((s) => [s.id, s]));
        for (const id of input.serviceIds) {
          const s = services.get(id);
          if (!s || !s.isActive) return res.status(400).json({ message: "Tanlangan tekshiruvlardan biri katalogda yo'q yoki to'xtatilgan" });
          if (!isExamServiceKind(s.kind)) return res.status(400).json({ message: `"${s.name}" tekshiruv emas` });
        }
        batch = { ...origin, kind: "exam", serviceIds: input.serviceIds };
      } else {
        let specialty = input.targetSpecialty;
        if (input.targetDoctorId) {
          const target = await storage.getDoctor(input.targetDoctorId);
          if (!target || !target.isActive || !target.userActive) {
            return res.status(400).json({ message: "Tanlangan shifokor hozir qabul qilmaydi" });
          }
          specialty = target.specialty;
        }
        batch = { ...origin, kind: "consult", targetSpecialty: specialty, targetDoctorId: input.targetDoctorId };
      }

      const made = await storage.createReferrals(batch, { id: req.user!.id, name: req.user!.fullName });
      for (const r of made) {
        await audit(
          req,
          "create",
          "referral",
          r.id,
          `${patientLabel(appointment)} — yo'llanma №${r.referralNumber}: ${REFERRAL_KIND_LABELS[r.kind]} (${referralSubject(r)})${
            r.order ? `, tahlil buyurtmasi #${r.order.orderNumber}` : ""
          }`,
        );
      }
      res.status(201).json(made);
    }),
  );

  /**
   * The desk's and the card's view of referrals. awaiting=1: examinations and
   * consultations no one has booked yet, oldest first — the desk's to-do list.
   */
  app.get(
    "/api/referrals",
    requirePermission("referrals.read"),
    handle(async (req, res) => {
      const patientId = stringParam(req.query.patientId);
      const awaiting = req.query.awaiting === "1";
      if (!patientId && !awaiting) return res.status(400).json({ message: "Bemor yoki holat ko'rsatilishi kerak" });
      const list = await storage
        .listReferrals({ patientId, awaitingBooking: awaiting, limit: awaiting ? 200 : undefined })
        .catch((e) => emptyIfMissing(e, [] as ReferralWithDetails[]));
      res.json(list);
    }),
  );

  /** The issuing doctor, or the desk (referrals.manage), cancels with a reason. */
  app.post(
    "/api/referrals/:id/cancel",
    requirePermission("referrals.create", "referrals.manage"),
    handle(async (req, res) => {
      const { reason } = cancelReferralSchema.parse(req.body);
      const before = await storage.getReferral(req.params.id);
      if (!before) return res.status(404).json({ message: "Yo'llanma topilmadi" });
      const issuer = before.doctorUserId === req.user!.id && hasPermission(req, "referrals.create");
      if (!issuer && !hasPermission(req, "referrals.manage")) {
        return res.status(403).json({ message: "Faqat yo'llanmani bergan shifokor yoki registratura bekor qila oladi" });
      }
      if (before.stage === "done") return res.status(409).json({ message: "Yo'llanma bajarilgan, uni bekor qilib bo'lmaydi" });
      const referral = await storage.cancelReferral(before.id, reason, { id: req.user!.id, name: req.user!.fullName });
      if (!referral) return res.status(404).json({ message: "Yo'llanma topilmadi" });
      await audit(
        req,
        "update",
        "referral",
        referral.id,
        `${patientLabel(referral)} — yo'llanma №${referral.referralNumber} bekor qilindi (${referralSubject(referral)}). Sabab: ${reason}${
          referral.order ? `; tahlil buyurtmasi #${referral.order.orderNumber} ham bekor qilindi` : ""
        }`,
      );
      res.json(referral);
    }),
  );

  // -------------------------------------------------------------- allergies

  app.post(
    "/api/patients/:id/allergies",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const input = insertAllergySchema.parse(req.body);
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      const duplicate = (await storage.listAllergies(patient.id)).find(
        (a) => a.allergen.trim().toLowerCase() === input.allergen.trim().toLowerCase(),
      );
      if (duplicate) return res.status(409).json({ message: `"${duplicate.allergen}" allaqachon ro'yxatda bor` });
      const allergy = await storage.addAllergy(patient.id, input, { id: req.user!.id, name: req.user!.fullName });
      await audit(
        req,
        "create",
        "patient",
        patient.id,
        `${patientLabel(patient)} — allergiya qo'shildi: ${allergy.allergen}${allergy.reaction ? ` (${allergy.reaction})` : ""}`,
      );
      res.status(201).json(allergy);
    }),
  );

  /** An allergy is never deleted — marked inactive, with why. */
  app.post(
    "/api/allergies/:id/deactivate",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const { reason } = removeAllergySchema.parse(req.body);
      const before = await storage.getAllergy(req.params.id);
      if (!before) return res.status(404).json({ message: "Yozuv topilmadi" });
      const allergy = await storage.deactivateAllergy(before.id, reason, { id: req.user!.id, name: req.user!.fullName });
      const patient = await storage.getPatient(before.patientId);
      await audit(
        req,
        "update",
        "patient",
        before.patientId,
        `${patient ? patientLabel(patient) : "Bemor"} — allergiya faol emas deb belgilandi: ${before.allergen}. Sabab: ${reason}`,
      );
      res.json(allergy);
    }),
  );
}

function pickPatient(p: Patient) {
  return {
    id: p.id,
    patientNumber: p.patientNumber,
    fullName: p.fullName,
    phone: p.phone,
    gender: p.gender,
    birthDate: p.birthDate,
    age: p.age,
    address: p.address,
  };
}

/** Every result entered, newest order first. */
function labResults(orders: OrderWithDetails[]): LabResultEntry[] {
  return orders
    .filter((o) => o.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((o) =>
      releasedLines(o.items)
        .map((i) => ({
          orderId: o.id,
          orderNumber: o.orderNumber,
          date: localDay(o.createdAt),
          testName: i.testName,
          result: i.result!,
          unit: i.unit,
          referenceRange: i.referenceRange,
          flag: i.flag,
        })),
    );
}

