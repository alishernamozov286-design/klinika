import { computeFlag } from "@shared/reference-range";
import type { LockState } from "@shared/lockout";
import { SUPER_ADMIN, SYSTEM_ROLE_KEYS } from "@shared/permissions";
import type { TestGroup } from "@shared/lab-catalogue";
import type { LabBoard } from "@shared/lab-board";
import type {
  AuditEntry,
  CreatePaymentInput,
  DashboardStatsData,
  ReferralWithDetails,
  OrderTestVersion,
  NotificationFeed,
  NotificationKind,
  IcdEntry,
  IcdStats,
  ReceptionDay,
  Expense,
  ExpenseSummary,
  InsertExpense,
  InsertPatient,
  InsertTest,
  Department,
  DepartmentWithUsage,
  DoctorWithDetails,
  InsertDepartment,
  InsertDoctor,
  InsertRole,
  InsertUser,
  LabSettings,
  LabSettingsInput,
  OrderListResponse,
  OrderStatus,
  OrderWithDetails,
  Paged,
  Payment,
  Visit,
  Patient,
  PatientCard,
  PatientCardVisit,
  PatientDetails,
  PatientListItem,
  PublicUser,
  ResultFlag,
  RevenueReportData,
  RoleRecord,
  RoleWithUsage,
  SecuritySettings,
  Sample,
  TelegramContact,
  Test,
  UpdateOrderInput,
  UpdateSampleInput,
  UpdateDepartmentInput,
  UpdateExpenseInput,
  UpdateDoctorInput,
  UpdateRoleInput,
  UpdateUserInput,
  User,
  UserMfa,
  MedicalRecordVersion,
  MedicalRecordWithDetails,
  PatientAllergy,
  RecordFields,
  RecordStatus,
  Appointment,
  AppointmentStatus,
  AppointmentWithDetails,
  CreateAppointmentInput,
  InsertService,
  Service,
  ServiceWithDetails,
  UpdateServiceInput,
} from "@shared/schema";

/** Local (not UTC) calendar day — the lab's own day is what reports count. */
export function localDay(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return localDay(new Date());
}

export type PatientQuery = { search?: string; limit?: number; offset?: number };

export type PatientCandidateQuery = {
  nameKey?: string | null;
  /** First word of the name, for a cheap prefilter before nameKey is compared. */
  surname?: string | null;
  phoneDigits?: string | null;
  birthDate?: string | null;
  passport?: string | null;
  pinfl?: string | null;
  excludeId?: string;
};

export type OrderQuery = {
  search?: string;
  status?: OrderStatus;
  patientId?: string;
  from?: string;
  to?: string;
  /**
   * The results workbench (B4.5): "waiting" has a value to enter or fix,
   * "review" has a value for the lab head to check, "ready" is fully verified.
   */
  queue?: "waiting" | "review" | "ready";
  /** TZ §6.1.2: orders with at least one test of this catalogue group. */
  group?: TestGroup;
  limit?: number;
  offset?: number;
};

export type { Paged };

export type CreateOrderArgs = {
  patientId: string;
  testIds: string[];
  discount: number;
  paidAmount: number;
  notes?: string | null;
  referrer?: string | null;
  createdBy?: string | null;
};

export type ResultInput = {
  id: string;
  result?: string | null;
  flag?: string | null;
  notes?: string | null;
};

/**
 * The flag to store for one result line.
 *
 * A flag the laborant actually chose always wins — they can see the sample and
 * the machine, this code can only see a string. Auto-detection therefore only
 * *fills a blank*: it never overrules, and it never clears a human's choice
 * into "normal". When the range cannot be read for this patient the line simply
 * stays unflagged, which is the honest answer and leaves the manual buttons to
 * do their job.
 */
export function resolveFlag(
  incoming: ResultInput,
  line: { referenceRange: string | null },
  gender: string | null | undefined,
): ResultFlag | null {
  if (incoming.flag) return incoming.flag as ResultFlag;
  return computeFlag(incoming.result, line.referenceRange, { gender });
}

/** Who is performing the write — carried into payments, expenses and the log. */
export type Actor = { id: string | null; name: string };

/** One line as saveResults will write it. */
export type ResultChange = { id: string; result: string | null; flag: ResultFlag | null; notes: string | null };

