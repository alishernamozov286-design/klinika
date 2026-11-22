/**
 * Statsionar (TZ §8). B6.1: palatalar va yotoqlar.
 *
 *   inpatient.read              the wards and beds board
 *   beds.manage                 wards (bed-day price), beds: add, rename, deactivate, delete
 *   beds.state | beds.manage    a bed's state: ready / cleaning / out of service
 *   admissions.manage           admit a patient, move to another bed, cancel a mistaken stay (B6.2)
 *   admissions.manage | records.write   plan the discharge day (B6.3: the doctor decides it)
 *   inpatient.read + (records.read | inpatient.history | inpatient.observe)   read the case history (B6.4)
 *   inpatient.history           write the case history (each save a new version)
 *   inpatient.observe           daily observations; strike out one's own (records.amend: anyone's)
 *
 * Rules: shared/inpatient.ts.
 */
import type { Express } from "express";
import {
  addBedsSchema,
  admitSchema,
  bedStateSchema,
  dischargePlanSchema,
  insertWardSchema,
  observationSchema,
  saveCaseHistorySchema,
  transferSchema,
  updateBedSchema,
  updateWardSchema,
  voidPaymentSchema,
  type AdmissionView,
  type CaseHistoryView,
} from "@shared/schema";
import { VITALS, VITAL_SPEC, caseChanges, caseTextOf, formatVital, normalizeCase, vitalsProblem, type Vitals } from "@shared/case-history";
import { labResults } from "./routes-medical";
import { ADMISSION_STATUSES, BED_STATE_LABELS, WARD_GENDER_LABELS, buildInpatientOverview, type AdmissionStatus } from "@shared/inpatient";
import { hasPermission } from "./rbac";
import { localDay, todayKey } from "./storage-types";
import { requirePermission } from "./rbac";
import { actorOf, audit, emptyIfMissing, handle, logPatientView, stringParam } from "./route-helpers";
import { storage } from "./storage";

