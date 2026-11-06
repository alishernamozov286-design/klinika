import { randomUUID } from "crypto";
import { defaultTests, testReferences } from "@shared/tests-data";
import { computeFlag } from "@shared/reference-range";
import type {
  AuditEntry,
  CreatePaymentInput,
  Department,
  DepartmentWithUsage,
  Doctor,
  DoctorWithDetails,
  InsertDepartment,
  InsertDoctor,
  DashboardStatsData,
  Expense,
  ExpenseSummary,
  InsertExpense,
  Payment,
  InsertPatient,
  InsertTest,
  InsertUser,
  LabSettings,
  LabSettingsInput,
  Order,
  OrderListResponse,
  OrderTest,
  OrderWithDetails,
  Patient,
  PatientCard,
  PatientContact,
  PatientDetails,
  PatientListItem,
  PublicUser,
  RevenueReportData,
  RoleRecord,
  RoleWithUsage,
  Sample,
  SecuritySettings,
  TelegramContact,
  Test,
  UpdateDepartmentInput,
  UpdateDoctorInput,
  UpdateExpenseInput,
  UpdateOrderInput,
  UpdateRoleInput,
  UpdateSampleInput,
  UpdateUserInput,
  User,
  UserMfa,
  Service,
  ServiceWithDetails,
  InsertService,
  UpdateServiceInput,
  Appointment,
  AppointmentWithDetails,
  MedicalRecord,
  MedicalRecordVersion,
  MedicalRecordWithDetails,
  PatientAllergy,
  RecordFields,
  Visit,
} from "@shared/schema";
import { DEFAULT_SECURITY_SETTINGS, daysBetween, nationalPhoneDigits, previousRange } from "@shared/schema";
import { nameKey, patientAge } from "@shared/patient-identity";
import { nextQueueNumber } from "@shared/appointment";
import { canTransition, parseBarcode, sampleBarcode, transitionError } from "@shared/sample";
import { type DbShape, readDbSync, writeDb } from "./db";
import { hashPassword } from "./password";
import { LEGACY_ADMIN, SUPER_ADMIN, SYSTEM_ROLES } from "@shared/permissions";
import {
  SEED_USERS,
  ATTENDED_STATUSES,
  buildPatientCard,
  byActiveThenName,
  sortRoles,
  type CreateRoleArgs,
  type SeedResult,
  localDay,
  todayKey,
  type Actor,
  StorageConflict,
  type AppointmentQuery,
  type AppointmentStatusChange,
  type BookingCheck,
  type NewAppointment,
  type OpenRecordInput,
  type RecordQuery,
  type AuditInput,
  type AuditQuery,
  type CreateOrderArgs,
  type ExpenseQuery,
  type IStorage,
  type OrderQuery,
  type Paged,
  type PatientCandidateQuery,
  type PatientQuery,
  type ResultInput,
  resolveFlag,
} from "./storage-types";
import type { LockState } from "@shared/lockout";

function contains(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle);
}

const digitsOf = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/**
 * Phone match that ignores formatting: "901234567" has to find the stored
 * "+998 90 123 45 67". Below three digits the query is too loose to be useful.
 */
function phoneContains(phone: string | null | undefined, search: string): boolean {
  const needle = digitsOf(search);
  return needle.length >= 3 && digitsOf(phone).includes(needle);
}

/**
 * A search that is nothing but a number is a lookup by patient/order number:
 * "14", "#14" and " 14 " all mean the same ticket.
 */