/**
 * Which lines a save actually changes (B4.5). Unchanged lines are left alone —
 * re-saving must not move the entry time or the person who entered it. A
 * verified line is locked: changing it is a StorageConflict, the way back is
 * amendment, which keeps the replaced value.
 */
export function planResultSave(
  lines: { id: string; testName: string; result: string | null; flag: string | null; notes: string | null; referenceRange: string | null; verifiedAt: string | null }[],
  incoming: ResultInput[],
  gender: string | null | undefined,
): ResultChange[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const changes: ResultChange[] = [];
  for (const inc of incoming) {
    const line = byId.get(inc.id);
    if (!line) continue;
    const result = inc.result?.trim() || null;
    const flag = resolveFlag(inc, line, gender);
    const notes = inc.notes?.trim() || null;
    if (result === (line.result || null) && flag === (line.flag ?? null) && notes === (line.notes || null)) continue;
    if (line.verifiedAt) {
      throw new StorageConflict(`"${line.testName}" natijasi tasdiqlangan. O'zgartirish uchun "Tuzatish"dan foydalaning`);
    }
    changes.push({ id: line.id, result, flag, notes });
  }
  return changes;
}

/**
 * A write refused because of what is already in the database — a slot taken
 * a moment ago, a status someone else just changed. Routes answer it with 409.
 */
export class StorageConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConflict";
  }
}

export type AppointmentQuery = {
  /** One day (YYYY-MM-DD). */
  date?: string;
  /** Strictly before this day — the cabinet's "never finished" list. */
  beforeDate?: string;
  doctorId?: string;
  patientId?: string;
  statuses?: AppointmentStatus[];
  limit?: number;
};

/** What the storage layer needs to place a booking; the route has already priced it. */
export type NewAppointment = CreateAppointmentInput & { durationMinutes: number; price: number };

/**
 * Re-checked inside the write, under a per-doctor-per-day lock, against the
 * doctor's bookings for that day. Returns why the booking cannot be made.
 */
export type BookingCheck = (dayBookings: Appointment[]) => string | null;

export type ReferralQuery = {
  ids?: string[];
  patientId?: string;
  appointmentId?: string;
  /** Examinations and consultations still waiting for the desk to book them. */
  awaitingBooking?: boolean;
  limit?: number;
};

/** What every referral of one request shares: who, for whom, from which visit. */
export type ReferralOrigin = {
  patientId: string;
  visitId: string | null;
  appointmentId: string | null;
  doctorId: string;
  note: string | null;
};

/** One request from the referral dialog; the route has validated every id. */
export type NewReferrals = ReferralOrigin &
  (
    | { kind: "lab"; testIds: string[]; referrer: string }
    | { kind: "exam"; serviceIds: string[] }
    | { kind: "consult"; targetSpecialty: string; targetDoctorId: string | null }
  );

export type NewNotification = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  entityId: string | null;
  important: boolean;
  /** Raised at most once per key; a repeat is silently dropped. */
  dedupeKey: string | null;
};

export type IcdQuery = {
  q: string;
  limit: number;
  /** Chapters, blocks and retired codes too — the catalogue screen; the picker never offers them. */
  all?: boolean;
};

export type RecordQuery = {
  patientId?: string;
  /** Records of these appointments (an empty list matches nothing). */
  appointmentIds?: string[];
  doctorId?: string;
  status?: RecordStatus;
  limit?: number;
};

export type OpenRecordInput = { patientId: string; appointmentId: string; doctorId: string; visitId: string | null };

export type AppointmentStatusChange = {
  from: AppointmentStatus;
  to: AppointmentStatus;
  reason?: string | null;
};

export type ExpenseQuery = {
  from?: string;
  to?: string;
  category?: string;
  method?: string;
  /** Matched against the note and the payee, case-insensitively. */
  search?: string;
  /** "active" by default: cancelled rows are listed only when asked for. */
  status?: "active" | "cancelled" | "all";
  limit?: number;
  offset?: number;
};

export type AuditQuery = {
  entity?: string;
  entityId?: string;
  action?: string;
  limit?: number;
  offset?: number;
};

export type AuditInput = {
  actor: Actor;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
};

export const DEFAULT_SETTINGS: LabSettings = {
  id: "default",
  labName: "MedLab",
  tagline: "Tibbiy Laboratoriya",
  address: null,
  phone: null,
  director: null,
  licenseNumber: null,
};