const sum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function registerInpatientRoutes(app: Express) {
  app.get(
    "/api/wards",
    requirePermission("inpatient.read"),
    handle(async (_req, res) => {
      res.json(await storage.listWards().catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.post(
    "/api/wards",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const input = insertWardSchema.parse(req.body);
      const w = await storage.createWard(input, actorOf(req));
      await audit(req, "create", "ward", w.id, `Palata "${w.name}" qo'shildi: ${w.departmentName}${w.floor !== null ? `, ${w.floor}-qavat` : ""}, ${WARD_GENDER_LABELS[w.gender]}, yotoq-kun ${sum(w.dayPrice)}`);
      res.status(201).json(w);
    }),
  );

  app.patch(
    "/api/wards/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const patch = updateWardSchema.parse(req.body);
      const before = await storage.getWard(req.params.id);
      if (!before) return res.status(404).json({ message: "Palata topilmadi" });
      const w = (await storage.updateWard(req.params.id, patch, actorOf(req)))!;
      const changes: string[] = [];
      if (before.name !== w.name) changes.push(`nomi "${before.name}" → "${w.name}"`);
      if (before.departmentId !== w.departmentId) changes.push(`bo'lim ${before.departmentName} → ${w.departmentName}`);
      if (before.floor !== w.floor) changes.push(`qavat ${before.floor ?? "—"} → ${w.floor ?? "—"}`);
      if (before.gender !== w.gender) changes.push(`${WARD_GENDER_LABELS[before.gender]} → ${WARD_GENDER_LABELS[w.gender]}`);
      if (before.dayPrice !== w.dayPrice) changes.push(`yotoq-kun ${sum(before.dayPrice)} → ${sum(w.dayPrice)}`);
      if (before.isActive !== w.isActive) changes.push(w.isActive ? "faollashtirildi" : "faolsizlantirildi");
      if ((before.note ?? "") !== (w.note ?? "")) changes.push("izoh");
      if (changes.length) await audit(req, "update", "ward", w.id, `Palata "${w.name}": ${changes.join(", ")}`);
      res.json(w);
    }),
  );

  app.delete(
    "/api/wards/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const before = await storage.getWard(req.params.id);
      if (!before || !(await storage.deleteWard(req.params.id))) return res.status(404).json({ message: "Palata topilmadi" });
      await audit(req, "delete", "ward", req.params.id, `Palata "${before.name}" (${before.departmentName}) o'chirildi`);
      res.status(204).end();
    }),
  );

  app.post(
    "/api/wards/:id/beds",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const { count } = addBedsSchema.parse(req.body);
      const before = await storage.getWard(req.params.id);
      if (!before) return res.status(404).json({ message: "Palata topilmadi" });
      const w = (await storage.addBeds(req.params.id, count, actorOf(req)))!;
      const added = w.beds.filter((b) => !before.beds.some((x) => x.id === b.id)).map((b) => b.label);
      await audit(req, "create", "bed", w.id, `Palata "${w.name}": ${added.length} ta yotoq qo'shildi (${added.join(", ")})`);
      res.status(201).json(w);
    }),
  );

  app.patch(
    "/api/beds/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const patch = updateBedSchema.parse(req.body);
      const b = await storage.updateBed(req.params.id, patch, actorOf(req));
      if (!b) return res.status(404).json({ message: "Yotoq topilmadi" });
      const parts = [patch.label !== undefined && `raqami ${b.label}`, patch.isActive !== undefined && (b.isActive ? "faollashtirildi" : "faolsizlantirildi"), patch.note !== undefined && "izoh"].filter(Boolean);
      await audit(req, "update", "bed", b.id, `Yotoq ${b.label}: ${parts.join(", ")}`);
      res.json(b);
    }),
  );

  app.post(
    "/api/beds/:id/state",
    requirePermission("beds.state", "beds.manage"),
    handle(async (req, res) => {
      const { state, note } = bedStateSchema.parse(req.body);
      const b = await storage.setBedState(req.params.id, state, note, actorOf(req));
      if (!b) return res.status(404).json({ message: "Yotoq topilmadi" });
      await audit(req, "update", "bed", b.id, `Yotoq ${b.label}: ${BED_STATE_LABELS[state].toLowerCase()}${note ? ` — ${note}` : ""}`);
      res.json(b);
    }),
  );

  app.delete(
    "/api/beds/:id",
    requirePermission("beds.manage"),
    handle(async (req, res) => {
      const ward = (await storage.listWards()).find((w) => w.beds.some((b) => b.id === req.params.id));
      const label = ward?.beds.find((b) => b.id === req.params.id)?.label;
      if (!(await storage.deleteBed(req.params.id))) return res.status(404).json({ message: "Yotoq topilmadi" });
      await audit(req, "delete", "bed", req.params.id, `Palata "${ward?.name ?? "—"}": yotoq ${label ?? "—"} o'chirildi`);
      res.status(204).end();
    }),
  );

  // ------------------------------------------------------------ B6.2 admissions

  const place = (a: AdmissionView) => (a.current ? `palata ${a.current.wardName}, yotoq ${a.current.bedLabel}` : "—");

  app.get(
    "/api/admissions",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      const status = stringParam(req.query.status) as AdmissionStatus | undefined;
      if (status && !ADMISSION_STATUSES.includes(status)) return res.status(400).json({ message: "Noma'lum holat" });
      res.json(await storage.listAdmissions({ status, patientId: stringParam(req.query.patientId) }).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.get(
    "/api/admissions/:id",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      const a = await storage.getAdmission(req.params.id);
      if (!a) return res.status(404).json({ message: "Yotqizish topilmadi" });
      res.json(a);
    }),
  );

  app.post(
    "/api/admissions",
    requirePermission("admissions.manage"),
    handle(async (req, res) => {
      const input = admitSchema.parse(req.body);
      const a = await storage.admitPatient(input, actorOf(req));
      await audit(req, "create", "admission", a.id, `Statsionar karta №${a.number}: №${a.patientNumber} ${a.patientName} yotqizildi — ${a.departmentName}, ${place(a)}; shifokor ${a.doctorName}${a.reason ? `. Sabab: ${a.reason}` : ""}`);
      res.status(201).json(a);
    }),
  );

  app.post(
    "/api/admissions/:id/transfer",
    requirePermission("admissions.manage"),
    handle(async (req, res) => {
      const input = transferSchema.parse(req.body);
      const before = await storage.getAdmission(req.params.id);
      if (!before) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const a = (await storage.transferAdmission(req.params.id, input, actorOf(req)))!;
      await audit(req, "update", "admission", a.id, `Statsionar karta №${a.number} (№${a.patientNumber} ${a.patientName}): ${place(before)} → ${place(a)}${input.note ? `. ${input.note}` : ""}`);
      res.json(a);
    }),
  );

  app.post(
    "/api/admissions/:id/cancel",
    requirePermission("admissions.manage"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const a = await storage.cancelAdmission(req.params.id, reason, actorOf(req));
      if (!a) return res.status(404).json({ message: "Yotqizish topilmadi" });
      await audit(req, "void", "admission", a.id, `Statsionar karta №${a.number} (№${a.patientNumber} ${a.patientName}) bekor qilindi. Sabab: ${reason}`);
      res.json(a);
    }),
  );

  // ------------------------------------------------------------ B6.3 home page

  /** TZ §8.1.1: patients, free and occupied beds, admitted today, leaving by tomorrow, beds to see to — one round. */
  app.get(
    "/api/inpatient/overview",
    requirePermission("inpatient.read"),
    handle(async (_req, res) => {
      const today = todayKey();
      const [wards, active, discharged] = await Promise.all([
        storage.listWards().catch((e) => emptyIfMissing(e, [])),
        storage.listAdmissions({ status: "active" }).catch((e) => emptyIfMissing(e, [])),
        storage.listAdmissions({ status: "discharged", limit: 200 }).catch((e) => emptyIfMissing(e, [])),
      ]);
      const dischargedToday = discharged.filter((a) => a.dischargedAt && localDay(a.dischargedAt) === today).length;
      res.json(buildInpatientOverview(wards, active, dischargedToday, today, localDay));
    }),
  );

  app.post(
    "/api/admissions/:id/discharge-plan",
    requirePermission("admissions.manage", "records.write"),
    handle(async (req, res) => {
      const { date } = dischargePlanSchema.parse(req.body);
      const a = await storage.planDischarge(req.params.id, date, { id: req.user?.id ?? null, name: req.user?.fullName ?? "Tizim" });
      if (!a) return res.status(404).json({ message: "Yotqizish topilmadi" });
      await audit(req, "update", "admission", a.id, `Statsionar karta №${a.number} (№${a.patientNumber} ${a.patientName}): chiqarish ${date ? `rejasi ${date}` : "rejasi olib tashlandi"}`);
      res.json(a);
    }),
  );

  // ------------------------------------------------------------ B6.4 case history

  /** Reading the clinical text: the board alone (registrar, cashier) is not enough. */
  const readsHistory = (req: Parameters<typeof hasPermission>[0]) =>
    hasPermission(req, "records.read") || hasPermission(req, "inpatient.history") || hasPermission(req, "inpatient.observe");

  /** TZ §8.1.3: the history, the daily observations, lab results and examinations of the stay — one read. */
  app.get(
    "/api/admissions/:id/history",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      if (!readsHistory(req)) return res.status(403).json({ message: "Kasallik tarixini ko'rish uchun ruxsatingiz yo'q" });
      const admission = await storage.getAdmission(req.params.id);
      if (!admission) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const seesLab = hasPermission(req, "orders.read");
      const [versions, observations, allergies, orders, records] = await Promise.all([
        storage.listCaseHistory(admission.id).catch((e) => emptyIfMissing(e, [])),
        storage.listObservations(admission.id).catch((e) => emptyIfMissing(e, [])),
        storage.listAllergies(admission.patientId).catch((e) => emptyIfMissing(e, [])),
        seesLab ? storage.listOrders({ patientId: admission.patientId }) : Promise.resolve(null),
        hasPermission(req, "records.read") ? storage.listRecords({ patientId: admission.patientId }).catch((e) => emptyIfMissing(e, [])) : Promise.resolve([]),
      ]);
      // The stay's window: from admission to its close (or now).
      const from = admission.admittedAt;
      const to = admission.dischargedAt ?? admission.cancelledAt ?? new Date().toISOString();
      const within = (t: string) => t >= from && t <= to;
      const firstDay = localDay(from);
      const lastDay = localDay(to);
      const view: CaseHistoryView = {
        admission,
        current: versions[0] ?? null,
        versionCount: versions.length,
        observations,
        allergies,
        labResults: orders ? labResults(orders.items.filter((o) => within(o.createdAt))) : null,
        exams: records
          .filter((r) => r.status === "signed" && r.date >= firstDay && r.date <= lastDay)
          .map((r) => ({
            id: r.id,
            date: r.date,
            title: `${r.specialty} ko'rigi`,
            doctorName: r.doctorName,
            conclusion: r.examination ?? r.recommendations,
            diagnosis: r.finalDiagnosis ?? r.preliminaryDiagnosis,
          })),
        can: {
          write: admission.status === "active" && hasPermission(req, "inpatient.history"),
          observe: admission.status === "active" && hasPermission(req, "inpatient.observe"),
          voidAny: hasPermission(req, "records.amend"),
        },
      };
      await logPatientView(req, { id: admission.patientId, patientNumber: admission.patientNumber, fullName: admission.patientName }, `kasallik tarixi ochildi (statsionar karta №${admission.number})`);
      res.json(view);
    }),
  );

  /** Every earlier wording, newest first — the history dialog. */
  app.get(
    "/api/admissions/:id/history/versions",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      if (!readsHistory(req)) return res.status(403).json({ message: "Kasallik tarixini ko'rish uchun ruxsatingiz yo'q" });
      res.json(await storage.listCaseHistory(req.params.id).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  app.post(
    "/api/admissions/:id/history",
    requirePermission("inpatient.history"),
    handle(async (req, res) => {
      const { baseVersion, ...input } = saveCaseHistorySchema.parse(req.body);
      const text = normalizeCase(input);
      const admission = await storage.getAdmission(req.params.id);
      if (!admission) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const before = (await storage.listCaseHistory(admission.id))[0];
      if (text.diagnosisCode && text.diagnosisCode !== before?.diagnosisCode) {
        const [found] = await storage.getIcd([text.diagnosisCode]).catch((e) => emptyIfMissing(e, []));
        if (!found?.selectable) return res.status(400).json({ message: `MKB-10 katalogida tanlab bo'lmaydigan kod: ${text.diagnosisCode}` });
      }
      const saved = await storage.saveCaseHistory(admission.id, baseVersion, text, actorOf(req));
      if (!saved) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const changed = caseChanges(before ? caseTextOf(before) : null, text);
      await audit(
        req,
        saved.version === 1 ? "create" : "update",
        "admission",
        admission.id,
        `Statsionar karta №${admission.number} (№${admission.patientNumber} ${admission.patientName}): kasallik tarixi, ${saved.version}-versiya — ${changed.join(", ")}`,
      );
      res.status(saved.version === 1 ? 201 : 200).json(saved);
    }),
  );

  app.post(
    "/api/admissions/:id/observations",
    requirePermission("inpatient.observe"),
    handle(async (req, res) => {
      const input = observationSchema.parse(req.body);
      const vitals = Object.fromEntries(VITALS.map((v) => [v, input[v]])) as Vitals;
      const bad = vitalsProblem(vitals);
      if (bad) return res.status(400).json({ message: bad });
      const admission = await storage.getAdmission(req.params.id);
      if (!admission) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const o = await storage.addObservation(
        admission.id,
        { observedAt: input.observedAt ?? new Date().toISOString(), vitals, note: input.note, authorRole: req.user?.roleName ?? null },
        actorOf(req),
      );
      if (!o) return res.status(404).json({ message: "Yotqizish topilmadi" });
      const figures = VITALS.filter((v) => v !== "diastolic" && vitals[v] !== null).map((v) =>
        v === "systolic" ? `AQB ${vitals.systolic}/${vitals.diastolic}` : `${VITAL_SPEC[v].short} ${formatVital(v, vitals[v])}`,
      );
      await audit(
        req,
        "create",
        "admission",
        admission.id,
        `Statsionar karta №${admission.number} (№${admission.patientNumber} ${admission.patientName}): kundalik kuzatuv${figures.length ? ` — ${figures.join(", ")}` : ""}${o.note ? " (izoh bilan)" : ""}`,
      );
      res.status(201).json(o);
    }),
  );

  app.post(
    "/api/observations/:id/void",
    requirePermission("inpatient.observe", "records.amend"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const found = await storage.getObservation(req.params.id);
      if (!found) return res.status(404).json({ message: "Kuzatuv topilmadi" });
      const any = hasPermission(req, "records.amend");
      if (!any && found.authorId !== req.user?.id) return res.status(403).json({ message: "Boshqa xodimning kuzatuvini faqat tuzatish huquqi bor shifokor bekor qiladi" });
      const o = await storage.voidObservation(found.id, reason, any, actorOf(req));
      if (!o) return res.status(404).json({ message: "Kuzatuv topilmadi" });
      const admission = await storage.getAdmission(o.admissionId);
      await audit(
        req,
        "update",
        "admission",
        o.admissionId,
        `Statsionar karta №${admission?.number ?? "?"}: kundalik kuzatuv (${o.authorName ?? "—"}, ${localDay(o.observedAt)}) bekor qilindi — ${reason}`,
      );
      res.json(o);
    }),
  );
}
