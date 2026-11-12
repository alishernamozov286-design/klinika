import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { defaultTests, testReferences } from "@shared/tests-data";
import {
  appSettings,
  labDevices,
  labDeviceErrors,
  qcMaterials,
  qcTargets,
  qcResults,
  calibrations,
  deviceMaintenance,
  eqaResults,
  inventoryItems,
  stockReceipts,
  inventoryBatches,
  stockMovements,
  stockIssues,
  stockCounts,
  stockCountLines,
  consumptionNorms,
  labConsumptions,
  auditLog,
  departments,
  doctors,
  expenses,
  labSettings,
  orderTests,
  orders,
  patientContacts,
  patients,
  visits,
  payments,
  roles,
  samples,
  telegramContacts,
  tests,
  users,
  userMfa,
  services,
  appointments,
  medicalRecords,
  medicalRecordVersions,
  patientAllergies,
  referrals,
  orderTestVersions,
  notifications,
  icd10,
  type IcdEntry,
  type IcdStats,
  type AppNotification,
  type NotificationFeed,
  type OrderTestVersion,
  type Referral,
  type ReferralBooking,
  type ReferralOrder,
  type ReferralWithDetails,
  type MedicalRecord,
  type MedicalRecordVersion,
  type MedicalRecordWithDetails,
  type PatientAllergy,
  type RecordFields,
  type RecordStatus,
  type Service,
  type ServiceKind,
  type ServiceWithDetails,
  type InsertService,
  type UpdateServiceInput,
  type Appointment,
  type AppointmentStatus,
  type AppointmentWithDetails,
  type UserMfa,
  type AuditEntry,
  type CreatePaymentInput,
  type Department,
  type DepartmentKind,
  type DepartmentWithUsage,
  type DoctorWithDetails,
  type InsertDepartment,
  type InsertDoctor,
  type DashboardStatsData,
  type ReceptionDay,
  type Expense,
  type ExpenseStatus,
  type ExpenseSummary,
  type InsertExpense,
  type PaymentMethod,
  type UpdateExpenseInput,
  daysBetween,
  previousRange,
  type Payment,
  type InsertPatient,
  type InsertTest,
  type InsertUser,
  type LabSettings,
  type LabSettingsInput,
  type Order,
  type OrderListResponse,
  type OrderStatus,
  type OrderTest,
  type OrderWithDetails,
  type Patient,
  type PatientCard,
  type PatientContact,
  type PatientDetails,
  type PatientListItem,
  type PublicUser,
  type RevenueReportData,
  type ResultFlag,
  type RoleRecord,
  type RoleWithUsage,
  type SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
  securitySettingsSchema,
  type Sample,
  type SampleStatus,
  type TelegramContact,
  type Test,
  type UpdateDepartmentInput,
  type UpdateDoctorInput,
  type UpdateOrderInput,
  type UpdateRoleInput,
  type UpdateSampleInput,
  type UpdateUserInput,
  type User,
  nationalPhoneDigits,
} from "@shared/schema";
import { canTransition, parseBarcode, sampleBarcode, transitionError } from "@shared/sample";
import { referralStage } from "@shared/referral";
import { classifyTest, isTestGroup, orderGroups } from "@shared/lab-catalogue";
import { LAB_BOARD_AWAITING_LIMIT, type LabBoard, type LabBoardCounts } from "@shared/lab-board";
import { checkLogo, type ClinicLogo } from "@shared/branding";
import {
  COUNTED_AFTER_DOCUMENT,
  COUNT_ALREADY_OPEN,
  COUNT_LINE_MISSING,
  COUNT_NOTHING,
  COUNT_NOT_OPEN,
  COUNT_POSTED_FINAL,
  INVENTORY_CODE_TAKEN,
  INVENTORY_NAME_TAKEN,
  ITEM_HAS_STOCK_HISTORY,
  ISSUE_ALREADY_CANCELLED,
  ISSUE_BATCH_GONE,
  QTY_EPSILON,
  RECEIPT_ALREADY_CANCELLED,
  RECEIPT_IN_USE,
  countedProblem,
  lineTotal,
  planCountPost,
  planIssue,
} from "@shared/inventory";
import {
  CONSUMPTION_ALREADY_CANCELLED,
  MAX_CONSUME_BATCH,
  NORM_ALREADY_RETIRED,
  NORM_CONSUMPTION_FINAL,
  NORM_DRAFT_EXISTS,
  NORM_NOT_DRAFT,
  planConsumptions,
  shortOf,
} from "@shared/consumption";
import { DEVICE_ERROR_ALREADY_RESOLVED, DEVICE_HAS_LOG } from "@shared/lab-devices";
import {
  QC_LOOKBACK,
  QC_RESULT_ALREADY_REVIEWED,
  QC_RESULT_ALREADY_VOIDED,
  QC_TARGET_EXISTS,
  eqaEvaluation,
  judgeQcRun,
  roundZ,
  zScore,
} from "@shared/qc";
import type {
  ConsumptionNorm,
  ConsumptionNormView,
  ExtraConsumptionInput,
  InsertNormInput,
  LabConsumption,
  LabConsumptionView,
  UpdateNormInput,
  CountEntryInput,
  CreateCountInput,
  StockCount,
  StockCountDetail,
  StockCountLine,
  StockCountView,
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
import { ICD_SOURCE, normalizeIcdCode } from "@shared/icd10";
import { amendProblem, pickForVerification } from "./lab-rules";
import { BLOCKING_TABLES, patientHistoryProblem, type BlockingTable } from "@shared/patient-links";
import { PAYMENT_ALREADY_VOIDED, TEST_IN_USE, orderDeleteProblem } from "@shared/ledger";
import { nextQueueNumber } from "@shared/appointment";
import { patientAge } from "@shared/patient-identity";
import { db } from "./db-pg";
import { hashPassword } from "./password";
import { LEGACY_ADMIN, SUPER_ADMIN, SYSTEM_ROLES, isPermission, type Permission } from "@shared/permissions";
import {
  DEFAULT_SETTINGS,
  SEED_USERS,
  buildPatientCard,
  sortRoles,
  type CreateRoleArgs,
  type SeedResult,
  todayKey,
  type Actor,
  StorageConflict,
  type AppointmentQuery,
  type NewReferrals,
  type NewNotification,
  type IcdQuery,
  type ReferralQuery,
  planResultSave,
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

/**
 * Postgres returns timestamptz as "2026-08-05 09:02:24.048+00", which Safari's
 * Date parser rejects. Normalise to ISO-8601 so both storage backends hand the
 * client byte-identical strings.
 */
const iso = <T extends string | null>(value: T): T =>
  (value ? (new Date(value).toISOString() as T) : value);

const mapUser = (row: typeof users.$inferSelect): User => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const mapTest = (row: typeof tests.$inferSelect): Test => ({
  ...row,
  group: row.group as Test["group"],
  sampleType: row.sampleType as Test["sampleType"],
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const mapPatient = (row: typeof patients.$inferSelect): Patient => ({
  ...row,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  telegramLinkedAt: iso(row.telegramLinkedAt),
});

const mapContact = (row: typeof patientContacts.$inferSelect): PatientContact => ({
  ...row,
  createdAt: iso(row.createdAt),
});

const mapOrder = (row: typeof orders.$inferSelect): Order => ({
  ...row,
  status: row.status as Order["status"],
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  completedAt: iso(row.completedAt),
  telegramSentAt: iso(row.telegramSentAt),
});

const mapItem = (row: typeof orderTests.$inferSelect): OrderTest => ({
  ...row,
  flag: row.flag as ResultFlag | null,
  completedAt: iso(row.completedAt),
  verifiedAt: iso(row.verifiedAt),
  returnedAt: iso(row.returnedAt),
});

const mapSample = (row: typeof samples.$inferSelect): Sample => ({
  ...row,
  status: row.status as SampleStatus,
  createdAt: iso(row.createdAt),
  collectedAt: iso(row.collectedAt),
  receivedAt: iso(row.receivedAt),
  rejectedAt: iso(row.rejectedAt),
});

const strip = (user: typeof users.$inferSelect): PublicUser => {
  const { password: _password, ...pub } = mapUser(user);
  return pub;
};

/**
 * Date filters compare on the lab's local day. Postgres stores timestamptz, so
 * the comparison is done in SQL against the server's own timezone rather than
 * pulling rows into JS first.
 */
const dayExpr = sql`(${orders.createdAt} AT TIME ZONE current_setting('TIMEZONE'))::date`;

const mapIcd = (row: typeof icd10.$inferSelect): IcdEntry => {
  const { updatedBy: _by, ...rest } = row;
  return { ...rest, kind: row.kind as IcdEntry["kind"], updatedAt: iso(row.updatedAt) };
};

const mapPayment = (row: typeof payments.$inferSelect): Payment => ({
  ...row,
  method: row.method as Payment["method"],
  createdAt: iso(row.createdAt) ?? row.createdAt,
  voidedAt: iso(row.voidedAt),
});

const mapRole = (row: typeof roles.$inferSelect): RoleRecord => ({
  ...row,
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
  permissions: (row.permissions ?? []).filter(isPermission) as Permission[],
});

const mapExpense = (row: typeof expenses.$inferSelect): Expense => ({
  ...row,
  method: row.method as PaymentMethod,
  status: row.status as ExpenseStatus,
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
  cancelledAt: iso(row.cancelledAt),
});

/** UQ_inventory_items_name / _code, raced past the route's check: the same 409 it gives. */
async function uniqueAsConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const e = err as { code?: string; constraint?: string };
    if (e?.code === "23505" && e.constraint?.startsWith("UQ_inventory_items")) {
      throw new StorageConflict(e.constraint.endsWith("_code") ? INVENTORY_CODE_TAKEN : INVENTORY_NAME_TAKEN);
    }
    throw err;
  }
}

const mapInventoryItem = (row: typeof inventoryItems.$inferSelect): InventoryItem => ({
  ...row,
  kind: row.kind as InventoryItem["kind"],
});
const mapQcResult = (row: typeof qcResults.$inferSelect): QcResult => ({
  ...row,
  rules: (row.rules ?? []) as QcResult["rules"],
  status: row.status as QcResult["status"],
});
const mapEqa = (row: typeof eqaResults.$inferSelect): EqaResult => ({
  ...row,
  evaluation: row.evaluation as EqaResult["evaluation"],
});

const mapDevice = (row: typeof labDevices.$inferSelect): LabDevice => ({
  ...row,
  direction: row.direction as LabDevice["direction"],
  connection: row.connection as LabDevice["connection"],
  status: row.status as LabDevice["status"],
});
const mapDeviceError = (row: typeof labDeviceErrors.$inferSelect): LabDeviceError => ({
  ...row,
  severity: row.severity as LabDeviceError["severity"],
});

const mapDepartment = (row: typeof departments.$inferSelect): Department => ({
  ...row,
  kind: row.kind as DepartmentKind,
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
});

/**
 * One query for a doctor and everything a screen shows next to them. The
 * account and the department are LEFT JOINed so a profile whose department was
 * removed still lists, rather than silently vanishing.
 */
const doctorSelect = () =>
  db
    .select({
      doctor: doctors,
      fullName: users.fullName,
      username: users.username,
      userActive: users.isActive,
      departmentName: departments.name,
    })
    .from(doctors)
    .leftJoin(users, eq(users.id, doctors.userId))
    .leftJoin(departments, eq(departments.id, doctors.departmentId));

type DoctorRow = Awaited<ReturnType<ReturnType<typeof doctorSelect>["execute"]>>[number];

const mapService = (row: typeof services.$inferSelect): Service => ({
  ...row,
  kind: row.kind as ServiceKind,
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
});

const mapAppointment = (row: typeof appointments.$inferSelect): Appointment => ({
  ...row,
  status: row.status as AppointmentStatus,
  arrivedAt: iso(row.arrivedAt),
  startedAt: iso(row.startedAt),
  completedAt: iso(row.completedAt),
  cancelledAt: iso(row.cancelledAt),
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
});

/** An appointment with everything the queue and the cabinet print next to it — one round trip. */
export const appointmentSelect = () =>
  db
    .select({
      a: appointments,
      patientNumber: patients.patientNumber,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      patientBirthDate: patients.birthDate,
      patientAgeRaw: patients.age,
      patientGender: patients.gender,
      doctorName: users.fullName,
      doctorUserId: doctors.userId,
      specialty: doctors.specialty,
      room: doctors.room,
      departmentName: departments.name,
      serviceName: services.name,
    })
    .from(appointments)
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .leftJoin(users, eq(users.id, doctors.userId))
    .leftJoin(departments, eq(departments.id, doctors.departmentId))
    .leftJoin(services, eq(services.id, appointments.serviceId));

type AppointmentRow = Awaited<ReturnType<ReturnType<typeof appointmentSelect>["execute"]>>[number];

const mapAppointmentRow = (r: AppointmentRow): AppointmentWithDetails => ({
  ...mapAppointment(r.a),
  patientNumber: r.patientNumber ?? 0,
  patientName: r.patientName ?? "—",
  patientPhone: r.patientPhone ?? "",
  patientBirthDate: r.patientBirthDate ?? null,
  patientAge: patientAge({ birthDate: r.patientBirthDate, age: r.patientAgeRaw }),
  patientGender: r.patientGender ?? null,
  doctorName: r.doctorName ?? "—",
  doctorUserId: r.doctorUserId ?? "",
  specialty: r.specialty ?? "",
  room: r.room ?? null,
  departmentName: r.departmentName ?? null,
  serviceName: r.serviceName ?? null,
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const issuerUser = alias(users, "issuer_user");
const targetDoctor = alias(doctors, "target_doctor");
const targetUser = alias(users, "target_user");
const cancelUser = alias(users, "cancel_user");

/** A referral with the names every screen shows. Progress is added by withProgress(). */
export const referralSelect = () =>
  db
    .select({
      r: referrals,
      patientNumber: patients.patientNumber,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      doctorName: issuerUser.fullName,
      doctorUserId: doctors.userId,
      specialty: doctors.specialty,
      serviceName: services.name,
      serviceKind: services.kind,
      servicePrice: services.price,
      targetDoctorName: targetUser.fullName,
      cancelledByName: cancelUser.fullName,
    })
    .from(referrals)
    .leftJoin(patients, eq(patients.id, referrals.patientId))
    .leftJoin(doctors, eq(doctors.id, referrals.doctorId))
    .leftJoin(issuerUser, eq(issuerUser.id, doctors.userId))
    .leftJoin(services, eq(services.id, referrals.serviceId))
    .leftJoin(targetDoctor, eq(targetDoctor.id, referrals.targetDoctorId))
    .leftJoin(targetUser, eq(targetUser.id, targetDoctor.userId))
    .leftJoin(cancelUser, eq(cancelUser.id, referrals.cancelledBy));

type ReferralRow = Awaited<ReturnType<ReturnType<typeof referralSelect>["execute"]>>[number];

const mapReferral = (row: typeof referrals.$inferSelect): Referral => ({
  ...row,
  kind: row.kind as Referral["kind"],
  status: row.status as Referral["status"],
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
  cancelledAt: iso(row.cancelledAt),
});

/** Bookings that still fulfil a referral: everything but cancelled and no-show. */
const LIVE_BOOKING = sql`status NOT IN ('cancelled', 'no_show')`;

/**
 * Serialises every booking write for one doctor's day. Taken inside the
 * transaction and released with it, so the "is it free?" check and the
 * insert are one step for everyone else booking the same doctor and day.
 */
const lockDoctorDay = (tx: Tx, doctorId: string, date: string) =>
  tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`appointments:${doctorId}:${date}`}))`);

/**
 * Whether a table from a later migration exists — used where a missing table
 * must not abort a transaction (a failed statement poisons the whole of it).
 */
const tableExists = async (tx: Tx | typeof db, table: string) => {
  const { rows } = await tx.execute<{ ok: boolean }>(sql`SELECT to_regclass(${"public." + table}) IS NOT NULL AS ok`);
  return Boolean(rows[0]?.ok);
};
const appointmentsTableExists = (tx: Tx | typeof db) => tableExists(tx, "appointments");

const mapRecord = (row: typeof medicalRecords.$inferSelect): MedicalRecord => ({
  ...row,
  status: row.status as RecordStatus,
  signedAt: iso(row.signedAt),
  amendedAt: iso(row.amendedAt),
  createdAt: iso(row.createdAt) ?? row.createdAt,
  updatedAt: iso(row.updatedAt),
});

const signer = alias(users, "signer");

/** A record with its doctor, appointment time and signer — one round trip. */
const recordSelect = () =>
  db
    .select({
      r: medicalRecords,
      patientNumber: patients.patientNumber,
      patientName: patients.fullName,
      doctorName: users.fullName,
      doctorUserId: doctors.userId,
      specialty: doctors.specialty,
      date: appointments.date,
      startTime: appointments.startTime,
      signedByName: signer.fullName,
    })
    .from(medicalRecords)
    .leftJoin(patients, eq(patients.id, medicalRecords.patientId))
    .leftJoin(doctors, eq(doctors.id, medicalRecords.doctorId))
    .leftJoin(users, eq(users.id, doctors.userId))
    .leftJoin(appointments, eq(appointments.id, medicalRecords.appointmentId))
    .leftJoin(signer, eq(signer.id, medicalRecords.signedBy));

type RecordRow = Awaited<ReturnType<ReturnType<typeof recordSelect>["execute"]>>[number];

const mapRecordRow = (r: RecordRow): MedicalRecordWithDetails => ({
  ...mapRecord(r.r),
  patientNumber: r.patientNumber ?? 0,
  patientName: r.patientName ?? "—",
  doctorName: r.doctorName ?? "—",
  doctorUserId: r.doctorUserId ?? "",
  specialty: r.specialty ?? "",
  date: r.date ?? (iso(r.r.createdAt) ?? r.r.createdAt).slice(0, 10),
  startTime: r.startTime ?? "",
  signedByName: r.signedByName ?? null,
});

const recordConflict = (status: RecordStatus | undefined) =>
  new StorageConflict(
    status === "signed"
      ? "Yozuv allaqachon tasdiqlangan. Sahifani yangilang"
      : "Yozuv boshqa oynada o'zgartirilgan. Sahifani yangilang — oxirgi saqlangan matn ko'rinadi",
  );

const mapDoctor = (row: DoctorRow): DoctorWithDetails => ({
  ...row.doctor,
  schedule: row.doctor.schedule ?? [],
  createdAt: iso(row.doctor.createdAt) ?? row.doctor.createdAt,
  updatedAt: iso(row.doctor.updatedAt),
  fullName: row.fullName ?? "—",
  username: row.username ?? "",
  userActive: row.userActive ?? false,
  departmentName: row.departmentName ?? null,
});

/** Postgres "undefined_table": the roles migration has not been run yet. */
export function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "42P01";
}

/*
 * Correlated subqueries below name their tables explicitly ("orders"."id",
 * aliases inside). Drizzle renders `${table.column}` WITHOUT the table name
 * in a single-table select, so `ot.order_id = ${orders.id}` became
 * `ot.order_id = "id"` — which Postgres resolves to the subquery's own id
 * column, silently matching nothing. Never interpolate an outer column into
 * a subquery here; write the qualified name.
 */
export class PgStorage implements IStorage {
  async seed(): Promise<SeedResult> {
    let createdTests = 0;
    const [{ count: testCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tests);

    if (testCount === 0) {
      const rows = defaultTests.map((t) => {
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
        };
      });
      await db.insert(tests).values(rows);
      createdTests = rows.length;
    }

    let createdUsers = 0;
    const [{ count: userCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    if (userCount === 0) {
      for (const u of SEED_USERS) {
        await db.insert(users).values({
          username: u.username,
          password: await hashPassword(u.password),
          fullName: u.fullName,
          role: u.role,
          isActive: true,
        });
      }
      createdUsers = SEED_USERS.length;
    }

    // Settings is a singleton row; create it if this is a fresh database.
    const existing = await db.select().from(labSettings).limit(1);
    if (existing.length === 0) {
      await db.insert(labSettings).values(DEFAULT_SETTINGS);
    }

    const migrated = await db
      .update(users)
      .set({ role: SUPER_ADMIN })
      .where(eq(users.role, LEGACY_ADMIN))
      .returning({ id: users.id });

    // One statement for all eleven: on Neon every round trip is a full
    // network hop, and ON CONFLICT keeps the clinic's edits to existing rows.
    let createdRoles = 0;
    try {
      const inserted = await db
        .insert(roles)
        .values(
          SYSTEM_ROLES.map((r) => ({
            key: r.key,
            name: r.name,
            description: r.description,
            permissions: [...r.permissions],
            isSystem: true,
          })),
        )
        .onConflictDoNothing({ target: roles.key })
        .returning({ key: roles.key });
      createdRoles = inserted.length;
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      console.warn(
        "[rbac] 'roles' jadvali topilmadi — standart rollar ishlatiladi. Jadvalni yaratish uchun: npm run db:roles",
      );
    }

    return { createdTests, createdUsers, createdRoles, migratedAdmins: migrated.length };
  }

  // ---------------------------------------------------------------- roles

  async listRoles(): Promise<RoleWithUsage[]> {
    const rows = await db
      .select({
        role: roles,
        userCount: sql<number>`(SELECT count(*)::int FROM ${users} u WHERE u.role = "roles"."key")`,
      })
      .from(roles);
    return sortRoles(rows.map((r) => ({ ...mapRole(r.role), userCount: r.userCount })));
  }

  async getRole(key: string): Promise<RoleRecord | undefined> {
    const [row] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
    return row && mapRole(row);
  }

  async createRole(input: CreateRoleArgs, actor: Actor): Promise<RoleRecord> {
    const [row] = await db
      .insert(roles)
      .values({
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        permissions: [...input.permissions],
        isSystem: input.isSystem ?? false,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    return mapRole(row);
  }

  async updateRole(key: string, input: UpdateRoleInput, actor: Actor): Promise<RoleRecord | undefined> {
    const patch: Partial<typeof roles.$inferInsert> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.permissions !== undefined) patch.permissions = [...input.permissions];
    const [row] = await db.update(roles).set(patch).where(eq(roles.key, key)).returning();
    return row && mapRole(row);
  }

  async deleteRole(key: string): Promise<boolean> {
    const rows = await db
      .delete(roles)
      .where(and(eq(roles.key, key), eq(roles.isSystem, false)))
      .returning({ key: roles.key });
    return rows.length > 0;
  }

  // ---------------------------------------------------------- departments

  async listDepartments(): Promise<DepartmentWithUsage[]> {
    const rows = await db
      .select({
        dept: departments,
        doctorCount: sql<number>`(SELECT count(*)::int FROM ${doctors} d WHERE d.department_id = "departments"."id")`,
      })
      .from(departments)
      .orderBy(desc(departments.isActive), asc(departments.name));
    return rows.map((r) => ({ ...mapDepartment(r.dept), doctorCount: r.doctorCount }));
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [row] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return row && mapDepartment(row);
  }

  async createDepartment(input: InsertDepartment, actor: Actor): Promise<Department> {
    const [row] = await db
      .insert(departments)
      .values({
        name: input.name,
        kind: input.kind,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    return mapDepartment(row);
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput, actor: Actor): Promise<Department | undefined> {
    const patch: Partial<typeof departments.$inferInsert> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    const [row] = await db.update(departments).set(patch).where(eq(departments.id, id)).returning();
    return row && mapDepartment(row);
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const rows = await db.delete(departments).where(eq(departments.id, id)).returning({ id: departments.id });
    return rows.length > 0;
  }

  // -------------------------------------------------------------- doctors

  async listDoctors(opts: { activeOnly?: boolean; departmentId?: string } = {}): Promise<DoctorWithDetails[]> {
    const where = [];
    if (opts.activeOnly) where.push(eq(doctors.isActive, true), eq(users.isActive, true));
    if (opts.departmentId) where.push(eq(doctors.departmentId, opts.departmentId));
    const rows = await doctorSelect()
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(doctors.isActive), asc(users.fullName));
    return rows.map(mapDoctor);
  }

  async getDoctor(id: string): Promise<DoctorWithDetails | undefined> {
    const [row] = await doctorSelect().where(eq(doctors.id, id)).limit(1);
    return row && mapDoctor(row);
  }

  async getDoctorByUser(userId: string): Promise<DoctorWithDetails | undefined> {
    const [row] = await doctorSelect().where(eq(doctors.userId, userId)).limit(1);
    return row && mapDoctor(row);
  }

  async createDoctor(input: InsertDoctor, actor: Actor): Promise<DoctorWithDetails> {
    const [row] = await db
      .insert(doctors)
      .values({
        userId: input.userId,
        departmentId: input.departmentId ?? null,
        specialty: input.specialty,
        room: input.room ?? null,
        consultationPrice: input.consultationPrice,
        slotMinutes: input.slotMinutes,
        schedule: input.schedule,
        isActive: input.isActive ?? true,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: doctors.id });
    return (await this.getDoctor(row.id))!;
  }

  async updateDoctor(id: string, input: UpdateDoctorInput, actor: Actor): Promise<DoctorWithDetails | undefined> {
    const patch: Partial<typeof doctors.$inferInsert> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    };
    if (input.departmentId !== undefined) patch.departmentId = input.departmentId ?? null;
    if (input.specialty !== undefined) patch.specialty = input.specialty;
    if (input.room !== undefined) patch.room = input.room ?? null;
    if (input.consultationPrice !== undefined) patch.consultationPrice = input.consultationPrice;
    if (input.slotMinutes !== undefined) patch.slotMinutes = input.slotMinutes;
    if (input.schedule !== undefined) patch.schedule = input.schedule;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    const rows = await db.update(doctors).set(patch).where(eq(doctors.id, id)).returning({ id: doctors.id });
    return rows.length ? this.getDoctor(id) : undefined;
  }

  async deleteDoctor(id: string): Promise<boolean> {
    const rows = await db.delete(doctors).where(eq(doctors.id, id)).returning({ id: doctors.id });
    return rows.length > 0;
  }

  // ------------------------------------------------------------- services

  async listServices(opts: { activeOnly?: boolean } = {}): Promise<ServiceWithDetails[]> {
    const rows = await db
      .select({
        service: services,
        departmentName: departments.name,
        appointmentCount: sql<number>`(SELECT count(*)::int FROM appointments ap WHERE ap.service_id = "services"."id")`,
      })
      .from(services)
      .leftJoin(departments, eq(departments.id, services.departmentId))
      .where(opts.activeOnly ? eq(services.isActive, true) : undefined)
      .orderBy(desc(services.isActive), asc(services.kind), asc(services.name))
      .catch(async (err) => {
        // Before db:appointments the count's table is missing; the catalogue still lists.
        if (!isMissingTable(err) || !(await this.servicesTableExists())) throw err;
        const plain = await db
          .select({ service: services, departmentName: departments.name })
          .from(services)
          .leftJoin(departments, eq(departments.id, services.departmentId))
          .where(opts.activeOnly ? eq(services.isActive, true) : undefined)
          .orderBy(desc(services.isActive), asc(services.kind), asc(services.name));
        return plain.map((r) => ({ ...r, appointmentCount: 0 }));
      });
    return rows.map((r) => ({
      ...mapService(r.service),
      departmentName: r.departmentName ?? null,
      appointmentCount: r.appointmentCount ?? 0,
    }));
  }

  private async servicesTableExists(): Promise<boolean> {
    const { rows } = await db.execute<{ ok: boolean }>(sql`SELECT to_regclass('public.services') IS NOT NULL AS ok`);
    return Boolean(rows[0]?.ok);
  }

  async getService(id: string): Promise<Service | undefined> {
    const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
    return row && mapService(row);
  }

  private async serviceDetails(id: string): Promise<ServiceWithDetails | undefined> {
    return (await this.listServices()).find((x) => x.id === id);
  }

  async createService(input: InsertService, actor: Actor): Promise<ServiceWithDetails> {
    const [row] = await db
      .insert(services)
      .values({
        name: input.name,
        kind: input.kind,
        departmentId: input.departmentId ?? null,
        price: input.price,
        durationMinutes: input.durationMinutes ?? null,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        createdBy: actor.id,
      })
      .returning({ id: services.id });
    return (await this.serviceDetails(row.id))!;
  }

  async updateService(id: string, input: UpdateServiceInput, actor: Actor): Promise<ServiceWithDetails | undefined> {
    const patch: Partial<typeof services.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    if (input.name !== undefined) patch.name = input.name;
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.departmentId !== undefined) patch.departmentId = input.departmentId ?? null;
    if (input.price !== undefined) patch.price = input.price;
    if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes ?? null;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    const rows = await db.update(services).set(patch).where(eq(services.id, id)).returning({ id: services.id });
    return rows.length ? this.serviceDetails(id) : undefined;
  }

  async deleteService(id: string): Promise<boolean> {
    const rows = await db.delete(services).where(eq(services.id, id)).returning({ id: services.id });
    return rows.length > 0;
  }

  // --------------------------------------------------------- appointments

  async listAppointments(q: AppointmentQuery): Promise<AppointmentWithDetails[]> {
    const where = [];
    if (q.date) where.push(eq(appointments.date, q.date));
    if (q.beforeDate) where.push(sql`${appointments.date} < ${q.beforeDate}`);
    if (q.doctorId) where.push(eq(appointments.doctorId, q.doctorId));
    if (q.patientId) where.push(eq(appointments.patientId, q.patientId));
    if (q.statuses?.length) where.push(inArray(appointments.status, q.statuses));
    const rows = await appointmentSelect()
      .where(where.length ? and(...where) : undefined)
      // A patient's history reads newest first; a day's queue in time order.
      .orderBy(
        ...(q.patientId
          ? [desc(appointments.date), desc(appointments.startTime)]
          : [asc(appointments.date), asc(appointments.startTime), asc(appointments.queueNumber)]),
      )
      .limit(Math.min(q.limit ?? 500, 2000));
    return rows.map(mapAppointmentRow);
  }

  async getAppointment(id: string): Promise<AppointmentWithDetails | undefined> {
    const [row] = await appointmentSelect().where(eq(appointments.id, id)).limit(1);
    return row && mapAppointmentRow(row);
  }

  /** The doctor's bookings for a day, read inside the locked transaction. */
  private async dayBookings(tx: Tx, doctorId: string, date: string): Promise<Appointment[]> {
    const rows = await tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date)));
    return rows.map(mapAppointment);
  }

  async createAppointment(input: NewAppointment, actor: Actor, check: BookingCheck): Promise<AppointmentWithDetails> {
    const id = await db.transaction(async (tx) => {
      await lockDoctorDay(tx, input.doctorId, input.date);
      if (input.referralId) {
        // The referral row lock serialises two desks booking the same referral
        // with different doctors; UQ_appointments_referral is the backstop.
        const [ref] = await tx
          .select({ id: referrals.id, status: referrals.status })
          .from(referrals)
          .where(eq(referrals.id, input.referralId))
          .for("update");
        if (!ref || ref.status !== "active") throw new StorageConflict("Yo'llanma bekor qilingan yoki topilmadi");
        const [taken] = await tx
          .select({ date: appointments.date, startTime: appointments.startTime })
          .from(appointments)
          .where(and(eq(appointments.referralId, input.referralId), LIVE_BOOKING))
          .limit(1);
        if (taken) throw new StorageConflict(`Bu yo'llanma bo'yicha bemor allaqachon yozilgan (${taken.date} ${taken.startTime})`);
      }
      const day = await this.dayBookings(tx, input.doctorId, input.date);
      const problem = check(day);
      if (problem) throw new StorageConflict(problem);
      const [row] = await tx
        .insert(appointments)
        .values({
          patientId: input.patientId,
          doctorId: input.doctorId,
          serviceId: input.serviceId ?? null,
          date: input.date,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          queueNumber: nextQueueNumber(day.map((a) => a.queueNumber)),
          status: "scheduled",
          price: input.price,
          reason: input.reason ?? null,
          referralId: input.referralId ?? null,
          createdBy: actor.id,
        })
        .returning({ id: appointments.id });
      return row.id;
    });
    return (await this.getAppointment(id))!;
  }

  async rescheduleAppointment(
    id: string,
    patch: { doctorId: string; date: string; startTime: string; durationMinutes: number; serviceId: string | null; price: number; reason: string | null },
    actor: Actor,
    check: BookingCheck,
  ): Promise<AppointmentWithDetails> {
    await db.transaction(async (tx) => {
      await lockDoctorDay(tx, patch.doctorId, patch.date);
      const [current] = await tx.select().from(appointments).where(eq(appointments.id, id)).limit(1).for("update");
      if (!current) throw new StorageConflict("Qabul topilmadi");
      if (current.status !== "scheduled") throw new StorageConflict("Faqat \"yozildi\" holatidagi qabulni ko'chirish mumkin");
      const day = await this.dayBookings(tx, patch.doctorId, patch.date);
      const problem = check(day);
      if (problem) throw new StorageConflict(problem);
      const sameQueue = current.doctorId === patch.doctorId && current.date === patch.date;
      await tx
        .update(appointments)
        .set({
          doctorId: patch.doctorId,
          date: patch.date,
          startTime: patch.startTime,
          durationMinutes: patch.durationMinutes,
          serviceId: patch.serviceId,
          price: patch.price,
          reason: patch.reason,
          queueNumber: sameQueue ? current.queueNumber : nextQueueNumber(day.map((a) => a.queueNumber)),
          updatedAt: new Date().toISOString(),
          updatedBy: actor.id,
        })
        .where(eq(appointments.id, id));
    });
    return (await this.getAppointment(id))!;
  }

  async setAppointmentStatus(id: string, change: AppointmentStatusChange, actor: Actor): Promise<AppointmentWithDetails> {
    const now = new Date().toISOString();
    const patch: Partial<typeof appointments.$inferInsert> = { status: change.to, updatedAt: now, updatedBy: actor.id };
    switch (change.to) {
      case "arrived":
        // Arrival is stamped once; coming back from "qabulda" keeps the first time.
        if (change.from !== "in_progress") patch.arrivedAt = now;
        break;
      case "in_progress":
        patch.startedAt = now;
        break;
      case "completed":
        patch.completedAt = now;
        break;
      case "cancelled":
        patch.cancelledAt = now;
        patch.cancelledBy = actor.id;
        patch.cancelReason = change.reason ?? null;
        break;
      case "scheduled":
        // An undone check-in: the patient is not here after all.
        patch.arrivedAt = null;
        patch.visitId = null;
        break;
    }

    const updated = await db.transaction(async (tx) => {
      if (change.to === "arrived" && change.from !== "in_progress") {
        const [current] = await tx
          .select({ patientId: appointments.patientId })
          .from(appointments)
          .where(eq(appointments.id, id))
          .limit(1);
        if (current) {
          // Today's visit (B2.5), shared with any lab order made today.
          const [visit] = await tx
            .insert(visits)
            .values({ patientId: current.patientId, visitDate: todayKey(), createdBy: actor.id })
            .onConflictDoUpdate({ target: [visits.patientId, visits.visitDate], set: { patientId: sql`excluded.patient_id` } })
            .returning({ id: visits.id });
          patch.visitId = visit.id;
        }
      }
      return tx
        .update(appointments)
        .set(patch)
        .where(and(eq(appointments.id, id), eq(appointments.status, change.from)))
        .returning({ id: appointments.id });
    });
    if (!updated.length) throw new StorageConflict("Qabul holati boshqa joyda o'zgartirilgan. Sahifani yangilang");
    return (await this.getAppointment(id))!;
  }

  // ---------------------------------------------------- examination records

  async listRecords(q: RecordQuery): Promise<MedicalRecordWithDetails[]> {
    const where = [];
    if (q.appointmentIds && q.appointmentIds.length === 0) return [];
    if (q.patientId) where.push(eq(medicalRecords.patientId, q.patientId));
    if (q.appointmentIds) where.push(inArray(medicalRecords.appointmentId, q.appointmentIds));
    if (q.doctorId) where.push(eq(medicalRecords.doctorId, q.doctorId));
    if (q.status) where.push(eq(medicalRecords.status, q.status));
    const rows = await recordSelect()
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(appointments.date), desc(appointments.startTime), desc(medicalRecords.createdAt))
      .limit(Math.min(q.limit ?? 500, 2000));
    return rows.map(mapRecordRow);
  }

  async getRecord(id: string): Promise<MedicalRecordWithDetails | undefined> {
    const [row] = await recordSelect().where(eq(medicalRecords.id, id)).limit(1);
    return row && mapRecordRow(row);
  }

  async getRecordByAppointment(appointmentId: string): Promise<MedicalRecordWithDetails | undefined> {
    const [row] = await recordSelect().where(eq(medicalRecords.appointmentId, appointmentId)).limit(1);
    return row && mapRecordRow(row);
  }

  async openRecord(input: OpenRecordInput, actor: Actor): Promise<MedicalRecordWithDetails> {
    // ON CONFLICT DO NOTHING: two tabs opening the same examination at once
    // end up on one record.
    await db
      .insert(medicalRecords)
      .values({
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        doctorId: input.doctorId,
        visitId: input.visitId,
        createdBy: actor.id,
      })
      .onConflictDoNothing({ target: medicalRecords.appointmentId });
    return (await this.getRecordByAppointment(input.appointmentId))!;
  }

  async saveRecordDraft(
    id: string,
    revision: number,
    fields: Partial<RecordFields>,
    actor: Actor,
  ): Promise<MedicalRecordWithDetails> {
    const rows = await db
      .update(medicalRecords)
      .set({ ...fields, revision: revision + 1, updatedAt: new Date().toISOString(), updatedBy: actor.id })
      .where(and(eq(medicalRecords.id, id), eq(medicalRecords.status, "draft"), eq(medicalRecords.revision, revision)))
      .returning({ id: medicalRecords.id });
    if (!rows.length) throw recordConflict((await this.getRecord(id))?.status);
    return (await this.getRecord(id))!;
  }

  async signRecord(id: string, revision: number, actor: Actor): Promise<MedicalRecordWithDetails> {
    const now = new Date().toISOString();
    const rows = await db
      .update(medicalRecords)
      .set({ status: "signed", signedAt: now, signedBy: actor.id, revision: revision + 1, updatedAt: now, updatedBy: actor.id })
      .where(and(eq(medicalRecords.id, id), eq(medicalRecords.status, "draft"), eq(medicalRecords.revision, revision)))
      .returning({ id: medicalRecords.id });
    if (!rows.length) throw recordConflict((await this.getRecord(id))?.status);
    return (await this.getRecord(id))!;
  }

  async amendRecord(
    id: string,
    revision: number,
    fields: RecordFields,
    reason: string,
    actor: Actor,
  ): Promise<MedicalRecordWithDetails> {
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(medicalRecords).where(eq(medicalRecords.id, id)).limit(1).for("update");
      if (!current) throw new StorageConflict("Yozuv topilmadi");
      if (current.status !== "signed") throw new StorageConflict("Faqat tasdiqlangan yozuvga tuzatish kiritiladi");
      if (current.revision !== revision) throw recordConflict(undefined);
      const now = new Date().toISOString();
      await tx.insert(medicalRecordVersions).values({
        recordId: id,
        version: current.version,
        complaints: current.complaints,
        anamnesis: current.anamnesis,
        examination: current.examination,
        preliminaryDiagnosis: current.preliminaryDiagnosis,
        finalDiagnosis: current.finalDiagnosis,
        recommendations: current.recommendations,
        preliminaryDiagnosisCode: current.preliminaryDiagnosisCode,
        finalDiagnosisCode: current.finalDiagnosisCode,
        signedAt: current.signedAt,
        signedBy: current.signedBy,
        replacedAt: now,
        replacedBy: actor.id,
        replaceReason: reason,
      });
      await tx
        .update(medicalRecords)
        .set({
          ...fields,
          version: current.version + 1,
          revision: current.revision + 1,
          signedAt: now,
          signedBy: actor.id,
          amendedAt: now,
          amendReason: reason,
          updatedAt: now,
          updatedBy: actor.id,
        })
        .where(eq(medicalRecords.id, id));
    });
    return (await this.getRecord(id))!;
  }

  async listRecordVersions(recordId: string): Promise<MedicalRecordVersion[]> {
    const rows = await db
      .select({ v: medicalRecordVersions, replacedByName: users.fullName })
      .from(medicalRecordVersions)
      .leftJoin(users, eq(users.id, medicalRecordVersions.replacedBy))
      .where(eq(medicalRecordVersions.recordId, recordId))
      .orderBy(desc(medicalRecordVersions.version));
    return rows.map((r) => ({
      ...r.v,
      signedAt: iso(r.v.signedAt),
      replacedAt: iso(r.v.replacedAt) ?? r.v.replacedAt,
      replacedByName: r.replacedByName ?? null,
    }));
  }

  // ------------------------------------------------------------- allergies

  private allergySelect() {
    return db
      .select({ a: patientAllergies, createdByName: users.fullName })
      .from(patientAllergies)
      .leftJoin(users, eq(users.id, patientAllergies.createdBy));
  }

  private mapAllergy(r: { a: typeof patientAllergies.$inferSelect; createdByName: string | null }): PatientAllergy {
    return {
      ...r.a,
      createdAt: iso(r.a.createdAt) ?? r.a.createdAt,
      removedAt: iso(r.a.removedAt),
      createdByName: r.createdByName ?? null,
    };
  }

  async listAllergies(patientId: string, opts: { includeInactive?: boolean } = {}): Promise<PatientAllergy[]> {
    const rows = await this.allergySelect()
      .where(
        opts.includeInactive
          ? eq(patientAllergies.patientId, patientId)
          : and(eq(patientAllergies.patientId, patientId), eq(patientAllergies.isActive, true)),
      )
      .orderBy(desc(patientAllergies.isActive), desc(patientAllergies.createdAt));
    return rows.map((r) => this.mapAllergy(r));
  }

  async getAllergy(id: string): Promise<PatientAllergy | undefined> {
    const [row] = await this.allergySelect().where(eq(patientAllergies.id, id)).limit(1);
    return row && this.mapAllergy(row);
  }

  async addAllergy(patientId: string, input: { allergen: string; reaction: string | null }, actor: Actor): Promise<PatientAllergy> {
    const [row] = await db
      .insert(patientAllergies)
      .values({ patientId, allergen: input.allergen, reaction: input.reaction, createdBy: actor.id })
      .returning({ id: patientAllergies.id });
    return (await this.getAllergy(row.id))!;
  }

  async deactivateAllergy(id: string, reason: string, actor: Actor): Promise<PatientAllergy> {
    const rows = await db
      .update(patientAllergies)
      .set({ isActive: false, removedAt: new Date().toISOString(), removedBy: actor.id, removeReason: reason })
      .where(and(eq(patientAllergies.id, id), eq(patientAllergies.isActive, true)))
      .returning({ id: patientAllergies.id });
    if (!rows.length) throw new StorageConflict("Bu yozuv allaqachon faol emas");
    return (await this.getAllergy(id))!;
  }

  // ---------------------------------------------------------------- MKB-10

  async searchIcd(query: IcdQuery): Promise<IcdEntry[]> {
    const q = query.q.trim();
    const parts = [];
    if (!query.all) parts.push(eq(icd10.selectable, true));
    const code = normalizeIcdCode(q);
    if (/^[A-Z]\d/.test(code)) {
      // A code, or the start of one: "I1" finds I10–I15 and their subdivisions.
      parts.push(sql`${icd10.code} LIKE ${code.replace(/[%_]/g, "") + "%"}`);
    } else if (q) {
      // Every word must appear, in the Russian or the Uzbek name.
      for (const word of q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
        const like = `%${word.replace(/[%_]/g, "")}%`;
        parts.push(sql`(${icd10.nameRu} ILIKE ${like} OR coalesce(${icd10.nameUz}, '') ILIKE ${like})`);
      }
    }
    const rows = await db
      .select()
      .from(icd10)
      .where(parts.length ? and(...parts) : undefined)
      .orderBy(asc(icd10.sortOrder))
      .limit(query.limit);
    return rows.map(mapIcd);
  }

  async getIcd(codes: string[]): Promise<IcdEntry[]> {
    if (codes.length === 0) return [];
    const rows = await db.select().from(icd10).where(inArray(icd10.code, codes));
    return rows.map(mapIcd);
  }

  async icdStats(): Promise<IcdStats> {
    const [r] = await db
      .select({
        total: sql<number>`count(*)::int`,
        selectable: sql<number>`count(*) FILTER (WHERE ${icd10.selectable})::int`,
        withUzbek: sql<number>`count(*) FILTER (WHERE ${icd10.nameUz} IS NOT NULL AND ${icd10.nameUz} <> '')::int`,
      })
      .from(icd10);
    return { total: r?.total ?? 0, selectable: r?.selectable ?? 0, withUzbek: r?.withUzbek ?? 0, source: ICD_SOURCE };
  }

  async setIcdUzName(code: string, nameUz: string | null, actor: Actor): Promise<IcdEntry | undefined> {
    const [row] = await db
      .update(icd10)
      .set({ nameUz, updatedAt: new Date().toISOString(), updatedBy: actor.id })
      .where(eq(icd10.code, code))
      .returning();
    return row && mapIcd(row);
  }

  async importIcdUzNames(names: Map<string, string>, actor: Actor): Promise<{ updated: number; unknown: string[] }> {
    const codes = [...names.keys()];
    if (codes.length === 0) return { updated: 0, unknown: [] };
    return db.transaction(async (tx) => {
      const known = new Set<string>();
      for (let i = 0; i < codes.length; i += 1000) {
        const slice = codes.slice(i, i + 1000);
        for (const r of await tx.select({ code: icd10.code }).from(icd10).where(inArray(icd10.code, slice))) known.add(r.code);
      }
      const now = new Date().toISOString();
      const pairs = codes.filter((c) => known.has(c));
      // One statement per thousand names: a VALUES list joined onto the table.
      for (let i = 0; i < pairs.length; i += 1000) {
        const chunk = pairs.slice(i, i + 1000);
        await tx.execute(sql`
          UPDATE icd10 AS t SET name_uz = v.name, updated_at = ${now}, updated_by = ${actor.id}
          FROM (VALUES ${sql.join(chunk.map((c) => sql`(${c}, ${names.get(c)!})`), sql`, `)}) AS v(code, name)
          WHERE t.code = v.code`);
      }
      return { updated: pairs.length, unknown: codes.filter((c) => !known.has(c)) };
    });
  }

  // -------------------------------------------------------- notifications

  async createNotification(input: NewNotification): Promise<boolean> {
    const rows = await db
      .insert(notifications)
      .values(input)
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async listNotifications(userId: string, limit: number): Promise<NotificationFeed> {
    // One round trip: the page and the unread count together.
    const [items, [{ unread }]] = await Promise.all([
      db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit),
      db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    ]);
    return {
      unread,
      items: items.map(({ dedupeKey: _key, ...n }): AppNotification => ({
        ...n,
        kind: n.kind as AppNotification["kind"],
        createdAt: iso(n.createdAt) ?? n.createdAt,
        readAt: iso(n.readAt),
      })),
    };
  }

  async markNotificationRead(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  }

  // ------------------------------------------------------------ referrals

  async listReferrals(q: ReferralQuery): Promise<ReferralWithDetails[]> {
    if (q.ids && q.ids.length === 0) return [];
    const parts = [];
    if (q.ids) parts.push(inArray(referrals.id, q.ids));
    if (q.patientId) parts.push(eq(referrals.patientId, q.patientId));
    if (q.appointmentId) parts.push(eq(referrals.appointmentId, q.appointmentId));
    if (q.awaitingBooking) {
      parts.push(eq(referrals.status, "active"));
      parts.push(sql`"referrals"."kind" <> 'lab'`);
      parts.push(sql`NOT EXISTS (SELECT 1 FROM appointments x
        WHERE x.referral_id = "referrals"."id" AND x.status NOT IN ('cancelled', 'no_show'))`);
    }
    const query = referralSelect()
      .where(parts.length ? and(...parts) : undefined)
      // The desk works the oldest waiting referral first; a card reads newest first.
      .orderBy(q.awaitingBooking ? asc(referrals.createdAt) : desc(referrals.createdAt));
    const rows = await (q.limit ? query.limit(q.limit) : query);
    return this.withProgress(rows);
  }

  async getReferral(id: string): Promise<ReferralWithDetails | undefined> {
    return (await this.listReferrals({ ids: [id] }))[0];
  }

  /** Adds the order or booking behind each referral, and the stage it puts it in. Two parallel queries. */
  private async withProgress(rows: ReferralRow[]): Promise<ReferralWithDetails[]> {
    if (rows.length === 0) return [];
    const labIds = rows.filter((r) => r.r.kind === "lab").map((r) => r.r.id);
    const bookedIds = rows.filter((r) => r.r.kind !== "lab").map((r) => r.r.id);

    const [orderRows, bookingRows] = await Promise.all([
      labIds.length
        ? db
            .select({
              id: orders.id,
              referralId: orders.referralId,
              orderNumber: orders.orderNumber,
              status: orders.status,
              totalAmount: orders.totalAmount,
              paidAmount: orders.paidAmount,
              tests: sql<number>`count(${orderTests.id})::int`,
              done: sql<number>`count(${orderTests.result})::int`,
              verified: sql<number>`count(${orderTests.verifiedAt})::int`,
              results: sql<ReferralOrder["results"]>`coalesce(json_agg(json_build_object(
                  'testName', ${orderTests.testName}, 'result', ${orderTests.result}, 'unit', ${orderTests.unit},
                  'referenceRange', ${orderTests.referenceRange}, 'flag', ${orderTests.flag})
                ORDER BY ${orderTests.testName}) FILTER (WHERE ${orderTests.verifiedAt} IS NOT NULL), '[]'::json)`,
              names: sql<string[]>`coalesce(array_agg(${orderTests.testName} ORDER BY ${orderTests.testName})
                FILTER (WHERE ${orderTests.id} IS NOT NULL), '{}')`,
            })
            .from(orders)
            .leftJoin(orderTests, eq(orderTests.orderId, orders.id))
            .where(inArray(orders.referralId, labIds))
            .groupBy(orders.id)
        : Promise.resolve([]),
      bookedIds.length
        ? appointmentSelect().where(
            and(inArray(appointments.referralId, bookedIds), notInArray(appointments.status, ["cancelled", "no_show"])),
          )
        : Promise.resolve([]),
    ]);

    const orderBy = new Map<string, ReferralOrder>(
      orderRows.map((o) => [
        o.referralId!,
        {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status as ReferralOrder["status"],
          totalAmount: o.totalAmount,
          paidAmount: o.paidAmount,
          tests: o.tests,
          done: o.done,
          verified: o.verified,
          results: o.results ?? [],
          testNames: o.names ?? [],
        },
      ]),
    );
    const bookingBy = new Map<string, ReferralBooking>();
    for (const b of bookingRows.map(mapAppointmentRow)) {
      bookingBy.set(b.referralId!, {
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        status: b.status,
        queueNumber: b.queueNumber,
        doctorName: b.doctorName,
      });
    }

    return rows.map((r) => {
      const base = mapReferral(r.r);
      const order = orderBy.get(base.id) ?? null;
      const booking = bookingBy.get(base.id) ?? null;
      return {
        ...base,
        patientNumber: r.patientNumber ?? 0,
        patientName: r.patientName ?? "—",
        patientPhone: r.patientPhone ?? "",
        doctorName: r.doctorName ?? "—",
        doctorUserId: r.doctorUserId ?? "",
        specialty: r.specialty ?? "",
        serviceName: r.serviceName ?? null,
        serviceKind: (r.serviceKind as ServiceKind | null) ?? null,
        servicePrice: r.servicePrice ?? null,
        targetDoctorName: r.targetDoctorName ?? null,
        cancelledByName: r.cancelledByName ?? null,
        order,
        booking,
        stage: referralStage({ kind: base.kind, status: base.status, order, booking }),
      };
    });
  }

  async createReferrals(input: NewReferrals, actor: Actor): Promise<ReferralWithDetails[]> {
    const selected = input.kind === "lab" ? (await db.select().from(tests).where(inArray(tests.id, input.testIds))).map(mapTest) : [];
    if (input.kind === "lab" && selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");

    const ids = await db.transaction(async (tx) => {
      const origin = {
        patientId: input.patientId,
        visitId: input.visitId,
        appointmentId: input.appointmentId,
        doctorId: input.doctorId,
        note: input.note,
        createdBy: actor.id,
      };
      if (input.kind === "lab") {
        const [ref] = await tx.insert(referrals).values({ ...origin, kind: "lab" }).returning({ id: referrals.id });
        await this.insertOrderTx(
          tx,
          {
            patientId: input.patientId,
            testIds: input.testIds,
            discount: 0,
            paidAmount: 0,
            notes: input.note,
            referrer: input.referrer,
            createdBy: actor.id,
          },
          selected,
          ref.id,
        );
        return [ref.id];
      }
      if (input.kind === "exam") {
        const made = await tx
          .insert(referrals)
          .values(input.serviceIds.map((serviceId) => ({ ...origin, kind: "exam", serviceId })))
          .returning({ id: referrals.id });
        return made.map((r) => r.id);
      }
      const [ref] = await tx
        .insert(referrals)
        .values({ ...origin, kind: "consult", targetSpecialty: input.targetSpecialty, targetDoctorId: input.targetDoctorId })
        .returning({ id: referrals.id });
      return [ref.id];
    });
    return this.listReferrals({ ids });
  }

  async cancelReferral(id: string, reason: string, actor: Actor): Promise<ReferralWithDetails | undefined> {
    const found = await db.transaction(async (tx) => {
      const [ref] = await tx.select().from(referrals).where(eq(referrals.id, id)).for("update");
      if (!ref) return false;
      if (ref.status === "cancelled") throw new StorageConflict("Yo'llanma allaqachon bekor qilingan");
      const now = new Date().toISOString();

      if (ref.kind === "lab") {
        const [order] = await tx
          .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
          .from(orders)
          .where(eq(orders.referralId, id))
          .for("update");
        if (order && order.status !== "cancelled") {
          const orderId = order.id;
          const { rows: [held] } = await tx.execute<{ paid: number; results: number }>(sql`
            SELECT
              (SELECT count(*) FROM payments p WHERE p.order_id = ${orderId} AND p.voided_at IS NULL)::int AS paid,
              (SELECT count(*) FROM order_tests ot WHERE ot.order_id = ${orderId} AND ot.result IS NOT NULL)::int AS results`);
          if ((held?.paid ?? 0) > 0 || (held?.results ?? 0) > 0) {
            throw new StorageConflict(
              `Tahlil buyurtmasi #${order.orderNumber} bo'yicha to'lov yoki natija bor. Uni registratura yoki laboratoriya hal qiladi`,
            );
          }
          await tx
            .update(orders)
            .set({ status: "cancelled", completedAt: null, updatedAt: now, updatedBy: actor.id })
            .where(eq(orders.id, order.id));
        }
      } else {
        const [booked] = await tx
          .select({ date: appointments.date, startTime: appointments.startTime })
          .from(appointments)
          .where(and(eq(appointments.referralId, id), LIVE_BOOKING))
          .limit(1);
        if (booked) {
          throw new StorageConflict(`Bemor bu yo'llanma bo'yicha navbatga yozilgan (${booked.date} ${booked.startTime}). Avval qabulni bekor qiling`);
        }
      }

      await tx
        .update(referrals)
        .set({ status: "cancelled", cancelledAt: now, cancelledBy: actor.id, cancelReason: reason, updatedAt: now, updatedBy: actor.id })
        .where(eq(referrals.id, id));
      return true;
    });
    return found ? this.getReferral(id) : undefined;
  }

  async doctorHasAppointments(doctorId: string): Promise<boolean> {
    if (!(await appointmentsTableExists(db))) return false;
    const [row] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .limit(1);
    return Boolean(row);
  }

  // ---------------------------------------------------------------- users

  async listUsers(): Promise<PublicUser[]> {
    const rows = await db.select().from(users).orderBy(asc(users.fullName));
    return rows.map(strip);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row && mapUser(row);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1);
    return row && mapUser(row);
  }

  async createUser(input: InsertUser, actor?: Actor): Promise<PublicUser> {
    const [row] = await db
      .insert(users)
      .values({
        username: input.username,
        password: await hashPassword(input.password),
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive ?? true,
        createdBy: actor?.id ?? null,
      })
      .returning();
    return strip(row);
  }

  async updateUser(id: string, input: UpdateUserInput, actor?: Actor): Promise<PublicUser | undefined> {
    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.username) patch.username = input.username;
    if (input.fullName) patch.fullName = input.fullName;
    if (input.role) patch.role = input.role;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.password) patch.password = await hashPassword(input.password);
    if (Object.keys(patch).length === 0) {
      const current = await this.getUser(id);
      return current ? strip(current) : undefined;
    }
    patch.updatedAt = new Date().toISOString();
    patch.updatedBy = actor?.id ?? null;
    const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    return row ? strip(row) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length > 0;
  }

  async setLockState(userId: string, state: LockState): Promise<void> {
    await db
      .update(users)
      .set({
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
        lockLevel: state.lockLevel,
        // Stamped on every write so an admin can see when the trouble started.
        lastFailedAt: state.failedAttempts > 0 || state.lockedUntil ? new Date().toISOString() : null,
      })
      .where(eq(users.id, userId));
  }

  // ------------------------------------------------------------------ 2FA

  async mfaAvailable(): Promise<boolean> {
    try {
      await db.select({ userId: userMfa.userId }).from(userMfa).limit(1);
      return true;
    } catch (err) {
      if (isMissingTable(err)) return false;
      throw err;
    }
  }

  async getUserMfa(userId: string): Promise<UserMfa | undefined> {
    try {
      const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
      return row;
    } catch (err) {
      // Not migrated yet: nobody has 2FA, and sign-in must keep working.
      if (isMissingTable(err)) return undefined;
      throw err;
    }
  }

  async listMfaEnrollments(): Promise<{ userId: string; enabledAt: string }[]> {
    try {
      return await db.select({ userId: userMfa.userId, enabledAt: userMfa.enabledAt }).from(userMfa);
    } catch (err) {
      if (isMissingTable(err)) return [];
      throw err;
    }
  }

  async saveUserMfa(
    input: { userId: string; secret: string; recoveryCodes: string[]; lastUsedStep: number },
    actor: Actor,
  ): Promise<UserMfa> {
    const now = new Date().toISOString();
    const values = {
      secret: input.secret,
      recoveryCodes: input.recoveryCodes,
      lastUsedStep: input.lastUsedStep,
      enabledAt: now,
      updatedAt: now,
      updatedBy: actor.id,
    };
    const [row] = await db
      .insert(userMfa)
      .values({ userId: input.userId, ...values })
      .onConflictDoUpdate({ target: userMfa.userId, set: values })
      .returning();
    return row;
  }

  async replaceRecoveryCodes(userId: string, hashes: string[], actor: Actor): Promise<boolean> {
    const rows = await db
      .update(userMfa)
      .set({ recoveryCodes: hashes, updatedAt: new Date().toISOString(), updatedBy: actor.id })
      .where(eq(userMfa.userId, userId))
      .returning({ userId: userMfa.userId });
    return rows.length > 0;
  }

  async consumeMfaStep(userId: string, step: number): Promise<boolean> {
    // The comparison is in the WHERE, so of two requests carrying the same
    // code only one row update happens — the other gets nothing back.
    const rows = await db
      .update(userMfa)
      .set({ lastUsedStep: step })
      .where(and(eq(userMfa.userId, userId), sql`${userMfa.lastUsedStep} < ${step}`))
      .returning({ userId: userMfa.userId });
    return rows.length > 0;
  }

  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    const rows = await db
      .update(userMfa)
      .set({
        recoveryCodes: sql`array_remove(${userMfa.recoveryCodes}, ${hash}::text)`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(userMfa.userId, userId), sql`${hash}::text = ANY(${userMfa.recoveryCodes})`))
      .returning({ userId: userMfa.userId });
    return rows.length > 0;
  }

  async deleteUserMfa(userId: string): Promise<boolean> {
    try {
      const rows = await db.delete(userMfa).where(eq(userMfa.userId, userId)).returning({ userId: userMfa.userId });
      return rows.length > 0;
    } catch (err) {
      if (isMissingTable(err)) return false;
      throw err;
    }
  }

  // ------------------------------------------------------------- patients

  async listPatients(query: PatientQuery = {}): Promise<Paged<PatientListItem>> {
    const search = query.search?.trim();
    let where;
    if (search) {
      const like = "%" + search + "%";
      const parts = [
        sql`${patients.fullName} ILIKE ${like}`,
        sql`${patients.phone} ILIKE ${like}`,
        sql`coalesce(${patients.address}, '') ILIKE ${like}`,
      ];
      // Formatting-insensitive phone match: "901234567" finds "+998 90 123 45 67".
      const digits = search.replace(/\D/g, "");
      if (digits.length >= 3) {
        parts.push(sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`);
      }
      // A bare number is the patient number itself: "14" or "#14".
      const numberMatch = search.match(/^#?\s*(\d{1,9})$/);
      if (numberMatch) parts.push(eq(patients.patientNumber, Number(numberMatch[1])));
      // Documents: "AA1234567" or a JShShIR typed in full or in part.
      const compact = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (compact.length >= 5) parts.push(sql`coalesce(${patients.passport}, '') LIKE ${"%" + compact + "%"}`);
      if (digits.length >= 6) parts.push(sql`coalesce(${patients.pinfl}, '') LIKE ${"%" + digits + "%"}`);
      where = or(...parts);
    }

    // Visit figures as correlated subqueries: one round trip, and they are
    // only computed for the page being returned. A visit is a day at the
    // clinic — a lab order, an attended doctor's appointment, or both.
    const withAppointments = await this.hasAppointmentsTable();
    const lastVisitAt = withAppointments
      ? sql<string | null>`(SELECT max(t) FROM (
            SELECT o.created_at AS t FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled'
            UNION ALL
            SELECT ap.arrived_at FROM appointments ap WHERE ap.patient_id = "patients"."id"
              AND ap.arrived_at IS NOT NULL AND ap.status IN ('arrived', 'in_progress', 'completed')
          ) x)`
      : sql<string | null>`(SELECT max(o.created_at) FROM ${orders} o
          WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled')`;
    const visitCount = withAppointments
      ? sql<number>`(SELECT count(DISTINCT k)::int FROM (
            SELECT coalesce(o.visit_id, ((o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date)::text) AS k
              FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled'
            UNION ALL
            SELECT ap.visit_id FROM appointments ap WHERE ap.patient_id = "patients"."id"
              AND ap.visit_id IS NOT NULL AND ap.status IN ('arrived', 'in_progress', 'completed')
          ) x)`
      : sql<number>`(SELECT count(DISTINCT coalesce(o.visit_id,
            ((o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date)::text))::int
          FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled')`;
    let q = db
      .select({ patient: patients, lastVisitAt, visitCount })
      .from(patients)
      .where(where)
      .orderBy(desc(patients.createdAt), desc(patients.patientNumber))
      .$dynamic();
    if (query.limit !== undefined) q = q.limit(query.limit);
    if (query.offset) q = q.offset(query.offset);

    const [rows, [{ count }]] = await Promise.all([
      q,
      db.select({ count: sql<number>`count(*)::int` }).from(patients).where(where),
    ]);

    return {
      items: rows.map((r) => ({
        ...mapPatient(r.patient),
        lastVisitAt: r.lastVisitAt ? new Date(r.lastVisitAt).toISOString() : null,
        visitCount: r.visitCount ?? 0,
      })),
      total: count,
    };
  }

  async getPatientDetails(id: string): Promise<PatientDetails | undefined> {
    const [[row], contacts] = await Promise.all([
      db.select().from(patients).where(eq(patients.id, id)).limit(1),
      db.select().from(patientContacts).where(eq(patientContacts.patientId, id)).orderBy(asc(patientContacts.createdAt)),
    ]);
    return row && { ...mapPatient(row), contacts: contacts.map(mapContact) };
  }

  async getPatientCard(id: string): Promise<PatientCard | undefined> {
    const [details, list, visitRows, paymentRows, appointmentList] = await Promise.all([
      this.getPatientDetails(id),
      this.listOrders({ patientId: id }),
      db.select().from(visits).where(eq(visits.patientId, id)),
      db
        .select({ payment: payments, orderNumber: orders.orderNumber })
        .from(payments)
        .innerJoin(orders, eq(orders.id, payments.orderId))
        .where(eq(orders.patientId, id)),
      (await this.hasAppointmentsTable()) ? this.listAppointments({ patientId: id }) : Promise.resolve([]),
    ]);
    if (!details) return undefined;
    return buildPatientCard(
      details,
      list.items,
      visitRows.map((v) => ({ ...v, createdAt: iso(v.createdAt) ?? v.createdAt })),
      paymentRows.map((r) => ({ ...mapPayment(r.payment), orderNumber: r.orderNumber })),
      appointmentList,
    );
  }

  /**
   * Whether `npm run db:appointments` has run. Queries that join appointments
   * into older screens (patients list, patient card) pick their SQL by it, so
   * those screens keep working on a database not migrated yet. Once true it
   * stays true; until then it is re-checked at most once a minute.
   */
  private appointmentsTable: { ok: boolean; at: number } = { ok: false, at: 0 };
  private async hasAppointmentsTable(): Promise<boolean> {
    if (this.appointmentsTable.ok || Date.now() - this.appointmentsTable.at < 60_000) return this.appointmentsTable.ok;
    this.appointmentsTable = { ok: await appointmentsTableExists(db), at: Date.now() };
    return this.appointmentsTable.ok;
  }

  async findPatientCandidates(q: PatientCandidateQuery): Promise<Patient[]> {
    const parts = [];
    if (q.pinfl) parts.push(eq(patients.pinfl, q.pinfl));
    if (q.passport) parts.push(eq(patients.passport, q.passport));
    if (q.phoneDigits?.length === 9) {
      parts.push(sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + q.phoneDigits}`);
    }
    // Surname prefix only — as typed, and in Latin for a name typed in
    // Cyrillic. The exact comparison is compareIdentity's, on this short list.
    for (const s of new Set([q.surname, q.nameKey].filter((v): v is string => Boolean(v && v.length >= 2)))) {
      parts.push(sql`${patients.fullName} ILIKE ${s + "%"}`);
    }
    if (!parts.length) return [];
    const where = q.excludeId ? and(or(...parts), sql`${patients.id} <> ${q.excludeId}`) : or(...parts);
    const rows = await db.select().from(patients).where(where).limit(30);
    return rows.map(mapPatient);
  }

  private async setEmergencyContact(
    tx: typeof db,
    patientId: string,
    contact: InsertPatient["emergencyContact"],
  ): Promise<void> {
    if (contact === undefined) return;
    await tx
      .delete(patientContacts)
      .where(and(eq(patientContacts.patientId, patientId), eq(patientContacts.isEmergency, true)));
    if (contact) {
      await tx.insert(patientContacts).values({
        patientId,
        name: contact.name,
        relation: contact.relation ?? null,
        phone: contact.phone,
        isEmergency: true,
      });
    }
  }

  async mergePatients(
    sourceId: string,
    targetId: string,
    actor?: Actor,
  ): Promise<{ orders: number; contacts: number; appointments: number } | undefined> {
    if (sourceId === targetId) return undefined;
    const stamp = { updatedAt: new Date().toISOString(), updatedBy: actor?.id ?? null };
    return db.transaction(async (tx) => {
      const [[source], [target]] = await Promise.all([
        tx.select().from(patients).where(eq(patients.id, sourceId)).limit(1),
        tx.select().from(patients).where(eq(patients.id, targetId)).limit(1),
      ]);
      if (!source || !target) return undefined;

      const moved = await tx
        .update(orders)
        .set({ patientId: targetId, ...stamp })
        .where(eq(orders.patientId, sourceId))
        .returning({ id: orders.id });

      // The real card keeps its own emergency contact if it has one.
      const [{ hasEmergency }] = await tx
        .select({ hasEmergency: sql<boolean>`count(*) > 0` })
        .from(patientContacts)
        .where(and(eq(patientContacts.patientId, targetId), eq(patientContacts.isEmergency, true)));
      const movedContacts = await tx
        .update(patientContacts)
        .set({ patientId: targetId })
        .where(
          hasEmergency
            ? and(eq(patientContacts.patientId, sourceId), eq(patientContacts.isEmergency, false))
            : eq(patientContacts.patientId, sourceId),
        )
        .returning({ id: patientContacts.id });
      await tx.delete(patientContacts).where(eq(patientContacts.patientId, sourceId));

      // Visits: a day both cards have becomes one visit (the target's); the
      // duplicate's other visits simply change owner.
      await tx.execute(sql`
        UPDATE ${orders} o SET visit_id = tv.id
        FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
        WHERE sv.patient_id = ${sourceId} AND o.visit_id = sv.id`);

      // Appointments (B2.7) follow the patient, re-pointed at the surviving visit.
      let movedAppointments = 0;
      if (await appointmentsTableExists(tx)) {
        await tx.execute(sql`
          UPDATE appointments ap SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND ap.visit_id = sv.id`);
        const movedAp = await tx
          .update(appointments)
          .set({ patientId: targetId })
          .where(eq(appointments.patientId, sourceId))
          .returning({ id: appointments.id });
        movedAppointments = movedAp.length;
      }
      // Clinical records (B3.3) and allergies follow the patient too.
      if (await tableExists(tx, "medical_records")) {
        await tx.execute(sql`
          UPDATE medical_records mr SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND mr.visit_id = sv.id`);
        await tx.update(medicalRecords).set({ patientId: targetId }).where(eq(medicalRecords.patientId, sourceId));
      }
      if (await tableExists(tx, "patient_allergies")) {
        await tx.update(patientAllergies).set({ patientId: targetId }).where(eq(patientAllergies.patientId, sourceId));
      }
      // Referrals (B3.5) follow the patient, re-pointed at the surviving visit.
      if (await tableExists(tx, "referrals")) {
        await tx.execute(sql`
          UPDATE referrals rf SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND rf.visit_id = sv.id`);
        await tx.update(referrals).set({ patientId: targetId }).where(eq(referrals.patientId, sourceId));
      }
      await tx.execute(sql`
        DELETE FROM ${visits} sv USING ${visits} tv
        WHERE sv.patient_id = ${sourceId} AND tv.patient_id = ${targetId} AND tv.visit_date = sv.visit_date`);
      await tx.update(visits).set({ patientId: targetId }).where(eq(visits.patientId, sourceId));

      // Fill gaps on the real card from the duplicate; never overwrite. The
      // Telegram chat is released from the duplicate first: it is unique.
      const fill: Partial<typeof patients.$inferInsert> = {};
      for (const k of ["birthDate", "passport", "pinfl", "address", "gender", "age"] as const) {
        if (target[k] == null && source[k] != null) (fill as Record<string, unknown>)[k] = source[k];
      }
      const takeChat = !target.telegramChatId && source.telegramChatId;
      await tx.delete(patients).where(eq(patients.id, sourceId));
      if (takeChat) {
        fill.telegramChatId = source.telegramChatId;
        fill.telegramLinkedAt = source.telegramLinkedAt;
      }
      // Stamped even with nothing to fill: the card now carries the duplicate's history.
      await tx.update(patients).set({ ...fill, ...stamp }).where(eq(patients.id, targetId));
      return { orders: moved.length, contacts: movedContacts.length, appointments: movedAppointments };
    });
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    const [row] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    return row && mapPatient(row);
  }

  async getPatientByPhone(phone: string): Promise<Patient | undefined> {
    const digits = nationalPhoneDigits(phone);
    if (digits.length !== 9) return undefined;
    // Suffix match on the digits only: the column keeps "+998 90 123 45 67".
    const [row] = await db
      .select()
      .from(patients)
      .where(sql`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits}`)
      .orderBy(desc(patients.createdAt))
      .limit(1);
    return row && mapPatient(row);
  }

  async getPatientByChatId(chatId: string): Promise<Patient | undefined> {
    const [row] = await db
      .select()
      .from(patients)
      .where(eq(patients.telegramChatId, chatId))
      .limit(1);
    return row && mapPatient(row);
  }

  async createPatient(input: InsertPatient, actor?: Actor): Promise<Patient> {
    const [row] = await db
      .insert(patients)
      .values({
        fullName: input.fullName,
        phone: input.phone,
        address: input.address ?? null,
        age: input.age ?? null,
        gender: input.gender ?? null,
        birthDate: input.birthDate ?? null,
        passport: input.passport ?? null,
        pinfl: input.pinfl ?? null,
        createdBy: actor?.id ?? null,
        updatedBy: actor?.id ?? null,
      })
      .returning();
    await this.setEmergencyContact(db, row.id, input.emergencyContact);
    return mapPatient(row);
  }

  async updatePatient(id: string, input: Partial<InsertPatient>, actor?: Actor): Promise<Patient | undefined> {
    const patch: Partial<typeof patients.$inferInsert> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.id ?? null,
    };
    if (input.fullName !== undefined) patch.fullName = input.fullName;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.address !== undefined) patch.address = input.address ?? null;
    if (input.age !== undefined) patch.age = input.age ?? null;
    if (input.gender !== undefined) patch.gender = input.gender ?? null;
    if (input.birthDate !== undefined) patch.birthDate = input.birthDate ?? null;
    if (input.passport !== undefined) patch.passport = input.passport ?? null;
    if (input.pinfl !== undefined) patch.pinfl = input.pinfl ?? null;
    const [row] = await db.update(patients).set(patch).where(eq(patients.id, id)).returning();
    if (!row) return undefined;
    await this.setEmergencyContact(db, id, input.emergencyContact);
    return mapPatient(row);
  }

  async deletePatient(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // The card is locked first, so history cannot be attached between the check and the delete.
      const [locked] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, id)).for("update");
      if (!locked) return false;

      // Refuse rather than orphan history. Two round trips whatever the number
      // of modules: which tables exist (one not yet migrated holds nothing),
      // then one count per existing table in a single statement.
      const { rows: present } = await tx.execute<{ name: BlockingTable }>(sql`
        SELECT t.name FROM unnest(string_to_array(${BLOCKING_TABLES.join(",")}, ',')) AS t(name)
        WHERE to_regclass('public.' || t.name) IS NOT NULL`);
      const counts: Partial<Record<BlockingTable, number>> = {};
      if (present.length) {
        const { rows } = await tx.execute<{ name: BlockingTable; n: number }>(
          sql.join(
            present.map(
              ({ name }) =>
                sql`SELECT ${name}::text AS name, count(*)::int AS n FROM ${sql.identifier(name)} x WHERE x.patient_id = ${id}`,
            ),
            sql` UNION ALL `,
          ),
        );
        for (const r of rows) counts[r.name] = r.n;
      }
      const problem = patientHistoryProblem(counts);
      if (problem) throw new StorageConflict(problem);

      await tx.delete(patientContacts).where(eq(patientContacts.patientId, id));
      await tx.delete(visits).where(eq(visits.patientId, id));
      const rows = await tx.delete(patients).where(eq(patients.id, id)).returning({ id: patients.id });
      return rows.length > 0;
    });
  }

  // ---------------------------------------------------------------- tests

  async listTests(opts: { activeOnly?: boolean } = {}): Promise<Test[]> {
    const rows = await db
      .select()
      .from(tests)
      .where(opts.activeOnly ? eq(tests.isActive, true) : undefined)
      .orderBy(asc(tests.category), asc(tests.name));
    return rows.map(mapTest);
  }

  async getTest(id: string): Promise<Test | undefined> {
    const [row] = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
    return row && mapTest(row);
  }

  async createTest(input: InsertTest, actor: Actor): Promise<Test> {
    const [row] = await db
      .insert(tests)
      .values({
        name: input.name,
        price: input.price,
        category: input.category,
        group: input.group,
        sampleType: input.sampleType,
        unit: input.unit ?? null,
        referenceRange: input.referenceRange ?? null,
        isActive: input.isActive ?? true,
        createdBy: actor.id,
      })
      .returning();
    return mapTest(row);
  }

  async updateTest(id: string, input: Partial<InsertTest>, actor: Actor): Promise<Test | undefined> {
    const patch: Partial<typeof tests.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.price !== undefined) patch.price = input.price;
    if (input.category !== undefined) patch.category = input.category;
    if (input.group !== undefined) patch.group = input.group;
    if (input.sampleType !== undefined) patch.sampleType = input.sampleType;
    if (input.unit !== undefined) patch.unit = input.unit ?? null;
    if (input.referenceRange !== undefined) patch.referenceRange = input.referenceRange ?? null;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (Object.keys(patch).length === 0) return this.getTest(id);
    patch.updatedAt = new Date().toISOString();
    patch.updatedBy = actor.id;
    const [row] = await db.update(tests).set(patch).where(eq(tests.id, id)).returning();
    return row && mapTest(row);
  }

  async deleteTest(id: string): Promise<boolean> {
    // Check and delete in one statement, so an order placed in between
    // cannot slip past the check.
    const { rows } = await db.execute<{ deleted: boolean; used: boolean }>(sql`
      WITH used AS (
        SELECT EXISTS (SELECT 1 FROM order_tests ot WHERE ot.test_id = ${id}) AS used
      ), gone AS (
        DELETE FROM tests t WHERE t.id = ${id} AND NOT (SELECT u.used FROM used u) RETURNING t.id
      )
      SELECT EXISTS (SELECT 1 FROM gone) AS deleted, (SELECT u.used FROM used u) AS used`);
    if (rows[0]?.used) throw new StorageConflict(TEST_IN_USE);
    return Boolean(rows[0]?.deleted);
  }

  // --------------------------------------------------------------- orders

  /** Attaches patient + line items + sample to a set of orders in three extra queries. */
  private async hydrate(rows: (typeof orders.$inferSelect)[]): Promise<OrderWithDetails[]> {
    if (rows.length === 0) return [];
    const orderIds = rows.map((o) => o.id);
    const patientIds = Array.from(new Set(rows.map((o) => o.patientId)));

    // The sample is fetched for the whole page in one query rather than per
    // row: the results queue renders 24 cards and each needs its tube's status
    // to decide whether to warn, which row-by-row would be 24 round trips.
    // Each line's catalogue group comes along in the same query (TZ §6.1.2).
    const [items, people, tubes] = await Promise.all([
      db
        .select({ line: orderTests, group: tests.group })
        .from(orderTests)
        .leftJoin(tests, eq(tests.id, orderTests.testId))
        .where(inArray(orderTests.orderId, orderIds)),
      db.select().from(patients).where(inArray(patients.id, patientIds)),
      db.select().from(samples).where(inArray(samples.orderId, orderIds)),
    ]);

    const byPatient = new Map(people.map((p) => [p.id, mapPatient(p)]));
    const bySample = new Map(tubes.map((s) => [s.orderId, mapSample(s)]));
    const byOrder = new Map<string, OrderTest[]>();
    const groupsOf = new Map<string, (string | null)[]>();
    for (const { line, group } of items) {
      const list = byOrder.get(line.orderId) ?? [];
      list.push(mapItem(line));
      byOrder.set(line.orderId, list);
      const groups = groupsOf.get(line.orderId) ?? [];
      groups.push(group);
      groupsOf.set(line.orderId, groups);
    }

    // Referral numbers only for the orders that came from a doctor.
    const referralIds = Array.from(new Set(rows.map((o) => o.referralId).filter((id): id is string => Boolean(id))));
    const numbers = referralIds.length
      ? await db
          .select({ id: referrals.id, n: referrals.referralNumber })
          .from(referrals)
          .where(inArray(referrals.id, referralIds))
      : [];
    const byReferral = new Map(numbers.map((r) => [r.id, r.n]));

    return rows.map((row) => ({
      ...mapOrder(row),
      patient: byPatient.get(row.patientId) ?? null,
      items: byOrder.get(row.id) ?? [],
      // Null for orders created before sample tracking existed.
      sample: bySample.get(row.id) ?? null,
      referralNumber: row.referralId ? (byReferral.get(row.referralId) ?? null) : null,
      groups: orderGroups(groupsOf.get(row.id) ?? []),
    }));
  }

  async listOrders(query: OrderQuery = {}): Promise<OrderListResponse> {
    // "base" holds every filter except status and queue: the summary has to
    // count across all four statuses and both queues, otherwise the tabs would
    // only ever report the tab you are already looking at.
    const base = [];
    if (query.patientId) base.push(eq(orders.patientId, query.patientId));
    if (query.from) base.push(gte(dayExpr, sql`${query.from}::date`));
    if (query.to) base.push(lte(dayExpr, sql`${query.to}::date`));

    const search = query.search?.trim();
    if (search) {
      const like = "%" + search + "%";
      const digits = search.replace(/\D/g, "");
      // Same formatting-insensitive phone rule as listPatients.
      const phoneDigits =
        digits.length >= 3
          ? sql` OR regexp_replace(p.phone, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`
          : sql``;
      base.push(sql`(
        EXISTS (SELECT 1 FROM ${patients} p
                WHERE p.id = "orders"."patient_id"
                  AND (p.full_name ILIKE ${like} OR p.phone ILIKE ${like}${phoneDigits}))
        OR ${orders.orderNumber}::text ILIKE ${like}
        OR EXISTS (SELECT 1 FROM ${orderTests} ot
                   WHERE ot.order_id = "orders"."id" AND ot.test_name ILIKE ${like})
      )`);
    }
    // The group chips count with the group filter lifted, as the status tabs do.
    const scopeWhere = base.length ? and(...base) : undefined;
    const groupKey = query.group;
    if (groupKey) {
      base.push(sql`EXISTS (SELECT 1 FROM ${orderTests} ot JOIN ${tests} t ON t.id = ot.test_id
                            WHERE ot.order_id = "orders"."id" AND t."group" = ${groupKey})`);
    }
    const baseWhere = base.length ? and(...base) : undefined;

    const notCancelled = sql`${orders.status} <> 'cancelled'`;
    const hasItems = sql`EXISTS (SELECT 1 FROM ${orderTests} ot WHERE ot.order_id = "orders"."id")`;
    // B4.5: the laborant's queue (a value to enter, or one sent back), the lab
    // head's queue (entered, not yet checked), and released (all verified).
    const hasBlank = sql`EXISTS (SELECT 1 FROM ${orderTests} ot
                                 WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL
                                   AND (ot.result IS NULL OR ot.result = '' OR ot.returned_at IS NOT NULL))`;
    const hasReview = sql`EXISTS (SELECT 1 FROM ${orderTests} ot
                                  WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL
                                    AND ot.result IS NOT NULL AND ot.result <> '' AND ot.returned_at IS NULL)`;
    const hasUnverified = sql`EXISTS (SELECT 1 FROM ${orderTests} ot
                                      WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL)`;
    const readyExpr = sql`(${hasItems} AND NOT ${hasUnverified})`;

    const conditions = [...base];
    if (query.status) conditions.push(eq(orders.status, query.status));
    if (query.queue) {
      conditions.push(notCancelled);
      conditions.push(query.queue === "waiting" ? hasBlank : query.queue === "review" ? hasReview : readyExpr);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    let q = db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).$dynamic();
    if (query.limit !== undefined) q = q.limit(query.limit);
    if (query.offset) q = q.offset(query.offset);

    const liveBase = baseWhere ? and(baseWhere, notCancelled) : notCancelled;
    const billable = where ? and(where, notCancelled) : notCancelled;

    const [rows, statusRows, [queueRow], [totalsRow], [{ count }], groupRows] = await Promise.all([
      q,
      db
        .select({ status: orders.status, count: sql<number>`count(*)::int` })
        .from(orders)
        .where(baseWhere)
        .groupBy(orders.status),
      db
        .select({
          waiting: sql<number>`count(*) FILTER (WHERE ${hasBlank})::int`,
          review: sql<number>`count(*) FILTER (WHERE ${hasReview})::int`,
          ready: sql<number>`count(*) FILTER (WHERE ${readyExpr})::int`,
        })
        .from(orders)
        .where(liveBase),
      db
        .select({
          sum: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
          paid: sql<number>`coalesce(sum(${orders.paidAmount}), 0)::int`,
        })
        .from(orders)
        .where(billable),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
      db
        .select({ group: tests.group, count: sql<number>`count(DISTINCT ${orderTests.orderId})::int` })
        .from(orderTests)
        .innerJoin(tests, eq(tests.id, orderTests.testId))
        .innerJoin(orders, eq(orders.id, orderTests.orderId))
        .where(scopeWhere)
        .groupBy(tests.group),
    ]);

    const groups: OrderListResponse["summary"]["groups"] = {};
    for (const row of groupRows) if (isTestGroup(row.group)) groups[row.group] = row.count;

    const counts = { all: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const row of statusRows) {
      counts.all += row.count;
      if (row.status in counts) counts[row.status as OrderStatus] = row.count;
    }

    const sum = totalsRow?.sum ?? 0;
    const paid = totalsRow?.paid ?? 0;

    return {
      items: await this.hydrate(rows),
      total: count,
      summary: {
        counts,
        results: { waiting: queueRow?.waiting ?? 0, review: queueRow?.review ?? 0, ready: queueRow?.ready ?? 0 },
        totals: { sum, paid, debt: Math.max(0, sum - paid) },
        groups,
      },
    };
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    const [hydrated] = await this.hydrate(rows);
    if (!hydrated) return undefined;
    // Only the single-order view carries the ledger; loading it per row in the
    // list endpoints would be an N+1 for something no list renders.
    hydrated.payments = await this.listPayments(id);
    return hydrated;
  }

  private async listPayments(orderId: string): Promise<Payment[]> {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
    return rows.map(mapPayment);
  }

  /**
   * orders.paidAmount is a cache of the ledger. Recomputing it from the rows
   * after every change is what keeps the two from drifting — incrementing it in
   * place silently loses a payment whenever a write fails halfway.
   */
  private async syncPaid(tx: typeof db, orderId: string, actor: Actor): Promise<void> {
    await tx
      .update(orders)
      .set({
        paidAmount: sql`greatest(0, (SELECT coalesce(sum(p.amount), 0)::int FROM payments p
          WHERE p.order_id = ${orderId} AND p.voided_at IS NULL))`,
        updatedAt: new Date().toISOString(),
        updatedBy: actor.id,
      })
      .where(eq(orders.id, orderId));
  }

  async createOrder(input: CreateOrderArgs): Promise<OrderWithDetails> {
    const patient = await this.getPatient(input.patientId);
    if (!patient) throw new Error("Bemor topilmadi");

    const selected = (await db.select().from(tests).where(inArray(tests.id, input.testIds))).map(mapTest);
    if (selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");

    // One transaction, so an order never exists without its line items.
    const orderId = await db.transaction((tx) => this.insertOrderTx(tx, input, selected, null));
    return (await this.getOrder(orderId))!;
  }

  /**
   * The order, its lines, its tube and the opening payment, written inside the
   * caller's transaction. Shared by the desk (createOrder) and the doctor's
   * lab referral (createReferrals), so both make exactly the same order.
   */
  private async insertOrderTx(tx: Tx, input: CreateOrderArgs, selected: Test[], referralId: string | null): Promise<string> {
    const subtotal = selected.reduce((sum, t) => sum + t.price, 0);
    const discount = Math.min(input.discount, subtotal);
    const total = subtotal - discount;
    const opening = Math.min(input.paidAmount, total);
    {
      // Today's visit for this patient, made on first use. ON CONFLICT with a
      // no-op update so the existing row's id comes back too, and two
      // registrars saving at once still end up on one visit.
      const [visit] = await tx
        .insert(visits)
        .values({ patientId: input.patientId, visitDate: todayKey(), createdBy: input.createdBy ?? null })
        .onConflictDoUpdate({ target: [visits.patientId, visits.visitDate], set: { patientId: sql`excluded.patient_id` } })
        .returning({ id: visits.id });

      const [order] = await tx
        .insert(orders)
        .values({
          patientId: input.patientId,
          visitId: visit.id,
          totalAmount: total,
          discount,
          paidAmount: opening,
          status: "pending",
          notes: input.notes ?? null,
          referrer: input.referrer ?? null,
          referralId,
          createdBy: input.createdBy ?? null,
        })
        .returning({ id: orders.id, orderNumber: orders.orderNumber });

      await tx.insert(orderTests).values(
        selected.map((t) => ({
          orderId: order.id,
          testId: t.id,
          testName: t.name,
          price: t.price,
          unit: t.unit,
          referenceRange: t.referenceRange,
          sampleType: t.sampleType,
        })),
      );

      // The tube is created with the order, not when someone remembers to.
      // Its barcode is derived from the order number the sequence just handed
      // us inside this same transaction, so it inherits that uniqueness.
      await tx.insert(samples).values({
        orderId: order.id,
        barcode: sampleBarcode(order.orderNumber),
        status: "kutilmoqda",
      });

      // The amount handed over at the counter is the ledger's first entry, not
      // a number written straight onto the order — otherwise the first payment
      // of every order would be missing from the till history.
      if (opening > 0) {
        const [staff] = input.createdBy
          ? await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, input.createdBy)).limit(1)
          : [];
        await tx.insert(payments).values({
          orderId: order.id,
          amount: opening,
          method: "naqd",
          createdBy: input.createdBy ?? null,
          createdByName: staff?.fullName ?? "—",
        });
      }

      return order.id;
    }
  }

  async updateOrder(id: string, input: UpdateOrderInput, actor?: Actor): Promise<OrderWithDetails | undefined> {
    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!current) return undefined;

    if (input.testIds) await this.replaceOrderTests(id, input.testIds);

    const patch: Partial<typeof orders.$inferInsert> = {};

    // Recomputed after any test change, so the discount is always capped
    // against the *new* subtotal rather than a stale one.
    if (input.discount !== undefined || input.testIds) {
      const [{ subtotal }] = await db
        .select({ subtotal: sql<number>`coalesce(sum(${orderTests.price}), 0)::int` })
        .from(orderTests)
        .where(eq(orderTests.orderId, id));
      patch.discount = Math.min(input.discount ?? current.discount, subtotal);
      patch.totalAmount = subtotal - patch.discount;
    }

    if (input.notes !== undefined) patch.notes = input.notes ?? null;
    if (input.referrer !== undefined) patch.referrer = input.referrer ?? null;
    if (input.status) {
      patch.status = input.status;
      patch.completedAt = input.status === "completed" ? new Date().toISOString() : null;
    }

    if (Object.keys(patch).length > 0 || input.testIds) {
      patch.updatedAt = new Date().toISOString();
      patch.updatedBy = actor?.id ?? null;
      await db.update(orders).set(patch).where(eq(orders.id, id));
    }
    return this.getOrder(id);
  }

  /**
   * Makes the order's line items match `testIds`.
   *
   * Two rules the caller cannot override. A line that already holds a result is
   * kept even if the caller left it out — an entered value is unrecoverable,
   * and a mis-click on a checkbox must not destroy one. And a test already on
   * the order keeps its original line, so its result, notes and the price
   * snapshot taken at registration all survive the edit.
   */
  private async replaceOrderTests(orderId: string, testIds: string[]): Promise<void> {
    const current = await db.select().from(orderTests).where(eq(orderTests.orderId, orderId));
    const wanted = new Set(testIds);

    const drop = current.filter((i) => !wanted.has(i.testId) && !i.result).map((i) => i.id);
    const present = new Set(current.filter((i) => !drop.includes(i.id)).map((i) => i.testId));
    const addIds = testIds.filter((t) => !present.has(t));

    const toAdd = addIds.length
      ? await db.select().from(tests).where(inArray(tests.id, addIds))
      : [];

    if (drop.length === 0 && toAdd.length === 0) return;

    await db.transaction(async (tx) => {
      if (drop.length) await tx.delete(orderTests).where(inArray(orderTests.id, drop));
      if (toAdd.length) {
        await tx.insert(orderTests).values(
          toAdd.map((t) => ({
            orderId,
            testId: t.id,
            testName: t.name,
            price: t.price,
            unit: t.unit,
            referenceRange: t.referenceRange,
            sampleType: t.sampleType,
          })),
        );
      }
    });
  }

  async saveResults(
    id: string,
    results: ResultInput[],
    actor?: Actor,
  ): Promise<OrderWithDetails | undefined> {
    const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!current) return undefined;

    const now = new Date().toISOString();

    // Needed to auto-flag: several ranges are sex-split, and the line carries
    // the reference text that was snapshotted at registration.
    const [patient] = await db
      .select({ gender: patients.gender })
      .from(patients)
      .where(eq(patients.id, current.patientId))
      .limit(1);

    await db.transaction(async (tx) => {
      // Locked, so a verification landing between the read and the write
      // cannot be overwritten by a laborant's stale form.
      const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, id)).for("update");
      const changes = planResultSave(
        lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt) })),
        results,
        patient?.gender,
      );
      for (const c of changes) {
        await tx
          .update(orderTests)
          .set({
            result: c.result,
            flag: c.flag,
            notes: c.notes,
            completedAt: c.result ? now : null,
            ...(c.result && actor ? { enteredBy: actor.name, enteredById: actor.id } : {}),
            // A re-entered value answers the lab head's return.
            returnedAt: null,
            returnedByName: null,
            returnReason: null,
          })
          .where(and(eq(orderTests.id, c.id), eq(orderTests.orderId, id)));
      }

      // Status follows the line items: all filled -> completed, some -> in_progress.
      const patch: Partial<typeof orders.$inferInsert> = { updatedAt: now, updatedBy: actor?.id ?? null };
      if (current.status !== "cancelled") {
        const [{ total, filled }] = await tx
          .select({
            total: sql<number>`count(*)::int`,
            filled: sql<number>`count(${orderTests.result})::int`,
          })
          .from(orderTests)
          .where(eq(orderTests.orderId, id));

        const status = total > 0 && filled === total ? "completed" : filled > 0 ? "in_progress" : "pending";
        patch.status = status;
        patch.completedAt = status === "completed" ? (current.status === "completed" && current.completedAt ? current.completedAt : now) : null;
      }
      if (changes.length) await tx.update(orders).set(patch).where(eq(orders.id, id));
    });

    return this.getOrder(id);
  }

  async verifyResults(
    orderId: string,
    itemIds: string[] | null,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; verified: number; selfChecked: number } | undefined> {
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) return undefined;
      if (order.status === "cancelled") throw new StorageConflict("Buyurtma bekor qilingan");
      const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, orderId));
      const target = pickForVerification(
        lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt), returnedAt: iso(l.returnedAt) })),
        itemIds,
      );
      const now = new Date().toISOString();
      for (const l of target) {
        await tx
          .update(orderTests)
          .set({ verifiedAt: now, verifiedBy: actor.id, verifiedByName: actor.name })
          .where(and(eq(orderTests.id, l.id), isNull(orderTests.verifiedAt)));
      }
      await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
      return { verified: target.length, selfChecked: target.filter((l) => l.enteredById && l.enteredById === actor.id).length };
    });
    if (!outcome) return undefined;
    return { order: (await this.getOrder(orderId))!, ...outcome };
  }

  async returnResults(orderId: string, itemIds: string[], reason: string, actor: Actor): Promise<OrderWithDetails | undefined> {
    const found = await db.transaction(async (tx) => {
      const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) return false;
      const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, orderId));
      const target = pickForVerification(
        lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt), returnedAt: iso(l.returnedAt) })),
        itemIds,
      );
      const now = new Date().toISOString();
      await tx
        .update(orderTests)
        .set({ returnedAt: now, returnedByName: actor.name, returnReason: reason })
        .where(inArray(orderTests.id, target.map((l) => l.id)));
      await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
      return true;
    });
    return found ? this.getOrder(orderId) : undefined;
  }

  async amendResult(
    orderId: string,
    itemId: string,
    input: { result: string; flag: ResultFlag | null; notes: string | null },
    reason: string,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; previous: { result: string | null; version: number } } | undefined> {
    const previous = await db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(orderTests)
        .where(and(eq(orderTests.id, itemId), eq(orderTests.orderId, orderId)))
        .for("update");
      if (!line) return undefined;
      const problem = amendProblem({ ...line, verifiedAt: iso(line.verifiedAt) }, input);
      if (problem) throw new StorageConflict(problem);
      const now = new Date().toISOString();
      await tx.insert(orderTestVersions).values({
        orderTestId: line.id,
        orderId,
        version: line.version,
        result: line.result,
        flag: line.flag,
        notes: line.notes,
        enteredBy: line.enteredBy,
        verifiedAt: line.verifiedAt,
        verifiedByName: line.verifiedByName,
        replacedBy: actor.id,
        replacedByName: actor.name,
        replaceReason: reason,
      });
      await tx
        .update(orderTests)
        .set({
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
        })
        .where(eq(orderTests.id, line.id));
      await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
      return { result: line.result, version: line.version };
    });
    if (!previous) return undefined;
    return { order: (await this.getOrder(orderId))!, previous };
  }

  async listResultVersions(itemId: string): Promise<OrderTestVersion[]> {
    const rows = await db
      .select()
      .from(orderTestVersions)
      .where(eq(orderTestVersions.orderTestId, itemId))
      .orderBy(desc(orderTestVersions.version));
    return rows.map((r) => ({
      ...r,
      flag: r.flag as ResultFlag | null,
      verifiedAt: iso(r.verifiedAt),
      replacedAt: iso(r.replacedAt) ?? r.replacedAt,
    }));
  }

  async deleteOrder(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // Locked first, so a payment or a result cannot land between the check and the delete.
      const [locked] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, id)).for("update");
      if (!locked) return false;
      const { rows: [held] } = await tx.execute<{ paid: number; results: number }>(sql`
        SELECT
          (SELECT count(*) FROM payments p WHERE p.order_id = ${id})::int AS paid,
          (SELECT count(*) FROM order_tests ot WHERE ot.order_id = ${id} AND ot.result IS NOT NULL)::int AS results`);
      const problem = orderDeleteProblem(held?.paid ?? 0, held?.results ?? 0);
      if (problem) throw new StorageConflict(problem);

      await tx.delete(orderTests).where(eq(orderTests.orderId, id));
      // Must go with the order: the barcode is unique, so an orphan row would
      // block the number from ever being used again.
      await tx.delete(samples).where(eq(samples.orderId, id));
      const rows = await tx.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
      return rows.length > 0;
    });
  }

  // -------------------------------------------------------------- samples

  async getOrderByBarcode(barcode: string): Promise<OrderWithDetails | undefined> {
    const orderNumber = parseBarcode(barcode);
    if (orderNumber === null) return undefined;

    // Resolved through the order number rather than the barcode string, so a
    // scan still finds orders created before sample tracking — they have no
    // samples row to match against.
    const [row] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    return row ? this.getOrder(row.id) : undefined;
  }

  async updateSampleStatus(
    orderId: string,
    input: UpdateSampleInput,
    actor: Actor,
  ): Promise<{ sample: Sample; order: OrderWithDetails } | { error: string } | undefined> {
    const [current] = await db.select().from(samples).where(eq(samples.orderId, orderId)).limit(1);
    if (!current) return undefined;

    const from = current.status as SampleStatus;
    if (!canTransition(from, input.status)) return { error: transitionError(from, input.status) };

    const now = new Date().toISOString();
    const patch: Partial<typeof samples.$inferInsert> = { status: input.status };

    // Each hand-off stamps its own three columns, so the tube keeps the full
    // history rather than only its latest actor. A step back clears the stamp
    // it is undoing — otherwise a corrected mis-click would leave a collection
    // time for a tube that, as far as the lab is concerned, was never drawn.
    switch (input.status) {
      case "olindi":
        patch.collectedAt = now;
        patch.collectedBy = actor.id;
        patch.collectedByName = actor.name;
        patch.receivedAt = null;
        patch.receivedBy = null;
        patch.receivedByName = null;
        patch.quality = null;
        patch.qualityNote = null;
        break;
      case "qabul_qilindi":
        patch.receivedAt = now;
        patch.receivedBy = actor.id;
        patch.receivedByName = actor.name;
        // TZ §6.1.3: quality is judged on reception; unstated means fine.
        patch.quality = input.quality ?? "yaxshi";
        patch.qualityNote = input.qualityNote?.trim() || null;
        break;
      case "kutilmoqda":
        patch.collectedAt = null;
        patch.collectedBy = null;
        patch.collectedByName = null;
        patch.receivedAt = null;
        patch.receivedBy = null;
        patch.receivedByName = null;
        patch.quality = null;
        patch.qualityNote = null;
        break;
      case "rad_etildi":
        patch.rejectedAt = now;
        patch.rejectedBy = actor.id;
        patch.rejectedByName = actor.name;
        // Validated upstream: rejectReason is required for this status.
        patch.rejectReason = input.rejectReason ?? null;
        patch.rejectNote = input.rejectNote ?? null;
        break;
    }

    const [updated] = await db.update(samples).set(patch).where(eq(samples.id, current.id)).returning();
    const order = await this.getOrder(orderId);
    if (!order) return undefined;

    return { sample: mapSample(updated), order };
  }

  // ------------------------------------------------------------- payments

  async addPayment(
    orderId: string,
    input: CreatePaymentInput,
    actor: Actor,
  ): Promise<OrderWithDetails | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return undefined;

    const [{ paid }] = await db
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.orderId, orderId), isNull(payments.voidedAt)));

    // Neither direction may take the ledger somewhere impossible: no paying
    // past the bill, no refunding money that was never taken.
    const room = order.totalAmount - paid;
    const amount = input.amount > 0 ? Math.min(input.amount, room) : Math.max(input.amount, -paid);
    if (amount === 0) {
      throw new Error(
        input.amount > 0 ? "Buyurtma allaqachon to'liq to'langan" : "Qaytariladigan to'lov yo'q",
      );
    }

    await db.transaction(async (tx) => {
      await tx.insert(payments).values({
        orderId,
        amount,
        method: input.method,
        note: input.note?.trim() || null,
        createdBy: actor.id,
        createdByName: actor.name,
      });
      await this.syncPaid(tx as unknown as typeof db, orderId, actor);
    });

    return this.getOrder(orderId);
  }

  async voidPayment(paymentId: string, reason: string, actor: Actor): Promise<OrderWithDetails | undefined> {
    const orderId = await db.transaction(async (tx) => {
      // Conditional on voided_at, so two people voiding at once void it once.
      const [row] = await tx
        .update(payments)
        .set({
          voidedAt: new Date().toISOString(),
          voidedBy: actor.id,
          voidedByName: actor.name,
          voidReason: reason,
        })
        .where(and(eq(payments.id, paymentId), isNull(payments.voidedAt)))
        .returning({ orderId: payments.orderId });
      if (!row) {
        const [exists] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.id, paymentId)).limit(1);
        if (exists) throw new StorageConflict(PAYMENT_ALREADY_VOIDED);
        return undefined;
      }
      await this.syncPaid(tx as unknown as typeof db, row.orderId, actor);
      return row.orderId;
    });
    return orderId ? this.getOrder(orderId) : undefined;
  }

  // ------------------------------------------------------------- expenses

  async listExpenses(query: ExpenseQuery = {}): Promise<Paged<Expense> & { total_amount: number }> {
    const status = query.status ?? "active";
    const parts = [];
    if (query.from) parts.push(gte(expenses.spentOn, query.from));
    if (query.to) parts.push(lte(expenses.spentOn, query.to));
    if (query.category) parts.push(eq(expenses.category, query.category));
    if (query.method) parts.push(eq(expenses.method, query.method));
    const q0 = query.search?.trim();
    if (q0) {
      const like = `%${q0.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      parts.push(or(sql`${expenses.note} ILIKE ${like}`, sql`${expenses.payee} ILIKE ${like}`)!);
    }
    if (status !== "all") parts.push(eq(expenses.status, status));
    const where = parts.length ? and(...parts) : undefined;

    let q = db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
      .$dynamic();
    if (query.limit !== undefined) q = q.limit(query.limit);
    if (query.offset) q = q.offset(query.offset);

    const [rows, [agg]] = await Promise.all([
      q,
      db
        .select({
          count: sql<number>`count(*)::int`,
          sum: sql<number>`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::bigint::float8`,
        })
        .from(expenses)
        .where(where),
    ]);

    return {
      items: rows.map(mapExpense),
      total: agg?.count ?? 0,
      total_amount: agg?.sum ?? 0,
    };
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    return row && mapExpense(row);
  }

  async createExpense(input: InsertExpense, actor: Actor): Promise<Expense> {
    const [row] = await db
      .insert(expenses)
      .values({
        category: input.category,
        amount: input.amount,
        method: input.method,
        payee: input.payee ?? null,
        note: input.note ?? null,
        spentOn: input.spentOn,
        createdBy: actor.id,
        createdByName: actor.name,
      })
      .returning();
    return mapExpense(row);
  }

  async updateExpense(id: string, input: UpdateExpenseInput, actor: Actor): Promise<Expense | undefined> {
    const patch: Partial<typeof expenses.$inferInsert> = {
      updatedAt: new Date().toISOString(),
      updatedBy: actor.id,
    };
    if (input.category !== undefined) patch.category = input.category;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.method !== undefined) patch.method = input.method;
    if (input.payee !== undefined) patch.payee = input.payee ?? null;
    if (input.note !== undefined) patch.note = input.note ?? null;
    if (input.spentOn !== undefined) patch.spentOn = input.spentOn;
    const [row] = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning();
    return row && mapExpense(row);
  }

  async cancelExpense(id: string, reason: string, actor: Actor): Promise<Expense | undefined> {
    const [row] = await db
      .update(expenses)
      .set({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor.id,
        cancelledByName: actor.name,
        cancelReason: reason,
      })
      .where(eq(expenses.id, id))
      .returning();
    return row && mapExpense(row);
  }

  /**
   * Five small aggregates run side by side. Each is one round trip, and they
   * overlap, so the dashboard costs about as much as a single query.
   */
  async getExpenseSummary(from: string, to: string): Promise<ExpenseSummary> {
    const range = and(gte(expenses.spentOn, from), lte(expenses.spentOn, to));
    const active = and(range, eq(expenses.status, "active"));
    const prev = previousRange(from, to);
    const sumAmount = sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint::float8`;

    const [byCategory, byMethod, perDay, [agg], [prevAgg]] = await Promise.all([
      db
        .select({ category: expenses.category, amount: sumAmount, count: sql<number>`count(*)::int` })
        .from(expenses)
        .where(active)
        .groupBy(expenses.category)
        .orderBy(desc(sumAmount)),
      db
        .select({ method: expenses.method, amount: sumAmount, count: sql<number>`count(*)::int` })
        .from(expenses)
        .where(active)
        .groupBy(expenses.method)
        .orderBy(desc(sumAmount)),
      db.select({ date: expenses.spentOn, amount: sumAmount }).from(expenses).where(active).groupBy(expenses.spentOn),
      db
        .select({
          total: sql<number>`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::bigint::float8`,
          count: sql<number>`count(*) FILTER (WHERE ${expenses.status} = 'active')::int`,
          largest: sql<number>`coalesce(max(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::int`,
          cancelledCount: sql<number>`count(*) FILTER (WHERE ${expenses.status} = 'cancelled')::int`,
          cancelledAmount: sql<number>`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'cancelled'), 0)::bigint::float8`,
        })
        .from(expenses)
        .where(range),
      db
        .select({ total: sumAmount })
        .from(expenses)
        .where(and(gte(expenses.spentOn, prev.from), lte(expenses.spentOn, prev.to), eq(expenses.status, "active"))),
    ]);

    const day = new Map(perDay.map((d) => [d.date, Number(d.amount)]));
    const total = Number(agg?.total ?? 0);
    const count = agg?.count ?? 0;
    return {
      range: { from, to },
      total,
      count,
      average: count ? Math.round(total / count) : 0,
      largest: agg?.largest ?? 0,
      byCategory: byCategory.map((c) => ({ ...c, amount: Number(c.amount) })),
      byMethod: byMethod.map((m) => ({ ...m, amount: Number(m.amount) })),
      daily: daysBetween(from, to).map((date) => ({ date, amount: day.get(date) ?? 0 })),
      previous: { ...prev, total: Number(prevAgg?.total ?? 0) },
      cancelled: { count: agg?.cancelledCount ?? 0, amount: Number(agg?.cancelledAmount ?? 0) },
    };
  }

  async listExpensePayees(limit = 30): Promise<string[]> {
    const rows = await db
      .select({ payee: expenses.payee })
      .from(expenses)
      .where(sql`${expenses.payee} IS NOT NULL AND btrim(${expenses.payee}) <> ''`)
      .groupBy(expenses.payee)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.map((r) => r.payee!).filter(Boolean);
  }

  // ---------------------------------------------------------------- audit

  async writeAudit(input: AuditInput): Promise<void> {
    await db.insert(auditLog).values({
      userId: input.actor.id,
      userName: input.actor.name,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary,
    });
  }

  async listAudit(query: AuditQuery = {}): Promise<Paged<AuditEntry>> {
    const parts = [];
    if (query.entity) parts.push(eq(auditLog.entity, query.entity));
    if (query.entityId) parts.push(eq(auditLog.entityId, query.entityId));
    if (query.action) parts.push(eq(auditLog.action, query.action));
    const where = parts.length ? and(...parts) : undefined;

    let q = db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).$dynamic();
    if (query.limit !== undefined) q = q.limit(query.limit);
    if (query.offset) q = q.offset(query.offset);

    const [rows, [{ count }]] = await Promise.all([
      q,
      db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where),
    ]);

    return { items: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })), total: count };
  }

  // ------------------------------------------------------------- telegram

  async linkTelegram(patientId: string, chatId: string): Promise<Patient | undefined> {
    // One chat belongs to one patient: release it from whoever held it before,
    // otherwise a shared phone would quietly send two people the same results.
    await db
      .update(patients)
      .set({ telegramChatId: null, telegramLinkedAt: null })
      .where(and(eq(patients.telegramChatId, chatId), sql`${patients.id} <> ${patientId}`));

    const [row] = await db
      .update(patients)
      .set({ telegramChatId: chatId, telegramLinkedAt: new Date().toISOString() })
      .where(eq(patients.id, patientId))
      .returning();
    return row && mapPatient(row);
  }

  async savePendingContact(input: {
    chatId: string;
    phone: string;
    fullName?: string | null;
    username?: string | null;
  }): Promise<void> {
    const values = {
      chatId: input.chatId,
      phone: input.phone,
      fullName: input.fullName ?? null,
      username: input.username ?? null,
    };
    await db
      .insert(telegramContacts)
      .values(values)
      .onConflictDoUpdate({ target: telegramContacts.chatId, set: values });
  }

  /** Digits-only suffix match, same rule as getPatientByPhone. */
  private pendingByPhone(phone: string) {
    const digits = nationalPhoneDigits(phone);
    if (digits.length !== 9) return undefined;
    return sql`regexp_replace(${telegramContacts.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits}`;
  }

  async findPendingContact(phone: string): Promise<TelegramContact | undefined> {
    const where = this.pendingByPhone(phone);
    if (!where) return undefined;
    const [row] = await db
      .select()
      .from(telegramContacts)
      .where(where)
      .orderBy(desc(telegramContacts.createdAt))
      .limit(1);
    return row && { ...row, createdAt: iso(row.createdAt) };
  }

  async deletePendingContact(chatId: string): Promise<void> {
    await db.delete(telegramContacts).where(eq(telegramContacts.chatId, chatId));
  }

  async unlinkTelegram(chatId: string): Promise<number> {
    const rows = await db
      .update(patients)
      .set({ telegramChatId: null, telegramLinkedAt: null })
      .where(eq(patients.telegramChatId, chatId))
      .returning({ id: patients.id });
    return rows.length;
  }

  async listUndeliveredOrders(patientId: string, limit = 5): Promise<OrderWithDetails[]> {
    const rows = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.patientId, patientId),
          eq(orders.status, "completed"),
          sql`${orders.telegramSentAt} IS NULL`,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    return this.hydrate(rows);
  }

  async markTelegramSent(orderId: string): Promise<void> {
    await db
      .update(orders)
      .set({ telegramSentAt: new Date().toISOString() })
      .where(eq(orders.id, orderId));
  }

  // ------------------------------------------------------------ reporting

  async getDashboardStats(): Promise<DashboardStatsData> {
    const today = todayKey();

    // Deliberately one statement with scalar subqueries rather than several
    // queries: the Neon driver opens a fresh WebSocket per pooled connection,
    // so each extra query costs a full handshake to another continent.
    const { rows } = await db.execute<{
      today_patients: number;
      today_revenue: number;
      pending: number;
      ready: number;
      review: number;
      total_patients: number;
      unpaid: number;
    }>(sql`
      WITH active AS (
        SELECT * FROM ${orders} WHERE status <> 'cancelled'
      ), today AS (
        SELECT * FROM active
        WHERE (created_at AT TIME ZONE current_setting('TIMEZONE'))::date = ${today}::date
      )
      SELECT
        (SELECT count(DISTINCT patient_id) FROM today)::int                                   AS today_patients,
        (SELECT coalesce(sum(paid_amount), 0) FROM today)::int                                AS today_revenue,
        (SELECT count(*) FROM ${orderTests} ot JOIN active a ON a.id = ot.order_id
          WHERE ot.result IS NULL)::int                                                       AS pending,
        (SELECT count(*) FROM ${orderTests} ot JOIN active a ON a.id = ot.order_id
          WHERE ot.verified_at IS NOT NULL)::int                                              AS ready,
        (SELECT count(*) FROM ${orderTests} ot JOIN active a ON a.id = ot.order_id
          WHERE ot.verified_at IS NULL AND ot.result IS NOT NULL AND ot.result <> ''
            AND ot.returned_at IS NULL)::int                                                  AS review,
        (SELECT count(*) FROM ${patients})::int                                               AS total_patients,
        (SELECT coalesce(sum(greatest(total_amount - paid_amount, 0)), 0) FROM active)::int    AS unpaid
    `);

    const r = rows[0];
    return {
      todayPatients: r?.today_patients ?? 0,
      pendingTests: r?.pending ?? 0,
      readyTests: r?.ready ?? 0,
      reviewTests: r?.review ?? 0,
      todayRevenue: r?.today_revenue ?? 0,
      totalPatients: r?.total_patients ?? 0,
      unpaidAmount: r?.unpaid ?? 0,
    };
  }

  // ------------------------------------------------------ lab devices (B4.9)

  async listDevices(): Promise<LabDeviceWithStats[]> {
    const rows = await db
      .select({
        d: labDevices,
        errorCount: sql<number>`(SELECT count(*)::int FROM lab_device_errors e WHERE e.device_id = "lab_devices"."id")`,
        openErrors: sql<number>`(SELECT count(*)::int FROM lab_device_errors e
                                  WHERE e.device_id = "lab_devices"."id" AND e.resolved_at IS NULL)`,
        lastErrorAt: sql<string | Date | null>`(SELECT max(e.occurred_at) FROM lab_device_errors e WHERE e.device_id = "lab_devices"."id")`,
      })
      .from(labDevices)
      .orderBy(asc(labDevices.name));
    return rows.map((r) => ({
      ...mapDevice(r.d),
      errorCount: r.errorCount,
      openErrors: r.openErrors,
      lastErrorAt: r.lastErrorAt ? new Date(r.lastErrorAt).toISOString() : null,
    }));
  }

  async getDevice(id: string): Promise<LabDevice | undefined> {
    const [row] = await db.select().from(labDevices).where(eq(labDevices.id, id)).limit(1);
    return row && mapDevice(row);
  }

  async createDevice(input: InsertDevice, actor: Actor): Promise<LabDevice> {
    const [row] = await db
      .insert(labDevices)
      .values({
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
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    return mapDevice(row);
  }

  async updateDevice(id: string, input: UpdateDeviceInput, actor: Actor): Promise<LabDevice | undefined> {
    const patch: Partial<typeof labDevices.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    const [row] = await db.update(labDevices).set(patch).where(eq(labDevices.id, id)).returning();
    return row && mapDevice(row);
  }

  async deleteDevice(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [device] = await tx.select({ id: labDevices.id }).from(labDevices).where(eq(labDevices.id, id)).for("update");
      if (!device) return false;
      const [logged] = await tx.select({ id: labDeviceErrors.id }).from(labDeviceErrors).where(eq(labDeviceErrors.deviceId, id)).limit(1);
      if (logged) throw new StorageConflict(DEVICE_HAS_LOG);
      await tx.delete(labDevices).where(eq(labDevices.id, id));
      return true;
    });
  }

  async listDeviceErrors(query: { deviceId?: string; open?: boolean; limit?: number } = {}): Promise<LabDeviceErrorWithDevice[]> {
    const where = [];
    if (query.deviceId) where.push(eq(labDeviceErrors.deviceId, query.deviceId));
    if (query.open) where.push(isNull(labDeviceErrors.resolvedAt));
    const rows = await db
      .select({ e: labDeviceErrors, deviceName: labDevices.name })
      .from(labDeviceErrors)
      .leftJoin(labDevices, eq(labDevices.id, labDeviceErrors.deviceId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(labDeviceErrors.occurredAt), desc(labDeviceErrors.createdAt))
      .limit(query.limit ?? 200);
    return rows.map((r) => ({ ...mapDeviceError(r.e), deviceName: r.deviceName ?? "—" }));
  }

  async createDeviceError(deviceId: string, input: InsertDeviceErrorInput, actor: Actor): Promise<LabDeviceError | undefined> {
    return db.transaction(async (tx) => {
      const [device] = await tx.select().from(labDevices).where(eq(labDevices.id, deviceId)).for("update");
      if (!device) return undefined;
      const now = new Date().toISOString();
      const [row] = await tx
        .insert(labDeviceErrors)
        .values({
          deviceId,
          occurredAt: input.occurredAt ? new Date(input.occurredAt).toISOString() : now,
          severity: input.severity,
          code: input.code ?? null,
          message: input.message,
          actionTaken: input.actionTaken ?? null,
          reportedBy: actor.id,
          reportedByName: actor.name,
        })
        .returning();
      if (input.markOutOfService && device.status !== "out_of_service") {
        await tx
          .update(labDevices)
          .set({ status: "out_of_service", updatedAt: now, updatedBy: actor.id })
          .where(eq(labDevices.id, deviceId));
      }
      return mapDeviceError(row);
    });
  }

  async resolveDeviceError(id: string, resolution: string, actor: Actor): Promise<LabDeviceError | undefined> {
    // Closing is one conditional UPDATE: two people pressing at once, one wins.
    const [row] = await db
      .update(labDeviceErrors)
      .set({ resolvedAt: new Date().toISOString(), resolvedBy: actor.id, resolvedByName: actor.name, resolution })
      .where(and(eq(labDeviceErrors.id, id), isNull(labDeviceErrors.resolvedAt)))
      .returning();
    if (row) return mapDeviceError(row);
    const [exists] = await db.select({ id: labDeviceErrors.id }).from(labDeviceErrors).where(eq(labDeviceErrors.id, id)).limit(1);
    if (exists) throw new StorageConflict(DEVICE_ERROR_ALREADY_RESOLVED);
    return undefined;
  }

  // ---------------------------------------------------- quality control (B4.8)

  async getQcBoard(day: string): Promise<QcBoard> {
    const [materials, rows] = await Promise.all([
      db.select().from(qcMaterials).orderBy(desc(qcMaterials.isActive), asc(qcMaterials.name), asc(qcMaterials.level)),
      db
        .select({
          t: qcTargets,
          materialName: qcMaterials.name,
          level: qcMaterials.level,
          lotNumber: qcMaterials.lotNumber,
          materialExpiresOn: qcMaterials.expiresOn,
          materialActive: qcMaterials.isActive,
          testName: tests.name,
          deviceName: labDevices.name,
          last: sql<{ value: number; z: number; status: string; measuredAt: string } | null>`(
            SELECT json_build_object('value', r.value, 'z', r.z, 'status', r.status, 'measuredAt', r.measured_at)
              FROM qc_results r
             WHERE r.target_id = "qc_targets"."id" AND r.voided_at IS NULL
             ORDER BY r.measured_at DESC, r.created_at DESC
             LIMIT 1)`,
          runs: sql<number>`(SELECT count(*)::int FROM qc_results r WHERE r.target_id = "qc_targets"."id" AND r.voided_at IS NULL)`,
          runsToday: sql<number>`(SELECT count(*)::int FROM qc_results r
                                   WHERE r.target_id = "qc_targets"."id" AND r.voided_at IS NULL
                                     AND (r.measured_at AT TIME ZONE current_setting('TIMEZONE'))::date = ${day}::date)`,
          openRejections: sql<number>`(SELECT count(*)::int FROM qc_results r
                                        WHERE r.target_id = "qc_targets"."id" AND r.voided_at IS NULL
                                          AND r.status = 'reject' AND r.reviewed_at IS NULL)`,
        })
        .from(qcTargets)
        .innerJoin(qcMaterials, eq(qcMaterials.id, qcTargets.materialId))
        .leftJoin(tests, eq(tests.id, qcTargets.testId))
        .leftJoin(labDevices, eq(labDevices.id, qcTargets.deviceId))
        .orderBy(asc(tests.name), asc(qcMaterials.level)),
    ]);
    return {
      date: day,
      materials,
      targets: rows.map((r) => ({
        ...r.t,
        materialName: r.materialName,
        level: r.level,
        lotNumber: r.lotNumber,
        materialExpiresOn: r.materialExpiresOn,
        materialActive: r.materialActive,
        testName: r.testName ?? "—",
        deviceName: r.deviceName ?? null,
        lastResult: r.last
          ? {
              value: Number(r.last.value),
              z: Number(r.last.z),
              status: r.last.status as QcResult["status"],
              measuredAt: new Date(r.last.measuredAt).toISOString(),
            }
          : null,
        runs: r.runs,
        runsToday: r.runsToday,
        openRejections: r.openRejections,
      })),
    };
  }

  async getQcMaterial(id: string): Promise<QcMaterial | undefined> {
    const [row] = await db.select().from(qcMaterials).where(eq(qcMaterials.id, id)).limit(1);
    return row;
  }

  async createQcMaterial(input: InsertQcMaterial, actor: Actor): Promise<QcMaterial> {
    const [row] = await db
      .insert(qcMaterials)
      .values({
        name: input.name,
        manufacturer: input.manufacturer ?? null,
        lotNumber: input.lotNumber,
        level: input.level,
        expiresOn: input.expiresOn,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    return row;
  }

  async updateQcMaterial(id: string, input: UpdateQcMaterialInput, actor: Actor): Promise<QcMaterial | undefined> {
    const patch: Partial<typeof qcMaterials.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    const [row] = await db.update(qcMaterials).set(patch).where(eq(qcMaterials.id, id)).returning();
    return row;
  }

  async getQcTarget(id: string): Promise<QcTarget | undefined> {
    const [row] = await db.select().from(qcTargets).where(eq(qcTargets.id, id)).limit(1);
    return row;
  }

  async createQcTarget(input: InsertQcTarget, actor: Actor): Promise<QcTarget> {
    try {
      const [row] = await db
        .insert(qcTargets)
        .values({
          materialId: input.materialId,
          testId: input.testId,
          deviceId: input.deviceId ?? null,
          mean: input.mean,
          sd: input.sd,
          unit: input.unit ?? null,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      return row;
    } catch (err) {
      // UQ_qc_targets_series (material, test, coalesce(device, '')).
      if ((err as { code?: string })?.code === "23505") throw new StorageConflict(QC_TARGET_EXISTS);
      throw err;
    }
  }

  async updateQcTarget(id: string, input: UpdateQcTargetInput, actor: Actor): Promise<QcTarget | undefined> {
    const patch: Partial<typeof qcTargets.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    const [row] = await db.update(qcTargets).set(patch).where(eq(qcTargets.id, id)).returning();
    return row;
  }

  async listQcResults(targetId: string, limit = 60): Promise<QcResult[]> {
    const rows = await db
      .select()
      .from(qcResults)
      .where(eq(qcResults.targetId, targetId))
      .orderBy(desc(qcResults.measuredAt), desc(qcResults.createdAt))
      .limit(limit);
    return rows.reverse().map(mapQcResult);
  }

  async addQcResult(target: QcTarget, input: InsertQcResultInput, actor: Actor): Promise<QcResult> {
    return db.transaction(async (tx) => {
      // One run at a time per series, so two entries judged together see each other.
      await tx.select({ id: qcTargets.id }).from(qcTargets).where(eq(qcTargets.id, target.id)).for("update");
      const measuredAt = input.measuredAt ? new Date(input.measuredAt).toISOString() : new Date().toISOString();
      const previous = await tx
        .select({ z: qcResults.z })
        .from(qcResults)
        .where(and(eq(qcResults.targetId, target.id), isNull(qcResults.voidedAt), lte(qcResults.measuredAt, measuredAt)))
        .orderBy(desc(qcResults.measuredAt), desc(qcResults.createdAt))
        .limit(QC_LOOKBACK);
      const verdict = judgeQcRun(previous.reverse().map((p) => p.z), input.value, target.mean, target.sd);
      const [row] = await tx
        .insert(qcResults)
        .values({
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
        })
        .returning();
      return mapQcResult(row);
    });
  }

  async getQcResult(id: string): Promise<QcResult | undefined> {
    const [row] = await db.select().from(qcResults).where(eq(qcResults.id, id)).limit(1);
    return row && mapQcResult(row);
  }

  async reviewQcResult(id: string, correctiveAction: string, actor: Actor): Promise<QcResult | undefined> {
    const [row] = await db
      .update(qcResults)
      .set({ reviewedAt: new Date().toISOString(), reviewedBy: actor.id, reviewedByName: actor.name, correctiveAction })
      .where(and(eq(qcResults.id, id), isNull(qcResults.reviewedAt)))
      .returning();
    if (row) return mapQcResult(row);
    if (await this.getQcResult(id)) throw new StorageConflict(QC_RESULT_ALREADY_REVIEWED);
    return undefined;
  }

  async voidQcResult(id: string, reason: string, actor: Actor): Promise<QcResult | undefined> {
    const [row] = await db
      .update(qcResults)
      .set({ voidedAt: new Date().toISOString(), voidedBy: actor.id, voidedByName: actor.name, voidReason: reason })
      .where(and(eq(qcResults.id, id), isNull(qcResults.voidedAt)))
      .returning();
    if (row) return mapQcResult(row);
    if (await this.getQcResult(id)) throw new StorageConflict(QC_RESULT_ALREADY_VOIDED);
    return undefined;
  }

  async listCalibrations(query: { deviceId?: string; limit?: number } = {}): Promise<CalibrationView[]> {
    const rows = await db
      .select({ c: calibrations, deviceName: labDevices.name, testName: tests.name })
      .from(calibrations)
      .leftJoin(labDevices, eq(labDevices.id, calibrations.deviceId))
      .leftJoin(tests, eq(tests.id, calibrations.testId))
      .where(query.deviceId ? eq(calibrations.deviceId, query.deviceId) : undefined)
      .orderBy(desc(calibrations.performedAt))
      .limit(query.limit ?? 200);
    return rows.map((r) => ({
      ...r.c,
      result: r.c.result as Calibration["result"],
      deviceName: r.deviceName ?? "—",
      testName: r.testName ?? null,
    }));
  }

  async addCalibration(input: InsertCalibrationInput, actor: Actor): Promise<Calibration> {
    const [row] = await db
      .insert(calibrations)
      .values({
        deviceId: input.deviceId,
        testId: input.testId ?? null,
        performedAt: input.performedAt ? new Date(input.performedAt).toISOString() : new Date().toISOString(),
        calibratorName: input.calibratorName,
        calibratorLot: input.calibratorLot ?? null,
        calibratorExpiresOn: input.calibratorExpiresOn ?? null,
        reagentLot: input.reagentLot ?? null,
        reagentExpiresOn: input.reagentExpiresOn ?? null,
        result: input.result,
        notes: input.notes ?? null,
        performedBy: actor.id,
        performedByName: actor.name,
      })
      .returning();
    return { ...row, result: row.result as Calibration["result"] };
  }

  async listMaintenance(query: { deviceId?: string; limit?: number } = {}): Promise<DeviceMaintenanceView[]> {
    const rows = await db
      .select({ m: deviceMaintenance, deviceName: labDevices.name })
      .from(deviceMaintenance)
      .leftJoin(labDevices, eq(labDevices.id, deviceMaintenance.deviceId))
      .where(query.deviceId ? eq(deviceMaintenance.deviceId, query.deviceId) : undefined)
      .orderBy(desc(deviceMaintenance.performedAt))
      .limit(query.limit ?? 200);
    return rows.map((r) => ({ ...r.m, kind: r.m.kind as DeviceMaintenanceEntry["kind"], deviceName: r.deviceName ?? "—" }));
  }

  async addMaintenance(input: InsertMaintenanceInput, actor: Actor): Promise<DeviceMaintenanceEntry> {
    const [row] = await db
      .insert(deviceMaintenance)
      .values({
        deviceId: input.deviceId,
        performedAt: input.performedAt ? new Date(input.performedAt).toISOString() : new Date().toISOString(),
        kind: input.kind,
        description: input.description,
        nextDueOn: input.nextDueOn ?? null,
        performedBy: actor.id,
        performedByName: actor.name,
      })
      .returning();
    return { ...row, kind: row.kind as DeviceMaintenanceEntry["kind"] };
  }

  async listEqa(query: { limit?: number } = {}): Promise<EqaResultView[]> {
    const rows = await db
      .select({ e: eqaResults, testName: tests.name, deviceName: labDevices.name })
      .from(eqaResults)
      .leftJoin(tests, eq(tests.id, eqaResults.testId))
      .leftJoin(labDevices, eq(labDevices.id, eqaResults.deviceId))
      .orderBy(desc(eqaResults.sampleDate), desc(eqaResults.createdAt))
      .limit(query.limit ?? 200);
    return rows.map((r) => ({ ...mapEqa(r.e), testName: r.testName ?? "—", deviceName: r.deviceName ?? null }));
  }

  async addEqa(input: InsertEqaInput, actor: Actor): Promise<EqaResult> {
    const z = roundZ(zScore(input.reportedValue, input.assignedValue, input.sdpa));
    const [row] = await db
      .insert(eqaResults)
      .values({
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
      })
      .returning();
    return mapEqa(row);
  }

  async voidEqa(id: string, reason: string, actor: Actor): Promise<EqaResult | undefined> {
    const [row] = await db
      .update(eqaResults)
      .set({ voidedAt: new Date().toISOString(), voidedBy: actor.id, voidedByName: actor.name, voidReason: reason })
      .where(and(eq(eqaResults.id, id), isNull(eqaResults.voidedAt)))
      .returning();
    if (row) return mapEqa(row);
    const [exists] = await db.select({ id: eqaResults.id }).from(eqaResults).where(eq(eqaResults.id, id)).limit(1);
    if (exists) throw new StorageConflict(QC_RESULT_ALREADY_VOIDED);
    return undefined;
  }

  // ------------------------------------------------------------ inventory (B5)

  async listInventoryItems(): Promise<InventoryItemView[]> {
    const order = [desc(inventoryItems.isActive), asc(inventoryItems.name)];
    try {
      const rows = await db
        .select({
          item: inventoryItems,
          onHand: sql<number>`(SELECT coalesce(sum(b.remaining), 0) FROM inventory_batches b
                                WHERE b.item_id = "inventory_items"."id" AND b.cancelled_at IS NULL)`,
          nearestExpiry: sql<string | null>`(SELECT min(b.expires_on) FROM inventory_batches b
                                              WHERE b.item_id = "inventory_items"."id" AND b.cancelled_at IS NULL AND b.remaining > 0)`,
        })
        .from(inventoryItems)
        .orderBy(...order);
      return rows.map((r) => ({ ...mapInventoryItem(r.item), onHand: Number(r.onHand), nearestExpiry: r.nearestExpiry ?? null }));
    } catch (err) {
      // Before db:stock the catalogue still works, with nothing on the shelf.
      if (!isMissingTable(err)) throw err;
      const rows = await db.select().from(inventoryItems).orderBy(...order);
      return rows.map((r) => ({ ...mapInventoryItem(r), onHand: 0, nearestExpiry: null }));
    }
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    return row && mapInventoryItem(row);
  }

  async createInventoryItem(input: InsertInventoryItem, actor: Actor): Promise<InventoryItem> {
    const [row] = await uniqueAsConflict(() =>
      db
      .insert(inventoryItems)
      .values({
        name: input.name,
        kind: input.kind,
        code: input.code ?? null,
        manufacturer: input.manufacturer ?? null,
        unit: input.unit,
        minStock: input.minStock ?? 0,
        salePrice: input.salePrice ?? null,
        isActive: input.isActive ?? true,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning(),
    );
    return mapInventoryItem(row);
  }

  async updateInventoryItem(id: string, input: UpdateInventoryItemInput, actor: Actor): Promise<InventoryItem | undefined> {
    const patch: Partial<typeof inventoryItems.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    for (const [k, v] of Object.entries(input)) if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    const [row] = await uniqueAsConflict(() => db.update(inventoryItems).set(patch).where(eq(inventoryItems.id, id)).returning());
    return row && mapInventoryItem(row);
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [item] = await tx.select({ id: inventoryItems.id }).from(inventoryItems).where(eq(inventoryItems.id, id)).for("update");
      if (!item) return false;
      const [moved] = await tx.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.itemId, id)).limit(1);
      if (moved) throw new StorageConflict(ITEM_HAS_STOCK_HISTORY);
      await tx.delete(inventoryItems).where(eq(inventoryItems.id, id));
      return true;
    });
  }

  private async receiptDetail(exec: typeof db, receipt: StockReceipt): Promise<StockReceiptDetail> {
    const rows = await exec
      .select({ b: inventoryBatches, itemName: inventoryItems.name, unit: inventoryItems.unit, kind: inventoryItems.kind })
      .from(inventoryBatches)
      .leftJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.itemId))
      .where(eq(inventoryBatches.receiptId, receipt.id))
      .orderBy(asc(inventoryBatches.createdAt), asc(inventoryItems.name));
    return {
      ...receipt,
      lines: rows.map((r) => ({
        ...r.b,
        itemName: r.itemName ?? "—",
        unit: r.unit ?? "",
        kind: (r.kind ?? "consumable") as InventoryItem["kind"],
      })),
    };
  }

  // ------------------------------------------------------------- issues (B5.3)

  async listBatches(query: { itemId?: string } = {}): Promise<InventoryBatchView[]> {
    const where = [isNull(inventoryBatches.cancelledAt), sql`${inventoryBatches.remaining} > ${QTY_EPSILON}`];
    if (query.itemId) where.push(eq(inventoryBatches.itemId, query.itemId));
    const rows = await db
      .select({
        b: inventoryBatches,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        kind: inventoryItems.kind,
        receiptNumber: stockReceipts.number,
        receivedOn: stockReceipts.receivedOn,
        supplier: stockReceipts.supplier,
      })
      .from(inventoryBatches)
      .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.itemId))
      .leftJoin(stockReceipts, eq(stockReceipts.id, inventoryBatches.receiptId))
      .where(and(...where))
      .orderBy(asc(inventoryItems.name), sql`${inventoryBatches.expiresOn} ASC NULLS LAST`, asc(inventoryBatches.createdAt));
    return rows.map((r) => ({
      ...r.b,
      itemName: r.itemName,
      unit: r.unit,
      kind: r.kind as InventoryItem["kind"],
      receiptNumber: r.receiptNumber ?? null,
      receivedOn: r.receivedOn ?? null,
      supplier: r.supplier ?? null,
    }));
  }

  private issueSelect(exec: typeof db) {
    return exec
      .select({
        i: stockIssues,
        departmentName: departments.name,
        lineCount: sql<number>`(SELECT count(*)::int FROM stock_movements m
                                 WHERE m.issue_id = "stock_issues"."id" AND m.kind IN ('issue', 'writeoff'))`,
      })
      .from(stockIssues)
      .leftJoin(departments, eq(departments.id, stockIssues.departmentId));
  }

  private mapIssue(r: { i: typeof stockIssues.$inferSelect; departmentName: string | null; lineCount: number }): StockIssueView {
    return {
      ...r.i,
      kind: r.i.kind as StockIssue["kind"],
      reason: r.i.reason as StockIssue["reason"],
      departmentName: r.departmentName ?? null,
      lineCount: r.lineCount,
    };
  }

  private async issueDetail(exec: typeof db, id: string): Promise<StockIssueDetail | undefined> {
    const [head] = await this.issueSelect(exec).where(eq(stockIssues.id, id)).limit(1);
    if (!head) return undefined;
    const rows = await exec
      .select({
        m: stockMovements,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        lotNumber: inventoryBatches.lotNumber,
        expiresOn: inventoryBatches.expiresOn,
        purchasePrice: inventoryBatches.purchasePrice,
      })
      .from(stockMovements)
      .leftJoin(inventoryItems, eq(inventoryItems.id, stockMovements.itemId))
      .leftJoin(inventoryBatches, eq(inventoryBatches.id, stockMovements.batchId))
      .where(and(eq(stockMovements.issueId, id), inArray(stockMovements.kind, ["issue", "writeoff"])))
      .orderBy(asc(inventoryItems.name), sql`${inventoryBatches.expiresOn} ASC NULLS LAST`);
    const lines: StockIssueLine[] = rows.map((r) => ({
      movementId: r.m.id,
      itemId: r.m.itemId,
      itemName: r.itemName ?? "—",
      unit: r.unit ?? "",
      batchId: r.m.batchId,
      lotNumber: r.lotNumber ?? null,
      expiresOn: r.expiresOn ?? null,
      quantity: -r.m.quantity,
      purchasePrice: r.purchasePrice ?? 0,
    }));
    return { ...this.mapIssue(head), lines };
  }

  async listIssues(query: { limit?: number } = {}): Promise<StockIssueView[]> {
    const rows = await this.issueSelect(db).orderBy(desc(stockIssues.number)).limit(query.limit ?? 200);
    return rows.map((r) => this.mapIssue(r));
  }

  async getIssue(id: string): Promise<StockIssueDetail | undefined> {
    return this.issueDetail(db, id);
  }

  async createIssue(input: CreateIssueInput, today: string, actor: Actor): Promise<StockIssueDetail> {
    return db.transaction(async (tx) => {
      const ids = Array.from(new Set(input.lines.map((l) => l.itemId)));
      const items = await tx.select().from(inventoryItems).where(inArray(inventoryItems.id, ids));
      // Locked in a fixed order so two issues of the same items cannot deadlock.
      const batches = await tx
        .select()
        .from(inventoryBatches)
        .where(and(inArray(inventoryBatches.itemId, ids), isNull(inventoryBatches.cancelledAt)))
        .orderBy(asc(inventoryBatches.id))
        .for("update");
      const plan = planIssue(
        input.kind,
        input.lines,
        batches,
        new Map(items.map((i) => [i.id, i])),
        today,
      );
      if (!plan.ok) throw new StorageConflict(plan.message);
      const byId = new Map(batches.map((b) => [b.id, b]));
      const [issue] = await tx
        .insert(stockIssues)
        .values({
          kind: input.kind,
          departmentId: input.kind === "department" ? input.departmentId : null,
          receivedBy: input.kind === "department" ? (input.receivedBy ?? null) : null,
          reason: input.kind === "writeoff" ? input.reason : null,
          issuedOn: input.issuedOn,
          notes: input.notes ?? null,
          total: plan.allocations.reduce((s, a) => s + lineTotal(a.quantity, byId.get(a.batchId)!.purchasePrice), 0),
          createdBy: actor.id,
          createdByName: actor.name,
        })
        .returning();
      await tx.insert(stockMovements).values(
        plan.allocations.map((a) => ({
          itemId: a.itemId,
          batchId: a.batchId,
          kind: input.kind === "writeoff" ? "writeoff" : "issue",
          quantity: -a.quantity,
          issueId: issue.id,
          createdBy: actor.id,
          createdByName: actor.name,
        })),
      );
      for (const a of plan.allocations) {
        const next = byId.get(a.batchId)!.remaining - a.quantity;
        await tx
          .update(inventoryBatches)
          .set({ remaining: next < QTY_EPSILON ? 0 : next })
          .where(eq(inventoryBatches.id, a.batchId));
      }
      return (await this.issueDetail(tx as unknown as typeof db, issue.id))!;
    });
  }

  async cancelIssue(id: string, reason: string, actor: Actor): Promise<StockIssueDetail | undefined> {
    return db.transaction(async (tx) => {
      const [issue] = await tx.select().from(stockIssues).where(eq(stockIssues.id, id)).for("update");
      if (!issue) return undefined;
      if (issue.cancelledAt) throw new StorageConflict(ISSUE_ALREADY_CANCELLED);
      const out = await tx
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.issueId, id), inArray(stockMovements.kind, ["issue", "writeoff"])));
      if (await this.countedSince(tx as unknown as typeof db, out.map((m) => m.batchId), issue.createdAt)) {
        throw new StorageConflict(COUNTED_AFTER_DOCUMENT);
      }
      if (out.length) {
        const batchIds = Array.from(new Set(out.map((m) => m.batchId)));
        const batches = await tx.select().from(inventoryBatches).where(inArray(inventoryBatches.id, batchIds)).orderBy(asc(inventoryBatches.id)).for("update");
        const left = new Map(batches.map((b) => [b.id, b]));
        for (const m of out) {
          const b = left.get(m.batchId);
          if (!b) continue;
          b.remaining = Math.min(b.quantity, b.remaining - m.quantity);
          await tx.update(inventoryBatches).set({ remaining: b.remaining }).where(eq(inventoryBatches.id, b.id));
        }
        await tx.insert(stockMovements).values(
          out.map((m) => ({
            itemId: m.itemId,
            batchId: m.batchId,
            kind: "issue_cancel",
            quantity: -m.quantity,
            issueId: id,
            note: reason,
            createdBy: actor.id,
            createdByName: actor.name,
          })),
        );
      }
      await tx
        .update(stockIssues)
        .set({ cancelledAt: new Date().toISOString(), cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason })
        .where(eq(stockIssues.id, id));
      return this.issueDetail(tx as unknown as typeof db, id);
    });
  }

  // ------------------------------------------------------------- counts (B5.5)

  /**
   * Has any of these batches been counted, in a count that was not cancelled,
   * after `since`? Then the shelf was reconciled past that document, and
   * undoing it would put back (or take out) stock the count already settled.
   */
  private async countedSince(exec: typeof db, batchIds: string[], since: string): Promise<boolean> {
    const ids = Array.from(new Set(batchIds));
    if (ids.length === 0) return false;
    const [hit] = await exec
      .select({ id: stockCountLines.id })
      .from(stockCountLines)
      .innerJoin(stockCounts, eq(stockCounts.id, stockCountLines.countId))
      .where(and(inArray(stockCountLines.batchId, ids), gt(stockCountLines.countedAt, since), ne(stockCounts.status, "cancelled")))
      .limit(1);
    return Boolean(hit);
  }

  private countSelect(exec: typeof db) {
    return exec
      .select({
        c: stockCounts,
        lineCount: sql<number>`(SELECT count(*)::int FROM stock_count_lines l WHERE l.count_id = "stock_counts"."id")`,
        countedCount: sql<number>`(SELECT count(*)::int FROM stock_count_lines l
                                    WHERE l.count_id = "stock_counts"."id" AND l.counted IS NOT NULL)`,
        diffCount: sql<number>`(SELECT count(*)::int FROM stock_count_lines l
                                 WHERE l.count_id = "stock_counts"."id" AND l.counted IS NOT NULL AND abs(l.counted - l.expected) > 1e-9)`,
      })
      .from(stockCounts);
  }

  private mapCount(r: { c: typeof stockCounts.$inferSelect; lineCount: number; countedCount: number; diffCount: number }): StockCountView {
    return {
      ...r.c,
      status: r.c.status as StockCount["status"],
      kinds: (r.c.kinds ?? null) as StockCount["kinds"],
      lineCount: r.lineCount,
      countedCount: r.countedCount,
      diffCount: r.diffCount,
    };
  }

  private async countDetail(exec: typeof db, id: string): Promise<StockCountDetail | undefined> {
    const [head] = await this.countSelect(exec).where(eq(stockCounts.id, id)).limit(1);
    if (!head) return undefined;
    const rows = await exec
      .select({ l: stockCountLines, itemName: inventoryItems.name, unit: inventoryItems.unit, kind: inventoryItems.kind, b: inventoryBatches })
      .from(stockCountLines)
      .leftJoin(inventoryItems, eq(inventoryItems.id, stockCountLines.itemId))
      .leftJoin(inventoryBatches, eq(inventoryBatches.id, stockCountLines.batchId))
      .where(eq(stockCountLines.countId, id))
      .orderBy(asc(inventoryItems.name), sql`${inventoryBatches.expiresOn} ASC NULLS LAST`, asc(inventoryBatches.createdAt));
    const lines: StockCountLine[] = rows.map((r) => ({
      ...r.l,
      itemName: r.itemName ?? "—",
      unit: r.unit ?? "",
      kind: (r.kind ?? "consumable") as StockCountLine["kind"],
      lotNumber: r.b?.lotNumber ?? null,
      expiresOn: r.b?.expiresOn ?? null,
      purchasePrice: r.b?.purchasePrice ?? 0,
      quantity: r.b?.quantity ?? 0,
      remaining: r.b?.remaining ?? 0,
      batchCancelled: !r.b || Boolean(r.b.cancelledAt),
    }));
    return { ...this.mapCount(head), lines };
  }

  async listCounts(query: { limit?: number } = {}): Promise<StockCountView[]> {
    const rows = await this.countSelect(db).orderBy(desc(stockCounts.number)).limit(query.limit ?? 100);
    return rows.map((r) => this.mapCount(r));
  }

  async getCount(id: string): Promise<StockCountDetail | undefined> {
    return this.countDetail(db, id);
  }

  async createCount(input: CreateCountInput, actor: Actor): Promise<StockCountDetail> {
    return db.transaction(async (tx) => {
      const [open] = await tx.select({ id: stockCounts.id }).from(stockCounts).where(eq(stockCounts.status, "open")).limit(1);
      if (open) throw new StorageConflict(COUNT_ALREADY_OPEN);
      const where = [isNull(inventoryBatches.cancelledAt), sql`${inventoryBatches.remaining} > ${QTY_EPSILON}`];
      if (input.kinds) where.push(inArray(inventoryItems.kind, input.kinds));
      const batches = await tx
        .select({ id: inventoryBatches.id, itemId: inventoryBatches.itemId, remaining: inventoryBatches.remaining })
        .from(inventoryBatches)
        .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.itemId))
        .where(and(...where));
      if (batches.length === 0) throw new StorageConflict(COUNT_NOTHING);
      let count: typeof stockCounts.$inferSelect;
      try {
        [count] = await tx
          .insert(stockCounts)
          .values({
            status: "open",
            kinds: input.kinds,
            countedOn: input.countedOn,
            notes: input.notes ?? null,
            createdBy: actor.id,
            createdByName: actor.name,
          })
          .returning();
      } catch (err) {
        // Two people opening a count at the same moment: the index lets one through.
        const e = err as { code?: string; constraint?: string };
        if (e?.code === "23505" && e.constraint === "UQ_stock_counts_open") throw new StorageConflict(COUNT_ALREADY_OPEN);
        throw err;
      }
      await tx.insert(stockCountLines).values(batches.map((b) => ({ countId: count.id, itemId: b.itemId, batchId: b.id, expected: b.remaining })));
      return (await this.countDetail(tx as unknown as typeof db, count.id))!;
    });
  }

  async saveCountEntries(id: string, entries: CountEntryInput[], actor: Actor): Promise<StockCountDetail | undefined> {
    return db.transaction(async (tx) => {
      const [count] = await tx.select().from(stockCounts).where(eq(stockCounts.id, id)).for("update");
      if (!count) return undefined;
      if (count.status !== "open") throw new StorageConflict(COUNT_NOT_OPEN);
      // The last entry for a line wins, as it would on screen.
      const latest = Array.from(new Map(entries.map((e) => [e.lineId, e])).values());
      const lines = await tx
        .select()
        .from(stockCountLines)
        .where(and(eq(stockCountLines.countId, id), inArray(stockCountLines.id, latest.map((e) => e.lineId))));
      if (lines.length !== latest.length) throw new StorageConflict(COUNT_LINE_MISSING);
      const byLine = new Map(lines.map((l) => [l.id, l]));
      // Locked, so `expected` is a remaining no issue is changing right now.
      const batches = await tx
        .select({ b: inventoryBatches, name: inventoryItems.name, unit: inventoryItems.unit })
        .from(inventoryBatches)
        .innerJoin(inventoryItems, eq(inventoryItems.id, inventoryBatches.itemId))
        .where(inArray(inventoryBatches.id, Array.from(new Set(lines.map((l) => l.batchId)))))
        .orderBy(asc(inventoryBatches.id))
        .for("update", { of: inventoryBatches });
      const byBatch = new Map(batches.map((r) => [r.b.id, r]));
      const rows = latest.map((e) => {
        const r = byBatch.get(byLine.get(e.lineId)!.batchId);
        if (!r) throw new StorageConflict(ISSUE_BATCH_GONE);
        if (e.counted !== null) {
          const problem = countedProblem(e.counted, r.b, { name: r.name, unit: r.unit });
          if (problem) throw new StorageConflict(problem);
        }
        return { id: e.lineId, counted: e.counted, expected: r.b.remaining, note: e.note ?? null };
      });
      const now = new Date().toISOString();
      await tx.execute(sql`
        UPDATE stock_count_lines AS l
           SET counted = v.counted,
               expected = v.expected,
               note = v.note,
               counted_at = CASE WHEN v.counted IS NULL THEN NULL ELSE ${now}::timestamptz END,
               counted_by = CASE WHEN v.counted IS NULL THEN NULL ELSE ${actor.id}::text END,
               counted_by_name = CASE WHEN v.counted IS NULL THEN NULL ELSE ${actor.name}::text END
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(id varchar, counted double precision, expected double precision, note text)
         WHERE l.id = v.id AND l.count_id = ${id}`);
      return this.countDetail(tx as unknown as typeof db, id);
    });
  }

  async postCount(id: string, actor: Actor): Promise<StockCountDetail | undefined> {
    return db.transaction(async (tx) => {
      const [count] = await tx.select().from(stockCounts).where(eq(stockCounts.id, id)).for("update");
      if (!count) return undefined;
      if (count.status !== "open") throw new StorageConflict(COUNT_NOT_OPEN);
      const lines = await tx
        .select({ l: stockCountLines, itemName: inventoryItems.name, unit: inventoryItems.unit })
        .from(stockCountLines)
        .leftJoin(inventoryItems, eq(inventoryItems.id, stockCountLines.itemId))
        .where(eq(stockCountLines.countId, id));
      const batchIds = Array.from(new Set(lines.map((r) => r.l.batchId)));
      // Fixed order, like issues: a post and an issue on the same batches cannot deadlock.
      const batches = batchIds.length
        ? await tx.select().from(inventoryBatches).where(inArray(inventoryBatches.id, batchIds)).orderBy(asc(inventoryBatches.id)).for("update")
        : [];
      const byBatch = new Map(batches.map((b) => [b.id, b]));
      const plan = planCountPost(
        lines.map((r) => ({ id: r.l.id, batchId: r.l.batchId, expected: r.l.expected, counted: r.l.counted, itemName: r.itemName ?? "—", unit: r.unit ?? "" })),
        byBatch,
      );
      if (!plan.ok) throw new StorageConflict(plan.message);
      let shortageValue = 0;
      let surplusValue = 0;
      for (const a of plan.adjustments) {
        const v = lineTotal(Math.abs(a.delta), byBatch.get(a.batchId)!.purchasePrice);
        if (a.delta < 0) shortageValue += v;
        else surplusValue += v;
      }
      if (plan.adjustments.length) {
        const itemOf = new Map(lines.map((r) => [r.l.id, r.l.itemId]));
        await tx.insert(stockMovements).values(
          plan.adjustments.map((a) => ({
            itemId: itemOf.get(a.lineId)!,
            batchId: a.batchId,
            kind: "count",
            quantity: a.delta,
            countId: id,
            note: `Inventarizatsiya №${count.number}`,
            createdBy: actor.id,
            createdByName: actor.name,
          })),
        );
        for (const a of plan.adjustments) {
          await tx.update(inventoryBatches).set({ remaining: a.next }).where(eq(inventoryBatches.id, a.batchId));
        }
      }
      await tx
        .update(stockCounts)
        .set({ status: "posted", postedAt: new Date().toISOString(), postedBy: actor.id, postedByName: actor.name, shortageValue, surplusValue })
        .where(eq(stockCounts.id, id));
      return this.countDetail(tx as unknown as typeof db, id);
    });
  }

  async cancelCount(id: string, reason: string, actor: Actor): Promise<StockCountDetail | undefined> {
    return db.transaction(async (tx) => {
      const [count] = await tx.select().from(stockCounts).where(eq(stockCounts.id, id)).for("update");
      if (!count) return undefined;
      if (count.status === "posted") throw new StorageConflict(COUNT_POSTED_FINAL);
      if (count.status !== "open") throw new StorageConflict(COUNT_NOT_OPEN);
      await tx
        .update(stockCounts)
        .set({ status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason })
        .where(eq(stockCounts.id, id));
      return this.countDetail(tx as unknown as typeof db, id);
    });
  }

  // ---------------------------------------------------------- consumption (B5.6)

  private normSelect(exec: typeof db) {
    return exec
      .select({ n: consumptionNorms, testName: tests.name, itemName: inventoryItems.name, unit: inventoryItems.unit, itemKind: inventoryItems.kind, itemActive: inventoryItems.isActive })
      .from(consumptionNorms)
      .leftJoin(tests, eq(tests.id, consumptionNorms.testId))
      .leftJoin(inventoryItems, eq(inventoryItems.id, consumptionNorms.itemId));
  }

  private mapNorm(r: {
    n: typeof consumptionNorms.$inferSelect;
    testName: string | null;
    itemName: string | null;
    unit: string | null;
    itemKind: string | null;
    itemActive: boolean | null;
  }): ConsumptionNormView {
    return {
      ...r.n,
      status: r.n.status as ConsumptionNorm["status"],
      testName: r.testName ?? "—",
      itemName: r.itemName ?? "—",
      unit: r.unit ?? "",
      itemKind: (r.itemKind ?? "consumable") as ConsumptionNormView["itemKind"],
      itemActive: r.itemActive ?? false,
    };
  }

  async listNorms(): Promise<ConsumptionNormView[]> {
    const rows = await this.normSelect(db).orderBy(asc(tests.name), asc(inventoryItems.name), desc(consumptionNorms.createdAt));
    return rows.map((r) => this.mapNorm(r));
  }

  async getNorm(id: string): Promise<ConsumptionNormView | undefined> {
    const [r] = await this.normSelect(db).where(eq(consumptionNorms.id, id)).limit(1);
    return r && this.mapNorm(r);
  }

  async createNorm(input: InsertNormInput, actor: Actor): Promise<ConsumptionNormView> {
    try {
      const [n] = await db
        .insert(consumptionNorms)
        .values({ testId: input.testId, itemId: input.itemId, quantity: input.quantity, notes: input.notes ?? null, status: "draft", createdBy: actor.id, createdByName: actor.name })
        .returning();
      return (await this.getNorm(n.id))!;
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e?.code === "23505" && e.constraint === "UQ_consumption_norms_live") throw new StorageConflict(NORM_DRAFT_EXISTS);
      throw err;
    }
  }

  async updateNorm(id: string, input: UpdateNormInput, actor: Actor): Promise<ConsumptionNormView | undefined> {
    const patch: Partial<typeof consumptionNorms.$inferInsert> = { updatedAt: new Date().toISOString(), updatedBy: actor.id };
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.notes !== undefined) patch.notes = input.notes;
    const [n] = await db
      .update(consumptionNorms)
      .set(patch)
      .where(and(eq(consumptionNorms.id, id), eq(consumptionNorms.status, "draft")))
      .returning({ id: consumptionNorms.id });
    if (n) return this.getNorm(id);
    if (await this.getNorm(id)) throw new StorageConflict(NORM_NOT_DRAFT);
    return undefined;
  }

  async approveNorm(id: string, actor: Actor): Promise<{ norm: ConsumptionNormView; replaced: ConsumptionNormView | null } | undefined> {
    return db.transaction(async (tx) => {
      const [draft] = await tx.select().from(consumptionNorms).where(eq(consumptionNorms.id, id)).for("update");
      if (!draft) return undefined;
      if (draft.status !== "draft") throw new StorageConflict(NORM_NOT_DRAFT);
      const now = new Date().toISOString();
      // The norm it replaces stops at the same instant the new one starts.
      const [old] = await tx
        .update(consumptionNorms)
        .set({ status: "retired", retiredAt: now, retiredBy: actor.id, retiredByName: actor.name, retireReason: "Yangi norma tasdiqlandi" })
        .where(and(eq(consumptionNorms.testId, draft.testId), eq(consumptionNorms.itemId, draft.itemId), eq(consumptionNorms.status, "approved")))
        .returning({ id: consumptionNorms.id });
      await tx
        .update(consumptionNorms)
        .set({ status: "approved", approvedAt: now, approvedBy: actor.id, approvedByName: actor.name })
        .where(eq(consumptionNorms.id, id));
      const exec = tx as unknown as typeof db;
      const [n] = await this.normSelect(exec).where(eq(consumptionNorms.id, id)).limit(1);
      const [r] = old ? await this.normSelect(exec).where(eq(consumptionNorms.id, old.id)).limit(1) : [];
      return { norm: this.mapNorm(n), replaced: r ? this.mapNorm(r) : null };
    });
  }

  async retireNorm(id: string, reason: string, actor: Actor): Promise<ConsumptionNormView | undefined> {
    const [n] = await db
      .update(consumptionNorms)
      .set({ status: "retired", retiredAt: new Date().toISOString(), retiredBy: actor.id, retiredByName: actor.name, retireReason: reason })
      .where(and(eq(consumptionNorms.id, id), ne(consumptionNorms.status, "retired")))
      .returning({ id: consumptionNorms.id });
    if (n) return this.getNorm(id);
    if (await this.getNorm(id)) throw new StorageConflict(NORM_ALREADY_RETIRED);
    return undefined;
  }

  private consumptionSelect(exec: typeof db) {
    return exec
      .select({
        c: labConsumptions,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        testName: tests.name,
        orderNumber: orders.orderNumber,
        value: sql<number>`(SELECT coalesce(sum((CASE WHEN m.quantity < 0 THEN 1 ELSE -1 END) * round((abs(m.quantity) * b.purchase_price)::numeric)), 0)::float
                             FROM stock_movements m JOIN inventory_batches b ON b.id = m.batch_id
                            WHERE m.consumption_id = "lab_consumptions"."id")`,
      })
      .from(labConsumptions)
      .leftJoin(inventoryItems, eq(inventoryItems.id, labConsumptions.itemId))
      .leftJoin(tests, eq(tests.id, labConsumptions.testId))
      .leftJoin(orders, eq(orders.id, labConsumptions.orderId));
  }

  private mapConsumption(r: {
    c: typeof labConsumptions.$inferSelect;
    itemName: string | null;
    unit: string | null;
    testName: string | null;
    orderNumber: number | null;
    value: number;
  }): LabConsumptionView {
    return {
      ...r.c,
      kind: r.c.kind as LabConsumption["kind"],
      reason: r.c.reason as LabConsumption["reason"],
      itemName: r.itemName ?? "—",
      unit: r.unit ?? "",
      testName: r.testName ?? null,
      orderNumber: r.orderNumber ?? null,
      value: Number(r.value),
    };
  }

  async listConsumptions(query: { from?: string; to?: string; shortOnly?: boolean; limit?: number } = {}): Promise<LabConsumptionView[]> {
    const where = [];
    if (query.from) where.push(gte(labConsumptions.createdAt, query.from));
    if (query.to) where.push(sql`${labConsumptions.createdAt} < ${query.to}`);
    if (query.shortOnly) where.push(isNull(labConsumptions.cancelledAt), sql`${labConsumptions.quantity} - ${labConsumptions.posted} > ${QTY_EPSILON}`);
    const rows = await this.consumptionSelect(db)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(labConsumptions.createdAt))
      .limit(query.limit ?? 5000);
    return rows.map((r) => this.mapConsumption(r));
  }

  private async consumptionsByIds(exec: typeof db, ids: string[]): Promise<LabConsumptionView[]> {
    if (ids.length === 0) return [];
    const rows = await this.consumptionSelect(exec).where(inArray(labConsumptions.id, ids)).orderBy(asc(labConsumptions.createdAt));
    return rows.map((r) => this.mapConsumption(r));
  }

  /**
   * Takes what the shelf has for each consumption (FEFO, no expired batch) on
   * batches locked by the caller, writes the movements, and moves `remaining`
   * and `posted` with one statement each.
   */
  private async postConsumptions(
    tx: typeof db,
    entries: { id: string; itemId: string; need: number; posted: number }[],
    batches: (typeof inventoryBatches.$inferSelect)[],
    today: string,
    actor: Actor,
  ): Promise<void> {
    const plan = planConsumptions(entries.map((e) => ({ key: e.id, itemId: e.itemId, quantity: e.need })), batches, today);
    const moves = plan.flatMap((p) => p.allocations.map((a) => ({ ...a, consumptionId: p.key, itemId: entries.find((e) => e.id === p.key)!.itemId })));
    if (moves.length === 0) return;
    await tx.insert(stockMovements).values(
      moves.map((m) => ({
        itemId: m.itemId,
        batchId: m.batchId,
        kind: "consumption",
        quantity: -m.quantity,
        consumptionId: m.consumptionId,
        createdBy: actor.id,
        createdByName: actor.name,
      })),
    );
    const left = new Map(batches.map((b) => [b.id, b.remaining]));
    for (const m of moves) left.set(m.batchId, (left.get(m.batchId) ?? 0) - m.quantity);
    const remaining = Array.from(new Set(moves.map((m) => m.batchId))).map((id) => {
      const r = left.get(id)!;
      return { id, remaining: r < QTY_EPSILON ? 0 : r };
    });
    await tx.execute(sql`
      UPDATE inventory_batches AS b SET remaining = v.remaining
        FROM jsonb_to_recordset(${JSON.stringify(remaining)}::jsonb) AS v(id varchar, remaining double precision)
       WHERE b.id = v.id`);
    const posted = plan
      .filter((p) => p.posted > 0)
      .map((p) => ({ id: p.key, posted: Number((entries.find((e) => e.id === p.key)!.posted + p.posted).toFixed(6)) }));
    await tx.execute(sql`
      UPDATE lab_consumptions AS c SET posted = v.posted
        FROM jsonb_to_recordset(${JSON.stringify(posted)}::jsonb) AS v(id varchar, posted double precision)
       WHERE c.id = v.id`);
  }

  private async lockLiveBatches(tx: typeof db, itemIds: string[]) {
    if (itemIds.length === 0) return [];
    return tx
      .select()
      .from(inventoryBatches)
      .where(and(inArray(inventoryBatches.itemId, Array.from(new Set(itemIds))), isNull(inventoryBatches.cancelledAt)))
      .orderBy(asc(inventoryBatches.id))
      .for("update");
  }

  async consumeVerified(scope: { orderId?: string }, today: string, actor: Actor): Promise<LabConsumptionView[]> {
    return db.transaction(async (tx) => {
      const exec = tx as unknown as typeof db;
      const orderFilter = scope.orderId ? sql`AND ot.order_id = ${scope.orderId}` : sql``;
      // Each verified line meets the norms in force at its verification.
      const found = await tx.execute(sql`
        SELECT ot.id AS order_test_id, ot.order_id, ot.test_id, n.id AS norm_id, n.item_id, n.quantity
          FROM order_tests ot
          JOIN consumption_norms n
            ON n.test_id = ot.test_id
           AND n.approved_at IS NOT NULL AND n.approved_at <= ot.verified_at
           AND (n.retired_at IS NULL OR n.retired_at > ot.verified_at)
         WHERE ot.verified_at IS NOT NULL ${orderFilter}
           AND NOT EXISTS (SELECT 1 FROM lab_consumptions c
                            WHERE c.order_test_id = ot.id AND c.item_id = n.item_id AND c.kind = 'norm')
         ORDER BY ot.verified_at
         LIMIT ${MAX_CONSUME_BATCH}`);
      const candidates = found.rows as { order_test_id: string; order_id: string; test_id: string; norm_id: string; item_id: string; quantity: number }[];
      if (candidates.length === 0) return [];
      const batches = await this.lockLiveBatches(exec, candidates.map((c) => c.item_id));
      // A verification and a reconcile racing: the index lets one row through, the other is skipped.
      const inserted = await tx
        .insert(labConsumptions)
        .values(
          candidates.map((c) => ({
            kind: "norm",
            orderId: c.order_id,
            orderTestId: c.order_test_id,
            testId: c.test_id,
            itemId: c.item_id,
            normId: c.norm_id,
            quantity: Number(c.quantity),
            posted: 0,
            createdBy: actor.id,
            createdByName: actor.name,
          })),
        )
        .onConflictDoNothing({ target: [labConsumptions.orderTestId, labConsumptions.itemId], where: sql`kind = 'norm'` })
        .returning();
      await this.postConsumptions(exec, inserted.map((c) => ({ id: c.id, itemId: c.itemId, need: c.quantity, posted: 0 })), batches, today, actor);
      return this.consumptionsByIds(exec, inserted.map((c) => c.id));
    });
  }

  async recordConsumption(input: ExtraConsumptionInput, today: string, actor: Actor): Promise<LabConsumptionView> {
    return db.transaction(async (tx) => {
      const exec = tx as unknown as typeof db;
      const batches = await this.lockLiveBatches(exec, [input.itemId]);
      const [c] = await tx
        .insert(labConsumptions)
        .values({
          kind: "extra",
          testId: input.testId,
          itemId: input.itemId,
          quantity: input.quantity,
          posted: 0,
          reason: input.reason,
          note: input.note ?? null,
          createdBy: actor.id,
          createdByName: actor.name,
        })
        .returning();
      await this.postConsumptions(exec, [{ id: c.id, itemId: c.itemId, need: c.quantity, posted: 0 }], batches, today, actor);
      return (await this.consumptionsByIds(exec, [c.id]))[0];
    });
  }

  async settleConsumptions(ids: string[] | null, today: string, actor: Actor): Promise<LabConsumptionView[]> {
    return db.transaction(async (tx) => {
      const exec = tx as unknown as typeof db;
      const where = [isNull(labConsumptions.cancelledAt), sql`${labConsumptions.quantity} - ${labConsumptions.posted} > ${QTY_EPSILON}`];
      if (ids) where.push(inArray(labConsumptions.id, ids.length ? ids : ["-"]));
      const short = await tx.select().from(labConsumptions).where(and(...where)).orderBy(asc(labConsumptions.createdAt)).limit(MAX_CONSUME_BATCH).for("update");
      if (short.length === 0) return [];
      const batches = await this.lockLiveBatches(exec, short.map((c) => c.itemId));
      await this.postConsumptions(exec, short.map((c) => ({ id: c.id, itemId: c.itemId, need: shortOf(c), posted: c.posted })), batches, today, actor);
      const after = await this.consumptionsByIds(exec, short.map((c) => c.id));
      const moved = after.filter((a) => a.posted > short.find((s) => s.id === a.id)!.posted + QTY_EPSILON);
      if (moved.length) {
        await tx
          .update(labConsumptions)
          .set({ settledAt: new Date().toISOString(), settledByName: actor.name })
          .where(inArray(labConsumptions.id, moved.map((m) => m.id)));
      }
      return this.consumptionsByIds(exec, moved.map((m) => m.id));
    });
  }

  async cancelConsumption(id: string, reason: string, actor: Actor): Promise<LabConsumptionView | undefined> {
    return db.transaction(async (tx) => {
      const exec = tx as unknown as typeof db;
      const [c] = await tx.select().from(labConsumptions).where(eq(labConsumptions.id, id)).for("update");
      if (!c) return undefined;
      if (c.kind !== "extra") throw new StorageConflict(NORM_CONSUMPTION_FINAL);
      if (c.cancelledAt) throw new StorageConflict(CONSUMPTION_ALREADY_CANCELLED);
      const out = await tx.select().from(stockMovements).where(and(eq(stockMovements.consumptionId, id), eq(stockMovements.kind, "consumption")));
      if (await this.countedSince(exec, out.map((m) => m.batchId), c.createdAt)) throw new StorageConflict(COUNTED_AFTER_DOCUMENT);
      if (out.length) {
        const batches = await tx
          .select()
          .from(inventoryBatches)
          .where(inArray(inventoryBatches.id, Array.from(new Set(out.map((m) => m.batchId)))))
          .orderBy(asc(inventoryBatches.id))
          .for("update");
        const byId = new Map(batches.map((b) => [b.id, b]));
        for (const m of out) {
          const b = byId.get(m.batchId);
          if (!b) continue;
          b.remaining = Math.min(b.quantity, b.remaining - m.quantity);
          await tx.update(inventoryBatches).set({ remaining: b.remaining }).where(eq(inventoryBatches.id, b.id));
        }
        await tx.insert(stockMovements).values(
          out.map((m) => ({
            itemId: m.itemId,
            batchId: m.batchId,
            kind: "consumption_cancel",
            quantity: -m.quantity,
            consumptionId: id,
            note: reason,
            createdBy: actor.id,
            createdByName: actor.name,
          })),
        );
      }
      await tx
        .update(labConsumptions)
        .set({ cancelledAt: new Date().toISOString(), cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason })
        .where(eq(labConsumptions.id, id));
      return (await this.consumptionsByIds(exec, [id]))[0];
    });
  }

  async listReceipts(query: { limit?: number } = {}): Promise<StockReceiptView[]> {
    const rows = await db
      .select({
        r: stockReceipts,
        lineCount: sql<number>`(SELECT count(*)::int FROM inventory_batches b WHERE b.receipt_id = "stock_receipts"."id")`,
      })
      .from(stockReceipts)
      .orderBy(desc(stockReceipts.number))
      .limit(query.limit ?? 200);
    return rows.map((x) => ({ ...x.r, lineCount: x.lineCount }));
  }

  async getReceipt(id: string): Promise<StockReceiptDetail | undefined> {
    const [r] = await db.select().from(stockReceipts).where(eq(stockReceipts.id, id)).limit(1);
    return r && this.receiptDetail(db, r);
  }

  async createReceipt(input: CreateReceiptInput, actor: Actor): Promise<StockReceiptDetail> {
    return db.transaction(async (tx) => {
      const [receipt] = await tx
        .insert(stockReceipts)
        .values({
          supplier: input.supplier,
          documentNumber: input.documentNumber ?? null,
          receivedOn: input.receivedOn,
          notes: input.notes ?? null,
          total: input.lines.reduce((s, l) => s + lineTotal(l.quantity, l.purchasePrice), 0),
          createdBy: actor.id,
          createdByName: actor.name,
        })
        .returning();
      const batches = await tx
        .insert(inventoryBatches)
        .values(
          input.lines.map((l) => ({
            itemId: l.itemId,
            receiptId: receipt.id,
            lotNumber: l.lotNumber ?? null,
            expiresOn: l.expiresOn ?? null,
            quantity: l.quantity,
            remaining: l.quantity,
            purchasePrice: l.purchasePrice,
          })),
        )
        .returning();
      await tx.insert(stockMovements).values(
        batches.map((b) => ({
          itemId: b.itemId,
          batchId: b.id,
          kind: "receipt",
          quantity: b.quantity,
          receiptId: receipt.id,
          createdBy: actor.id,
          createdByName: actor.name,
        })),
      );
      return this.receiptDetail(tx as unknown as typeof db, receipt);
    });
  }

  async cancelReceipt(id: string, reason: string, actor: Actor): Promise<StockReceiptDetail | undefined> {
    return db.transaction(async (tx) => {
      const [receipt] = await tx.select().from(stockReceipts).where(eq(stockReceipts.id, id)).for("update");
      if (!receipt) return undefined;
      if (receipt.cancelledAt) throw new StorageConflict(RECEIPT_ALREADY_CANCELLED);
      const batches = await tx.select().from(inventoryBatches).where(eq(inventoryBatches.receiptId, id)).for("update");
      if (batches.some((b) => Math.abs(b.remaining - b.quantity) > 1e-9)) throw new StorageConflict(RECEIPT_IN_USE);
      if (await this.countedSince(tx as unknown as typeof db, batches.map((b) => b.id), receipt.createdAt)) {
        throw new StorageConflict(COUNTED_AFTER_DOCUMENT);
      }
      const now = new Date().toISOString();
      if (batches.length) {
        await tx.insert(stockMovements).values(
          batches.map((b) => ({
            itemId: b.itemId,
            batchId: b.id,
            kind: "receipt_cancel",
            quantity: -b.remaining,
            receiptId: id,
            note: reason,
            createdBy: actor.id,
            createdByName: actor.name,
          })),
        );
        await tx.update(inventoryBatches).set({ remaining: 0, cancelledAt: now }).where(eq(inventoryBatches.receiptId, id));
      }
      const [updated] = await tx
        .update(stockReceipts)
        .set({ cancelledAt: now, cancelledBy: actor.id, cancelledByName: actor.name, cancelReason: reason })
        .where(eq(stockReceipts.id, id))
        .returning();
      return this.receiptDetail(tx as unknown as typeof db, updated);
    });
  }

  async getLabBoard(day: string): Promise<LabBoard> {
    // The same rules as summarizeLabBoard (shared/lab-board.ts), in one
    // statement. Only live orders and those cancelled in the last two days are
    // read; the per-order facts are computed once in "o" and counted below.
    const local = (col: string) => sql.raw(`(${col} AT TIME ZONE current_setting('TIMEZONE'))::date`);
    const countsQuery = db.execute<LabBoardCounts & { groups: Record<string, number> | null }>(sql`
      WITH o AS (
        SELECT
          ord.id, ord.status,
          ${local("ord.created_at")} AS created_day,
          ${local("coalesce(ord.updated_at, ord.created_at)")} AS changed_day,
          s.status AS sample_status,
          EXISTS (SELECT 1 FROM order_tests ot WHERE ot.order_id = ord.id AND ot.verified_at IS NULL
                    AND (ot.result IS NULL OR btrim(ot.result) = '' OR ot.returned_at IS NOT NULL)) AS has_blank,
          EXISTS (SELECT 1 FROM order_tests ot WHERE ot.order_id = ord.id AND ot.verified_at IS NULL
                    AND ot.result IS NOT NULL AND btrim(ot.result) <> '' AND ot.returned_at IS NULL) AS has_review,
          (EXISTS (SELECT 1 FROM order_tests ot WHERE ot.order_id = ord.id)
            AND NOT EXISTS (SELECT 1 FROM order_tests ot WHERE ot.order_id = ord.id AND ot.verified_at IS NULL)) AS released,
          (SELECT ${local("max(ot.verified_at)")} FROM order_tests ot WHERE ot.order_id = ord.id) AS verified_day
        FROM orders ord
        LEFT JOIN samples s ON s.order_id = ord.id
        WHERE ord.status <> 'cancelled' OR coalesce(ord.updated_at, ord.created_at) > now() - interval '2 days'
      )
      SELECT
        count(*) FILTER (WHERE status <> 'cancelled' AND created_day = ${day}::date)::int AS "today",
        count(*) FILTER (WHERE status <> 'cancelled' AND sample_status IS NOT NULL
                           AND sample_status <> 'qabul_qilindi')::int AS "awaitingSample",
        count(*) FILTER (WHERE status <> 'cancelled' AND sample_status = 'rad_etildi')::int AS "rejected",
        count(*) FILTER (WHERE status <> 'cancelled' AND (sample_status IS NULL OR sample_status = 'qabul_qilindi')
                           AND has_blank)::int AS "inProgress",
        count(*) FILTER (WHERE status <> 'cancelled' AND has_review)::int AS "review",
        count(*) FILTER (WHERE status <> 'cancelled' AND released AND verified_day = ${day}::date)::int AS "readyToday",
        count(*) FILTER (WHERE status = 'cancelled' AND changed_day = ${day}::date)::int AS "cancelledToday",
        (SELECT json_object_agg(g.grp, g.n) FROM (
           SELECT t."group" AS grp, count(DISTINCT ot.order_id)::int AS n
           FROM order_tests ot
           JOIN tests t ON t.id = ot.test_id
           JOIN o ON o.id = ot.order_id
           WHERE o.status <> 'cancelled' AND o.created_day = ${day}::date
           GROUP BY t."group") g) AS "groups"
      FROM o
    `);
    const awaitingQuery = db
      .select()
      .from(orders)
      .where(
        and(
          sql`${orders.status} <> 'cancelled'`,
          sql`EXISTS (SELECT 1 FROM samples s WHERE s.order_id = "orders"."id" AND s.status <> 'qabul_qilindi')`,
        ),
      )
      .orderBy(asc(orders.createdAt))
      .limit(LAB_BOARD_AWAITING_LIMIT);

    const [{ rows }, waitingRows] = await Promise.all([countsQuery, awaitingQuery]);
    const r = rows[0];
    const groupsToday: LabBoard["groupsToday"] = {};
    for (const [g, n] of Object.entries(r?.groups ?? {})) if (isTestGroup(g)) groupsToday[g] = Number(n);
    return {
      date: day,
      counts: {
        today: r?.today ?? 0,
        awaitingSample: r?.awaitingSample ?? 0,
        rejected: r?.rejected ?? 0,
        inProgress: r?.inProgress ?? 0,
        review: r?.review ?? 0,
        readyToday: r?.readyToday ?? 0,
        cancelledToday: r?.cancelledToday ?? 0,
      },
      groupsToday,
      awaiting: await this.hydrate(waitingRows),
    };
  }

  async getReceptionDay(day: string): Promise<ReceptionDay> {
    // One statement: the desk's home screen refreshes all day, and on Neon
    // every extra round trip is felt.
    const { rows } = await db.execute<{
      patients_today: number;
      new_total: number;
      new_latest: { id: string; patient_number: number; full_name: string; phone: string; created_at: string }[];
      orders: number;
      paid: number;
      partial: number;
      unpaid: number;
      billed: number;
      collected: number;
    }>(sql`
      WITH today_orders AS (
        SELECT o.total_amount, o.paid_amount FROM orders o
        WHERE o.status <> 'cancelled'
          AND (o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date = ${day}::date
      ), new_patients AS (
        SELECT p.id, p.patient_number, p.full_name, p.phone, p.created_at FROM patients p
        WHERE (p.created_at AT TIME ZONE current_setting('TIMEZONE'))::date = ${day}::date
      )
      SELECT
        (SELECT count(DISTINCT v.patient_id) FROM visits v WHERE v.visit_date = ${day}::text)::int AS patients_today,
        (SELECT count(*) FROM new_patients)::int                                             AS new_total,
        (SELECT coalesce(json_agg(n ORDER BY n.created_at DESC), '[]'::json)
           FROM (SELECT * FROM new_patients np ORDER BY np.created_at DESC LIMIT 6) n)         AS new_latest,
        (SELECT count(*) FROM today_orders)::int                                              AS orders,
        (SELECT count(*) FROM today_orders t WHERE t.paid_amount >= t.total_amount)::int      AS paid,
        (SELECT count(*) FROM today_orders t
           WHERE t.paid_amount > 0 AND t.paid_amount < t.total_amount)::int                   AS partial,
        (SELECT count(*) FROM today_orders t WHERE t.paid_amount = 0 AND t.total_amount > 0)::int AS unpaid,
        (SELECT coalesce(sum(t.total_amount), 0) FROM today_orders t)::int                     AS billed,
        (SELECT coalesce(sum(least(t.paid_amount, t.total_amount)), 0) FROM today_orders t)::int AS collected
    `);
    const r = rows[0];
    const billed = r?.billed ?? 0;
    const collected = r?.collected ?? 0;
    return {
      date: day,
      patientsToday: r?.patients_today ?? 0,
      newPatients: {
        total: r?.new_total ?? 0,
        latest: (r?.new_latest ?? []).map((n) => ({
          id: n.id,
          patientNumber: n.patient_number,
          fullName: n.full_name,
          phone: n.phone,
          createdAt: iso(n.created_at),
        })),
      },
      payments: {
        orders: r?.orders ?? 0,
        paid: r?.paid ?? 0,
        partial: r?.partial ?? 0,
        unpaid: r?.unpaid ?? 0,
        billed,
        collected,
        due: Math.max(0, billed - collected),
      },
    };
  }

  async getRevenueReport(from: string, to: string): Promise<RevenueReportData> {
    const inRange = and(
      sql`${orders.status} <> 'cancelled'`,
      gte(dayExpr, sql`${from}::date`),
      lte(dayExpr, sql`${to}::date`),
    );

    // Two straightforward groupings merged in JS: counting tests in the same
    // query as orders would multiply the order rows by their line items.
    const [orderDays, testDays] = await Promise.all([
      db
        .select({
          date: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
          patients: sql<number>`count(distinct ${orders.patientId})::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(inRange)
        .groupBy(dayExpr)
        .orderBy(asc(dayExpr)),
      db
        .select({
          date: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
          tests: sql<number>`count(*)::int`,
        })
        .from(orderTests)
        .innerJoin(orders, eq(orders.id, orderTests.orderId))
        .where(inRange)
        .groupBy(dayExpr),
    ]);

    const testsByDay = new Map(testDays.map((r) => [r.date, r.tests]));
    const points = orderDays.map((d) => ({ ...d, tests: testsByDay.get(d.date) ?? 0 }));

    const [[totals], topTests, byCategory] = await Promise.all([
      db
        .select({
          totalRevenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
          totalPaid: sql<number>`coalesce(sum(${orders.paidAmount}), 0)::int`,
          totalPatients: sql<number>`count(distinct ${orders.patientId})::int`,
        })
        .from(orders)
        .where(inRange),
      db
        .select({
          name: orderTests.testName,
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orderTests.price}), 0)::int`,
        })
        .from(orderTests)
        .innerJoin(orders, eq(orders.id, orderTests.orderId))
        .where(inRange)
        .groupBy(orderTests.testName)
        .orderBy(desc(sql`sum(${orderTests.price})`))
        .limit(8),
      db
        .select({
          category: sql<string>`coalesce(${tests.category}, 'Boshqa')`,
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${orderTests.price}), 0)::int`,
        })
        .from(orderTests)
        .innerJoin(orders, eq(orders.id, orderTests.orderId))
        .leftJoin(tests, eq(tests.id, orderTests.testId))
        .where(inRange)
        .groupBy(sql`coalesce(${tests.category}, 'Boshqa')`)
        .orderBy(desc(sql`sum(${orderTests.price})`)),
    ]);

    // Cancelled expenses never reduce the profit.
    const spentInRange = and(gte(expenses.spentOn, from), lte(expenses.spentOn, to), eq(expenses.status, "active"));
    const [expensesByCategory, byReferrer] = await Promise.all([
      db
        .select({
          category: expenses.category,
          amount: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
        })
        .from(expenses)
        .where(spentInRange)
        .groupBy(expenses.category)
        .orderBy(desc(sql`sum(${expenses.amount})`)),
      db
        .select({
          referrer: sql<string>`coalesce(nullif(btrim(${orders.referrer}), ''), '—')`,
          patients: sql<number>`count(distinct ${orders.patientId})::int`,
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)::int`,
        })
        .from(orders)
        .where(inRange)
        .groupBy(sql`coalesce(nullif(btrim(${orders.referrer}), ''), '—')`)
        .orderBy(desc(sql`sum(${orders.totalAmount})`))
        .limit(10),
    ]);

    const totalTests = byCategory.reduce((sum, c) => sum + c.count, 0);
    const totalExpenses = expensesByCategory.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = totals?.totalPaid ?? 0;

    return {
      range: { from, to },
      points,
      totalRevenue: totals?.totalRevenue ?? 0,
      totalPaid,
      totalPatients: totals?.totalPatients ?? 0,
      totalTests,
      topTests,
      byCategory,
      totalExpenses,
      // Against money actually collected, not invoiced: an unpaid bill is not
      // cash the lab can spend.
      netProfit: totalPaid - totalExpenses,
      expensesByCategory,
      byReferrer,
    };
  }

  // ------------------------------------------------------------- settings

  // ------------------------------------------------------------- security

  async getSecuritySettings(): Promise<SecuritySettings> {
    try {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "security")).limit(1);
      // Parsed rather than trusted: a hand-edited row with a nonsense value
      // must not switch session expiry off.
      const parsed = securitySettingsSchema.safeParse({ ...DEFAULT_SECURITY_SETTINGS, ...(row?.value ?? {}) });
      return parsed.success ? parsed.data : { ...DEFAULT_SECURITY_SETTINGS };
    } catch (err) {
      if (isMissingTable(err)) return { ...DEFAULT_SECURITY_SETTINGS };
      throw err;
    }
  }

  async updateSecuritySettings(input: SecuritySettings, actor: Actor): Promise<SecuritySettings> {
    const now = new Date().toISOString();
    await db
      .insert(appSettings)
      .values({ key: "security", value: input, updatedAt: now, updatedBy: actor.id })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: input, updatedAt: now, updatedBy: actor.id } });
    return { ...input };
  }

  async getLogo(): Promise<ClinicLogo | null> {
    try {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "logo")).limit(1);
      const v = row?.value as ClinicLogo | null | undefined;
      // Re-checked on the way out too: a hand-edited row must not put
      // arbitrary content into a page's <img>.
      return v && checkLogo(v.dataUrl).ok ? v : null;
    } catch (err) {
      if (isMissingTable(err)) return null;
      throw err;
    }
  }

  async setLogo(logo: ClinicLogo | null, actor: Actor): Promise<void> {
    const now = new Date().toISOString();
    if (!logo) {
      await db.delete(appSettings).where(eq(appSettings.key, "logo"));
      return;
    }
    await db
      .insert(appSettings)
      .values({ key: "logo", value: logo, updatedAt: now, updatedBy: actor.id })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: logo, updatedAt: now, updatedBy: actor.id } });
  }

  async getSettings(): Promise<LabSettings> {
    const [row] = await db.select().from(labSettings).limit(1);
    return row ?? DEFAULT_SETTINGS;
  }

  async updateSettings(input: LabSettingsInput): Promise<LabSettings> {
    const values = {
      id: "default",
      labName: input.labName,
      tagline: input.tagline,
      address: input.address ?? null,
      phone: input.phone ?? null,
      director: input.director ?? null,
      licenseNumber: input.licenseNumber ?? null,
    };
    const [row] = await db
      .insert(labSettings)
      .values(values)
      .onConflictDoUpdate({ target: labSettings.id, set: values })
      .returning();
    return row;
  }
}
