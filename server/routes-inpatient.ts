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
 *   procedures.prescribe        order medicines and procedures for a stay, stop an order (B6.5)
 *   procedures.perform          mark a dose done / not done, put a mistaken mark back
 *   procedures.prescribe        order lab tests from the case history (B6.6; the order joins the stay's bill)
 *   inpatient.read + (payments.create | finance.view)   the stay's charge: bed-days, procedures, paid, owed
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
  inpatientOrderSchema,
  observationSchema,
  stayLabOrderSchema,
  taskMarkSchema,
  taskReasonSchema,
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
import { ADMIN_ROUTE_LABELS } from "@shared/prescription";
import { ORDER_NOTHING_AHEAD, TASK_STATUS_LABELS, addDays, normalizeTimes, orderProblem, planSlots, sortTasks } from "@shared/procedures";
import type { InpatientOrderView, ProcedureTaskView } from "@shared/schema";
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
    hasPermission(req, "records.read") ||
    hasPermission(req, "inpatient.history") ||
    hasPermission(req, "inpatient.observe") ||
    hasPermission(req, "procedures.prescribe") ||
    hasPermission(req, "procedures.perform");

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

  // ------------------------------------------------------------ B6.5 orders and procedures

  /** A local day and time as an instant — the server runs in the clinic's zone (as localDay does). */
  const localAt = (day: string, time: string) => new Date(`${day}T${time}:00`);
  const orderLabel = (o: Pick<InpatientOrderView, "name" | "dose" | "route" | "times" | "days">) =>
    `${o.name}${o.dose ? ` ${o.dose}` : ""}${o.route ? `, ${ADMIN_ROUTE_LABELS[o.route as keyof typeof ADMIN_ROUTE_LABELS]?.toLowerCase() ?? o.route}` : ""} — ${o.times.join(", ")}, ${o.days} kun`;
  const taskLabel = (t: ProcedureTaskView) =>
    `Statsionar karta №${t.admissionNumber} (№${t.patientNumber} ${t.patientName}): ${t.name}${t.dose ? ` ${t.dose}` : ""}, ${localDay(t.plannedAt)} ${new Date(t.plannedAt).toTimeString().slice(0, 5)}`;

  app.get(
    "/api/admissions/:id/orders",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      if (!readsHistory(req)) return res.status(403).json({ message: "Tayinlovlarni ko'rish uchun ruxsatingiz yo'q" });
      res.json(await storage.listInpatientOrders(req.params.id).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  /** TZ §8.1.4: the doctor orders; the whole schedule is written at once. */
  app.post(
    "/api/admissions/:id/orders",
    requirePermission("procedures.prescribe"),
    handle(async (req, res) => {
      const input = inpatientOrderSchema.parse(req.body);
      const admission = await storage.getAdmission(req.params.id);
      if (!admission) return res.status(404).json({ message: "Yotqizish topilmadi" });
      let name = input.name;
      // B6.6: a procedure from the service list bills at its price as ordered; anything written by hand is not billed.
      let unitPrice: number | null = null;
      // A catalogue line takes its name from the catalogue; the wrong catalogue for the kind is refused.
      if (input.kind === "medicine") {
        if (input.serviceId) return res.status(400).json({ message: "Dori xizmatlar katalogidan tanlanmaydi" });
        if (input.itemId) {
          const item = await storage.getInventoryItem(input.itemId);
          if (!item || item.kind !== "medicine" || !item.isActive) return res.status(400).json({ message: "Dori ombor katalogida topilmadi yoki faol emas" });
          name = item.name;
          // B6.6b: a stocked medicine says how much of it one dose takes; it bills at the sale price.
          if (!input.issueQty) return res.status(400).json({ message: `Bir dozaga ombordan qancha ketishini kiriting (${item.unit})` });
          unitPrice = item.salePrice !== null && item.salePrice !== undefined ? Math.round(item.salePrice * input.issueQty) : null;
        } else if (input.issueQty) {
          return res.status(400).json({ message: "Ombordan miqdor faqat katalogdagi dori uchun" });
        }
      } else {
        if (input.itemId || input.issueQty) return res.status(400).json({ message: "Muolaja ombor katalogidan tanlanmaydi" });
        if (input.serviceId) {
          const service = await storage.getService(input.serviceId);
          if (!service || service.kind !== "muolaja" || !service.isActive) return res.status(400).json({ message: "Muolaja xizmatlar katalogida topilmadi yoki faol emas" });
          name = service.name;
          unitPrice = service.price;
        }
      }
      const plan = { ...input, name, unitPrice, times: normalizeTimes(input.times) };
      const problem = orderProblem(plan, todayKey(), localDay(admission.admittedAt));
      if (problem) return res.status(400).json({ message: problem });
      const slots = planSlots(plan, new Date(), localAt).map((d) => d.toISOString());
      if (slots.length === 0) return res.status(400).json({ message: ORDER_NOTHING_AHEAD });
      const o = await storage.createInpatientOrder(admission.id, plan, slots, actorOf(req));
      if (!o) return res.status(404).json({ message: "Yotqizish topilmadi" });
      await audit(req, "create", "admission", admission.id, `Statsionar karta №${admission.number} (№${admission.patientNumber} ${admission.patientName}): tayinlov — ${orderLabel(o)}, ${o.tasks.length} ta muolaja`);
      res.status(201).json(o);
    }),
  );

  app.post(
    "/api/inpatient-orders/:id/stop",
    requirePermission("procedures.prescribe"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const o = await storage.stopInpatientOrder(req.params.id, reason, actorOf(req));
      if (!o) return res.status(404).json({ message: "Tayinlov topilmadi" });
      const admission = await storage.getAdmission(o.admissionId);
      await audit(req, "update", "admission", o.admissionId, `Statsionar karta №${admission?.number ?? "?"}: tayinlov to'xtatildi — ${o.name}: ${reason}`);
      res.json(o);
    }),
  );

  /** The nurse's list: every dose of a local day on the stays in hospital, overdue first. */
  app.get(
    "/api/procedure-tasks",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      if (!readsHistory(req)) return res.status(403).json({ message: "Muolajalarni ko'rish uchun ruxsatingiz yo'q" });
      const day = stringParam(req.query.day) ?? todayKey();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ message: "Kunni to'g'ri kiriting" });
      const rows = await storage
        .listProcedureTasks({ from: localAt(day, "00:00").toISOString(), to: localAt(addDays(day, 1), "00:00").toISOString(), admissionId: stringParam(req.query.admissionId) ?? undefined })
        .catch((e) => emptyIfMissing(e, []));
      res.json(sortTasks(rows));
    }),
  );

  const markTask = (status: "done" | "missed") =>
    handle(async (req, res) => {
      const note = status === "done" ? taskMarkSchema.parse(req.body).note : taskReasonSchema.parse(req.body).reason;
      const t = await storage.markProcedureTask(req.params.id, { status, note }, actorOf(req));
      if (!t) return res.status(404).json({ message: "Muolaja topilmadi" });
      // B6.6b: what the dose took from the warehouse, and any shortage left for the storekeeper.
      const short = t.stock ? Math.max(0, t.stock.quantity - t.stock.posted) : 0;
      const stock = t.stock ? `; ombordan ${t.stock.posted} ${t.stock.unit}${short > 1e-6 ? ` (kamomad ${Number(short.toFixed(3))} ${t.stock.unit})` : ""}` : "";
      await audit(req, "update", "admission", t.admissionId, `${taskLabel(t)} — ${TASK_STATUS_LABELS[status].toLowerCase()}${note ? `: ${note}` : ""}${stock}`);
      res.json(t);
    });
  app.post("/api/procedure-tasks/:id/done", requirePermission("procedures.perform"), markTask("done"));
  app.post("/api/procedure-tasks/:id/missed", requirePermission("procedures.perform"), markTask("missed"));

  app.post(
    "/api/procedure-tasks/:id/revert",
    requirePermission("procedures.perform"),
    handle(async (req, res) => {
      const { reason } = taskReasonSchema.parse(req.body);
      const before = await storage.getProcedureTask(req.params.id);
      if (!before) return res.status(404).json({ message: "Muolaja topilmadi" });
      const t = await storage.revertProcedureTask(before.id, reason, actorOf(req));
      if (!t) return res.status(404).json({ message: "Muolaja topilmadi" });
      await audit(req, "update", "admission", t.admissionId, `${taskLabel(t)} — "${TASK_STATUS_LABELS[before.status].toLowerCase()}" belgisi qaytarildi: ${reason}`);
      res.json(t);
    }),
  );

  // ------------------------------------------------------------ B6.6 the stay and the cash desk

  /** What the stay has run up: bed-days per ward, procedures done, what was paid and what is owed. Money needs a money permission. */
  app.get(
    "/api/admissions/:id/charge",
    requirePermission("inpatient.read"),
    handle(async (req, res) => {
      if (!hasPermission(req, "payments.create") && !hasPermission(req, "finance.view")) return res.status(403).json({ message: "Statsionar hisobini ko'rish uchun ruxsatingiz yo'q" });
      const found = await storage.getStayCharge(req.params.id);
      if (!found) return res.status(404).json({ message: "Yotqizish topilmadi" });
      res.json({ ...found, due: Math.max(0, found.charge.amount - found.paid), credit: Math.max(0, found.paid - found.charge.amount) });
    }),
  );

  /** TZ §8.2: "Laboratoriya natijalari shu kartaga biriktiriladi" — the doctor orders lab tests from the case history. */
  app.post(
    "/api/admissions/:id/lab-orders",
    requirePermission("procedures.prescribe"),
    handle(async (req, res) => {
      const { testIds, note } = stayLabOrderSchema.parse(req.body);
      const admission = await storage.getAdmission(req.params.id);
      if (!admission) return res.status(404).json({ message: "Yotqizish topilmadi" });
      if (admission.status !== "active") return res.status(409).json({ message: "Statsionar karta yopilgan — buyurtma berib bo'lmaydi" });
      if (!admission.visitId) return res.status(409).json({ message: "Statsionar kartaning hisobvarag'i yo'q — avval npm run db:stay-billing" });
      const order = await storage.createOrder({
        patientId: admission.patientId,
        testIds,
        discount: 0,
        paidAmount: 0,
        notes: [`Statsionar karta №${admission.number}`, note].filter(Boolean).join(" — "),
        referrer: req.user?.fullName ?? null,
        createdBy: req.user?.id ?? null,
        visitId: admission.visitId,
        admissionId: admission.id,
      });
      await audit(
        req,
        "create",
        "order",
        order.id,
        `Statsionar karta №${admission.number} (№${admission.patientNumber} ${admission.patientName}): laboratoriya buyurtmasi #${order.orderNumber} — ${order.items.map((i) => i.testName).join(", ")}`,
      );
      res.status(201).json(order);
    }),
  );
}
