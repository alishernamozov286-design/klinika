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
  ReceptionDay,
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
  Referral,
  ReferralWithDetails,
  OrderTestVersion,
  ResultFlag,
  NotificationFeed,
  IcdEntry,
  IcdStats,
  Visit,
} from "@shared/schema";
import { DEFAULT_SECURITY_SETTINGS, daysBetween, nationalPhoneDigits, previousRange } from "@shared/schema";
import { nameKey, patientAge } from "@shared/patient-identity";
import { nextQueueNumber } from "@shared/appointment";
import { canTransition, parseBarcode, sampleBarcode, transitionError } from "@shared/sample";
import { patientHistoryProblem } from "@shared/patient-links";
import { referralStage } from "@shared/referral";
import { classifyTest, isTestGroup, orderGroups } from "@shared/lab-catalogue";
import { LAB_BOARD_AWAITING_LIMIT, awaitsSample, summarizeLabBoard, type LabBoard } from "@shared/lab-board";
import type { ClinicLogo } from "@shared/branding";
import { DEVICE_ERROR_ALREADY_RESOLVED, DEVICE_HAS_LOG } from "@shared/lab-devices";
import {
  QC_RESULT_ALREADY_REVIEWED,
  QC_RESULT_ALREADY_VOIDED,
  QC_TARGET_EXISTS,
  eqaEvaluation,
  judgeQcRun,
  roundZ,
  zScore,
} from "@shared/qc";
import {
  ISSUE_ALREADY_CANCELLED,
  ITEM_HAS_STOCK_HISTORY,
  QTY_EPSILON,
  RECEIPT_ALREADY_CANCELLED,
  RECEIPT_IN_USE,
  lineTotal,
  planIssue,
} from "@shared/inventory";
import type {
  CreateIssueInput,
  InventoryBatchView,
  StockIssue,
  StockIssueDetail,
  StockIssueLine,
  StockIssueView,
  CreateReceiptInput,
  InventoryBatch,
  InventoryItemView,
  StockMovement,
  StockReceipt,
  StockReceiptDetail,
  StockReceiptView,
  InsertInventoryItem,
  InventoryItem,
  UpdateInventoryItemInput,
  Calibration,
  CalibrationView,
  DeviceMaintenanceEntry,
  DeviceMaintenanceView,
  EqaResult,
  EqaResultView,
  InsertCalibrationInput,
  InsertEqaInput,
  InsertMaintenanceInput,
  InsertQcMaterial,
  InsertQcResultInput,
  InsertQcTarget,
  QcBoard,
  QcMaterial,
  QcResult,
  QcTarget,
  QcTargetView,
  UpdateQcMaterialInput,
  UpdateQcTargetInput,
  InsertDevice,
  InsertDeviceErrorInput,
  LabDevice,
  LabDeviceError,
  LabDeviceErrorWithDevice,
  LabDeviceWithStats,
  UpdateDeviceInput,
} from "@shared/schema";
import { ICD_SOURCE, normalizeIcdCode, parseNsiIcd10, type IcdRow } from "@shared/icd10";
import { readFileSync } from "fs";
import path from "path";

/** The MKB-10 file never changes at run time: one parse per process. */
let icdCache: IcdRow[] | null = null;
import { LEGACY_VERIFIER, isOrderReleased, lineState, needsEntry, needsReview } from "@shared/lab-verification";
import { amendProblem, pickForVerification } from "./lab-rules";
import { PAYMENT_ALREADY_VOIDED, TEST_IN_USE, ledgerTotal, orderDeleteProblem } from "@shared/ledger";
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
  type NewReferrals,
  type NewNotification,
  type IcdQuery,
  type ReferralQuery,
  planResultSave,
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

/** A result line as created: entry, verification and return come later (B4.5). */
const UNVERIFIED = {
  verifiedAt: null,
  verifiedBy: null,
  verifiedByName: null,
  returnedAt: null,
  returnedByName: null,
  returnReason: null,
  version: 1,
} as const;

/** A ledger row as written: voiding is a later, separate act. */
const UNVOIDED = { voidedAt: null, voidedBy: null, voidedByName: null, voidReason: null } as const;

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

