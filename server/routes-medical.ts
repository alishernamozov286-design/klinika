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
  amendRecordSchema,
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
} from "@shared/schema";
import { changedFields, diagnosisHistory, fieldList, pickFields, signProblem } from "@shared/medical-record";
import { patientAge } from "@shared/patient-identity";
import { hasPermission, requirePermission } from "./rbac";
import { audit, emptyIfMissing, handle, logPatientView } from "./route-helpers";
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

      const record = await storage.getRecordByAppointment(appointment.id).catch((e) => emptyIfMissing(e, undefined));
      await logPatientView(req, { id: appointment.patientId, patientNumber: appointment.patientNumber, fullName: appointment.patientName }, "ko'rik yozuvi ochildi");

      const data: ExaminationData = {
        appointment,
        record: record && visibleTo(req)(record) ? record : null,
        canWrite: own && hasPermission(req, "records.write") && WRITABLE_APPOINTMENT.has(appointment.status),
        canAmend: own && hasPermission(req, "records.amend"),
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

      const [allergies, records, orders] = await Promise.all([
        storage.listAllergies(patient.id, { includeInactive: true }).catch((e) => emptyIfMissing(e, [])),
        storage.listRecords({ patientId: patient.id }).catch((e) => emptyIfMissing(e, [])),
        seesLab ? storage.listOrders({ patientId: patient.id }) : Promise.resolve(null),
      ]);
      await logPatientView(req, patient, "tibbiy kartasi ochildi");

      const visible = records.filter(visibleTo(req));
      const card: MedicalCard = {
        patient: { ...pickPatient(patient), ageYears: patientAge(patient) },
        allergies,
        records: visible,
        diagnoses: diagnosisHistory(visible),
        labResults: orders ? labResults(orders.items) : null,
      };
      res.json(card);
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
      o.items
        .filter((i) => i.result)
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