/**
 * Only the administrator is seeded. Every other account is created by the
 * admin from Sozlamalar → Xodimlar, with one of the roles from SYSTEM_ROLES
 * or one the clinic defined itself.
 */
export const SEED_USERS: { username: string; password: string; fullName: string; role: User["role"] }[] = [
  // A single word on purpose: the dashboard greets people by their given name,
  // which it takes to be the second word of "Familiya Ism Otasining-ismi".
  // A two-word job title would come out as "Salom, administratori".
  { username: "admin", password: "admin123", fullName: "Administrator", role: SUPER_ADMIN },
];

/**
 * Assembles the patient card from the raw rows, the same way for both
 * backends. Orders are grouped by their visit; orders older than visits fall
 * back to their local day, so history before the visits table still reads as
 * one entry per day.
 */
/** An appointment the patient actually came to — the ones that make a visit. */
export const ATTENDED_STATUSES: readonly AppointmentStatus[] = ["arrived", "in_progress", "completed"];

export function buildPatientCard(
  patient: PatientDetails,
  orderList: OrderWithDetails[],
  visitList: Visit[],
  payments: (Payment & { orderNumber: number })[],
  appointmentList: AppointmentWithDetails[] = [],
): PatientCard {
  const visitDate = new Map(visitList.map((v) => [v.id, v.visitDate]));
  const groups = new Map<string, PatientCardVisit>();
  // A day with a doctor's appointment is a visit even without a lab order;
  // with one, both land on the same visit (the check-in shares it).
  const attended = appointmentList.filter((a) => ATTENDED_STATUSES.includes(a.status));
  for (const a of attended) {
    const key = a.visitId ?? `day:${a.date}`;
    const date = (a.visitId && visitDate.get(a.visitId)) || a.date;
    const g = groups.get(key) ?? { key, date, orders: [], appointments: [], billed: 0, paid: 0 };
    g.appointments.push(a);
    groups.set(key, g);
  }
  for (const order of orderList) {
    const key = order.visitId ?? `day:${localDay(order.createdAt)}`;
    const date = (order.visitId && visitDate.get(order.visitId)) || localDay(order.createdAt);
    const g = groups.get(key) ?? { key, date, orders: [], appointments: [], billed: 0, paid: 0 };
    g.orders.push(order);
    if (order.status !== "cancelled") {
      g.billed += order.totalAmount;
      g.paid += order.paidAmount;
    }
    groups.set(key, g);
  }
  const visits = [...groups.values()]
    .map((g) => ({
      ...g,
      orders: g.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      appointments: g.appointments.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const live = orderList.filter((o) => o.status !== "cancelled");
  const billed = live.reduce((s, o) => s + o.totalAmount, 0);
  const paid = live.reduce((s, o) => s + o.paidAmount, 0);
  const times = [
    ...orderList.map((o) => o.createdAt),
    ...attended.map((a) => a.arrivedAt ?? a.createdAt),
  ].sort();
  return {
    patient,
    visits,
    payments: [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    totals: {
      visits: visits.filter((v) => v.appointments.length > 0 || v.orders.some((o) => o.status !== "cancelled")).length,
      orders: orderList.length,
      billed,
      paid,
      debt: Math.max(0, billed - paid),
      firstVisitAt: times[0] ?? null,
      lastVisitAt: times[times.length - 1] ?? null,
    },
  };
}

/** Active before inactive, then alphabetical — how every directory list reads. */
export function byActiveThenName<T extends { isActive: boolean }>(name: (row: T) => string) {
  return (a: T, b: T) => Number(b.isActive) - Number(a.isActive) || name(a).localeCompare(name(b));
}

/** System roles in TZ §3 order, then the clinic's own roles by name. */
export function sortRoles<T extends { key: string; name: string; isSystem: boolean }>(list: T[]): T[] {
  const rank = (r: T) => {
    const i = SYSTEM_ROLE_KEYS.indexOf(r.key);
    return r.isSystem && i >= 0 ? i : SYSTEM_ROLE_KEYS.length;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export type SeedResult = {
  createdTests: number;
  createdUsers: number;
  /** System roles inserted because they were missing. */
  createdRoles: number;
  /** Accounts moved from the pre-RBAC "admin" key to "super_admin". */
  migratedAdmins: number;
};

export type CreateRoleArgs = InsertRole & { key: string; isSystem?: boolean };

export interface IStorage {
  /**
   * Idempotent boot-time setup: default tests and admin on an empty store,
   * plus any SYSTEM_ROLES row that is missing. Existing role rows are never
   * overwritten — once created, the clinic owns their permissions.
   */
  seed(): Promise<SeedResult>;

  /** Every role, system ones first, each with its current head count. */
  listRoles(): Promise<RoleWithUsage[]>;
  getRole(key: string): Promise<RoleRecord | undefined>;
  createRole(input: CreateRoleArgs, actor: Actor): Promise<RoleRecord>;
  /** System roles keep their key and system flag; only name/description/permissions change. */
  updateRole(key: string, input: UpdateRoleInput, actor: Actor): Promise<RoleRecord | undefined>;
  /** Refuses (returns false) for system roles. The route checks for holders first. */
  deleteRole(key: string): Promise<boolean>;

  /** Every department, active first then by name, each with its doctor count. */
  listDepartments(): Promise<DepartmentWithUsage[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(input: InsertDepartment, actor: Actor): Promise<Department>;
  updateDepartment(id: string, input: UpdateDepartmentInput, actor: Actor): Promise<Department | undefined>;
  /** The route refuses first when doctors are still attached. */
  deleteDepartment(id: string): Promise<boolean>;

  /** Doctors joined with their account and department, by name. */
  listDoctors(opts?: { activeOnly?: boolean; departmentId?: string }): Promise<DoctorWithDetails[]>;
  getDoctor(id: string): Promise<DoctorWithDetails | undefined>;
  getDoctorByUser(userId: string): Promise<DoctorWithDetails | undefined>;
  createDoctor(input: InsertDoctor, actor: Actor): Promise<DoctorWithDetails>;
  updateDoctor(id: string, input: UpdateDoctorInput, actor: Actor): Promise<DoctorWithDetails | undefined>;
  deleteDoctor(id: string): Promise<boolean>;

  listUsers(): Promise<PublicUser[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  /** `actor` is absent only for the seed accounts and the CLI scripts. */
  createUser(input: InsertUser, actor?: Actor): Promise<PublicUser>;
  updateUser(id: string, input: UpdateUserInput, actor?: Actor): Promise<PublicUser | undefined>;
  deleteUser(id: string): Promise<boolean>;

  /**
   * Writes the lockout counters back onto a user row.
   *
   * Separate from updateUser because it is not an edit anyone performed: it
   * carries no actor, must not touch the password, and has to work for an
   * account nobody is signed in as.
   */
  setLockState(userId: string, state: LockState): Promise<void>;

  // --- services (B2.6, TZ §4.1.5)

  listServices(opts?: { activeOnly?: boolean }): Promise<ServiceWithDetails[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(input: InsertService, actor: Actor): Promise<ServiceWithDetails>;
  updateService(id: string, input: UpdateServiceInput, actor: Actor): Promise<ServiceWithDetails | undefined>;
  /** Only for a service no appointment has used; the route checks. */
  deleteService(id: string): Promise<boolean>;

  // --- appointments (B2.7, TZ §4.1.4)

  listAppointments(query: AppointmentQuery): Promise<AppointmentWithDetails[]>;
  getAppointment(id: string): Promise<AppointmentWithDetails | undefined>;
  /**
   * Books a slot and issues the day's next ticket number for that doctor.
   * `check` runs under a lock with the doctor's bookings for the day; a
   * non-null answer aborts with StorageConflict.
   */
  createAppointment(input: NewAppointment, actor: Actor, check: BookingCheck): Promise<AppointmentWithDetails>;
  /**
   * Moves a still-"scheduled" booking. A new doctor or day gets a new ticket
   * number. StorageConflict when the slot is gone or the status moved on.
   */
  rescheduleAppointment(
    id: string,
    patch: { doctorId: string; date: string; startTime: string; durationMinutes: number; serviceId: string | null; price: number; reason: string | null },
    actor: Actor,
    check: BookingCheck,
  ): Promise<AppointmentWithDetails>;
  /**
   * Applies one status move — only if the appointment is still in `from`, so
   * two people pressing buttons at once cannot both win. Arrival attaches
   * the patient's visit for today. StorageConflict when the status moved on.
   */
  setAppointmentStatus(id: string, change: AppointmentStatusChange, actor: Actor): Promise<AppointmentWithDetails>;
  /** Any appointment at all — a doctor with history is deactivated, not deleted. */
  doctorHasAppointments(doctorId: string): Promise<boolean>;

  // --- examination records (B3.3, TZ §5.1.3, §5.2)

  /** Newest first (by appointment day and time). */
  listRecords(query: RecordQuery): Promise<MedicalRecordWithDetails[]>;
  getRecord(id: string): Promise<MedicalRecordWithDetails | undefined>;
  getRecordByAppointment(appointmentId: string): Promise<MedicalRecordWithDetails | undefined>;
  /** Opens the appointment's record as an empty draft — or returns the one already open. */
  openRecord(input: OpenRecordInput, actor: Actor): Promise<MedicalRecordWithDetails>;
  /**
   * Saves draft text, only if the record is still a draft at `revision`.
   * StorageConflict when it was signed, or saved from elsewhere, meanwhile.
   */
  saveRecordDraft(id: string, revision: number, fields: Partial<RecordFields>, actor: Actor): Promise<MedicalRecordWithDetails>;
  /** Signs (locks) a draft at `revision`. The route has checked signProblem(). */
  signRecord(id: string, revision: number, actor: Actor): Promise<MedicalRecordWithDetails>;
  /**
   * Corrects a signed record: the current text is kept as a version, the new
   * text becomes the next version, signed by the corrector. One transaction.
   */
  amendRecord(id: string, revision: number, fields: RecordFields, reason: string, actor: Actor): Promise<MedicalRecordWithDetails>;
  /** Replaced versions, newest first. */
  // ---- MKB-10 (B3.4)
  searchIcd(query: IcdQuery): Promise<IcdEntry[]>;
  getIcd(codes: string[]): Promise<IcdEntry[]>;
  icdStats(): Promise<IcdStats>;
  setIcdUzName(code: string, nameUz: string | null, actor: Actor): Promise<IcdEntry | undefined>;
  /** Sets many Uzbek names at once; codes not in the catalogue are reported, not created. */
  importIcdUzNames(names: Map<string, string>, actor: Actor): Promise<{ updated: number; unknown: string[] }>;

  // ---- notifications (B3.9)
  /** Returns false when the dedupe key was already used. */
  createNotification(input: NewNotification): Promise<boolean>;
  listNotifications(userId: string, limit: number): Promise<NotificationFeed>;
  markNotificationRead(userId: string, id: string): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<number>;

  // ---- referrals (B3.5)
  listReferrals(query: ReferralQuery): Promise<ReferralWithDetails[]>;
  getReferral(id: string): Promise<ReferralWithDetails | undefined>;
  /**
   * Issues the referrals of one request atomically. A lab referral creates its
   * lab order (unpaid, with its tube) in the same transaction.
   */
  createReferrals(input: NewReferrals, actor: Actor): Promise<ReferralWithDetails[]>;
  /**
   * Cancels with a reason. A lab referral cancels its order too, unless the
   * order already holds a payment or a result; a booked one must have its
   * booking cancelled first. Both refusals are StorageConflict.
   */
  cancelReferral(id: string, reason: string, actor: Actor): Promise<ReferralWithDetails | undefined>;

  listRecordVersions(recordId: string): Promise<MedicalRecordVersion[]>;

  // --- allergies (B3.2, TZ §5.1.2)

  listAllergies(patientId: string, opts?: { includeInactive?: boolean }): Promise<PatientAllergy[]>;
  getAllergy(id: string): Promise<PatientAllergy | undefined>;
  addAllergy(patientId: string, input: { allergen: string; reaction: string | null }, actor: Actor): Promise<PatientAllergy>;
  /** Marks an allergy inactive with a reason. StorageConflict if it already was. */
  deactivateAllergy(id: string, reason: string, actor: Actor): Promise<PatientAllergy>;

  // --- two-factor sign-in (B1.8, TZ §12). Secrets arrive already encrypted.

  /** False until `npm run db:mfa` has created the table (Postgres only). */
  mfaAvailable(): Promise<boolean>;
  /** Undefined when the user has no 2FA — or when the table does not exist yet. */
  getUserMfa(userId: string): Promise<UserMfa | undefined>;
  /** Every enrolled user and since when — the staff list's 2FA column. */
  listMfaEnrollments(): Promise<{ userId: string; enabledAt: string }[]>;
  /** Creates or replaces the enrolment; `lastUsedStep` is the code that confirmed it. */
  saveUserMfa(
    input: { userId: string; secret: string; recoveryCodes: string[]; lastUsedStep: number },
    actor: Actor,
  ): Promise<UserMfa>;
  replaceRecoveryCodes(userId: string, hashes: string[], actor: Actor): Promise<boolean>;
  /**
   * Records a code's step as used — only if it is newer than the last one.
   * False means the code was already spent (a replay, or a parallel request).
   */
  consumeMfaStep(userId: string, step: number): Promise<boolean>;
  /** Removes one recovery code; false when it was not (or no longer) there. */
  consumeRecoveryCode(userId: string, hash: string): Promise<boolean>;
  deleteUserMfa(userId: string): Promise<boolean>;

  /** Each row carries when the patient was last here and how many visits they have had. */
  listPatients(query?: PatientQuery): Promise<Paged<PatientListItem>>;
  /** The card with its contacts — what the edit form and the patient card load. */
  getPatientDetails(id: string): Promise<PatientDetails | undefined>;
  /** The whole patient card: visits with their orders, the payment ledger, totals. */
  getPatientCard(id: string): Promise<PatientCard | undefined>;
  /**
   * Patients who might be the person described: any one identity field in
   * common. Deliberately broad; shared/patient-identity grades the result.
   */
  findPatientCandidates(input: PatientCandidateQuery): Promise<Patient[]>;
  /**
   * Folds a duplicate card into the real one: its orders, contacts and
   * Telegram link move over, the empty duplicate is removed. Returns what moved.
   */
  mergePatients(
    sourceId: string,
    targetId: string,
    actor?: Actor,
  ): Promise<{ orders: number; contacts: number; appointments: number } | undefined>;
  getPatient(id: string): Promise<Patient | undefined>;
  /** Matched on the 9 national digits, so formatting never blocks a match. */
  getPatientByPhone(phone: string): Promise<Patient | undefined>;
  getPatientByChatId(chatId: string): Promise<Patient | undefined>;
  createPatient(input: InsertPatient, actor?: Actor): Promise<Patient>;
  updatePatient(id: string, input: Partial<InsertPatient>, actor?: Actor): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<boolean>;

  listTests(opts?: { activeOnly?: boolean }): Promise<Test[]>;
  getTest(id: string): Promise<Test | undefined>;
  createTest(input: InsertTest, actor: Actor): Promise<Test>;
  updateTest(id: string, input: Partial<InsertTest>, actor: Actor): Promise<Test | undefined>;
  /** A test that any order has used is kept for history: StorageConflict, deactivate it instead. */
  deleteTest(id: string): Promise<boolean>;

  listOrders(query?: OrderQuery): Promise<OrderListResponse>;
  /** Includes the payment ledger; the list endpoints deliberately do not. */
  getOrder(id: string): Promise<OrderWithDetails | undefined>;
  createOrder(input: CreateOrderArgs): Promise<OrderWithDetails>;
  /**
   * `input.testIds`, when given, replaces the order's test list. Lines that
   * already hold a result are never removed — losing an entered value to a
   * mis-click is not recoverable, so the storage layer refuses rather than
   * trusting the caller.
   */
  updateOrder(id: string, input: UpdateOrderInput, actor?: Actor): Promise<OrderWithDetails | undefined>;
  /** `actor` is stamped on every line this call fills in. */
  saveResults(id: string, results: ResultInput[], actor?: Actor): Promise<OrderWithDetails | undefined>;
  /**
   * The lab head verifies entered lines (all of them when `itemIds` is null).
   * Listed lines that are not waiting for review are a StorageConflict.
   * `selfChecked` counts lines the verifier entered themselves.
   */
  verifyResults(
    orderId: string,
    itemIds: string[] | null,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; verified: number; selfChecked: number } | undefined>;
  /** Sends entered, unverified lines back to the laborant with a reason. */
  returnResults(orderId: string, itemIds: string[], reason: string, actor: Actor): Promise<OrderWithDetails | undefined>;
  /**
   * Corrects a verified value: the current one goes to order_test_versions,
   * the new one becomes the next version, verified by the amender.
   */
  amendResult(
    orderId: string,
    itemId: string,
    input: { result: string; flag: ResultFlag | null; notes: string | null },
    reason: string,
    actor: Actor,
  ): Promise<{ order: OrderWithDetails; previous: { result: string | null; version: number } } | undefined>;
  listResultVersions(itemId: string): Promise<OrderTestVersion[]>;
  /**
   * Only an order entered by mistake goes: one with a payment (even a voided
   * one) or a result throws StorageConflict — that order is cancelled instead.
   */
  deleteOrder(id: string): Promise<boolean>;

  /**
   * Moves the order's tube to a new status, stamping who did it and when.
   *
   * Returns `{ error }` rather than throwing for a refused transition: an
   * illegal move is an ordinary thing for a user to attempt (two people
   * working the same rack), and the route turns it into a 409 with the message
   * the UI shows. A genuinely missing order still returns undefined.
   */
  updateSampleStatus(
    orderId: string,
    input: UpdateSampleInput,
    actor: Actor,
  ): Promise<{ sample: Sample; order: OrderWithDetails } | { error: string } | undefined>;

  /** Resolves a scanned barcode to its order. Used by the scan box. */
  getOrderByBarcode(barcode: string): Promise<OrderWithDetails | undefined>;

  /** Cash ledger. Adding or removing a row re-derives orders.paidAmount. */
  addPayment(orderId: string, input: CreatePaymentInput, actor: Actor): Promise<OrderWithDetails | undefined>;
  /**
   * Strikes a mistyped entry from the paid total. The row stays in the ledger
   * with who voided it and why; voiding twice is a StorageConflict.
   */
  voidPayment(paymentId: string, reason: string, actor: Actor): Promise<OrderWithDetails | undefined>;

  /** `total_amount` sums the active rows of the match, whatever the status filter. */
  listExpenses(query?: ExpenseQuery): Promise<Paged<Expense> & { total_amount: number }>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(input: InsertExpense, actor: Actor): Promise<Expense>;
  updateExpense(id: string, input: UpdateExpenseInput, actor: Actor): Promise<Expense | undefined>;
  /** Marks the row cancelled; it stays in the ledger and out of every total. */
  cancelExpense(id: string, reason: string, actor: Actor): Promise<Expense | undefined>;
  getExpenseSummary(from: string, to: string): Promise<ExpenseSummary>;
  /** Distinct payees used before, most frequent first — suggestions for the form. */
  listExpensePayees(limit?: number): Promise<string[]>;

  writeAudit(input: AuditInput): Promise<void>;
  listAudit(query?: AuditQuery): Promise<Paged<AuditEntry>>;

  /** Binds a Telegram chat to a patient; the chat is released from any other. */
  linkTelegram(patientId: string, chatId: string): Promise<Patient | undefined>;
  /** Parks a chat whose phone has no patient yet, so registration can claim it. */
  savePendingContact(input: {
    chatId: string;
    phone: string;
    fullName?: string | null;
    username?: string | null;
  }): Promise<void>;
  /** Used by the registration form and by the claim on patient create. */
  findPendingContact(phone: string): Promise<TelegramContact | undefined>;
  /** Called once the chat is safely linked to a patient — or on /stop. */
  deletePendingContact(chatId: string): Promise<void>;
  /** Called when the patient blocks the bot or asks to stop. */
  unlinkTelegram(chatId: string): Promise<number>;
  /** Completed orders of a patient whose results were never delivered. */
  listUndeliveredOrders(patientId: string, limit?: number): Promise<OrderWithDetails[]>;
  markTelegramSent(orderId: string): Promise<void>;

  getDashboardStats(): Promise<DashboardStatsData>;
  /** Registratura bosh sahifasi (TZ §4.1.1): one day's counts, in one round trip. */
  getReceptionDay(day: string): Promise<ReceptionDay>;
  /** Laboratoriya bosh sahifasi (TZ §6.1.1); the rules are in shared/lab-board.ts. */
  getLabBoard(day: string): Promise<LabBoard>;
  getRevenueReport(from: string, to: string): Promise<RevenueReportData>;

  /** Session policy; the defaults when nothing was ever saved. */
  getSecuritySettings(): Promise<SecuritySettings>;
  updateSecuritySettings(input: SecuritySettings, actor: Actor): Promise<SecuritySettings>;

  getSettings(): Promise<LabSettings>;
  updateSettings(input: LabSettingsInput): Promise<LabSettings>;
}