function asNumberSearch(search: string): number | null {
  const match = search.trim().match(/^#?\s*(\d{1,9})$/);
  return match ? Number(match[1]) : null;
}

/** Still has at least one line item without a result. */
function isWaiting(order: OrderWithDetails): boolean {
  return order.items.some((i) => !i.result);
}

/** Every line item is filled in — the blank can be printed. */
function isReady(order: OrderWithDetails): boolean {
  return order.items.length > 0 && order.items.every((i) => i.result);
}

/** Zero-setup fallback used when DATABASE_URL is not configured. */
const copyRole = (r: RoleRecord): RoleRecord => ({ ...r, permissions: [...r.permissions] });

/** Patients saved before birth date / documents / edit stamps existed. */
const normalizePatient = (p: Patient): Patient => ({
  ...p,
  birthDate: p.birthDate ?? null,
  passport: p.passport ?? null,
  pinfl: p.pinfl ?? null,
  updatedAt: p.updatedAt ?? null,
  updatedBy: p.updatedBy ?? null,
});

/**
 * Expenses saved before the method/payee/status columns existed come back
 * with those fields missing; they were all cash and all active.
 */
const normalizeExpense = (e: Partial<Expense> & Pick<Expense, "id" | "category" | "amount" | "spentOn" | "createdAt">): Expense => ({
  note: null,
  createdBy: null,
  createdByName: null,
  ...e,
  method: e.method ?? "naqd",
  payee: e.payee ?? null,
  status: e.status ?? "active",
  cancelledAt: e.cancelledAt ?? null,
  cancelledBy: e.cancelledBy ?? null,
  cancelledByName: e.cancelledByName ?? null,
  cancelReason: e.cancelReason ?? null,
  updatedAt: e.updatedAt ?? null,
  updatedBy: e.updatedBy ?? null,
});

export class FileStorage implements IStorage {
  private db: DbShape;

  constructor() {
    this.db = readDbSync();
  }

  private persist(): Promise<void> {
    return writeDb(this.db);
  }

  async seed(): Promise<SeedResult> {
    let createdTests = 0;
    if (this.db.tests.length === 0) {
      this.db.tests = defaultTests.map((t) => {
        const ref = testReferences[t.id];
        return {
          id: t.id,
          name: t.name,
          price: t.price,
          category: t.category,
          unit: ref?.unit ?? null,
          referenceRange: ref?.referenceRange ?? null,
          isActive: true,
        };
      });
      createdTests = this.db.tests.length;
    }

    let createdUsers = 0;
    if (this.db.users.length === 0) {
      for (const u of SEED_USERS) {
        this.db.users.push({
          id: randomUUID(),
          username: u.username,
          password: await hashPassword(u.password),
          fullName: u.fullName,
          role: u.role,
          isActive: true,
          createdAt: new Date().toISOString(),
          failedAttempts: 0,
          lockedUntil: null,
          lockLevel: 0,
          lastFailedAt: null,
        });
      }
      createdUsers = SEED_USERS.length;
    }

    const numbered = this.backfillPatientNumbers();
    const visited = this.backfillVisits();

    let createdRoles = 0;
    const now = new Date().toISOString();
    for (const def of SYSTEM_ROLES) {
      if (this.db.roles.some((r) => r.key === def.key)) continue;
      this.db.roles.push({
        key: def.key,
        name: def.name,
        description: def.description,
        permissions: [...def.permissions],
        isSystem: true,
        createdAt: now,
        updatedAt: null,
        updatedBy: null,
      });
      createdRoles++;
    }

    let migratedAdmins = 0;
    for (const u of this.db.users) {
      if (u.role === LEGACY_ADMIN) {
        u.role = SUPER_ADMIN;
        migratedAdmins++;
      }
    }

    if (createdTests || createdUsers || numbered || createdRoles || migratedAdmins || visited) await this.persist();
    return { createdTests, createdUsers, createdRoles, migratedAdmins };
  }

  // ---------------------------------------------------------------- roles

  async listRoles(): Promise<RoleWithUsage[]> {
    const counts = new Map<string, number>();
    for (const u of this.db.users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    return sortRoles(this.db.roles).map((r) => ({ ...copyRole(r), userCount: counts.get(r.key) ?? 0 }));
  }

  /**
   * Roles are handed out as copies. The routes read a role, update it, then
   * diff the two for the audit log; returning the stored object itself made
   * "before" change along with the update and the diff come out empty.
   */
  async getRole(key: string): Promise<RoleRecord | undefined> {
    const role = this.db.roles.find((r) => r.key === key);
    return role && copyRole(role);
  }

  async createRole(input: CreateRoleArgs, actor: Actor): Promise<RoleRecord> {
    if (this.db.roles.some((r) => r.key === input.key)) {
      throw new Error("Bu kalitli rol allaqachon mavjud");
    }
    const role: RoleRecord = {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      permissions: [...input.permissions],
      isSystem: input.isSystem ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.roles.push(role);
    await this.persist();
    return copyRole(role);
  }

  async updateRole(key: string, input: UpdateRoleInput, actor: Actor): Promise<RoleRecord | undefined> {
    const role = this.db.roles.find((r) => r.key === key);
    if (!role) return undefined;
    if (input.name !== undefined) role.name = input.name;
    if (input.description !== undefined) role.description = input.description ?? null;
    if (input.permissions !== undefined) role.permissions = [...input.permissions];
    role.updatedAt = new Date().toISOString();
    role.updatedBy = actor.id;
    await this.persist();
    return copyRole(role);
  }

  async deleteRole(key: string): Promise<boolean> {
    const role = this.db.roles.find((r) => r.key === key);
    if (!role || role.isSystem) return false;
    this.db.roles = this.db.roles.filter((r) => r.key !== key);
    await this.persist();
    return true;
  }

  // ---------------------------------------------------------- departments

  async listDepartments(): Promise<DepartmentWithUsage[]> {
    return this.db.departments
      .map((d) => ({ ...d, doctorCount: this.db.doctors.filter((doc) => doc.departmentId === d.id).length }))
      .sort(byActiveThenName((d) => d.name));
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const d = this.db.departments.find((x) => x.id === id);
    return d && { ...d };
  }

  async createDepartment(input: InsertDepartment, actor: Actor): Promise<Department> {
    const dept: Department = {
      id: randomUUID(),
      name: input.name,
      kind: input.kind,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.departments.push(dept);
    await this.persist();
    return { ...dept };
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput, actor: Actor): Promise<Department | undefined> {
    const d = this.db.departments.find((x) => x.id === id);
    if (!d) return undefined;
    if (input.name !== undefined) d.name = input.name;
    if (input.kind !== undefined) d.kind = input.kind;
    if (input.description !== undefined) d.description = input.description ?? null;
    if (input.isActive !== undefined) d.isActive = input.isActive;
    d.updatedAt = new Date().toISOString();
    d.updatedBy = actor.id;
    await this.persist();
    return { ...d };
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const before = this.db.departments.length;
    this.db.departments = this.db.departments.filter((d) => d.id !== id);
    if (this.db.departments.length === before) return false;
    await this.persist();
    return true;
  }

  // -------------------------------------------------------------- doctors

  private doctorDetails(doc: Doctor): DoctorWithDetails {
    const user = this.db.users.find((u) => u.id === doc.userId);
    const dept = doc.departmentId ? this.db.departments.find((d) => d.id === doc.departmentId) : undefined;
    return {
      ...doc,
      schedule: doc.schedule.map((s) => ({ ...s })),
      fullName: user?.fullName ?? "—",
      username: user?.username ?? "",
      userActive: user?.isActive ?? false,
      departmentName: dept?.name ?? null,
    };
  }

  async listDoctors(opts: { activeOnly?: boolean; departmentId?: string } = {}): Promise<DoctorWithDetails[]> {
    return this.db.doctors
      .filter((d) => !opts.activeOnly || d.isActive)
      .filter((d) => !opts.departmentId || d.departmentId === opts.departmentId)
      .map((d) => this.doctorDetails(d))
      .filter((d) => !opts.activeOnly || d.userActive)
      .sort(byActiveThenName((d) => d.fullName));
  }

  async getDoctor(id: string): Promise<DoctorWithDetails | undefined> {
    const doc = this.db.doctors.find((d) => d.id === id);
    return doc && this.doctorDetails(doc);
  }

  async getDoctorByUser(userId: string): Promise<DoctorWithDetails | undefined> {
    const doc = this.db.doctors.find((d) => d.userId === userId);
    return doc && this.doctorDetails(doc);
  }

  async createDoctor(input: InsertDoctor, actor: Actor): Promise<DoctorWithDetails> {
    if (this.db.doctors.some((d) => d.userId === input.userId)) {
      throw new Error("Bu xodimning shifokor profili allaqachon bor");
    }
    const doc: Doctor = {
      id: randomUUID(),
      userId: input.userId,
      departmentId: input.departmentId ?? null,
      specialty: input.specialty,
      room: input.room ?? null,
      consultationPrice: input.consultationPrice,
      slotMinutes: input.slotMinutes,
      schedule: input.schedule.map((s) => ({ ...s })),
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.doctors.push(doc);
    await this.persist();
    return this.doctorDetails(doc);
  }

  async updateDoctor(id: string, input: UpdateDoctorInput, actor: Actor): Promise<DoctorWithDetails | undefined> {
    const doc = this.db.doctors.find((d) => d.id === id);
    if (!doc) return undefined;
    if (input.departmentId !== undefined) doc.departmentId = input.departmentId ?? null;
    if (input.specialty !== undefined) doc.specialty = input.specialty;
    if (input.room !== undefined) doc.room = input.room ?? null;
    if (input.consultationPrice !== undefined) doc.consultationPrice = input.consultationPrice;
    if (input.slotMinutes !== undefined) doc.slotMinutes = input.slotMinutes;
    if (input.schedule !== undefined) doc.schedule = input.schedule.map((s) => ({ ...s }));
    if (input.isActive !== undefined) doc.isActive = input.isActive;
    doc.updatedAt = new Date().toISOString();
    doc.updatedBy = actor.id;
    await this.persist();
    return this.doctorDetails(doc);
  }

  // ------------------------------------------------------------- services

  private serviceDetails(svc: Service): ServiceWithDetails {
    const dept = svc.departmentId ? this.db.departments.find((d) => d.id === svc.departmentId) : undefined;
    return {
      ...svc,
      departmentName: dept?.name ?? null,
      appointmentCount: this.db.appointments.filter((a) => a.serviceId === svc.id).length,
    };
  }

  async listServices(opts: { activeOnly?: boolean } = {}): Promise<ServiceWithDetails[]> {
    return this.db.services
      .filter((x) => !opts.activeOnly || x.isActive)
      .map((x) => this.serviceDetails(x))
      .sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
      );
  }

  async getService(id: string): Promise<Service | undefined> {
    const svc = this.db.services.find((x) => x.id === id);
    return svc && { ...svc };
  }

  async createService(input: InsertService, actor: Actor): Promise<ServiceWithDetails> {
    const svc: Service = {
      id: randomUUID(),
      name: input.name,
      kind: input.kind,
      departmentId: input.departmentId ?? null,
      price: input.price,
      durationMinutes: input.durationMinutes ?? null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: null,
    };
    this.db.services.push(svc);
    await this.persist();
    return this.serviceDetails(svc);
  }

  async updateService(id: string, input: UpdateServiceInput, actor: Actor): Promise<ServiceWithDetails | undefined> {
    const svc = this.db.services.find((x) => x.id === id);
    if (!svc) return undefined;
    if (input.name !== undefined) svc.name = input.name;
    if (input.kind !== undefined) svc.kind = input.kind;
    if (input.departmentId !== undefined) svc.departmentId = input.departmentId ?? null;
    if (input.price !== undefined) svc.price = input.price;
    if (input.durationMinutes !== undefined) svc.durationMinutes = input.durationMinutes ?? null;
    if (input.description !== undefined) svc.description = input.description ?? null;
    if (input.isActive !== undefined) svc.isActive = input.isActive;
    svc.updatedAt = new Date().toISOString();
    svc.updatedBy = actor.id;
    await this.persist();
    return this.serviceDetails(svc);
  }

  async deleteService(id: string): Promise<boolean> {
    const before = this.db.services.length;
    this.db.services = this.db.services.filter((x) => x.id !== id);
    if (this.db.services.length === before) return false;
    await this.persist();
    return true;
  }

  // --------------------------------------------------------- appointments

  private appointmentDetails(a: Appointment): AppointmentWithDetails {
    const patient = this.db.patients.find((p) => p.id === a.patientId);
    const doctor = this.db.doctors.find((d) => d.id === a.doctorId);
    const user = doctor ? this.db.users.find((u) => u.id === doctor.userId) : undefined;
    const dept = doctor?.departmentId ? this.db.departments.find((d) => d.id === doctor.departmentId) : undefined;
    const svc = a.serviceId ? this.db.services.find((x) => x.id === a.serviceId) : undefined;
    return {
      ...a,
      patientNumber: patient?.patientNumber ?? 0,
      patientName: patient?.fullName ?? "—",
      patientPhone: patient?.phone ?? "",
      patientBirthDate: patient?.birthDate ?? null,
      patientAge: patientAge(patient),
      patientGender: patient?.gender ?? null,
      doctorName: user?.fullName ?? "—",
      doctorUserId: doctor?.userId ?? "",
      specialty: doctor?.specialty ?? "",
      room: doctor?.room ?? null,
      departmentName: dept?.name ?? null,
      serviceName: svc?.name ?? null,
    };
  }

  async listAppointments(q: AppointmentQuery): Promise<AppointmentWithDetails[]> {
    const list = this.db.appointments.filter(
      (a) =>
        (!q.date || a.date === q.date) &&
        (!q.beforeDate || a.date < q.beforeDate) &&
        (!q.doctorId || a.doctorId === q.doctorId) &&
        (!q.patientId || a.patientId === q.patientId) &&
        (!q.statuses?.length || q.statuses.includes(a.status)),
    );
    list.sort((a, b) =>
      q.patientId
        ? b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)
        : a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber,
    );
    return list.slice(0, Math.min(q.limit ?? 500, 2000)).map((a) => this.appointmentDetails(a));
  }

  async getAppointment(id: string): Promise<AppointmentWithDetails | undefined> {
    const a = this.db.appointments.find((x) => x.id === id);
    return a && this.appointmentDetails(a);
  }

  private dayBookings(doctorId: string, date: string): Appointment[] {
    return this.db.appointments.filter((a) => a.doctorId === doctorId && a.date === date).map((a) => ({ ...a }));
  }

  async createAppointment(input: NewAppointment, actor: Actor, check: BookingCheck): Promise<AppointmentWithDetails> {
    // Check and push happen without an await in between: on this
    // single-process store nothing else can run in that gap.
    const day = this.dayBookings(input.doctorId, input.date);
    const problem = check(day);
    if (problem) throw new StorageConflict(problem);
    const a: Appointment = {
      id: randomUUID(),
      patientId: input.patientId,
      doctorId: input.doctorId,
      serviceId: input.serviceId ?? null,
      visitId: null,
      date: input.date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      queueNumber: nextQueueNumber(day.map((x) => x.queueNumber)),
      status: "scheduled",
      price: input.price,
      reason: input.reason ?? null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: null,
    };
    this.db.appointments.push(a);
    await this.persist();
    return this.appointmentDetails(a);
  }

  async rescheduleAppointment(
    id: string,
    patch: { doctorId: string; date: string; startTime: string; durationMinutes: number; serviceId: string | null; price: number; reason: string | null },
    actor: Actor,
    check: BookingCheck,
  ): Promise<AppointmentWithDetails> {
    const a = this.db.appointments.find((x) => x.id === id);
    if (!a) throw new StorageConflict("Qabul topilmadi");
    if (a.status !== "scheduled") throw new StorageConflict("Faqat \"yozildi\" holatidagi qabulni ko'chirish mumkin");
    const day = this.dayBookings(patch.doctorId, patch.date);
    const problem = check(day);
    if (problem) throw new StorageConflict(problem);
    const sameQueue = a.doctorId === patch.doctorId && a.date === patch.date;
    Object.assign(a, {
      doctorId: patch.doctorId,
      date: patch.date,
      startTime: patch.startTime,
      durationMinutes: patch.durationMinutes,
      serviceId: patch.serviceId,
      price: patch.price,
      reason: patch.reason,
      queueNumber: sameQueue ? a.queueNumber : nextQueueNumber(day.map((x) => x.queueNumber)),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    });
    await this.persist();
    return this.appointmentDetails(a);
  }

  async setAppointmentStatus(id: string, change: AppointmentStatusChange, actor: Actor): Promise<AppointmentWithDetails> {
    const a = this.db.appointments.find((x) => x.id === id);
    if (!a || a.status !== change.from) {
      throw new StorageConflict("Qabul holati boshqa joyda o'zgartirilgan. Sahifani yangilang");
    }
    const now = new Date().toISOString();
    switch (change.to) {
      case "arrived":
        if (change.from !== "in_progress") {
          a.arrivedAt = now;
          a.visitId = this.ensureVisit(a.patientId, todayKey(), actor.id).id;
        }
        break;
      case "in_progress":
        a.startedAt = now;
        break;
      case "completed":
        a.completedAt = now;
        break;
      case "cancelled":
        a.cancelledAt = now;
        a.cancelledBy = actor.id;
        a.cancelReason = change.reason ?? null;
        break;
      case "scheduled":
        a.arrivedAt = null;
        a.visitId = null;
        break;
    }
    a.status = change.to;
    a.updatedAt = now;
    a.updatedBy = actor.id;
    await this.persist();
    return this.appointmentDetails(a);
  }

  async doctorHasAppointments(doctorId: string): Promise<boolean> {
    return this.db.appointments.some((a) => a.doctorId === doctorId);
  }

  // ---------------------------------------------------- examination records

  private recordDetails(r: MedicalRecord): MedicalRecordWithDetails {
    const doctor = this.db.doctors.find((d) => d.id === r.doctorId);
    const user = doctor ? this.db.users.find((u) => u.id === doctor.userId) : undefined;
    const appt = this.db.appointments.find((a) => a.id === r.appointmentId);
    const signer = r.signedBy ? this.db.users.find((u) => u.id === r.signedBy) : undefined;
    const patient = this.db.patients.find((p) => p.id === r.patientId);
    return {
      ...r,
      patientNumber: patient?.patientNumber ?? 0,
      patientName: patient?.fullName ?? "—",
      doctorName: user?.fullName ?? "—",
      doctorUserId: doctor?.userId ?? "",
      specialty: doctor?.specialty ?? "",
      date: appt?.date ?? r.createdAt.slice(0, 10),
      startTime: appt?.startTime ?? "",
      signedByName: signer?.fullName ?? null,
    };
  }

  /** Same wording as the Postgres store: "already signed", else "saved elsewhere". */
  private recordConflict(status?: MedicalRecord["status"]): StorageConflict {
    return new StorageConflict(
      status === "signed"
        ? "Yozuv allaqachon tasdiqlangan. Sahifani yangilang"
        : "Yozuv boshqa oynada o'zgartirilgan. Sahifani yangilang — oxirgi saqlangan matn ko'rinadi",
    );
  }

  async listRecords(q: RecordQuery): Promise<MedicalRecordWithDetails[]> {
    return this.db.medicalRecords
      .filter(
        (r) =>
          (!q.patientId || r.patientId === q.patientId) &&
          (!q.appointmentIds || q.appointmentIds.includes(r.appointmentId)) &&
          (!q.doctorId || r.doctorId === q.doctorId) &&
          (!q.status || r.status === q.status),
      )
      .map((r) => this.recordDetails(r))
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime) || b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, Math.min(q.limit ?? 500, 2000));
  }

  async getRecord(id: string): Promise<MedicalRecordWithDetails | undefined> {
    const r = this.db.medicalRecords.find((x) => x.id === id);
    return r && this.recordDetails({ ...r });
  }

  async getRecordByAppointment(appointmentId: string): Promise<MedicalRecordWithDetails | undefined> {
    const r = this.db.medicalRecords.find((x) => x.appointmentId === appointmentId);
    return r && this.recordDetails({ ...r });
  }

  async openRecord(input: OpenRecordInput, actor: Actor): Promise<MedicalRecordWithDetails> {
    const existing = this.db.medicalRecords.find((r) => r.appointmentId === input.appointmentId);
    if (existing) return this.recordDetails({ ...existing });
    const r: MedicalRecord = {
      id: randomUUID(),
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      doctorId: input.doctorId,
      visitId: input.visitId,
      status: "draft",
      version: 1,
      revision: 0,
      complaints: null,
      anamnesis: null,
      examination: null,
      preliminaryDiagnosis: null,
      finalDiagnosis: null,
      recommendations: null,
      signedAt: null,
      signedBy: null,
      amendedAt: null,
      amendReason: null,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: null,
    };
    this.db.medicalRecords.push(r);
    await this.persist();
    return this.recordDetails({ ...r });
  }

  async saveRecordDraft(
    id: string,
    revision: number,
    fields: Partial<RecordFields>,
    actor: Actor,
  ): Promise<MedicalRecordWithDetails> {
    const r = this.db.medicalRecords.find((x) => x.id === id);
    if (!r || r.status !== "draft" || r.revision !== revision) throw this.recordConflict(r?.status);
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
    r.revision = revision + 1;
    r.updatedAt = new Date().toISOString();
    r.updatedBy = actor.id;
    await this.persist();
    return this.recordDetails({ ...r });
  }

  async signRecord(id: string, revision: number, actor: Actor): Promise<MedicalRecordWithDetails> {
    const r = this.db.medicalRecords.find((x) => x.id === id);
    if (!r || r.status !== "draft" || r.revision !== revision) throw this.recordConflict(r?.status);
    const now = new Date().toISOString();
    Object.assign(r, { status: "signed", signedAt: now, signedBy: actor.id, revision: revision + 1, updatedAt: now, updatedBy: actor.id });
    await this.persist();
    return this.recordDetails({ ...r });
  }

  async amendRecord(
    id: string,
    revision: number,
    fields: RecordFields,
    reason: string,
    actor: Actor,
  ): Promise<MedicalRecordWithDetails> {
    const r = this.db.medicalRecords.find((x) => x.id === id);
    if (!r) throw new StorageConflict("Yozuv topilmadi");
    if (r.status !== "signed") throw new StorageConflict("Faqat tasdiqlangan yozuvga tuzatish kiritiladi");
    if (r.revision !== revision) throw this.recordConflict();
    const now = new Date().toISOString();
    this.db.medicalRecordVersions.push({
      id: randomUUID(),
      recordId: id,
      version: r.version,
      complaints: r.complaints,
      anamnesis: r.anamnesis,
      examination: r.examination,
      preliminaryDiagnosis: r.preliminaryDiagnosis,
      finalDiagnosis: r.finalDiagnosis,
      recommendations: r.recommendations,
      signedAt: r.signedAt,
      signedBy: r.signedBy,
      replacedAt: now,
      replacedBy: actor.id,
      replaceReason: reason,
    });
    Object.assign(r, {
      ...fields,
      version: r.version + 1,
      revision: r.revision + 1,
      signedAt: now,
      signedBy: actor.id,
      amendedAt: now,
      amendReason: reason,
      updatedAt: now,
      updatedBy: actor.id,
    });
    await this.persist();
    return this.recordDetails({ ...r });
  }

  async listRecordVersions(recordId: string): Promise<MedicalRecordVersion[]> {
    return this.db.medicalRecordVersions
      .filter((v) => v.recordId === recordId)
      .sort((a, b) => b.version - a.version)
      .map((v) => ({ ...v, replacedByName: this.db.users.find((u) => u.id === v.replacedBy)?.fullName ?? null }));
  }

  // ------------------------------------------------------------- allergies

  private allergyDetails(a: PatientAllergy | Omit<PatientAllergy, "createdByName">): PatientAllergy {
    return { ...a, createdByName: this.db.users.find((u) => u.id === a.createdBy)?.fullName ?? null };
  }

  async listAllergies(patientId: string, opts: { includeInactive?: boolean } = {}): Promise<PatientAllergy[]> {
    return this.db.patientAllergies
      .filter((a) => a.patientId === patientId && (opts.includeInactive || a.isActive))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt))
      .map((a) => this.allergyDetails(a));
  }

  async getAllergy(id: string): Promise<PatientAllergy | undefined> {
    const a = this.db.patientAllergies.find((x) => x.id === id);
    return a && this.allergyDetails(a);
  }

  async addAllergy(patientId: string, input: { allergen: string; reaction: string | null }, actor: Actor): Promise<PatientAllergy> {
    const a = {
      id: randomUUID(),
      patientId,
      allergen: input.allergen,
      reaction: input.reaction,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      removedAt: null,
      removedBy: null,
      removeReason: null,
    };
    this.db.patientAllergies.push(a);
    await this.persist();
    return this.allergyDetails(a);
  }

  async deactivateAllergy(id: string, reason: string, actor: Actor): Promise<PatientAllergy> {
    const a = this.db.patientAllergies.find((x) => x.id === id);
    if (!a || !a.isActive) throw new StorageConflict("Bu yozuv allaqachon faol emas");
    Object.assign(a, { isActive: false, removedAt: new Date().toISOString(), removedBy: actor.id, removeReason: reason });
    await this.persist();
    return this.allergyDetails(a);
  }

  async deleteDoctor(id: string): Promise<boolean> {
    const before = this.db.doctors.length;
    this.db.doctors = this.db.doctors.filter((d) => d.id !== id);
    if (this.db.doctors.length === before) return false;
    await this.persist();
    return true;
  }

  /** The patient's visit for `day`, created on first use. One per patient per day. */
  private ensureVisit(patientId: string, day: string, createdBy: string | null): Visit {
    const existing = this.db.visits.find((v) => v.patientId === patientId && v.visitDate === day);
    if (existing) return existing;
    const visit: Visit = { id: randomUUID(), patientId, visitDate: day, createdAt: new Date().toISOString(), createdBy };
    this.db.visits.push(visit);
    return visit;
  }

  /** Orders from before visits existed get the visit of their own day. */
  private backfillVisits(): number {
    let n = 0;
    for (const o of this.db.orders) {
      if (o.visitId) continue;
      o.visitId = this.ensureVisit(o.patientId, localDay(o.createdAt), o.createdBy ?? null).id;
      n++;
    }
    return n;
  }

  /**
   * Gives a number to every patient saved before patientNumber existed, oldest
   * first, so the sequence still reads as the order people walked in. Returns
   * how many were touched; zero on every boot after the first.
   */
  private backfillPatientNumbers(): number {
    const missing = this.db.patients
      .filter((p) => typeof p.patientNumber !== "number")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Anything already numbered keeps its number, so the counter has to clear
    // the highest of them before handing out the next one.
    let next = Math.max(
      this.db.counters.patientNumber,
      ...this.db.patients.map((p) => p.patientNumber ?? 0),
      0,
    );
    for (const patient of missing) patient.patientNumber = ++next;
    this.db.counters.patientNumber = next;

    return missing.length;
  }

  // ---------------------------------------------------------------- users

  async listUsers(): Promise<PublicUser[]> {
    return this.db.users
      .map(({ password: _password, ...rest }) => rest)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.db.users.find((u) => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  async createUser(input: InsertUser): Promise<PublicUser> {
    const user: User = {
      id: randomUUID(),
      username: input.username,
      password: await hashPassword(input.password),
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      failedAttempts: 0,
      lockedUntil: null,
      lockLevel: 0,
      lastFailedAt: null,
    };
    this.db.users.push(user);
    await this.persist();
    const { password: _password, ...pub } = user;
    return pub;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<PublicUser | undefined> {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) return undefined;
    if (input.username) user.username = input.username;
    if (input.fullName) user.fullName = input.fullName;
    if (input.role) user.role = input.role;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    if (input.password) user.password = await hashPassword(input.password);
    await this.persist();
    const { password: _password, ...pub } = user;
    return pub;
  }

  async deleteUser(id: string): Promise<boolean> {
    const before = this.db.users.length;
    this.db.users = this.db.users.filter((u) => u.id !== id);
    if (this.db.users.length === before) return false;
    // ON DELETE CASCADE, as in Postgres.
    this.db.userMfa = this.db.userMfa.filter((m) => m.userId !== id);
    await this.persist();
    return true;
  }

  async setLockState(userId: string, state: LockState): Promise<void> {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return;
    user.failedAttempts = state.failedAttempts;
    user.lockedUntil = state.lockedUntil;
    user.lockLevel = state.lockLevel;
    // Stamped on every write so an admin can see when the trouble started.
    user.lastFailedAt =
      state.failedAttempts > 0 || state.lockedUntil ? new Date().toISOString() : null;
    await this.persist();
  }

  // ------------------------------------------------------------- patients

  async listPatients(query: PatientQuery = {}): Promise<Paged<PatientListItem>> {
    const search = query.search?.trim().toLowerCase();
    let rows = this.db.patients.map(normalizePatient);
    if (search) {
      const wantedNumber = asNumberSearch(search);
      rows = rows.filter(
        (p) =>
          p.patientNumber === wantedNumber ||
          contains(p.fullName, search) ||
          contains(p.phone, search) ||
          phoneContains(p.phone, search) ||
          contains(p.address, search) ||
          (p.passport ?? "").toLowerCase().includes(search.replace(/\s/g, "")) ||
          (search.replace(/\D/g, "").length >= 6 && (p.pinfl ?? "").includes(search.replace(/\D/g, ""))),
      );
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.patientNumber - a.patientNumber);
    const total = rows.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? total;
    const page = rows.slice(offset, offset + limit).map((p) => {
      const live = this.db.orders.filter((o) => o.patientId === p.id && o.status !== "cancelled");
      const attended = this.db.appointments.filter(
        (a) => a.patientId === p.id && a.arrivedAt && ATTENDED_STATUSES.includes(a.status),
      );
      const times = [...live.map((o) => o.createdAt), ...attended.map((a) => a.arrivedAt!)];
      const last = times.reduce<string | null>((m, t) => (!m || t > m ? t : m), null);
      // A visit is a day at the clinic: a lab order, an attended appointment, or both.
      const days = new Set([
        ...live.map((o) => o.visitId ?? localDay(o.createdAt)),
        ...attended.map((a) => a.visitId ?? `day:${a.date}`),
      ]);
      return { ...p, lastVisitAt: last, visitCount: days.size };
    });
    return { items: page, total };
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const p = this.db.patients.find((x) => x.id === id);
    return p && normalizePatient(p);
  }

  async getPatientDetails(id: string): Promise<PatientDetails | undefined> {
    const p = await this.getPatient(id);
    if (!p) return undefined;
    const contacts = this.db.patientContacts.filter((c) => c.patientId === id).map((c) => ({ ...c }));
    return { ...p, contacts };
  }

  async getPatientCard(id: string): Promise<PatientCard | undefined> {
    const details = await this.getPatientDetails(id);
    if (!details) return undefined;
    const { items } = await this.listOrders({ patientId: id });
    const numbers = new Map(items.map((o) => [o.id, o.orderNumber]));
    const payments = this.db.payments
      .filter((p) => numbers.has(p.orderId))
      .map((p) => ({ ...p, orderNumber: numbers.get(p.orderId)! }));
    const visits = this.db.visits.filter((v) => v.patientId === id);
    return buildPatientCard(details, items, visits, payments, await this.listAppointments({ patientId: id }));
  }

  async findPatientCandidates(q: PatientCandidateQuery): Promise<Patient[]> {
    return this.db.patients
      .map(normalizePatient)
      .filter((p) => p.id !== q.excludeId)
      .filter(
        (p) =>
          (q.pinfl && p.pinfl === q.pinfl) ||
          (q.passport && p.passport === q.passport) ||
          (q.phoneDigits?.length === 9 && nationalPhoneDigits(p.phone) === q.phoneDigits) ||
          (q.nameKey && nameKey(p.fullName).startsWith(q.nameKey)),
      )
      .slice(0, 20);
  }

  /** Writes the emergency contact: replaced by a value, removed by null, kept by undefined. */
  private setEmergencyContact(patientId: string, contact: InsertPatient["emergencyContact"]) {
    if (contact === undefined) return;
    this.db.patientContacts = this.db.patientContacts.filter((c) => !(c.patientId === patientId && c.isEmergency));
    if (contact) {
      const row: PatientContact = {
        id: randomUUID(),
        patientId,
        name: contact.name,
        relation: contact.relation ?? null,
        phone: contact.phone,
        isEmergency: true,
        createdAt: new Date().toISOString(),
      };
      this.db.patientContacts.push(row);
    }
  }

  async mergePatients(
    sourceId: string,
    targetId: string,
  ): Promise<{ orders: number; contacts: number; appointments: number } | undefined> {
    const source = this.db.patients.find((p) => p.id === sourceId);
    const target = this.db.patients.find((p) => p.id === targetId);
    if (!source || !target || source.id === target.id) return undefined;
    let orders = 0;
    for (const o of this.db.orders) if (o.patientId === sourceId) (o.patientId = targetId), orders++;
    let contacts = 0;
    for (const c of this.db.patientContacts) {
      if (c.patientId !== sourceId) continue;
      // The real card keeps its own emergency contact if it has one.
      if (c.isEmergency && this.db.patientContacts.some((x) => x.patientId === targetId && x.isEmergency)) continue;
      c.patientId = targetId;
      contacts++;
    }
    this.db.patientContacts = this.db.patientContacts.filter((c) => c.patientId !== sourceId);
    // Visits: a day both cards have becomes one visit; the rest move over.
    for (const v of this.db.visits.filter((x) => x.patientId === sourceId)) {
      const same = this.db.visits.find((x) => x.patientId === targetId && x.visitDate === v.visitDate);
      if (same) {
        for (const o of this.db.orders) if (o.visitId === v.id) o.visitId = same.id;
        for (const a of this.db.appointments) if (a.visitId === v.id) a.visitId = same.id;
        for (const r of this.db.medicalRecords) if (r.visitId === v.id) r.visitId = same.id;
        this.db.visits = this.db.visits.filter((x) => x.id !== v.id);
      } else {
        v.patientId = targetId;
      }
    }
    // Fill gaps on the real card from the duplicate; never overwrite.
    for (const k of ["birthDate", "passport", "pinfl", "address", "gender", "age"] as const) {
      if (target[k] == null && source[k] != null) (target as Record<string, unknown>)[k] = source[k];
    }
    if (!target.telegramChatId && source.telegramChatId) {
      target.telegramChatId = source.telegramChatId;
      target.telegramLinkedAt = source.telegramLinkedAt;
    }
    let appointments = 0;
    for (const a of this.db.appointments) if (a.patientId === sourceId) (a.patientId = targetId), appointments++;
    for (const r of this.db.medicalRecords) if (r.patientId === sourceId) r.patientId = targetId;
    for (const a of this.db.patientAllergies) if (a.patientId === sourceId) a.patientId = targetId;
    this.db.patients = this.db.patients.filter((p) => p.id !== sourceId);
    await this.persist();
    return { orders, contacts, appointments };
  }

  async getPatientByPhone(phone: string): Promise<Patient | undefined> {
    const digits = nationalPhoneDigits(phone);
    if (digits.length !== 9) return undefined;
    return [...this.db.patients]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((p) => nationalPhoneDigits(p.phone) === digits);
  }

  async getPatientByChatId(chatId: string): Promise<Patient | undefined> {
    return this.db.patients.find((p) => p.telegramChatId === chatId);
  }

  async createPatient(input: InsertPatient, actor?: Actor): Promise<Patient> {
    this.db.counters.patientNumber += 1;
    const patient: Patient = {
      id: randomUUID(),
      patientNumber: this.db.counters.patientNumber,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      birthDate: input.birthDate ?? null,
      passport: input.passport ?? null,
      pinfl: input.pinfl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      updatedBy: actor?.id ?? null,
      telegramChatId: null,
      telegramLinkedAt: null,
    };
    this.db.patients.push(patient);
    this.setEmergencyContact(patient.id, input.emergencyContact);
    await this.persist();
    return { ...patient };
  }

  async updatePatient(id: string, input: Partial<InsertPatient>, actor?: Actor): Promise<Patient | undefined> {
    const i = this.db.patients.findIndex((p) => p.id === id);
    if (i === -1) return undefined;
    const patient = normalizePatient(this.db.patients[i]);
    if (input.fullName !== undefined) patient.fullName = input.fullName;
    if (input.phone !== undefined) patient.phone = input.phone;
    if (input.address !== undefined) patient.address = input.address ?? null;
    if (input.age !== undefined) patient.age = input.age ?? null;
    if (input.gender !== undefined) patient.gender = input.gender ?? null;
    if (input.birthDate !== undefined) patient.birthDate = input.birthDate ?? null;
    if (input.passport !== undefined) patient.passport = input.passport ?? null;
    if (input.pinfl !== undefined) patient.pinfl = input.pinfl ?? null;
    patient.updatedAt = new Date().toISOString();
    patient.updatedBy = actor?.id ?? null;
    this.db.patients[i] = patient;
    this.setEmergencyContact(id, input.emergencyContact);
    await this.persist();
    return { ...patient };
  }

  async deletePatient(id: string): Promise<boolean> {
    if (this.db.orders.some((o) => o.patientId === id)) {
      throw new Error("Bu bemorda buyurtmalar mavjud — avval buyurtmalarni o'chiring");
    }
    if (this.db.appointments.some((a) => a.patientId === id)) {
      throw new Error("Bu bemorda qabullar tarixi bor — kartani o'chirib bo'lmaydi");
    }
    if (this.db.patientAllergies.some((a) => a.patientId === id)) {
      throw new Error("Bu bemorda tibbiy ma'lumotlar (allergiyalar) bor — kartani o'chirib bo'lmaydi");
    }
    const before = this.db.patients.length;
    this.db.patients = this.db.patients.filter((p) => p.id !== id);
    if (this.db.patients.length === before) return false;
    this.db.patientContacts = this.db.patientContacts.filter((c) => c.patientId !== id);
    this.db.visits = this.db.visits.filter((v) => v.patientId !== id);
    await this.persist();
    return true;
  }

  // ---------------------------------------------------------------- tests

  async listTests(opts: { activeOnly?: boolean } = {}): Promise<Test[]> {
    const rows = opts.activeOnly ? this.db.tests.filter((t) => t.isActive) : [...this.db.tests];
    return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  async getTest(id: string): Promise<Test | undefined> {
    return this.db.tests.find((t) => t.id === id);
  }

  async createTest(input: InsertTest): Promise<Test> {
    const test: Test = {
      id: randomUUID(),
      name: input.name,
      price: input.price,
      category: input.category,
      unit: input.unit ?? null,
      referenceRange: input.referenceRange ?? null,
      isActive: input.isActive ?? true,
    };
    this.db.tests.push(test);
    await this.persist();
    return test;
  }

  async updateTest(id: string, input: Partial<InsertTest>): Promise<Test | undefined> {
    const test = this.db.tests.find((t) => t.id === id);
    if (!test) return undefined;
    if (input.name !== undefined) test.name = input.name;
    if (input.price !== undefined) test.price = input.price;
    if (input.category !== undefined) test.category = input.category;
    if (input.unit !== undefined) test.unit = input.unit ?? null;
    if (input.referenceRange !== undefined) test.referenceRange = input.referenceRange ?? null;
    if (input.isActive !== undefined) test.isActive = input.isActive;
    await this.persist();
    return test;
  }

  async deleteTest(id: string): Promise<boolean> {
    const before = this.db.tests.length;
    this.db.tests = this.db.tests.filter((t) => t.id !== id);
    if (this.db.tests.length === before) return false;
    await this.persist();
    return true;
  }

  // --------------------------------------------------------------- orders

  /** `withPayments` is opt-in: the list screens never render the ledger. */
  private hydrate(order: Order, withPayments = false): OrderWithDetails {
    const full: OrderWithDetails = {
      ...order,
      patient: this.db.patients.find((p) => p.id === order.patientId) ?? null,
      items: this.db.orderTests.filter((ot) => ot.orderId === order.id),
      // Null for orders created before sample tracking existed.
      sample: this.db.samples.find((s) => s.orderId === order.id) ?? null,
    };
    if (withPayments) {
      full.payments = this.db.payments
        .filter((p) => p.orderId === order.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return full;
  }

  /**
   * orders.paidAmount is a cache of the ledger. Recomputing it from the rows
   * after every change is what keeps the two from drifting — the alternative,
   * incrementing it in place, silently loses a payment whenever a write fails
   * halfway.
   */
  private syncPaid(orderId: string): void {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return;
    const sum = this.db.payments
      .filter((p) => p.orderId === orderId)
      .reduce((acc, p) => acc + p.amount, 0);
    order.paidAmount = Math.max(0, sum);
  }

  async listOrders(query: OrderQuery = {}): Promise<OrderListResponse> {
    const search = query.search?.trim().toLowerCase();

    // "base" carries every filter except the two the summary has to look past:
    // status (the tabs need all four counts) and queue.
    let base = this.db.orders.map((o) => this.hydrate(o));
    if (query.patientId) base = base.filter((o) => o.patientId === query.patientId);
    if (query.from) base = base.filter((o) => localDay(o.createdAt) >= query.from!);
    if (query.to) base = base.filter((o) => localDay(o.createdAt) <= query.to!);
    if (search) {
      base = base.filter(
        (o) =>
          contains(o.patient?.fullName, search) ||
          contains(o.patient?.phone, search) ||
          phoneContains(o.patient?.phone, search) ||
          String(o.orderNumber).includes(search) ||
          o.items.some((i) => contains(i.testName, search)),
      );
    }

    const counts = { all: base.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const o of base) counts[o.status] += 1;

    const live = base.filter((o) => o.status !== "cancelled");
    const results = {
      waiting: live.filter(isWaiting).length,
      ready: live.filter(isReady).length,
    };

    let rows = base;
    if (query.status) rows = rows.filter((o) => o.status === query.status);
    if (query.queue) {
      const match = query.queue === "waiting" ? isWaiting : isReady;
      rows = rows.filter((o) => o.status !== "cancelled" && match(o));
    }

    const billable = rows.filter((o) => o.status !== "cancelled");
    const sum = billable.reduce((acc, o) => acc + o.totalAmount, 0);
    const paid = billable.reduce((acc, o) => acc + o.paidAmount, 0);

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? total;

    return {
      items: rows.slice(offset, offset + limit),
      total,
      summary: { counts, results, totals: { sum, paid, debt: Math.max(0, sum - paid) } },
    };
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === id);
    return order ? this.hydrate(order, true) : undefined;
  }

  async createOrder(input: CreateOrderArgs): Promise<OrderWithDetails> {
    if (!this.db.patients.some((p) => p.id === input.patientId)) {
      throw new Error("Bemor topilmadi");
    }

    const selected = input.testIds
      .map((id) => this.db.tests.find((t) => t.id === id))
      .filter((t): t is Test => Boolean(t));
    if (selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");

    const subtotal = selected.reduce((sum, t) => sum + t.price, 0);
    const discount = Math.min(input.discount, subtotal);
    const total = subtotal - discount;

    this.db.counters.orderNumber += 1;
    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      orderNumber: this.db.counters.orderNumber,
      patientId: input.patientId,
      visitId: this.ensureVisit(input.patientId, todayKey(), input.createdBy ?? null).id,
      totalAmount: total,
      discount,
      paidAmount: 0, // set by syncPaid below, from the opening payment
      status: "pending",
      notes: input.notes ?? null,
      referrer: input.referrer ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      completedAt: null,
      telegramSentAt: null,
    };
    this.db.orders.push(order);

    // The tube is created with the order, not when someone remembers to. The
    // barcode is derived from the order number allocated just above, so it is
    // unique for the same reason that number is.
    this.db.samples.push({
      id: randomUUID(),
      orderId: order.id,
      barcode: sampleBarcode(order.orderNumber),
      status: "kutilmoqda",
      collectedAt: null,
      collectedBy: null,
      collectedByName: null,
      receivedAt: null,
      receivedBy: null,
      receivedByName: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectedByName: null,
      rejectReason: null,
      rejectNote: null,
      createdAt: now,
    });

    // The amount handed over at the counter is the ledger's first entry, not a
    // number written straight onto the order — otherwise the very first payment
    // of every order would be missing from the till history.
    const opening = Math.min(input.paidAmount, total);
    if (opening > 0) {
      this.db.payments.push({
        id: randomUUID(),
        orderId: order.id,
        amount: opening,
        method: "naqd",
        note: null,
        createdBy: input.createdBy ?? null,
        createdByName: this.db.users.find((u) => u.id === input.createdBy)?.fullName ?? "—",
        createdAt: now,
      });
    }
    this.syncPaid(order.id);

    for (const t of selected) {
      const item: OrderTest = {
        id: randomUUID(),
        orderId: order.id,
        testId: t.id,
        testName: t.name,
        price: t.price,
        unit: t.unit,
        referenceRange: t.referenceRange,
        result: null,
        flag: null,
        notes: null,
        enteredBy: null,
        completedAt: null,
      };
      this.db.orderTests.push(item);
    }

    await this.persist();
    // With payments, matching what the Postgres backend returns here — the two
    // must be interchangeable or the UI behaves differently per deployment.
    return this.hydrate(order, true);
  }

  async updateOrder(id: string, input: UpdateOrderInput): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === id);
    if (!order) return undefined;

    if (input.testIds) this.replaceOrderTests(id, input.testIds);

    // Recomputed after any test change, so the discount is always capped
    // against the *new* subtotal rather than a stale one.
    if (input.discount !== undefined || input.testIds) {
      const subtotal = this.db.orderTests
        .filter((i) => i.orderId === id)
        .reduce((s, i) => s + i.price, 0);
      const discount = input.discount ?? order.discount;
      order.discount = Math.min(discount, subtotal);
      order.totalAmount = subtotal - order.discount;
    }
    if (input.notes !== undefined) order.notes = input.notes ?? null;
    if (input.referrer !== undefined) order.referrer = input.referrer ?? null;
    if (input.status) {
      order.status = input.status;
      order.completedAt = input.status === "completed" ? new Date().toISOString() : null;
    }

    await this.persist();
    return this.hydrate(order, true);
  }

  /**
   * Makes the order's line items match `testIds`.
   *
   * Two rules the caller cannot override. A line that already holds a result is
   * kept even if the caller left it out — an entered value is unrecoverable,
   * and a mis-click on a checkbox must not destroy one. And a test that is
   * already on the order keeps its original line, so its result, notes and the
   * price snapshot taken at registration all survive the edit.
   */
  private replaceOrderTests(orderId: string, testIds: string[]): void {
    const current = this.db.orderTests.filter((i) => i.orderId === orderId);
    const wanted = new Set(testIds);

    const keep = new Set(
      current.filter((i) => wanted.has(i.testId) || i.result).map((i) => i.id),
    );
    this.db.orderTests = this.db.orderTests.filter(
      (i) => i.orderId !== orderId || keep.has(i.id),
    );

    const present = new Set(
      this.db.orderTests.filter((i) => i.orderId === orderId).map((i) => i.testId),
    );
    for (const testId of testIds) {
      if (present.has(testId)) continue;
      const t = this.db.tests.find((x) => x.id === testId);
      if (!t) continue;
      this.db.orderTests.push({
        id: randomUUID(),
        orderId,
        testId: t.id,
        testName: t.name,
        price: t.price,
        unit: t.unit,
        referenceRange: t.referenceRange,
        result: null,
        flag: null,
        notes: null,
        enteredBy: null,
        completedAt: null,
      });
      present.add(testId);
    }
  }

  async saveResults(
    id: string,
    results: ResultInput[],
    actor?: Actor,
  ): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === id);
    if (!order) return undefined;

    const patient = this.db.patients.find((p) => p.id === order.patientId);
    const now = new Date().toISOString();
    for (const incoming of results) {
      const item = this.db.orderTests.find((i) => i.id === incoming.id && i.orderId === id);
      if (!item) continue;
      const value = incoming.result?.trim() || null;
      item.result = value;
      item.flag = resolveFlag(incoming, item, patient?.gender);
      item.notes = incoming.notes?.trim() || null;
      item.completedAt = value ? now : null;
      if (value && actor) item.enteredBy = actor.name;
    }

    const items = this.db.orderTests.filter((i) => i.orderId === id);
    const filled = items.filter((i) => Boolean(i.result)).length;
    if (order.status !== "cancelled") {
      if (filled === items.length && items.length > 0) {
        order.status = "completed";
        order.completedAt = now;
      } else if (filled > 0) {
        order.status = "in_progress";
        order.completedAt = null;
      } else {
        order.status = "pending";
        order.completedAt = null;
      }
    }

    await this.persist();
    return this.hydrate(order, true);
  }

  async deleteOrder(id: string): Promise<boolean> {
    const before = this.db.orders.length;
    this.db.orders = this.db.orders.filter((o) => o.id !== id);
    if (this.db.orders.length === before) return false;
    this.db.orderTests = this.db.orderTests.filter((i) => i.orderId !== id);
    this.db.payments = this.db.payments.filter((p) => p.orderId !== id);
    this.db.samples = this.db.samples.filter((s) => s.orderId !== id);
    await this.persist();
    return true;
  }

  // -------------------------------------------------------------- samples

  async getOrderByBarcode(barcode: string): Promise<OrderWithDetails | undefined> {
    const orderNumber = parseBarcode(barcode);
    if (orderNumber === null) return undefined;

    // Resolved through the order number rather than the barcode string, so a
    // scan still finds orders created before sample tracking — they have no
    // sample row to match against.
    const order = this.db.orders.find((o) => o.orderNumber === orderNumber);
    return order ? this.hydrate(order, true) : undefined;
  }

  async updateSampleStatus(
    orderId: string,
    input: UpdateSampleInput,
    actor: Actor,
  ): Promise<{ sample: Sample; order: OrderWithDetails } | { error: string } | undefined> {
    const sample = this.db.samples.find((s) => s.orderId === orderId);
    if (!sample) return undefined;

    const from = sample.status;
    if (!canTransition(from, input.status)) return { error: transitionError(from, input.status) };

    const now = new Date().toISOString();
    sample.status = input.status;

    // Each hand-off stamps its own fields, so the tube keeps its full history
    // rather than only its latest actor. A step back clears the stamp it is
    // undoing — otherwise a corrected mis-click would leave a collection time
    // for a tube that, as far as the lab is concerned, was never drawn.
    switch (input.status) {
      case "olindi":
        sample.collectedAt = now;
        sample.collectedBy = actor.id;
        sample.collectedByName = actor.name;
        sample.receivedAt = null;
        sample.receivedBy = null;
        sample.receivedByName = null;
        break;
      case "qabul_qilindi":
        sample.receivedAt = now;
        sample.receivedBy = actor.id;
        sample.receivedByName = actor.name;
        break;
      case "kutilmoqda":
        sample.collectedAt = null;
        sample.collectedBy = null;
        sample.collectedByName = null;
        sample.receivedAt = null;
        sample.receivedBy = null;
        sample.receivedByName = null;
        break;
      case "rad_etildi":
        sample.rejectedAt = now;
        sample.rejectedBy = actor.id;
        sample.rejectedByName = actor.name;
        // Validated upstream: rejectReason is required for this status.
        sample.rejectReason = input.rejectReason ?? null;
        sample.rejectNote = input.rejectNote ?? null;
        break;
    }

    await this.persist();

    const order = this.hydrate(this.db.orders.find((o) => o.id === orderId)!, true);
    return { sample, order };
  }

  // ------------------------------------------------------------- payments

  async addPayment(
    orderId: string,
    input: CreatePaymentInput,
    actor: Actor,
  ): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;

    const paid = this.db.payments
      .filter((p) => p.orderId === orderId)
      .reduce((s, p) => s + p.amount, 0);

    // Neither direction may take the ledger somewhere impossible: no paying
    // past the bill, no refunding money that was never taken.
    const room = order.totalAmount - paid;
    const amount = input.amount > 0 ? Math.min(input.amount, room) : Math.max(input.amount, -paid);
    if (amount === 0) {
      throw new Error(
        input.amount > 0 ? "Buyurtma allaqachon to'liq to'langan" : "Qaytariladigan to'lov yo'q",
      );
    }

    this.db.payments.push({
      id: randomUUID(),
      orderId,
      amount,
      method: input.method,
      note: input.note?.trim() || null,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: new Date().toISOString(),
    });
    this.syncPaid(orderId);
    await this.persist();
    return this.hydrate(order, true);
  }

  async deletePayment(paymentId: string): Promise<boolean> {
    const row = this.db.payments.find((p) => p.id === paymentId);
    if (!row) return false;
    this.db.payments = this.db.payments.filter((p) => p.id !== paymentId);
    this.syncPaid(row.orderId);
    await this.persist();
    return true;
  }

  // ------------------------------------------------------------- expenses

  private allExpenses(): Expense[] {
    return this.db.expenses.map((e) => normalizeExpense(e));
  }

  async listExpenses(query: ExpenseQuery = {}): Promise<Paged<Expense> & { total_amount: number }> {
    const status = query.status ?? "active";
    const q = query.search?.trim().toLowerCase();
    let rows = this.allExpenses();
    if (query.from) rows = rows.filter((e) => e.spentOn >= query.from!);
    if (query.to) rows = rows.filter((e) => e.spentOn <= query.to!);
    if (query.category) rows = rows.filter((e) => e.category === query.category);
    if (query.method) rows = rows.filter((e) => e.method === query.method);
    if (q) rows = rows.filter((e) => `${e.note ?? ""} ${e.payee ?? ""}`.toLowerCase().includes(q));
    if (status !== "all") rows = rows.filter((e) => e.status === status);
    rows.sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));

    const total = rows.length;
    const total_amount = rows.filter((e) => e.status === "active").reduce((s, e) => s + e.amount, 0);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? total;
    return { items: rows.slice(offset, offset + limit), total, total_amount };
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const row = this.db.expenses.find((e) => e.id === id);
    return row && normalizeExpense(row);
  }

  async createExpense(input: InsertExpense, actor: Actor): Promise<Expense> {
    const row = normalizeExpense({
      id: randomUUID(),
      category: input.category,
      amount: input.amount,
      method: input.method,
      payee: input.payee ?? null,
      note: input.note ?? null,
      spentOn: input.spentOn,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: new Date().toISOString(),
    });
    this.db.expenses.push(row);
    await this.persist();
    return { ...row };
  }

  async updateExpense(id: string, input: UpdateExpenseInput, actor: Actor): Promise<Expense | undefined> {
    const i = this.db.expenses.findIndex((e) => e.id === id);
    if (i === -1) return undefined;
    const row = normalizeExpense(this.db.expenses[i]);
    if (input.category !== undefined) row.category = input.category;
    if (input.amount !== undefined) row.amount = input.amount;
    if (input.method !== undefined) row.method = input.method;
    if (input.payee !== undefined) row.payee = input.payee ?? null;
    if (input.note !== undefined) row.note = input.note ?? null;
    if (input.spentOn !== undefined) row.spentOn = input.spentOn;
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor.id;
    this.db.expenses[i] = row;
    await this.persist();
    return { ...row };
  }

  async cancelExpense(id: string, reason: string, actor: Actor): Promise<Expense | undefined> {
    const i = this.db.expenses.findIndex((e) => e.id === id);
    if (i === -1) return undefined;
    const row = normalizeExpense(this.db.expenses[i]);
    row.status = "cancelled";
    row.cancelledAt = new Date().toISOString();
    row.cancelledBy = actor.id;
    row.cancelledByName = actor.name;
    row.cancelReason = reason;
    this.db.expenses[i] = row;
    await this.persist();
    return { ...row };
  }

  async getExpenseSummary(from: string, to: string): Promise<ExpenseSummary> {
    const inRange = this.allExpenses().filter((e) => e.spentOn >= from && e.spentOn <= to);
    const active = inRange.filter((e) => e.status === "active");
    const cancelled = inRange.filter((e) => e.status === "cancelled");

    const group = <K extends string>(key: (e: Expense) => K) => {
      const m = new Map<K, { amount: number; count: number }>();
      for (const e of active) {
        const g = m.get(key(e)) ?? { amount: 0, count: 0 };
        g.amount += e.amount;
        g.count += 1;
        m.set(key(e), g);
      }
      return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount);
    };
    const perDay = new Map<string, number>();
    for (const e of active) perDay.set(e.spentOn, (perDay.get(e.spentOn) ?? 0) + e.amount);

    const total = active.reduce((s, e) => s + e.amount, 0);
    const prev = previousRange(from, to);
    const prevTotal = this.allExpenses()
      .filter((e) => e.status === "active" && e.spentOn >= prev.from && e.spentOn <= prev.to)
      .reduce((s, e) => s + e.amount, 0);

    return {
      range: { from, to },
      total,
      count: active.length,
      average: active.length ? Math.round(total / active.length) : 0,
      largest: active.reduce((m, e) => Math.max(m, e.amount), 0),
      byCategory: group((e) => e.category).map(([category, g]) => ({ category, ...g })),
      byMethod: group((e) => e.method).map(([method, g]) => ({ method, ...g })),
      daily: daysBetween(from, to).map((date) => ({ date, amount: perDay.get(date) ?? 0 })),
      previous: { ...prev, total: prevTotal },
      cancelled: { count: cancelled.length, amount: cancelled.reduce((s, e) => s + e.amount, 0) },
    };
  }

  async listExpensePayees(limit = 30): Promise<string[]> {
    const counts = new Map<string, number>();
    for (const e of this.allExpenses()) if (e.payee) counts.set(e.payee, (counts.get(e.payee) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([p]) => p);
  }

  // ---------------------------------------------------------------- audit

  async writeAudit(input: AuditInput): Promise<void> {
    this.db.auditLog.push({
      id: randomUUID(),
      userId: input.actor.id,
      userName: input.actor.name,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary,
      createdAt: new Date().toISOString(),
    });
    // The log is append-only and unbounded otherwise; a local JSON file is not
    // the place to keep five years of it.
    if (this.db.auditLog.length > 5000) {
      this.db.auditLog = this.db.auditLog.slice(-5000);
    }
    await this.persist();
  }

  async listAudit(query: AuditQuery = {}): Promise<Paged<AuditEntry>> {
    let rows = [...this.db.auditLog];
    if (query.entity) rows = rows.filter((e) => e.entity === query.entity);
    if (query.entityId) rows = rows.filter((e) => e.entityId === query.entityId);
    if (query.action) rows = rows.filter((e) => e.action === query.action);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? total;
    return { items: rows.slice(offset, offset + limit), total };
  }

  // ------------------------------------------------------------- telegram

  async linkTelegram(patientId: string, chatId: string): Promise<Patient | undefined> {
    const patient = this.db.patients.find((p) => p.id === patientId);
    if (!patient) return undefined;
    // One chat belongs to one patient — release it from whoever held it before.
    for (const other of this.db.patients) {
      if (other.id !== patientId && other.telegramChatId === chatId) {
        other.telegramChatId = null;
        other.telegramLinkedAt = null;
      }
    }
    patient.telegramChatId = chatId;
    patient.telegramLinkedAt = new Date().toISOString();
    await this.persist();
    return patient;
  }

  async savePendingContact(input: {
    chatId: string;
    phone: string;
    fullName?: string | null;
    username?: string | null;
  }): Promise<void> {
    const row: TelegramContact = {
      chatId: input.chatId,
      phone: input.phone,
      fullName: input.fullName ?? null,
      username: input.username ?? null,
      createdAt: new Date().toISOString(),
    };
    this.db.telegramContacts = this.db.telegramContacts.filter((c) => c.chatId !== input.chatId);
    this.db.telegramContacts.push(row);
    await this.persist();
  }

  async findPendingContact(phone: string): Promise<TelegramContact | undefined> {
    const digits = nationalPhoneDigits(phone);
    if (digits.length !== 9) return undefined;
    return [...this.db.telegramContacts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((c) => nationalPhoneDigits(c.phone) === digits);
  }

  async deletePendingContact(chatId: string): Promise<void> {
    const before = this.db.telegramContacts.length;
    this.db.telegramContacts = this.db.telegramContacts.filter((c) => c.chatId !== chatId);
    if (this.db.telegramContacts.length !== before) await this.persist();
  }

  async unlinkTelegram(chatId: string): Promise<number> {
    let count = 0;
    for (const p of this.db.patients) {
      if (p.telegramChatId === chatId) {
        p.telegramChatId = null;
        p.telegramLinkedAt = null;
        count += 1;
      }
    }
    if (count) await this.persist();
    return count;
  }

  async listUndeliveredOrders(patientId: string, limit = 5): Promise<OrderWithDetails[]> {
    return this.db.orders
      .filter((o) => o.patientId === patientId && o.status === "completed" && !o.telegramSentAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((o) => this.hydrate(o));
  }

  async markTelegramSent(orderId: string): Promise<void> {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.telegramSentAt = new Date().toISOString();
    await this.persist();
  }

  // ------------------------------------------------------------ reporting

  async getDashboardStats(): Promise<DashboardStatsData> {
    const today = todayKey();
    const todayOrders = this.db.orders.filter(
      (o) => localDay(o.createdAt) === today && o.status !== "cancelled",
    );
    const activeOrderIds = new Set(
      this.db.orders.filter((o) => o.status !== "cancelled").map((o) => o.id),
    );
    const activeItems = this.db.orderTests.filter((i) => activeOrderIds.has(i.orderId));

    return {
      todayPatients: new Set(todayOrders.map((o) => o.patientId)).size,
      pendingTests: activeItems.filter((i) => !i.result).length,
      readyTests: activeItems.filter((i) => Boolean(i.result)).length,
      todayRevenue: todayOrders.reduce((sum, o) => sum + o.paidAmount, 0),
      totalPatients: this.db.patients.length,
      unpaidAmount: this.db.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.paidAmount), 0),
    };
  }

  async getRevenueReport(from: string, to: string): Promise<RevenueReportData> {
    const inRange = this.db.orders.filter((o) => {
      const day = localDay(o.createdAt);
      return day >= from && day <= to && o.status !== "cancelled";
    });

    const byDay = new Map<string, { patients: Set<string>; tests: number; revenue: number }>();
    for (const order of inRange) {
      const day = localDay(order.createdAt);
      const bucket = byDay.get(day) ?? { patients: new Set<string>(), tests: 0, revenue: 0 };
      bucket.patients.add(order.patientId);
      bucket.tests += this.db.orderTests.filter((i) => i.orderId === order.id).length;
      bucket.revenue += order.totalAmount;
      byDay.set(day, bucket);
    }

    const points = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, patients: b.patients.size, tests: b.tests, revenue: b.revenue }));

    const orderIds = new Set(inRange.map((o) => o.id));
    const items = this.db.orderTests.filter((i) => orderIds.has(i.orderId));

    const testAgg = new Map<string, { count: number; revenue: number }>();
    const catAgg = new Map<string, { count: number; revenue: number }>();
    for (const item of items) {
      const t = testAgg.get(item.testName) ?? { count: 0, revenue: 0 };
      t.count += 1;
      t.revenue += item.price;
      testAgg.set(item.testName, t);

      const category = this.db.tests.find((x) => x.id === item.testId)?.category ?? "Boshqa";
      const c = catAgg.get(category) ?? { count: 0, revenue: 0 };
      c.count += 1;
      c.revenue += item.price;
      catAgg.set(category, c);
    }

    const refAgg = new Map<string, { patients: Set<string>; revenue: number }>();
    for (const order of inRange) {
      const key = order.referrer?.trim() || "—";
      const bucket = refAgg.get(key) ?? { patients: new Set<string>(), revenue: 0 };
      bucket.patients.add(order.patientId);
      bucket.revenue += order.totalAmount;
      refAgg.set(key, bucket);
    }

    // Cancelled expenses never reduce the profit.
    const spent = this.allExpenses().filter((e) => e.status === "active" && e.spentOn >= from && e.spentOn <= to);
    const totalExpenses = spent.reduce((s, e) => s + e.amount, 0);
    const expAgg = new Map<string, number>();
    for (const e of spent) expAgg.set(e.category, (expAgg.get(e.category) ?? 0) + e.amount);

    const totalPaid = inRange.reduce((s, o) => s + o.paidAmount, 0);

    return {
      range: { from, to },
      points,
      totalRevenue: inRange.reduce((s, o) => s + o.totalAmount, 0),
      totalPaid,
      totalPatients: new Set(inRange.map((o) => o.patientId)).size,
      totalTests: items.length,
      topTests: Array.from(testAgg.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
      byCategory: Array.from(catAgg.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue),
      totalExpenses,
      // Against money actually collected, not invoiced: an unpaid bill is not
      // cash the lab can spend.
      netProfit: totalPaid - totalExpenses,
      expensesByCategory: Array.from(expAgg.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      byReferrer: Array.from(refAgg.entries())
        .map(([referrer, v]) => ({ referrer, patients: v.patients.size, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  }

  // ------------------------------------------------------------------ 2FA

  async mfaAvailable(): Promise<boolean> {
    return true;
  }

  async getUserMfa(userId: string): Promise<UserMfa | undefined> {
    const row = this.db.userMfa.find((m) => m.userId === userId);
    return row ? { ...row, recoveryCodes: [...row.recoveryCodes] } : undefined;
  }

  async listMfaEnrollments(): Promise<{ userId: string; enabledAt: string }[]> {
    return this.db.userMfa.map((m) => ({ userId: m.userId, enabledAt: m.enabledAt }));
  }

  async saveUserMfa(
    input: { userId: string; secret: string; recoveryCodes: string[]; lastUsedStep: number },
    actor: Actor,
  ): Promise<UserMfa> {
    const now = new Date().toISOString();
    const row: UserMfa = {
      userId: input.userId,
      secret: input.secret,
      recoveryCodes: [...input.recoveryCodes],
      lastUsedStep: input.lastUsedStep,
      enabledAt: now,
      updatedAt: now,
      updatedBy: actor.id,
    };
    this.db.userMfa = [...this.db.userMfa.filter((m) => m.userId !== input.userId), row];
    await this.persist();
    return { ...row, recoveryCodes: [...row.recoveryCodes] };
  }

  async replaceRecoveryCodes(userId: string, hashes: string[], actor: Actor): Promise<boolean> {
    const row = this.db.userMfa.find((m) => m.userId === userId);
    if (!row) return false;
    row.recoveryCodes = [...hashes];
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor.id;
    await this.persist();
    return true;
  }

  async consumeMfaStep(userId: string, step: number): Promise<boolean> {
    // Check and write happen in one synchronous stretch, so no other request
    // can slip in between them on this single-process store.
    const row = this.db.userMfa.find((m) => m.userId === userId);
    if (!row || row.lastUsedStep >= step) return false;
    row.lastUsedStep = step;
    await this.persist();
    return true;
  }

  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    const row = this.db.userMfa.find((m) => m.userId === userId);
    if (!row || !row.recoveryCodes.includes(hash)) return false;
    row.recoveryCodes = row.recoveryCodes.filter((h) => h !== hash);
    row.updatedAt = new Date().toISOString();
    await this.persist();
    return true;
  }

  async deleteUserMfa(userId: string): Promise<boolean> {
    const before = this.db.userMfa.length;
    this.db.userMfa = this.db.userMfa.filter((m) => m.userId !== userId);
    if (this.db.userMfa.length === before) return false;
    await this.persist();
    return true;
  }

  // ------------------------------------------------------------- security

  async getSecuritySettings(): Promise<SecuritySettings> {
    return { ...DEFAULT_SECURITY_SETTINGS, ...(this.db.security ?? {}) };
  }

  async updateSecuritySettings(input: SecuritySettings, _actor: Actor): Promise<SecuritySettings> {
    this.db.security = { ...input };
    await this.persist();
    return { ...input };
  }

  // ------------------------------------------------------------- settings

  async getSettings(): Promise<LabSettings> {
    return this.db.settings;
  }

  async updateSettings(input: LabSettingsInput): Promise<LabSettings> {
    this.db.settings = {
      ...this.db.settings,
      labName: input.labName,
      tagline: input.tagline,
      address: input.address ?? null,
      phone: input.phone ?? null,
      director: input.director ?? null,
      licenseNumber: input.licenseNumber ?? null,
    };
    await this.persist();
    return this.db.settings;
  }
}