/** Something for the laborant: a value to enter, or one the lab head sent back. */
const isWaiting = (order: OrderWithDetails) => needsEntry(order.items);
/** Something for the lab head to check. */
const isReview = (order: OrderWithDetails) => needsReview(order.items);
/** Every value verified — the blank can be printed and the patient told. */
const isReady = (order: OrderWithDetails) => isOrderReleased(order);

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
          ...classifyTest(t),
          unit: ref?.unit ?? null,
          referenceRange: ref?.referenceRange ?? null,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: null,
          updatedAt: null,
          updatedBy: null,
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
          createdBy: null,
          updatedAt: null,
          updatedBy: null,
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
    this.backfillVerification();

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
        createdBy: null,
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
      createdBy: actor.id,
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
      createdBy: actor.id,
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
      createdBy: actor.id,
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
    if (input.referralId) {
      const ref = this.db.referrals.find((r) => r.id === input.referralId);
      if (!ref || ref.status !== "active") throw new StorageConflict("Yo'llanma bekor qilingan yoki topilmadi");
      const taken = this.liveBooking(input.referralId);
      if (taken) throw new StorageConflict(`Bu yo'llanma bo'yicha bemor allaqachon yozilgan (${taken.date} ${taken.startTime})`);
    }
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
      referralId: input.referralId ?? null,
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
      preliminaryDiagnosisCode: null,
      finalDiagnosisCode: null,
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
      preliminaryDiagnosisCode: r.preliminaryDiagnosisCode ?? null,
      finalDiagnosisCode: r.finalDiagnosisCode ?? null,
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

  // ---------------------------------------------------------------- MKB-10

  /** The catalogue file, parsed once per process; Uzbek names come from the store. */
  private icdRows(): IcdRow[] {
    if (!icdCache) {
      const file = path.resolve(import.meta.dirname, "..", "data", "icd10", "mkb10-nsi-2.27.csv");
      icdCache = parseNsiIcd10(readFileSync(file, "utf8"));
    }
    return icdCache;
  }

  private icdEntry(r: IcdRow): IcdEntry {
    const uz = this.db.icdUzNames?.[r.code];
    return { ...r, nameUz: uz ?? null, updatedAt: null };
  }

  async searchIcd(query: IcdQuery): Promise<IcdEntry[]> {
    const q = query.q.trim();
    const code = normalizeIcdCode(q);
    const words = /^[A-Z]\d/.test(code) ? [] : q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const out: IcdEntry[] = [];
    for (const r of this.icdRows()) {
      if (!query.all && !r.selectable) continue;
      if (/^[A-Z]\d/.test(code) && !r.code.startsWith(code)) continue;
      if (words.length) {
        const hay = `${r.nameRu} ${this.db.icdUzNames?.[r.code] ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) continue;
      }
      out.push(this.icdEntry(r));
      if (out.length >= query.limit) break;
    }
    return out;
  }

  async getIcd(codes: string[]): Promise<IcdEntry[]> {
    const want = new Set(codes);
    return this.icdRows().filter((r) => want.has(r.code)).map((r) => this.icdEntry(r));
  }

  async icdStats(): Promise<IcdStats> {
    const rows = this.icdRows();
    return {
      total: rows.length,
      selectable: rows.filter((r) => r.selectable).length,
      withUzbek: Object.values(this.db.icdUzNames ?? {}).filter((v) => v.trim()).length,
      source: ICD_SOURCE,
    };
  }

  async setIcdUzName(code: string, nameUz: string | null, _actor: Actor): Promise<IcdEntry | undefined> {
    const row = this.icdRows().find((r) => r.code === code);
    if (!row) return undefined;
    this.db.icdUzNames ??= {};
    if (nameUz) this.db.icdUzNames[code] = nameUz;
    else delete this.db.icdUzNames[code];
    await this.persist();
    return this.icdEntry(row);
  }

  async importIcdUzNames(names: Map<string, string>, _actor: Actor): Promise<{ updated: number; unknown: string[] }> {
    const known = new Set(this.icdRows().map((r) => r.code));
    this.db.icdUzNames ??= {};
    let updated = 0;
    const unknown: string[] = [];
    for (const [code, name] of names) {
      if (!known.has(code)) {
        unknown.push(code);
        continue;
      }
      this.db.icdUzNames[code] = name;
      updated++;
    }
    if (updated) await this.persist();
    return { updated, unknown };
  }

  // -------------------------------------------------------- notifications

  async createNotification(input: NewNotification): Promise<boolean> {
    if (input.dedupeKey && this.db.notifications.some((n) => n.dedupeKey === input.dedupeKey)) return false;
    this.db.notifications.push({ id: randomUUID(), ...input, createdAt: new Date().toISOString(), readAt: null });
    await this.persist();
    return true;
  }

  async listNotifications(userId: string, limit: number): Promise<NotificationFeed> {
    const mine = this.db.notifications.filter((n) => n.userId === userId);
    return {
      unread: mine.filter((n) => !n.readAt).length,
      items: [...mine]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(({ dedupeKey: _key, ...n }) => ({ ...n })),
    };
  }

  async markNotificationRead(userId: string, id: string): Promise<boolean> {
    const n = this.db.notifications.find((x) => x.id === id && x.userId === userId && !x.readAt);
    if (!n) return false;
    n.readAt = new Date().toISOString();
    await this.persist();
    return true;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const n of this.db.notifications) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = now;
        count++;
      }
    }
    if (count) await this.persist();
    return count;
  }

  // ------------------------------------------------------------ referrals

  /** The booking that still fulfils a referral: anything but cancelled or no-show. */
  private liveBooking(referralId: string): Appointment | undefined {
    return this.db.appointments.find(
      (a) => a.referralId === referralId && a.status !== "cancelled" && a.status !== "no_show",
    );
  }

  private referralDetails(r: Referral): ReferralWithDetails {
    const patient = this.db.patients.find((p) => p.id === r.patientId);
    const issuer = this.db.doctors.find((d) => d.id === r.doctorId);
    const issuerUser = issuer && this.db.users.find((u) => u.id === issuer.userId);
    const service = r.serviceId ? this.db.services.find((s) => s.id === r.serviceId) : undefined;
    const target = r.targetDoctorId ? this.db.doctors.find((d) => d.id === r.targetDoctorId) : undefined;
    const targetUser = target && this.db.users.find((u) => u.id === target.userId);
    const canceller = r.cancelledBy ? this.db.users.find((u) => u.id === r.cancelledBy) : undefined;

    let order: ReferralWithDetails["order"] = null;
    if (r.kind === "lab") {
      const o = this.db.orders.find((x) => x.referralId === r.id);
      if (o) {
        const lines = this.db.orderTests.filter((i) => i.orderId === o.id);
        order = {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: o.totalAmount,
          paidAmount: o.paidAmount,
          tests: lines.length,
          done: lines.filter((i) => i.result).length,
          verified: lines.filter((i) => i.verifiedAt).length,
          results: lines
            .filter((i) => i.verifiedAt && i.result)
            .sort((a, b) => a.testName.localeCompare(b.testName))
            .map((i) => ({ testName: i.testName, result: i.result!, unit: i.unit, referenceRange: i.referenceRange, flag: i.flag })),
          testNames: lines.map((i) => i.testName).sort((a, b) => a.localeCompare(b)),
        };
      }
    }
    let booking: ReferralWithDetails["booking"] = null;
    if (r.kind !== "lab") {
      const b = this.liveBooking(r.id);
      if (b) {
        const doc = this.db.doctors.find((d) => d.id === b.doctorId);
        booking = {
          id: b.id,
          date: b.date,
          startTime: b.startTime,
          status: b.status,
          queueNumber: b.queueNumber,
          doctorName: this.db.users.find((u) => u.id === doc?.userId)?.fullName ?? "—",
        };
      }
    }
    return {
      ...r,
      patientNumber: patient?.patientNumber ?? 0,
      patientName: patient?.fullName ?? "—",
      patientPhone: patient?.phone ?? "",
      doctorName: issuerUser?.fullName ?? "—",
      doctorUserId: issuer?.userId ?? "",
      specialty: issuer?.specialty ?? "",
      serviceName: service?.name ?? null,
      serviceKind: service?.kind ?? null,
      servicePrice: service?.price ?? null,
      targetDoctorName: targetUser?.fullName ?? null,
      cancelledByName: canceller?.fullName ?? null,
      order,
      booking,
      stage: referralStage({ kind: r.kind, status: r.status, order, booking }),
    };
  }

  async listReferrals(q: ReferralQuery): Promise<ReferralWithDetails[]> {
    let rows = this.db.referrals.filter(
      (r) =>
        (!q.ids || q.ids.includes(r.id)) &&
        (!q.patientId || r.patientId === q.patientId) &&
        (!q.appointmentId || r.appointmentId === q.appointmentId) &&
        (!q.awaitingBooking || (r.status === "active" && r.kind !== "lab" && !this.liveBooking(r.id))),
    );
    rows = rows.sort((a, b) =>
      q.awaitingBooking ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    );
    if (q.limit) rows = rows.slice(0, q.limit);
    return rows.map((r) => this.referralDetails(r));
  }

  async getReferral(id: string): Promise<ReferralWithDetails | undefined> {
    const r = this.db.referrals.find((x) => x.id === id);
    return r && this.referralDetails(r);
  }

  async createReferrals(input: NewReferrals, actor: Actor): Promise<ReferralWithDetails[]> {
    const now = new Date().toISOString();
    const make = (extra: Partial<Referral> & Pick<Referral, "kind">): Referral => {
      this.db.counters.referralNumber += 1;
      return {
        id: randomUUID(),
        referralNumber: this.db.counters.referralNumber,
        patientId: input.patientId,
        visitId: input.visitId,
        appointmentId: input.appointmentId,
        doctorId: input.doctorId,
        status: "active",
        serviceId: null,
        targetSpecialty: null,
        targetDoctorId: null,
        note: input.note,
        createdAt: now,
        createdBy: actor.id,
        updatedAt: null,
        updatedBy: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        ...extra,
      };
    };

    let made: Referral[];
    if (input.kind === "lab") {
      if (!input.testIds.some((id) => this.db.tests.some((t) => t.id === id))) throw new Error("Tanlangan tahlillar topilmadi");
      const ref = make({ kind: "lab" });
      this.db.referrals.push(ref);
      await this.placeOrder(
        {
          patientId: input.patientId,
          testIds: input.testIds,
          discount: 0,
          paidAmount: 0,
          notes: input.note,
          referrer: input.referrer,
          createdBy: actor.id,
        },
        ref.id,
      );
      made = [ref];
    } else if (input.kind === "exam") {
      made = input.serviceIds.map((serviceId) => make({ kind: "exam", serviceId }));
      this.db.referrals.push(...made);
    } else {
      made = [make({ kind: "consult", targetSpecialty: input.targetSpecialty, targetDoctorId: input.targetDoctorId })];
      this.db.referrals.push(...made);
    }
    await this.persist();
    return made.map((r) => this.referralDetails(r));
  }

  async cancelReferral(id: string, reason: string, actor: Actor): Promise<ReferralWithDetails | undefined> {
    const ref = this.db.referrals.find((r) => r.id === id);
    if (!ref) return undefined;
    if (ref.status === "cancelled") throw new StorageConflict("Yo'llanma allaqachon bekor qilingan");
    const now = new Date().toISOString();
    if (ref.kind === "lab") {
      const order = this.db.orders.find((o) => o.referralId === id);
      if (order && order.status !== "cancelled") {
        const paid = this.db.payments.some((p) => p.orderId === order.id && !p.voidedAt);
        const results = this.db.orderTests.some((i) => i.orderId === order.id && i.result);
        if (paid || results) {
          throw new StorageConflict(
            `Tahlil buyurtmasi #${order.orderNumber} bo'yicha to'lov yoki natija bor. Uni registratura yoki laboratoriya hal qiladi`,
          );
        }
        Object.assign(order, { status: "cancelled", completedAt: null, updatedAt: now, updatedBy: actor.id });
      }
    } else {
      const booked = this.liveBooking(id);
      if (booked) {
        throw new StorageConflict(`Bemor bu yo'llanma bo'yicha navbatga yozilgan (${booked.date} ${booked.startTime}). Avval qabulni bekor qiling`);
      }
    }
    Object.assign(ref, { status: "cancelled", cancelledAt: now, cancelledBy: actor.id, cancelReason: reason, updatedAt: now, updatedBy: actor.id });
    await this.persist();
    return this.referralDetails(ref);
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
  /**
   * Results entered before verification existed (B4.5) have no verification
   * fields at all. They were already handed to patients, so they count as
   * released — under a name that says so rather than an invented verifier.
   * New lines carry explicit nulls and are never touched by this.
   */
  private backfillVerification(): void {
    for (const line of this.db.orderTests) {
      if ((line as { verifiedAt?: unknown }).verifiedAt !== undefined) continue;
      Object.assign(line, {
        enteredById: null,
        returnedAt: null,
        returnedByName: null,
        returnReason: null,
        version: 1,
        verifiedBy: null,
        verifiedAt: line.result ? (line.completedAt ?? new Date().toISOString()) : null,
        verifiedByName: line.result ? LEGACY_VERIFIER : null,
      });
    }
  }

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

  async createUser(input: InsertUser, actor?: Actor): Promise<PublicUser> {
    const user: User = {
      id: randomUUID(),
      username: input.username,
      password: await hashPassword(input.password),
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      createdBy: actor?.id ?? null,
      updatedAt: null,
      updatedBy: null,
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

  async updateUser(id: string, input: UpdateUserInput, actor?: Actor): Promise<PublicUser | undefined> {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) return undefined;
    const touched =
      Boolean(input.username || input.fullName || input.role || input.password) || input.isActive !== undefined;
    if (input.username) user.username = input.username;
    if (input.fullName) user.fullName = input.fullName;
    if (input.role) user.role = input.role;
    if (input.isActive !== undefined) user.isActive = input.isActive;
    if (input.password) user.password = await hashPassword(input.password);
    if (touched) {
      user.updatedAt = new Date().toISOString();
      user.updatedBy = actor?.id ?? null;
    }
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
    actor?: Actor,
  ): Promise<{ orders: number; contacts: number; appointments: number } | undefined> {
    const source = this.db.patients.find((p) => p.id === sourceId);
    const target = this.db.patients.find((p) => p.id === targetId);
    if (!source || !target || source.id === target.id) return undefined;
    const stamp = { updatedAt: new Date().toISOString(), updatedBy: actor?.id ?? null };
    let orders = 0;
    for (const o of this.db.orders) {
      if (o.patientId !== sourceId) continue;
      Object.assign(o, { patientId: targetId }, stamp);
      orders++;
    }
    Object.assign(target, stamp);
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
        for (const r of this.db.referrals) if (r.visitId === v.id) r.visitId = same.id;
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
    for (const r of this.db.referrals) if (r.patientId === sourceId) r.patientId = targetId;
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
      createdBy: actor?.id ?? null,
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
    const mine = (rows: { patientId: string }[]) => rows.filter((r) => r.patientId === id).length;
    const problem = patientHistoryProblem({
      orders: mine(this.db.orders),
      appointments: mine(this.db.appointments),
      medical_records: mine(this.db.medicalRecords),
      patient_allergies: mine(this.db.patientAllergies),
      referrals: mine(this.db.referrals),
    });
    if (problem) throw new StorageConflict(problem);
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

  async createTest(input: InsertTest, actor: Actor): Promise<Test> {
    const test: Test = {
      id: randomUUID(),
      name: input.name,
      price: input.price,
      category: input.category,
      group: input.group,
      sampleType: input.sampleType,
      unit: input.unit ?? null,
      referenceRange: input.referenceRange ?? null,
      isActive: input.isActive ?? true,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: null,
    };
    this.db.tests.push(test);
    await this.persist();
    return test;
  }

  async updateTest(id: string, input: Partial<InsertTest>, actor: Actor): Promise<Test | undefined> {
    const test = this.db.tests.find((t) => t.id === id);
    if (!test) return undefined;
    const fields = ["name", "price", "category", "group", "sampleType", "unit", "referenceRange", "isActive"] as const;
    if (fields.some((k) => input[k] !== undefined)) {
      test.updatedAt = new Date().toISOString();
      test.updatedBy = actor.id;
    }
    if (input.name !== undefined) test.name = input.name;
    if (input.price !== undefined) test.price = input.price;
    if (input.category !== undefined) test.category = input.category;
    if (input.group !== undefined) test.group = input.group;
    if (input.sampleType !== undefined) test.sampleType = input.sampleType;
    if (input.unit !== undefined) test.unit = input.unit ?? null;
    if (input.referenceRange !== undefined) test.referenceRange = input.referenceRange ?? null;
    if (input.isActive !== undefined) test.isActive = input.isActive;
    await this.persist();
    return test;
  }

  async deleteTest(id: string): Promise<boolean> {
    if (this.db.orderTests.some((i) => i.testId === id)) throw new StorageConflict(TEST_IN_USE);
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
      referralNumber: order.referralId
        ? (this.db.referrals.find((r) => r.id === order.referralId)?.referralNumber ?? null)
        : null,
      patient: this.db.patients.find((p) => p.id === order.patientId) ?? null,
      items: this.db.orderTests.filter((ot) => ot.orderId === order.id),
      groups: orderGroups(
        this.db.orderTests
          .filter((ot) => ot.orderId === order.id)
          .map((ot) => this.db.tests.find((t) => t.id === ot.testId)?.group),
      ),
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
    order.paidAmount = Math.max(0, ledgerTotal(this.db.payments.filter((p) => p.orderId === orderId)));
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

    // Group chips count with the group filter lifted, as the status tabs do.
    const groups: OrderListResponse["summary"]["groups"] = {};
    for (const o of base) for (const g of o.groups ?? []) if (isTestGroup(g)) groups[g] = (groups[g] ?? 0) + 1;
    if (query.group) base = base.filter((o) => o.groups?.includes(query.group!));

    const counts = { all: base.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const o of base) counts[o.status] += 1;

    const live = base.filter((o) => o.status !== "cancelled");
    const results = {
      waiting: live.filter(isWaiting).length,
      review: live.filter(isReview).length,
      ready: live.filter(isReady).length,
    };

    let rows = base;
    if (query.status) rows = rows.filter((o) => o.status === query.status);
    if (query.queue) {
      const match = query.queue === "waiting" ? isWaiting : query.queue === "review" ? isReview : isReady;
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
      summary: { counts, results, totals: { sum, paid, debt: Math.max(0, sum - paid) }, groups },
    };
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === id);
    return order ? this.hydrate(order, true) : undefined;
  }

  async createOrder(input: CreateOrderArgs): Promise<OrderWithDetails> {
    return this.placeOrder(input, null);
  }

  /** Shared by the desk and the doctor's lab referral, so both make the same order. */
  private async placeOrder(input: CreateOrderArgs, referralId: string | null): Promise<OrderWithDetails> {
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
      referralId,
      totalAmount: total,
      discount,
      paidAmount: 0, // set by syncPaid below, from the opening payment
      status: "pending",
      notes: input.notes ?? null,
      referrer: input.referrer ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: null,
      updatedBy: null,
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
      quality: null,
      qualityNote: null,
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
        ...UNVOIDED,
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
        sampleType: t.sampleType,
        result: null,
        flag: null,
        notes: null,
        enteredBy: null,
        enteredById: null,
        completedAt: null,
        ...UNVERIFIED,
      };
      this.db.orderTests.push(item);
    }

    await this.persist();
    // With payments, matching what the Postgres backend returns here — the two
    // must be interchangeable or the UI behaves differently per deployment.
    return this.hydrate(order, true);
  }

  async updateOrder(id: string, input: UpdateOrderInput, actor?: Actor): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === id);
    if (!order) return undefined;
    const touched =
      input.testIds !== undefined ||
      input.discount !== undefined ||
      input.notes !== undefined ||
      input.referrer !== undefined ||
      Boolean(input.status);
    if (touched) {
      order.updatedAt = new Date().toISOString();
      order.updatedBy = actor?.id ?? null;
    }

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
        sampleType: t.sampleType,
        result: null,
        flag: null,
        notes: null,
        enteredBy: null,
        enteredById: null,
        completedAt: null,
        ...UNVERIFIED,
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
    const lines = this.db.orderTests.filter((i) => i.orderId === id);
    const changes = planResultSave(lines, results, patient?.gender);
    for (const c of changes) {
      const item = lines.find((i) => i.id === c.id)!;
      Object.assign(item, {
        result: c.result,
        flag: c.flag,
        notes: c.notes,
        completedAt: c.result ? now : null,
        returnedAt: null,
        returnedByName: null,
        returnReason: null,
      });
      if (c.result && actor) Object.assign(item, { enteredBy: actor.name, enteredById: actor.id });
    }
    if (changes.length === 0) return this.hydrate(order, true);

    order.updatedAt = now;
    order.updatedBy = actor?.id ?? null;
    const filled = lines.filter((i) => Boolean(i.result)).length;
    if (order.status !== "cancelled") {
      if (filled === lines.length && lines.length > 0) {
        order.completedAt = order.status === "completed" && order.completedAt ? order.completedAt : now;
        order.status = "completed";
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

  async verifyResults(
    orderId: string,
    itemIds: string[] | null,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; verified: number; selfChecked: number } | undefined> {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    if (order.status === "cancelled") throw new StorageConflict("Buyurtma bekor qilingan");
    const target = pickForVerification(this.db.orderTests.filter((i) => i.orderId === orderId), itemIds);
    const now = new Date().toISOString();
    for (const l of target) Object.assign(l, { verifiedAt: now, verifiedBy: actor.id, verifiedByName: actor.name });
    order.updatedAt = now;
    order.updatedBy = actor.id;
    await this.persist();
    return {
      order: this.hydrate(order, true),
      verified: target.length,
      selfChecked: target.filter((l) => l.enteredById && l.enteredById === actor.id).length,
    };
  }

  async returnResults(orderId: string, itemIds: string[], reason: string, actor: Actor): Promise<OrderWithDetails | undefined> {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) return undefined;
    const target = pickForVerification(this.db.orderTests.filter((i) => i.orderId === orderId), itemIds);
    const now = new Date().toISOString();
    for (const l of target) Object.assign(l, { returnedAt: now, returnedByName: actor.name, returnReason: reason });
    order.updatedAt = now;
    order.updatedBy = actor.id;
    await this.persist();
    return this.hydrate(order, true);
  }

  async amendResult(
    orderId: string,
    itemId: string,
    input: { result: string; flag: ResultFlag | null; notes: string | null },
    reason: string,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; previous: { result: string | null; version: number } } | undefined> {
    const order = this.db.orders.find((o) => o.id === orderId);
    const line = this.db.orderTests.find((i) => i.id === itemId && i.orderId === orderId);
    if (!order || !line) return undefined;
    const problem = amendProblem(line, input);
    if (problem) throw new StorageConflict(problem);
    const now = new Date().toISOString();
    this.db.orderTestVersions.push({
      id: randomUUID(),
      orderTestId: line.id,
      orderId,
      version: line.version,
      result: line.result,
      flag: line.flag,
      notes: line.notes,
      enteredBy: line.enteredBy,
      verifiedAt: line.verifiedAt,
      verifiedByName: line.verifiedByName,
      replacedAt: now,
      replacedBy: actor.id,
      replacedByName: actor.name,
      replaceReason: reason,
    });
    const previous = { result: line.result, version: line.version };
    Object.assign(line, {
      result: input.result,
      flag: input.flag,
      notes: input.notes,
      version: line.version + 1,
      completedAt: now,
      enteredBy: actor.name,
      enteredById: actor.id,
      verifiedAt: now,
      verifiedBy: actor.id,
      verifiedByName: actor.name,
    });
    order.updatedAt = now;
    order.updatedBy = actor.id;
    await this.persist();
    return { order: this.hydrate(order, true), previous };
  }

  async listResultVersions(itemId: string): Promise<OrderTestVersion[]> {
    return this.db.orderTestVersions
      .filter((v) => v.orderTestId === itemId)
      .sort((a, b) => b.version - a.version)
      .map((v) => ({ ...v }));
  }

  async deleteOrder(id: string): Promise<boolean> {
    if (!this.db.orders.some((o) => o.id === id)) return false;
    const problem = orderDeleteProblem(
      this.db.payments.filter((p) => p.orderId === id).length,
      this.db.orderTests.filter((i) => i.orderId === id && i.result).length,
    );
    if (problem) throw new StorageConflict(problem);
    this.db.orders = this.db.orders.filter((o) => o.id !== id);
    this.db.orderTests = this.db.orderTests.filter((i) => i.orderId !== id);
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
        sample.quality = null;
        sample.qualityNote = null;
        break;
      case "qabul_qilindi":
        sample.receivedAt = now;
        sample.receivedBy = actor.id;
        sample.receivedByName = actor.name;
        sample.quality = input.quality ?? "yaxshi";
        sample.qualityNote = input.qualityNote?.trim() || null;
        break;
      case "kutilmoqda":
        sample.collectedAt = null;
        sample.collectedBy = null;
        sample.collectedByName = null;
        sample.receivedAt = null;
        sample.receivedBy = null;
        sample.receivedByName = null;
        sample.quality = null;
        sample.qualityNote = null;
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

    const paid = ledgerTotal(this.db.payments.filter((p) => p.orderId === orderId));

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
      ...UNVOIDED,
    });
    this.touchOrder(order, actor);
    this.syncPaid(orderId);
    await this.persist();
    return this.hydrate(order, true);
  }

  async voidPayment(paymentId: string, reason: string, actor: Actor): Promise<OrderWithDetails | undefined> {
    const row = this.db.payments.find((p) => p.id === paymentId);
    if (!row) return undefined;
    if (row.voidedAt) throw new StorageConflict(PAYMENT_ALREADY_VOIDED);
    row.voidedAt = new Date().toISOString();
    row.voidedBy = actor.id;
    row.voidedByName = actor.name;
    row.voidReason = reason;
    const order = this.db.orders.find((o) => o.id === row.orderId);
    if (order) this.touchOrder(order, actor);
    this.syncPaid(row.orderId);
    await this.persist();
    return order && this.hydrate(order, true);
  }

  private touchOrder(order: Order, actor: Actor): void {
    order.updatedAt = new Date().toISOString();
    order.updatedBy = actor.id;
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
      readyTests: activeItems.filter((i) => lineState(i) === "verified").length,
      reviewTests: activeItems.filter((i) => lineState(i) === "review").length,
      todayRevenue: todayOrders.reduce((sum, o) => sum + o.paidAmount, 0),
      totalPatients: this.db.patients.length,
      unpaidAmount: this.db.orders
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.paidAmount), 0),
    };
  }

  // ------------------------------------------------------ lab devices (B4.9)

  async listDevices(): Promise<LabDeviceWithStats[]> {
    return this.db.labDevices
      .map((d) => {
        const log = this.db.labDeviceErrors.filter((e) => e.deviceId === d.id);
        const last = log.reduce<string | null>((m, e) => (!m || e.occurredAt > m ? e.occurredAt : m), null);
        return { ...d, errorCount: log.length, openErrors: log.filter((e) => !e.resolvedAt).length, lastErrorAt: last };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getDevice(id: string): Promise<LabDevice | undefined> {
    const d = this.db.labDevices.find((x) => x.id === id);
    return d && { ...d };
  }

  async createDevice(input: InsertDevice, actor: Actor): Promise<LabDevice> {
    const device: LabDevice = {
      id: randomUUID(),
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      serialNumber: input.serialNumber ?? null,
      direction: input.direction,
      connection: input.connection,
      status: input.status,
      location: input.location ?? null,
      installedOn: input.installedOn ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.labDevices.push(device);
    await this.persist();
    return { ...device };
  }

  async updateDevice(id: string, input: UpdateDeviceInput, actor: Actor): Promise<LabDevice | undefined> {
    const d = this.db.labDevices.find((x) => x.id === id);
    if (!d) return undefined;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (d as Record<string, unknown>)[k] = v;
    d.updatedAt = new Date().toISOString();
    d.updatedBy = actor.id;
    await this.persist();
    return { ...d };
  }

  async deleteDevice(id: string): Promise<boolean> {
    const i = this.db.labDevices.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (this.db.labDeviceErrors.some((e) => e.deviceId === id)) throw new StorageConflict(DEVICE_HAS_LOG);
    this.db.labDevices.splice(i, 1);
    await this.persist();
    return true;
  }

  async listDeviceErrors(query: { deviceId?: string; open?: boolean; limit?: number } = {}): Promise<LabDeviceErrorWithDevice[]> {
    const names = new Map(this.db.labDevices.map((d) => [d.id, d.name]));
    return this.db.labDeviceErrors
      .filter((e) => (!query.deviceId || e.deviceId === query.deviceId) && (!query.open || !e.resolvedAt))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit ?? 200)
      .map((e) => ({ ...e, deviceName: names.get(e.deviceId) ?? "—" }));
  }

  async createDeviceError(deviceId: string, input: InsertDeviceErrorInput, actor: Actor): Promise<LabDeviceError | undefined> {
    const device = this.db.labDevices.find((x) => x.id === deviceId);
    if (!device) return undefined;
    const now = new Date().toISOString();
    const entry: LabDeviceError = {
      id: randomUUID(),
      deviceId,
      occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
      severity: input.severity,
      code: input.code ?? null,
      message: input.message,
      actionTaken: input.actionTaken ?? null,
      reportedBy: actor.id,
      reportedByName: actor.name,
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      resolution: null,
    };
    this.db.labDeviceErrors.push(entry);
    if (input.markOutOfService && device.status !== "out_of_service") {
      Object.assign(device, { status: "out_of_service", updatedAt: now, updatedBy: actor.id });
    }
    await this.persist();
    return { ...entry };
  }

  async resolveDeviceError(id: string, resolution: string, actor: Actor): Promise<LabDeviceError | undefined> {
    const e = this.db.labDeviceErrors.find((x) => x.id === id);
    if (!e) return undefined;
    if (e.resolvedAt) throw new StorageConflict(DEVICE_ERROR_ALREADY_RESOLVED);
    Object.assign(e, { resolvedAt: new Date().toISOString(), resolvedBy: actor.id, resolvedByName: actor.name, resolution });
    await this.persist();
    return { ...e };
  }

  // ---------------------------------------------------- quality control (B4.8)

  async getQcBoard(day: string): Promise<QcBoard> {
    const materials = [...this.db.qcMaterials].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name) || a.level.localeCompare(b.level),
    );
    const targets: QcTargetView[] = [];
    for (const t of this.db.qcTargets) {
      const m = this.db.qcMaterials.find((x) => x.id === t.materialId);
      if (!m) continue;
      const runs = this.db.qcResults
        .filter((r) => r.targetId === t.id && !r.voidedAt)
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.createdAt.localeCompare(b.createdAt));
      const last = runs.at(-1);
      targets.push({
        ...t,
        materialName: m.name,
        level: m.level,
        lotNumber: m.lotNumber,
        materialExpiresOn: m.expiresOn,
        materialActive: m.isActive,
        testName: this.db.tests.find((x) => x.id === t.testId)?.name ?? "—",
        deviceName: t.deviceId ? (this.db.labDevices.find((x) => x.id === t.deviceId)?.name ?? null) : null,
        lastResult: last ? { value: last.value, z: last.z, status: last.status, measuredAt: last.measuredAt } : null,
        runs: runs.length,
        runsToday: runs.filter((r) => localDay(r.measuredAt) === day).length,
        openRejections: runs.filter((r) => r.status === "reject" && !r.reviewedAt).length,
      });
    }
    targets.sort((a, b) => a.testName.localeCompare(b.testName) || a.level.localeCompare(b.level));
    return { date: day, materials, targets };
  }

  async getQcMaterial(id: string): Promise<QcMaterial | undefined> {
    const m = this.db.qcMaterials.find((x) => x.id === id);
    return m && { ...m };
  }

  async createQcMaterial(input: InsertQcMaterial, actor: Actor): Promise<QcMaterial> {
    const m: QcMaterial = {
      id: randomUUID(),
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      lotNumber: input.lotNumber,
      level: input.level,
      expiresOn: input.expiresOn,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.qcMaterials.push(m);
    await this.persist();
    return { ...m };
  }

  async updateQcMaterial(id: string, input: UpdateQcMaterialInput, actor: Actor): Promise<QcMaterial | undefined> {
    const m = this.db.qcMaterials.find((x) => x.id === id);
    if (!m) return undefined;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (m as Record<string, unknown>)[k] = v;
    Object.assign(m, { updatedAt: new Date().toISOString(), updatedBy: actor.id });
    await this.persist();
    return { ...m };
  }

  async getQcTarget(id: string): Promise<QcTarget | undefined> {
    const t = this.db.qcTargets.find((x) => x.id === id);
    return t && { ...t };
  }

  async createQcTarget(input: InsertQcTarget, actor: Actor): Promise<QcTarget> {
    const dup = this.db.qcTargets.some(
      (t) => t.materialId === input.materialId && t.testId === input.testId && (t.deviceId ?? null) === (input.deviceId ?? null),
    );
    if (dup) throw new StorageConflict(QC_TARGET_EXISTS);
    const t: QcTarget = {
      id: randomUUID(),
      materialId: input.materialId,
      testId: input.testId,
      deviceId: input.deviceId ?? null,
      mean: input.mean,
      sd: input.sd,
      unit: input.unit ?? null,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.qcTargets.push(t);
    await this.persist();
    return { ...t };
  }

  async updateQcTarget(id: string, input: UpdateQcTargetInput, actor: Actor): Promise<QcTarget | undefined> {
    const t = this.db.qcTargets.find((x) => x.id === id);
    if (!t) return undefined;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (t as Record<string, unknown>)[k] = v;
    Object.assign(t, { updatedAt: new Date().toISOString(), updatedBy: actor.id });
    await this.persist();
    return { ...t };
  }

  async listQcResults(targetId: string, limit = 60): Promise<QcResult[]> {
    return this.db.qcResults
      .filter((r) => r.targetId === targetId)
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
      .map((r) => ({ ...r, rules: [...r.rules] }));
  }

  async addQcResult(target: QcTarget, input: InsertQcResultInput, actor: Actor): Promise<QcResult> {
    const now = new Date().toISOString();
    const measuredAt = input.measuredAt ? new Date(input.measuredAt).toISOString() : now;
    const previous = this.db.qcResults
      .filter((r) => r.targetId === target.id && !r.voidedAt && r.measuredAt <= measuredAt)
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.createdAt.localeCompare(b.createdAt))
      .map((r) => r.z);
    const verdict = judgeQcRun(previous, input.value, target.mean, target.sd);
    const r: QcResult = {
      id: randomUUID(),
      targetId: target.id,
      value: input.value,
      mean: target.mean,
      sd: target.sd,
      z: verdict.z,
      rules: verdict.rules,
      status: verdict.status,
      measuredAt,
      reagentLot: input.reagentLot ?? null,
      reagentExpiresOn: input.reagentExpiresOn ?? null,
      comment: input.comment ?? null,
      enteredBy: actor.id,
      enteredByName: actor.name,
      createdAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewedByName: null,
      correctiveAction: null,
      voidedAt: null,
      voidedBy: null,
      voidedByName: null,
      voidReason: null,
    };
    this.db.qcResults.push(r);
    await this.persist();
    return { ...r, rules: [...r.rules] };
  }

  async getQcResult(id: string): Promise<QcResult | undefined> {
    const r = this.db.qcResults.find((x) => x.id === id);
    return r && { ...r, rules: [...r.rules] };
  }

  async reviewQcResult(id: string, correctiveAction: string, actor: Actor): Promise<QcResult | undefined> {
    const r = this.db.qcResults.find((x) => x.id === id);
    if (!r) return undefined;
    if (r.reviewedAt) throw new StorageConflict(QC_RESULT_ALREADY_REVIEWED);
    Object.assign(r, { reviewedAt: new Date().toISOString(), reviewedBy: actor.id, reviewedByName: actor.name, correctiveAction });
    await this.persist();
    return { ...r, rules: [...r.rules] };
  }

  async voidQcResult(id: string, reason: string, actor: Actor): Promise<QcResult | undefined> {
    const r = this.db.qcResults.find((x) => x.id === id);
    if (!r) return undefined;
    if (r.voidedAt) throw new StorageConflict(QC_RESULT_ALREADY_VOIDED);
    Object.assign(r, { voidedAt: new Date().toISOString(), voidedBy: actor.id, voidedByName: actor.name, voidReason: reason });
    await this.persist();
    return { ...r, rules: [...r.rules] };
  }

  async listCalibrations(query: { deviceId?: string; limit?: number } = {}): Promise<CalibrationView[]> {
    return this.db.calibrations
      .filter((c) => !query.deviceId || c.deviceId === query.deviceId)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      .slice(0, query.limit ?? 200)
      .map((c) => ({
        ...c,
        deviceName: this.db.labDevices.find((d) => d.id === c.deviceId)?.name ?? "—",
        testName: c.testId ? (this.db.tests.find((t) => t.id === c.testId)?.name ?? null) : null,
      }));
  }

  async addCalibration(input: InsertCalibrationInput, actor: Actor): Promise<Calibration> {
    const now = new Date().toISOString();
    const c: Calibration = {
      id: randomUUID(),
      deviceId: input.deviceId,
      testId: input.testId ?? null,
      performedAt: input.performedAt ? new Date(input.performedAt).toISOString() : now,
      calibratorName: input.calibratorName,
      calibratorLot: input.calibratorLot ?? null,
      calibratorExpiresOn: input.calibratorExpiresOn ?? null,
      reagentLot: input.reagentLot ?? null,
      reagentExpiresOn: input.reagentExpiresOn ?? null,
      result: input.result,
      notes: input.notes ?? null,
      performedBy: actor.id,
      performedByName: actor.name,
      createdAt: now,
    };
    this.db.calibrations.push(c);
    await this.persist();
    return { ...c };
  }

  async listMaintenance(query: { deviceId?: string; limit?: number } = {}): Promise<DeviceMaintenanceView[]> {
    return this.db.deviceMaintenance
      .filter((m) => !query.deviceId || m.deviceId === query.deviceId)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
      .slice(0, query.limit ?? 200)
      .map((m) => ({ ...m, deviceName: this.db.labDevices.find((d) => d.id === m.deviceId)?.name ?? "—" }));
  }

  async addMaintenance(input: InsertMaintenanceInput, actor: Actor): Promise<DeviceMaintenanceEntry> {
    const now = new Date().toISOString();
    const m: DeviceMaintenanceEntry = {
      id: randomUUID(),
      deviceId: input.deviceId,
      performedAt: input.performedAt ? new Date(input.performedAt).toISOString() : now,
      kind: input.kind,
      description: input.description,
      nextDueOn: input.nextDueOn ?? null,
      performedBy: actor.id,
      performedByName: actor.name,
      createdAt: now,
    };
    this.db.deviceMaintenance.push(m);
    await this.persist();
    return { ...m };
  }

  async listEqa(query: { limit?: number } = {}): Promise<EqaResultView[]> {
    return [...this.db.eqaResults]
      .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit ?? 200)
      .map((e) => ({
        ...e,
        testName: this.db.tests.find((t) => t.id === e.testId)?.name ?? "—",
        deviceName: e.deviceId ? (this.db.labDevices.find((d) => d.id === e.deviceId)?.name ?? null) : null,
      }));
  }

  async addEqa(input: InsertEqaInput, actor: Actor): Promise<EqaResult> {
    const z = roundZ(zScore(input.reportedValue, input.assignedValue, input.sdpa));
    const e: EqaResult = {
      id: randomUUID(),
      provider: input.provider,
      cycle: input.cycle,
      sampleCode: input.sampleCode ?? null,
      testId: input.testId,
      deviceId: input.deviceId ?? null,
      sampleDate: input.sampleDate,
      reportedValue: input.reportedValue,
      assignedValue: input.assignedValue,
      sdpa: input.sdpa,
      z,
      evaluation: eqaEvaluation(z),
      notes: input.notes ?? null,
      enteredBy: actor.id,
      enteredByName: actor.name,
      createdAt: new Date().toISOString(),
      voidedAt: null,
      voidedBy: null,
      voidedByName: null,
      voidReason: null,
    };
    this.db.eqaResults.push(e);
    await this.persist();
    return { ...e };
  }

  async voidEqa(id: string, reason: string, actor: Actor): Promise<EqaResult | undefined> {
    const e = this.db.eqaResults.find((x) => x.id === id);
    if (!e) return undefined;
    if (e.voidedAt) throw new StorageConflict(QC_RESULT_ALREADY_VOIDED);
    Object.assign(e, { voidedAt: new Date().toISOString(), voidedBy: actor.id, voidedByName: actor.name, voidReason: reason });
    await this.persist();
    return { ...e };
  }

  // ------------------------------------------------------------ inventory (B5)

  async listInventoryItems(): Promise<InventoryItemView[]> {
    return [...this.db.inventoryItems]
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
      .map((i) => {
        const live = this.db.inventoryBatches.filter((b) => b.itemId === i.id && !b.cancelledAt);
        const expiries = live.filter((b) => b.remaining > 0 && b.expiresOn).map((b) => b.expiresOn!);
        return {
          ...i,
          onHand: live.reduce((s, b) => s + b.remaining, 0),
          nearestExpiry: expiries.length ? expiries.sort()[0] : null,
        };
      });
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const i = this.db.inventoryItems.find((x) => x.id === id);
    return i && { ...i };
  }

  async createInventoryItem(input: InsertInventoryItem, actor: Actor): Promise<InventoryItem> {
    const item: InventoryItem = {
      id: randomUUID(),
      name: input.name,
      kind: input.kind,
      code: input.code ?? null,
      manufacturer: input.manufacturer ?? null,
      unit: input.unit,
      minStock: input.minStock ?? 0,
      salePrice: input.salePrice ?? null,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      updatedAt: null,
      updatedBy: actor.id,
    };
    this.db.inventoryItems.push(item);
    await this.persist();
    return { ...item };
  }

  async updateInventoryItem(id: string, input: UpdateInventoryItemInput, actor: Actor): Promise<InventoryItem | undefined> {
    const i = this.db.inventoryItems.find((x) => x.id === id);
    if (!i) return undefined;
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (i as Record<string, unknown>)[k] = v;
    Object.assign(i, { updatedAt: new Date().toISOString(), updatedBy: actor.id });
    await this.persist();
    return { ...i };
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    if (this.db.stockMovements.some((m) => m.itemId === id)) throw new StorageConflict(ITEM_HAS_STOCK_HISTORY);
    const n = this.db.inventoryItems.length;
    this.db.inventoryItems = this.db.inventoryItems.filter((x) => x.id !== id);
    if (this.db.inventoryItems.length === n) return false;
    await this.persist();
    return true;
  }

  private receiptDetail(r: StockReceipt): StockReceiptDetail {
    const lines = this.db.inventoryBatches
      .filter((b) => b.receiptId === r.id)
      .map((b) => {
        const item = this.db.inventoryItems.find((i) => i.id === b.itemId);
        return { ...b, itemName: item?.name ?? "—", unit: item?.unit ?? "", kind: item?.kind ?? "consumable" };
      });
    return { ...r, lines };
  }

  async listReceipts(query: { limit?: number } = {}): Promise<StockReceiptView[]> {
    return [...this.db.stockReceipts]
      .sort((a, b) => b.number - a.number)
      .slice(0, query.limit ?? 200)
      .map((r) => ({ ...r, lineCount: this.db.inventoryBatches.filter((b) => b.receiptId === r.id).length }));
  }

  async getReceipt(id: string): Promise<StockReceiptDetail | undefined> {
    const r = this.db.stockReceipts.find((x) => x.id === id);
    return r && this.receiptDetail(r);
  }

  async createReceipt(input: CreateReceiptInput, actor: Actor): Promise<StockReceiptDetail> {
    const now = new Date().toISOString();
    this.db.counters.receiptNumber += 1;
    const receipt: StockReceipt = {
      id: randomUUID(),
      number: this.db.counters.receiptNumber,
      supplier: input.supplier,
      documentNumber: input.documentNumber ?? null,
      receivedOn: input.receivedOn,
      notes: input.notes ?? null,
      total: input.lines.reduce((s, l) => s + lineTotal(l.quantity, l.purchasePrice), 0),
      createdAt: now,
      createdBy: actor.id,
      createdByName: actor.name,
      cancelledAt: null,
      cancelledBy: null,
      cancelledByName: null,
      cancelReason: null,
    };
    this.db.stockReceipts.push(receipt);
    for (const l of input.lines) {
      const batch: InventoryBatch = {
        id: randomUUID(),
        itemId: l.itemId,
        receiptId: receipt.id,
        lotNumber: l.lotNumber ?? null,
        expiresOn: l.expiresOn ?? null,
        quantity: l.quantity,
        remaining: l.quantity,
        purchasePrice: l.purchasePrice,
        createdAt: now,
        cancelledAt: null,
      };
      this.db.inventoryBatches.push(batch);
      this.db.stockMovements.push({
        id: randomUUID(),
        itemId: l.itemId,
        batchId: batch.id,
        kind: "receipt",
        quantity: l.quantity,
        receiptId: receipt.id,
        issueId: null,
        note: null,
        createdAt: now,
        createdBy: actor.id,
        createdByName: actor.name,
      });
    }
    await this.persist();
    return this.receiptDetail(receipt);
  }

  async cancelReceipt(id: string, reason: string, actor: Actor): Promise<StockReceiptDetail | undefined> {
    const r = this.db.stockReceipts.find((x) => x.id === id);
    if (!r) return undefined;
    if (r.cancelledAt) throw new StorageConflict(RECEIPT_ALREADY_CANCELLED);
    const batches = this.db.inventoryBatches.filter((b) => b.receiptId === id);
    if (batches.some((b) => Math.abs(b.remaining - b.quantity) > 1e-9)) throw new StorageConflict(RECEIPT_IN_USE);
    const now = new Date().toISOString();
    for (const b of batches) {
      this.db.stockMovements.push({
        id: randomUUID(),
        itemId: b.itemId,
        batchId: b.id,
        kind: "receipt_cancel",
        quantity: -b.remaining,
        receiptId: id,
        issueId: null,
        note: reason,
        createdAt: now,
        createdBy: actor.id,
        createdByName: actor.name,
      });
      Object.assign(b, { remaining: 0, cancelledAt: now });
    }
    Object.assign(r, { cancelledAt: now, cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason });
    await this.persist();
    return this.receiptDetail(r);
  }

  // ------------------------------------------------------------- issues (B5.3)

  async listBatches(query: { itemId?: string } = {}): Promise<InventoryBatchView[]> {
    const items = new Map(this.db.inventoryItems.map((i) => [i.id, i]));
    return this.db.inventoryBatches
      .filter((b) => !b.cancelledAt && b.remaining > QTY_EPSILON && (!query.itemId || b.itemId === query.itemId))
      .map((b) => {
        const it = items.get(b.itemId);
        return { ...b, itemName: it?.name ?? "—", unit: it?.unit ?? "", kind: it?.kind ?? "consumable" };
      })
      .sort(
        (a, b) =>
          a.itemName.localeCompare(b.itemName) ||
          (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999") ||
          a.createdAt.localeCompare(b.createdAt),
      );
  }

  private issueView(i: StockIssue): StockIssueView {
    return {
      ...i,
      departmentName: i.departmentId ? (this.db.departments.find((d) => d.id === i.departmentId)?.name ?? null) : null,
      lineCount: this.db.stockMovements.filter((m) => m.issueId === i.id && (m.kind === "issue" || m.kind === "writeoff")).length,
    };
  }

  private issueDetail(i: StockIssue): StockIssueDetail {
    const lines: StockIssueLine[] = this.db.stockMovements
      .filter((m) => m.issueId === i.id && (m.kind === "issue" || m.kind === "writeoff"))
      .map((m) => {
        const b = this.db.inventoryBatches.find((x) => x.id === m.batchId);
        const it = this.db.inventoryItems.find((x) => x.id === m.itemId);
        return {
          movementId: m.id,
          itemId: m.itemId,
          itemName: it?.name ?? "—",
          unit: it?.unit ?? "",
          batchId: m.batchId,
          lotNumber: b?.lotNumber ?? null,
          expiresOn: b?.expiresOn ?? null,
          quantity: -m.quantity,
          purchasePrice: b?.purchasePrice ?? 0,
        };
      });
    return { ...this.issueView(i), lines };
  }

  async listIssues(query: { limit?: number } = {}): Promise<StockIssueView[]> {
    return [...this.db.stockIssues]
      .sort((a, b) => b.number - a.number)
      .slice(0, query.limit ?? 200)
      .map((i) => this.issueView(i));
  }

  async getIssue(id: string): Promise<StockIssueDetail | undefined> {
    const i = this.db.stockIssues.find((x) => x.id === id);
    return i && this.issueDetail(i);
  }

  async createIssue(input: CreateIssueInput, today: string, actor: Actor): Promise<StockIssueDetail> {
    const ids = new Set(input.lines.map((l) => l.itemId));
    const items = new Map(this.db.inventoryItems.filter((i) => ids.has(i.id)).map((i) => [i.id, i]));
    const batches = this.db.inventoryBatches.filter((b) => ids.has(b.itemId) && !b.cancelledAt);
    const plan = planIssue(input.kind, input.lines, batches, items, today);
    if (!plan.ok) throw new StorageConflict(plan.message);
    const now = new Date().toISOString();
    const byId = new Map(batches.map((b) => [b.id, b]));
    this.db.counters.issueNumber += 1;
    const issue: StockIssue = {
      id: randomUUID(),
      number: this.db.counters.issueNumber,
      kind: input.kind,
      departmentId: input.kind === "department" ? input.departmentId : null,
      receivedBy: input.kind === "department" ? (input.receivedBy ?? null) : null,
      reason: input.kind === "writeoff" ? input.reason : null,
      issuedOn: input.issuedOn,
      notes: input.notes ?? null,
      total: plan.allocations.reduce((s, a) => s + lineTotal(a.quantity, byId.get(a.batchId)!.purchasePrice), 0),
      createdAt: now,
      createdBy: actor.id,
      createdByName: actor.name,
      cancelledAt: null,
      cancelledBy: null,
      cancelledByName: null,
      cancelReason: null,
    };
    this.db.stockIssues.push(issue);
    for (const a of plan.allocations) {
      const b = byId.get(a.batchId)!;
      b.remaining = Math.max(0, b.remaining - a.quantity);
      if (b.remaining < QTY_EPSILON) b.remaining = 0;
      this.db.stockMovements.push({
        id: randomUUID(),
        itemId: a.itemId,
        batchId: a.batchId,
        kind: input.kind === "writeoff" ? "writeoff" : "issue",
        quantity: -a.quantity,
        receiptId: null,
        issueId: issue.id,
        note: null,
        createdAt: now,
        createdBy: actor.id,
        createdByName: actor.name,
      });
    }
    await this.persist();
    return this.issueDetail(issue);
  }

  async cancelIssue(id: string, reason: string, actor: Actor): Promise<StockIssueDetail | undefined> {
    const issue = this.db.stockIssues.find((x) => x.id === id);
    if (!issue) return undefined;
    if (issue.cancelledAt) throw new StorageConflict(ISSUE_ALREADY_CANCELLED);
    const now = new Date().toISOString();
    const out = this.db.stockMovements.filter((m) => m.issueId === id && (m.kind === "issue" || m.kind === "writeoff"));
    for (const m of out) {
      const b = this.db.inventoryBatches.find((x) => x.id === m.batchId);
      if (b) b.remaining = Math.min(b.quantity, b.remaining - m.quantity);
      this.db.stockMovements.push({
        id: randomUUID(),
        itemId: m.itemId,
        batchId: m.batchId,
        kind: "issue_cancel",
        quantity: -m.quantity,
        receiptId: null,
        issueId: id,
        note: reason,
        createdAt: now,
        createdBy: actor.id,
        createdByName: actor.name,
      });
    }
    Object.assign(issue, { cancelledAt: now, cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason });
    await this.persist();
    return this.issueDetail(issue);
  }

  async getLabBoard(day: string): Promise<LabBoard> {
    const all = this.db.orders.map((o) => this.hydrate(o));
    const { counts, groupsToday } = summarizeLabBoard(all, day, localDay);
    const awaiting = all
      .filter(awaitsSample)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, LAB_BOARD_AWAITING_LIMIT);
    return { date: day, counts, groupsToday, awaiting };
  }

  async getReceptionDay(day: string): Promise<ReceptionDay> {
    const orders = this.db.orders.filter((o) => o.status !== "cancelled" && localDay(o.createdAt) === day);
    const fresh = this.db.patients
      .filter((p) => localDay(p.createdAt) === day)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const billed = orders.reduce((s, o) => s + o.totalAmount, 0);
    const collected = orders.reduce((s, o) => s + Math.min(o.paidAmount, o.totalAmount), 0);
    return {
      date: day,
      patientsToday: new Set(this.db.visits.filter((v) => v.visitDate === day).map((v) => v.patientId)).size,
      newPatients: {
        total: fresh.length,
        latest: fresh.slice(0, 6).map((p) => ({
          id: p.id,
          patientNumber: p.patientNumber,
          fullName: p.fullName,
          phone: p.phone,
          createdAt: p.createdAt,
        })),
      },
      payments: {
        orders: orders.length,
        paid: orders.filter((o) => o.paidAmount >= o.totalAmount).length,
        partial: orders.filter((o) => o.paidAmount > 0 && o.paidAmount < o.totalAmount).length,
        unpaid: orders.filter((o) => o.paidAmount === 0 && o.totalAmount > 0).length,
        billed,
        collected,
        due: Math.max(0, billed - collected),
      },
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

  async getLogo(): Promise<ClinicLogo | null> {
    return this.db.logo ?? null;
  }

  async setLogo(logo: ClinicLogo | null, _actor: Actor): Promise<void> {
    this.db.logo = logo;
    await this.persist();
  }

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
