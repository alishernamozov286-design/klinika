import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, index, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isPermission, type Permission } from "./permissions";
import { normalizePassport, normalizePinfl } from "./patient-identity";

/**
 * One schema, two backends: Postgres when DATABASE_URL is set, otherwise the
 * local JSON store. Two column choices keep both backends returning literally
 * the same shapes, so no row-mapping layer is needed:
 *
 *   - money as `integer` — so'm has no sub-unit in practice, and `decimal`
 *     would come back from pg as a string.
 *   - timestamps as `mode: "string"` — ISO strings, which is what JSON has.
 */
const money = (name: string) => integer(name);
const isoTimestamp = (name: string) => timestamp(name, { mode: "string", withTimezone: true });

/**
 * A role key, e.g. "registrator". Roles live in the `roles` table and may be
 * created by the clinic, so this is a string rather than a closed union; the
 * built-in ones are listed in shared/permissions.ts (SYSTEM_ROLES).
 */
export type Role = string;

export const ORDER_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Kutilmoqda",
  in_progress: "Jarayonda",
  completed: "Tayyor",
  cancelled: "Bekor qilingan",
};

/** Result flag relative to the reference range. */
export const RESULT_FLAGS = ["low", "normal", "high"] as const;
export type ResultFlag = (typeof RESULT_FLAGS)[number];

export const PAYMENT_METHODS = ["naqd", "karta", "o'tkazma"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  naqd: "Naqd",
  karta: "Karta",
  "o'tkazma": "Bank o'tkazmasi",
};

/**
 * Where a sample is on its way from the patient's arm to the analyser.
 *
 * Two hand-offs are recorded rather than one, because they are performed by
 * different people and the difference is exactly what a dispute is about:
 * "olindi" is the registrar/nurse saying the tube was drawn, "qabul_qilindi"
 * is the laboratory saying it arrived intact and is fit to run. A tube lost
 * between the two now has a visible owner.
 */
export const SAMPLE_STATUSES = ["kutilmoqda", "olindi", "qabul_qilindi", "rad_etildi"] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  kutilmoqda: "Kutilmoqda",
  olindi: "Olindi",
  qabul_qilindi: "Qabul qilindi",
  rad_etildi: "Rad etildi",
};

/**
 * Why a tube was refused. A closed list rather than free text: these are the
 * answers that let a lab notice it is rejecting every third tube from one
 * phlebotomist, which free text buries.
 */
export const SAMPLE_REJECT_REASONS = [
  "Gemoliz",
  "Miqdori yetarli emas",
  "Noto'g'ri probirka",
  "Probirka buzilgan",
  "Belgilanmagan",
  "Ivib qolgan",
  "Boshqa",
] as const;
export type SampleRejectReason = (typeof SAMPLE_REJECT_REASONS)[number];

export const EXPENSE_CATEGORIES = [
  "Reaktivlar",
  "Ish haqi",
  "Ijara",
  "Kommunal",
  "Jihoz",
  "Soliq",
  "Boshqa",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * A recorded expense is never deleted (TZ §10: financial operations are
 * cancelled, not erased). A cancelled one keeps its amount and who cancelled
 * it and why, and simply stops counting towards any total.
 */
export const EXPENSE_STATUSES = ["active", "cancelled"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/**
 * What a department does. Drives where it shows up later: ambulator and
 * diagnostika departments take appointments (B2.7), statsionar ones own wards
 * and beds (B6), laboratoriya is the LIS.
 */
export const DEPARTMENT_KINDS = ["ambulator", "diagnostika", "laboratoriya", "statsionar", "boshqa"] as const;
export type DepartmentKind = (typeof DEPARTMENT_KINDS)[number];

export const DEPARTMENT_KIND_LABELS: Record<DepartmentKind, string> = {
  ambulator: "Ambulator qabul",
  diagnostika: "Diagnostika",
  laboratoriya: "Laboratoriya",
  statsionar: "Statsionar",
  boshqa: "Boshqa",
};

/**
 * The clinic's paid services (TZ §4.1.5): "Shifokor ko'rigi. Laboratoriya.
 * UZI. Muolajalar. Boshqa xizmatlar."
 *
 * Laboratory tests are not rows here: they already have their own catalogue
 * (`tests`, with units and reference ranges). The price list joins the two —
 * see PriceListItem — so the lab keeps one place to maintain its prices.
 */
export const SERVICE_KINDS = ["konsultatsiya", "uzi", "muolaja", "boshqa"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/** Every kind the price list shows, lab tests included. */
export type PriceListKind = ServiceKind | "laboratoriya";

export const SERVICE_KIND_LABELS: Record<PriceListKind, string> = {
  konsultatsiya: "Shifokor ko'rigi",
  laboratoriya: "Laboratoriya",
  uzi: "UZI",
  muolaja: "Muolaja",
  boshqa: "Boshqa",
};

/**
 * Appointment lifecycle (TZ §4.1.4 "qabul holati"):
 * yozildi → keldi → qabulda → yakunlandi, or kelmadi / bekor qilindi.
 * Which move is allowed, and for whom, lives in shared/appointment.ts.
 */
export const APPOINTMENT_STATUSES = ["scheduled", "arrived", "in_progress", "completed", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Yozildi",
  arrived: "Keldi",
  in_progress: "Qabulda",
  completed: "Yakunlandi",
  no_show: "Kelmadi",
  cancelled: "Bekor qilindi",
};

/**
 * An examination record's life (TZ §5.2): the doctor writes a draft, then
 * signs it. A signed record is locked; a correction makes a new version and
 * keeps the old one (medical_record_versions).
 */
export const RECORD_STATUSES = ["draft", "signed"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  draft: "Qoralama",
  signed: "Tasdiqlangan",
};

/**
 * The examination form (TZ §5.1.3), in the order a doctor writes it. One
 * list drives the form, the read-only view, the version diff and the PDF.
 */
export const RECORD_FIELDS = [
  "complaints",
  "anamnesis",
  "examination",
  "preliminaryDiagnosis",
  "finalDiagnosis",
  "recommendations",
] as const;
export type RecordField = (typeof RECORD_FIELDS)[number];

export const RECORD_FIELD_LABELS: Record<RecordField, string> = {
  complaints: "Shikoyatlar",
  anamnesis: "Anamnez",
  examination: "Ko'rik natijalari",
  preliminaryDiagnosis: "Dastlabki tashxis",
  finalDiagnosis: "Yakuniy tashxis",
  recommendations: "Tavsiyalar",
};

/** ISO weekday numbers, Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_SHORT: Record<number, string> = { 1: "Du", 2: "Se", 3: "Ch", 4: "Pa", 5: "Ju", 6: "Sh", 7: "Ya" };
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Dushanba",
  2: "Seshanba",
  3: "Chorshanba",
  4: "Payshanba",
  5: "Juma",
  6: "Shanba",
  7: "Yakshanba",
};

/** One working window. A day may have more than one (around a lunch break). */
export type ScheduleSlot = { day: number; start: string; end: string };

// ---------------------------------------------------------------- tables

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("registrator"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),

  /**
   * Escalating lockout state, kept on the row rather than in memory.
   *
   * In memory it would not survive a restart — and on serverless, where each
   * request may land on a different instance, it would barely survive at all.
   * A week-long lock that a redeploy silently lifts is not a lock.
   */
  failedAttempts: integer("failed_attempts").notNull().default(0),
  /** Null when the account is not locked. */
  lockedUntil: isoTimestamp("locked_until"),
  /** How many locks this account has served — drives the escalation. */
  lockLevel: integer("lock_level").notNull().default(0),
  lastFailedAt: isoTimestamp("last_failed_at"),
});

/**
 * Staff roles (TZ §3, §10). `users.role` holds the key.
 *
 * Permissions are stored on the row as an array of permission keys rather than
 * in a join table: a role has a few dozen at most, they are always read and
 * written as a whole set, and the matrix editor saves the set in one go.
 */
export const roles = pgTable("roles", {
  key: varchar("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
  /** One of the TZ §3 roles. These cannot be deleted; their key is fixed. */
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
});

/**
 * Two-factor sign-in (TZ §12 "ikki bosqichli autentifikatsiya"), one row per
 * user who has switched it on.
 *
 * A table of its own rather than columns on `users`: every query that reads a
 * user row would otherwise carry the secret along, one forgotten `omit` away
 * from the client — and a database not yet migrated would fail every login,
 * where a missing table here only means "nobody has 2FA yet".
 *
 * - secret: the TOTP key, AES-256-GCM encrypted (server/mfa.ts). A database
 *   dump alone does not let anyone generate codes.
 * - lastUsedStep: the 30-second step of the last accepted code, so a code
 *   seen over a shoulder cannot be replayed in the same window.
 * - recoveryCodes: SHA-256 hashes of the one-time recovery codes; each is
 *   removed when used.
 */
export const userMfa = pgTable("user_mfa", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  lastUsedStep: integer("last_used_step").notNull().default(0),
  recoveryCodes: text("recovery_codes").array().notNull().default(sql`'{}'::text[]`),
  enabledAt: isoTimestamp("enabled_at").defaultNow().notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
});

/** Clinic departments (TZ §10 `departments`). */
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  kind: text("kind").notNull().default("ambulator"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
});

/**
 * A doctor's profile (TZ §10 `doctors`): the clinical side of a staff
 * account, one per user. Kept apart from `users` because most staff are not
 * doctors, and what a doctor needs — a room, a price, a weekly timetable — is
 * what the appointment book (B2.7) is built on.
 */
export const doctors = pgTable(
  "doctors",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().unique(),
    departmentId: varchar("department_id"),
    specialty: text("specialty").notNull(),
    room: text("room"),
    /** Price of one consultation; the service catalogue (B2.6) will build on it. */
    consultationPrice: money("consultation_price").notNull().default(0),
    /** Length of one appointment in minutes: the step of the appointment grid. */
    slotMinutes: integer("slot_minutes").notNull().default(20),
    schedule: json("schedule").$type<ScheduleSlot[]>().notNull().default(sql`'[]'::json`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    updatedAt: isoTimestamp("updated_at"),
    updatedBy: varchar("updated_by"),
  },
  (t) => ({ departmentIdx: index("IDX_doctors_department").on(t.departmentId) }),
);

/** The service catalogue (TZ §4.1.5, B2.6). Lab tests stay in `tests`. */
export const services = pgTable(
  "services",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("konsultatsiya"),
    /** Which department provides it; null for clinic-wide services. */
    departmentId: varchar("department_id"),
    price: money("price").notNull().default(0),
    /** How long it takes, when that matters for scheduling. */
    durationMinutes: integer("duration_minutes"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by"),
    updatedAt: isoTimestamp("updated_at"),
    updatedBy: varchar("updated_by"),
  },
  (t) => ({ departmentIdx: index("IDX_services_department").on(t.departmentId) }),
);

/**
 * Appointments and the queue (TZ §4.1.4, §10 `appointments`; B2.7).
 *
 * Times are the clinic's wall clock — a calendar day and "HH:MM" — exactly as
 * the doctor's weekly timetable is written. A timestamp would have to guess a
 * time zone; "Tuesday 09:20 with Dr. X" means the same on every server.
 *
 * Never deleted: a booking that did not happen is cancelled (with a reason)
 * or marked as a no-show, and stays in the patient's history.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    doctorId: varchar("doctor_id").notNull(),
    serviceId: varchar("service_id"),
    /** Set when the patient arrives: the day's visit (B2.5) this belongs to. */
    visitId: varchar("visit_id"),
    /** YYYY-MM-DD, clinic calendar. */
    date: text("date").notNull(),
    /** HH:MM, clinic wall clock. */
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    /** The ticket number: per doctor, per day, in order of booking. */
    queueNumber: integer("queue_number").notNull(),
    status: text("status").notNull().default("scheduled"),
    /** Price at booking time — a later price change does not rewrite it. */
    price: money("price").notNull().default(0),
    /** Why the patient is coming, as told to the registrar. */
    reason: text("reason"),
    arrivedAt: isoTimestamp("arrived_at"),
    startedAt: isoTimestamp("started_at"),
    completedAt: isoTimestamp("completed_at"),
    cancelledAt: isoTimestamp("cancelled_at"),
    cancelledBy: varchar("cancelled_by"),
    cancelReason: text("cancel_reason"),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by"),
    updatedAt: isoTimestamp("updated_at"),
    updatedBy: varchar("updated_by"),
  },
  (t) => ({
    dayIdx: index("IDX_appointments_date_doctor").on(t.date, t.doctorId),
    patientIdx: index("IDX_appointments_patient").on(t.patientId),
    queueIdx: uniqueIndex("UQ_appointments_queue").on(t.doctorId, t.date, t.queueNumber),
    // One live booking per doctor per start time — the database is the last
    // word when two registrars take the same slot at the same moment.
    slotIdx: uniqueIndex("UQ_appointments_slot")
      .on(t.doctorId, t.date, t.startTime)
      .where(sql`status NOT IN ('cancelled', 'no_show')`),
  }),
);

/**
 * The examination record (TZ §5.1.3, §10 `medical_records`; B3.3), one per
 * appointment. Never deleted: a draft is finished and signed, a signed record
 * is corrected by a new version.
 *
 * - revision: bumped on every save. A save names the revision it was based
 *   on, so a second open tab cannot silently overwrite the first.
 * - version: bumped on every correction after signing; the replaced text goes
 *   to medical_record_versions.
 */
export const medicalRecords = pgTable(
  "medical_records",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    appointmentId: varchar("appointment_id").notNull(),
    doctorId: varchar("doctor_id").notNull(),
    visitId: varchar("visit_id"),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    revision: integer("revision").notNull().default(0),
    complaints: text("complaints"),
    anamnesis: text("anamnesis"),
    examination: text("examination"),
    preliminaryDiagnosis: text("preliminary_diagnosis"),
    finalDiagnosis: text("final_diagnosis"),
    recommendations: text("recommendations"),
    signedAt: isoTimestamp("signed_at"),
    signedBy: varchar("signed_by"),
    /** The last correction: when, and why. */
    amendedAt: isoTimestamp("amended_at"),
    amendReason: text("amend_reason"),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by"),
    updatedAt: isoTimestamp("updated_at"),
    updatedBy: varchar("updated_by"),
  },
  (t) => ({
    appointmentIdx: uniqueIndex("UQ_medical_records_appointment").on(t.appointmentId),
    patientIdx: index("IDX_medical_records_patient").on(t.patientId),
    doctorStatusIdx: index("IDX_medical_records_doctor_status").on(t.doctorId, t.status),
  }),
);

/**
 * A signed version that a correction replaced (TZ §5.2: "avval tasdiqlangan
 * hujjatning tarixiy nusxasi saqlanadi"). Written once, never changed.
 */
export const medicalRecordVersions = pgTable(
  "medical_record_versions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    recordId: varchar("record_id").notNull(),
    version: integer("version").notNull(),
    complaints: text("complaints"),
    anamnesis: text("anamnesis"),
    examination: text("examination"),
    preliminaryDiagnosis: text("preliminary_diagnosis"),
    finalDiagnosis: text("final_diagnosis"),
    recommendations: text("recommendations"),
    signedAt: isoTimestamp("signed_at"),
    signedBy: varchar("signed_by"),
    /** Who replaced this version, when, and why. */
    replacedAt: isoTimestamp("replaced_at").defaultNow().notNull(),
    replacedBy: varchar("replaced_by"),
    replaceReason: text("replace_reason").notNull(),
  },
  (t) => ({ recordVersionIdx: uniqueIndex("UQ_medical_record_versions").on(t.recordId, t.version) }),
);

/**
 * Allergies (TZ §5.1.2). A row is never deleted: one entered by mistake, or
 * no longer true, is marked inactive with who did it and why.
 */
export const patientAllergies = pgTable(
  "patient_allergies",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    allergen: text("allergen").notNull(),
    reaction: text("reaction"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by"),
    removedAt: isoTimestamp("removed_at"),
    removedBy: varchar("removed_by"),
    removeReason: text("remove_reason"),
  },
  (t) => ({ patientIdx: index("IDX_patient_allergies_patient").on(t.patientId) }),
);

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // The number the registrator and the patient actually speak — "bemor №14",
  // handed out like a queue ticket. Same identity-sequence trick as
  // orders.orderNumber: Postgres allocates it, so two registrars saving at the
  // same moment can never be given the same number. The uuid above stays the
  // key everything else joins on.
  patientNumber: integer("patient_number").generatedByDefaultAsIdentity({ startWith: 1 }).notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  /** Typed in at registration when the birth date is not known. Display uses patientAge(). */
  age: integer("age"),
  gender: text("gender"),
  /** YYYY-MM-DD. Preferred over `age`: an age goes stale, a birth date does not. */
  birthDate: text("birth_date"),
  /** Passport or ID card series and number, normalised: "AA1234567". */
  passport: text("passport"),
  /** JShShIR — the 14-digit personal number; the surest key against duplicates. */
  pinfl: text("pinfl"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
  // Set by the Telegram bot when the patient shares their contact; null means
  // "not connected yet", and results for them stay queued until they are.
  telegramChatId: text("telegram_chat_id"),
  telegramLinkedAt: isoTimestamp("telegram_linked_at"),
});

/**
 * People to call about a patient (TZ §10 `patient_contacts`). Separate rows
 * rather than columns so a patient can have more than one; the registration
 * form edits the emergency one.
 */
export const patientContacts = pgTable(
  "patient_contacts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    name: text("name").notNull(),
    /** "Onasi", "Turmush o'rtog'i"… free text. */
    relation: text("relation"),
    phone: text("phone").notNull(),
    isEmergency: boolean("is_emergency").notNull().default(true),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ patientIdx: index("IDX_patient_contacts_patient").on(t.patientId) }),
);

export const tests = pgTable("tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: money("price").notNull(),
  category: text("category").notNull(),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  isActive: boolean("is_active").notNull().default(true),
});

/**
 * A patient's arrival at the clinic (TZ §10 `visits`): one per patient per
 * day. Everything done for them that day — lab orders now, appointments and
 * services as those modules land — hangs off the visit, which is what the
 * patient card's history is organised by.
 */
export const visits = pgTable(
  "visits",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    /** The clinic's local calendar day, YYYY-MM-DD. */
    visitDate: text("visit_date").notNull(),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
    createdBy: varchar("created_by"),
  },
  (t) => ({
    patientDayIdx: uniqueIndex("UQ_visits_patient_day").on(t.patientId, t.visitDate),
  }),
);

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Human-facing receipt number. Postgres assigns it from an identity
  // sequence so concurrent registrars can never collide on the same number.
  orderNumber: integer("order_number").generatedByDefaultAsIdentity({ startWith: 1001 }).notNull(),
  patientId: varchar("patient_id").notNull(),
  /** The visit this order belongs to; null only for rows older than visits. */
  visitId: varchar("visit_id"),
  totalAmount: money("total_amount").notNull(),
  discount: money("discount").notNull().default(0),
  paidAmount: money("paid_amount").notNull().default(0),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  /** Who sent the patient — the lab's main growth question. Free text: most
      referrals are spoken, and a doctor directory would be a table nobody fills. */
  referrer: text("referrer"),
  createdBy: varchar("created_by"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  completedAt: isoTimestamp("completed_at"),
  // When the ready results were delivered over Telegram. Doubles as the
  // "already sent" guard, so re-saving a result never spams the patient.
  telegramSentAt: isoTimestamp("telegram_sent_at"),
});

export const orderTests = pgTable("order_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  testId: varchar("test_id").notNull(),
  // Snapshot of the catalogue row, so later price/name edits never rewrite history.
  testName: text("test_name").notNull(),
  price: money("price").notNull(),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  result: text("result"),
  flag: text("flag"),
  notes: text("notes"),
  /** Who signed off this value. A result on a medical form always has to be
      answerable for, and orders.createdBy only covers the registration. */
  enteredBy: varchar("entered_by"),
  completedAt: isoTimestamp("completed_at"),
});

/**
 * The physical tube behind an order.
 *
 * One per order, created with it, so the chain from "bemor to'ladi" to "natija
 * chiqdi" has no gap where a tube exists only in someone's memory. Splitting
 * per bio-material was considered and deliberately not done: it doubles the
 * laborant's clicks on every order to answer a question ("qaysi probirka?")
 * that the printed label already answers in the rack.
 *
 * The barcode is what a scanner reads, and is the join key an analyser
 * integration will use later — which is why it is unique and never reissued.
 */
export const samples = pgTable(
  "samples",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: varchar("order_id").notNull(),
    /** Human- and scanner-readable, e.g. "LAB-1042". Unique across the lab. */
    barcode: text("barcode").notNull().unique(),
    status: text("status").notNull().default("kutilmoqda"),

    /** Set when the tube is drawn, and by whom. */
    collectedAt: isoTimestamp("collected_at"),
    collectedBy: varchar("collected_by"),
    collectedByName: text("collected_by_name"),

    /** Set when the laboratory accepts the tube as fit to run. */
    receivedAt: isoTimestamp("received_at"),
    receivedBy: varchar("received_by"),
    receivedByName: text("received_by_name"),

    /** Set when the tube is refused; reason is required at that point. */
    rejectedAt: isoTimestamp("rejected_at"),
    rejectedBy: varchar("rejected_by"),
    rejectedByName: text("rejected_by_name"),
    rejectReason: text("reject_reason"),
    rejectNote: text("reject_note"),

    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  },
  // Every order screen loads its sample by orderId; the barcode index backs
  // the scanner lookup, which must stay fast with a full year of tubes in it.
  (t) => ({
    orderIdx: index("IDX_samples_order").on(t.orderId),
    barcodeIdx: index("IDX_samples_barcode").on(t.barcode),
  }),
);

/**
 * One row per cash movement. The running total on orders.paidAmount is kept as
 * the fast path every list already reads, but it is derived from these — a
 * single number cannot answer "who took the 50 000 yesterday", which is the
 * question a till reconciliation actually asks.
 */
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  /** Negative for a refund, so the history reads as a ledger. */
  amount: money("amount").notNull(),
  method: text("method").notNull().default("naqd"),
  note: text("note"),
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
});

/** Money out. Without it the reports only ever show turnover, never profit. */
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  amount: money("amount").notNull(),
  note: text("note"),
  /** The day the money was actually spent, which is not always today. */
  spentOn: text("spent_on").notNull(),
  /** How it was paid: cash from the till, card, or bank transfer. */
  method: text("method").notNull().default("naqd"),
  /** Who was paid — the supplier, the landlord, the employee. */
  payee: text("payee"),
  status: text("status").notNull().default("active"),
  cancelledAt: isoTimestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by"),
  cancelledByName: text("cancelled_by_name"),
  cancelReason: text("cancel_reason"),
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
});

/**
 * Who changed what. The actor's name is denormalised on purpose: the log has to
 * stay readable after the staff account is deleted, and a join to a row that no
 * longer exists would blank out exactly the entries that matter most.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id"),
    userName: text("user_name").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: varchar("entity_id"),
    summary: text("summary").notNull(),
    createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ createdIdx: index("IDX_audit_created").on(t.createdAt) }),
);

/**
 * A Telegram chat that shared a phone number we have no patient for yet —
 * the patient opened the bot *before* visiting the lab.
 *
 * The registration form reads this table to show "botni ochgan", and the moment
 * a patient with that number is created the chat is claimed from here and the
 * row is gone. So the waiting list only ever holds people we do not know yet.
 */
export const telegramContacts = pgTable("telegram_contacts", {
  chatId: text("chat_id").primaryKey(),
  phone: text("phone").notNull(),
  /** What Telegram calls them — shown to the registrator as a sanity check. */
  fullName: text("full_name"),
  username: text("username"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
});

/**
 * Owned by connect-pg-simple, not by the app — it creates the table itself on
 * first boot. It is declared here purely so `db:push` sees it as part of the
 * schema: without this, every push offers to drop it and log everyone out.
 */
export const sessions = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
  },
  (t) => ({ expireIdx: index("IDX_session_expire").on(t.expire) }),
);

/**
 * System-wide settings that are not the lab's letterhead: one JSON value per
 * key ("security", and later e.g. 2FA policy). A key-value table rather than
 * more columns on lab_settings, so a new setting never needs an ALTER on a
 * table every screen reads — a missing row simply means "use the default".
 */
export const appSettings = pgTable("app_settings", {
  key: varchar("key").primaryKey(),
  value: json("value").notNull(),
  updatedAt: isoTimestamp("updated_at"),
  updatedBy: varchar("updated_by"),
});

export const labSettings = pgTable("lab_settings", {
  id: varchar("id").primaryKey().default("default"),
  labName: text("lab_name").notNull().default("MedLab"),
  tagline: text("tagline").notNull().default("Tibbiy Laboratoriya"),
  address: text("address"),
  phone: text("phone"),
  director: text("director"),
  licenseNumber: text("license_number"),
});

// ---------------------------------------------------------------- types

export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "password">;

export type UserMfa = typeof userMfa.$inferSelect;

/** What a user (or the staff list) may know about a 2FA enrolment — never the secret. */
export type MfaStatus = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
  /** The user's role is on the "must use 2FA" list. */
  required: boolean;
  /** False until `npm run db:mfa` has created the table. */
  available: boolean;
};

/** Shown once, right after enrolment or regeneration. */
export type MfaSetup = { secret: string; otpauthUrl: string; qrDataUrl: string };

export type RoleRecord = Omit<typeof roles.$inferSelect, "permissions"> & { permissions: Permission[] };

/** A role as the admin screens list it: with how many staff currently hold it. */
export type RoleWithUsage = RoleRecord & { userCount: number };

/**
 * The signed-in user as the server attaches it to the request and as
 * /api/user returns it: the account plus everything resolved from its role,
 * so neither the routes nor the client have to look the role up again.
 */
export type SessionUser = PublicUser & {
  roleName: string;
  permissions: Permission[];
  /**
   * Signed in, but the role requires two-factor sign-in and the user has not
   * set it up yet: until they do, the server answers only the enrolment and
   * sign-out calls (server/auth.ts requireMfaEnrollment).
   */
  mfaSetupRequired?: boolean;
};

/** /api/login's answer when the password was right and a code is still due. */
export type MfaChallenge = { mfaRequired: true; fullName: string };

export type Patient = typeof patients.$inferSelect;
export type PatientContact = typeof patientContacts.$inferSelect;

/** A row of the patients list: the card plus when they were last here. */
export type PatientListItem = Patient & { lastVisitAt: string | null; visitCount: number };

export type Visit = typeof visits.$inferSelect;

/** One day at the clinic, with what was done. */
export type PatientCardVisit = {
  /** The visit id, or "day:YYYY-MM-DD" for orders older than visits. */
  key: string;
  date: string;
  orders: OrderWithDetails[];
  /** Doctor appointments the patient attended that day (B2.7). */
  appointments: AppointmentWithDetails[];
  billed: number;
  paid: number;
};

/** Everything the patient card (TZ §4.1.3 "shaxsiy karta") shows, in one request. */
export type PatientCard = {
  patient: PatientDetails;
  /** Newest first. */
  visits: PatientCardVisit[];
  /** The cash ledger across all their orders, newest first. */
  payments: (Payment & { orderNumber: number })[];
  totals: {
    visits: number;
    orders: number;
    /** Cancelled orders excluded. Null when the viewer may not see money. */
    billed: number | null;
    paid: number | null;
    debt: number | null;
    firstVisitAt: string | null;
    lastVisitAt: string | null;
  };
};

/** One patient with everything the card screen and the edit form need. */
export type PatientDetails = Patient & { contacts: PatientContact[] };

/** A possible duplicate of the patient being registered. */
export type DuplicateCandidate = {
  patient: Patient;
  strength: "strong" | "weak";
  reasons: string[];
};

export type Department = Omit<typeof departments.$inferSelect, "kind"> & { kind: DepartmentKind };
/** A department as the admin screen lists it: with its doctor head count. */
export type DepartmentWithUsage = Department & { doctorCount: number };

export type Doctor = typeof doctors.$inferSelect;
/** A doctor joined with the account and department — what every screen renders. */
export type DoctorWithDetails = Doctor & {
  fullName: string;
  username: string;
  userActive: boolean;
  departmentName: string | null;
};

export type Service = Omit<typeof services.$inferSelect, "kind"> & { kind: ServiceKind };
export type ServiceWithDetails = Service & { departmentName: string | null; appointmentCount: number };

/** One line of the clinic price list (TZ §9.1 "Xizmatlar narxlari"): a service or a lab test. */
export type PriceListItem = {
  source: "service" | "test";
  id: string;
  name: string;
  kind: PriceListKind;
  /** Department for services, lab category for tests. */
  group: string | null;
  price: number;
  isActive: boolean;
};

export type Appointment = Omit<typeof appointments.$inferSelect, "status"> & { status: AppointmentStatus };

/** An appointment with the names every screen shows next to it. */
export type AppointmentWithDetails = Appointment & {
  patientNumber: number;
  patientName: string;
  patientPhone: string;
  patientBirthDate: string | null;
  patientAge: number | null;
  patientGender: string | null;
  doctorName: string;
  doctorUserId: string;
  specialty: string;
  room: string | null;
  departmentName: string | null;
  serviceName: string | null;
};

/** One cell of the booking grid. */
export type AppointmentSlot = {
  startTime: string;
  endTime: string;
  /** Free to book: inside the timetable, not taken, not already over. */
  available: boolean;
  /** Why not, when it is not. */
  reason?: "taken" | "past";
  /** The booking holding it, for the registrar's tooltip. */
  takenBy?: { appointmentId: string; patientName: string; queueNumber: number };
};

export type DoctorDaySlots = {
  doctorId: string;
  date: string;
  /** False when the doctor does not work that weekday (or the profile is paused). */
  works: boolean;
  slotMinutes: number;
  slots: AppointmentSlot[];
};

/** The doctor's cabinet for one day (TZ §5.1.1). */
export type DoctorCabinet = {
  doctor: DoctorWithDetails;
  date: string;
  appointments: AppointmentWithDetails[];
  /** Started on an earlier day and never finished. */
  unfinished: AppointmentWithDetails[];
  /** The examination record's state for each of the day's appointments that has one. */
  recordStatus: Record<string, RecordStatus>;
  /** "Tugallanmagan tibbiy kartalar": this doctor's records not yet signed. */
  draftRecords: MedicalRecordWithDetails[];
};

export type MedicalRecord = Omit<typeof medicalRecords.$inferSelect, "status"> & { status: RecordStatus };

/** A record with what every screen prints next to it. */
export type MedicalRecordWithDetails = MedicalRecord & {
  patientNumber: number;
  patientName: string;
  doctorName: string;
  doctorUserId: string;
  specialty: string;
  /** The appointment's day and time — when the examination took place. */
  date: string;
  startTime: string;
  signedByName: string | null;
};

export type MedicalRecordVersion = typeof medicalRecordVersions.$inferSelect & { replacedByName: string | null };

export type PatientAllergy = typeof patientAllergies.$inferSelect & { createdByName: string | null };

/** One diagnosis line in the patient's history, taken from signed records. */
export type DiagnosisEntry = {
  recordId: string;
  date: string;
  doctorName: string;
  specialty: string;
  kind: "preliminary" | "final";
  text: string;
};

/** A lab result as the medical card lists it. */
export type LabResultEntry = {
  orderId: string;
  orderNumber: number;
  date: string;
  testName: string;
  result: string;
  unit: string | null;
  referenceRange: string | null;
  flag: ResultFlag | null;
};

/** The electronic medical record (TZ §5.1.2): one summary of everything clinical. */
export type MedicalCard = {
  patient: Pick<
    Patient,
    "id" | "patientNumber" | "fullName" | "phone" | "gender" | "birthDate" | "age" | "address"
  > & { ageYears: number | null };
  allergies: PatientAllergy[];
  /** Newest first. Drafts appear only to the doctor who is writing them. */
  records: MedicalRecordWithDetails[];
  diagnoses: DiagnosisEntry[];
  /** Null when the viewer may not see lab orders. */
  labResults: LabResultEntry[] | null;
};

/** The examination window's data in one request. */
export type ExaminationData = {
  appointment: AppointmentWithDetails;
  record: MedicalRecordWithDetails | null;
  /** May the viewer write and sign this record? */
  canWrite: boolean;
  canAmend: boolean;
};

export type Test = typeof tests.$inferSelect;

// `status` and `flag` are plain text columns; narrow them for the app.
export type Order = Omit<typeof orders.$inferSelect, "status"> & { status: OrderStatus };

export type OrderTest = Omit<typeof orderTests.$inferSelect, "flag"> & { flag: ResultFlag | null };

export type LabSettings = typeof labSettings.$inferSelect;

export type TelegramContact = typeof telegramContacts.$inferSelect;

export type Payment = Omit<typeof payments.$inferSelect, "method"> & { method: PaymentMethod };

// `status` is a plain text column; narrow it for the app.
export type Sample = Omit<typeof samples.$inferSelect, "status"> & { status: SampleStatus };

export type Expense = Omit<typeof expenses.$inferSelect, "method" | "status"> & {
  method: PaymentMethod;
  status: ExpenseStatus;
};

/** The figures behind the expenses dashboard, over a whole date range. */
export type ExpenseSummary = {
  range: { from: string; to: string };
  /** Active expenses only — cancelled ones never count. */
  total: number;
  count: number;
  average: number;
  largest: number;
  byCategory: { category: string; amount: number; count: number }[];
  byMethod: { method: string; amount: number; count: number }[];
  /** Every day of the range, zero-filled, oldest first. */
  daily: { date: string; amount: number }[];
  /** The same number of days immediately before `range`. */
  previous: { from: string; to: string; total: number };
  cancelled: { count: number; amount: number };
};

export type AuditEntry = typeof auditLog.$inferSelect;

/** What the registration form shows next to the phone field. */
export type TelegramPhoneStatus = {
  /** True once this number has opened the bot — as a patient or as a waiter. */
  connected: boolean;
  /** "patient" = already linked to a patient row, "pending" = waiting to be registered. */
  source: "patient" | "pending" | null;
  /** The name Telegram knows them by; null for an already linked patient. */
  telegramName: string | null;
};

/** An order joined with its patient and line items — what every order screen renders. */
export type OrderWithDetails = Order & {
  patient: Patient | null;
  items: OrderTest[];
  /** Cash movements, newest first. Absent on list endpoints, where the running
      paidAmount is enough and per-row payment queries would be N+1. */
  payments?: Payment[];
  /**
   * The order's tube. Loaded on lists too — unlike payments this is a single
   * row per order, so it costs one join, and the results queue needs it on
   * every card to warn before a value is typed against an uncollected sample.
   *
   * Null for orders created before samples existed; every screen treats that
   * as "no sample tracking on this one" rather than as an error.
   */
  sample?: Sample | null;
};

/** A page of rows plus the row count of the whole (unpaginated) match. */
export type Paged<T> = { items: T[]; total: number };

/**
 * Aggregates that the order screens show alongside the current page. They are
 * computed over the whole match, not just the visible rows — otherwise the
 * status tabs and the money strip would describe one page instead of the
 * filter the user actually chose.
 */
export type OrderSummary = {
  /** Per-status counts with the status filter itself lifted, so the tabs stay usable. */
  counts: Record<OrderStatus, number> & { all: number };
  /** Results-queue split of the non-cancelled matches. */
  results: { waiting: number; ready: number };
  /** Money for the current filter; cancelled orders never count. */
  totals: { sum: number; paid: number; debt: number };
};

export type OrderListResponse = Paged<OrderWithDetails> & { summary: OrderSummary };

// ---------------------------------------------------------------- validation

/**
 * Phones are stored in one canonical shape: "+998 90 123 45 67". Whatever the
 * caller sends — "+998901234567", "998 90 123-45-67", "8 90 123 45 67" — comes
 * out the same, so search and printed blanks never see two forms of a number.
 * Input that is not a recognisable Uzbek number is kept as typed.
 */
export function normalizeUzPhone(value: string): string {
  const digits = nationalPhoneDigits(value);
  if (digits.length !== 9) return (value ?? "").trim();
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/**
 * The 9 national digits of an Uzbek number, whatever shape it arrived in:
 * "+998901234567", "998 90 123 45 67" and "8 90 123 45 67" all reduce to
 * "901234567". This is what Telegram's shared contact is matched on, since
 * Telegram hands the number back without any formatting.
 *
 * The 99 operator code is why this is not a plain "drop a leading 998":
 * "+998 99 833 22 11" has a national part that itself begins with 998, so
 * stripping "998" wherever it appears would eat the first three digits.
 * A written "+" therefore marks an explicit country code, and without one only
 * a value too long to be national is trimmed.
 *
 * Must stay in step with the client's nationalPhoneDigits() in lib/format.ts.
 */
export function nationalPhoneDigits(value: string | null | undefined): string {
  const raw = (value ?? "").trim();

  const explicit = raw.match(/^\+\s*998\s*(.*)$/);
  if (explicit) return explicit[1].replace(/\D/g, "").slice(0, 9);

  const digits = raw.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("998")) return digits.slice(3, 12);
  if (digits.length === 10 && digits.startsWith("8")) return digits.slice(1);
  return digits.slice(0, 9);
}

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tug'ilgan sanani tanlang")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Sana noto'g'ri")
  .refine((v) => v <= localDayString(new Date()), "Tug'ilgan sana kelajakda bo'lishi mumkin emas")
  .refine((v) => Number(v.slice(0, 4)) >= new Date().getFullYear() - 130, "Tug'ilgan sanani tekshiring");

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(2, "Aloqa uchun shaxs ismini kiriting").max(120),
  relation: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null),
  phone: z.string().trim().min(7, "Telefon raqamini to'g'ri kiriting").transform(normalizeUzPhone),
});

export const insertPatientSchema = createInsertSchema(patients)
  // patientNumber is allocated by the store, never accepted from the client.
  .omit({
    id: true,
    patientNumber: true,
    createdAt: true,
    updatedAt: true,
    updatedBy: true,
    telegramChatId: true,
    telegramLinkedAt: true,
  })
  .extend({
    birthDate: z.union([birthDateSchema, z.literal("")]).nullish().transform((v) => v || null),
    passport: z
      .string()
      .trim()
      .max(20, "Pasport raqami juda uzun")
      .nullish()
      .transform((v) => normalizePassport(v))
      .refine((v) => v === null || /^[A-Z]{2}\d{7}$/.test(v) || /^[A-Z0-9]{5,20}$/.test(v), "Pasport raqamini tekshiring"),
    pinfl: z
      .string()
      .nullish()
      .transform((v) => normalizePinfl(v))
      .refine((v) => v === null || /^\d{14}$/.test(v), "JShShIR 14 ta raqamdan iborat bo'lishi kerak"),
    /** Replaces the emergency contact; null removes it, undefined leaves it alone. */
    emergencyContact: emergencyContactSchema.nullish(),
    /** Sent after the registrar has seen the duplicate warning and confirmed. */
    allowDuplicate: z.boolean().optional(),
    fullName: z.string().trim().min(3, "F.I.Sh kamida 3 ta belgidan iborat bo'lishi kerak"),
    phone: z
      .string()
      .trim()
      .min(7, "Telefon raqamini to'g'ri kiriting")
      .transform(normalizeUzPhone),
    age: z.coerce.number().int().min(0, "Yosh manfiy bo'lmasligi kerak").max(130, "Yoshni tekshiring").nullish(),
    gender: z.enum(["erkak", "ayol"]).nullish(),
    address: z.string().trim().nullish(),
  });

export const insertTestSchema = createInsertSchema(tests)
  .omit({ id: true })
  .extend({
    name: z.string().trim().min(2, "Tahlil nomini kiriting"),
    price: z.coerce.number().int().min(0, "Narx manfiy bo'lmasligi kerak"),
    category: z.string().trim().min(2, "Kategoriyani tanlang"),
    unit: z.string().trim().nullish(),
    referenceRange: z.string().trim().nullish(),
    isActive: z.boolean().default(true),
  });

/**
 * The same test asked for twice is one line, not two.
 *
 * The order form cannot produce a duplicate — it toggles a selection — but a
 * double-submit, a retry, or any other caller can, and the price is summed per
 * line: an order carrying the same test three times billed the patient three
 * times for one tube of blood. Deduplicated here rather than in the storage
 * layer so both backends and every caller inherit the rule.
 */
const uniqueTestIds = z
  .array(z.string())
  .min(1, "Kamida bitta tahlil tanlang")
  .transform((ids) => Array.from(new Set(ids)));

export const createOrderSchema = z.object({
  patientId: z.string().min(1, "Bemorni tanlang"),
  testIds: uniqueTestIds,
  discount: z.coerce.number().int().min(0).default(0),
  paidAmount: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().nullish(),
  referrer: z.string().trim().nullish(),
});

export const updateOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  discount: z.coerce.number().int().min(0).optional(),
  paidAmount: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().nullish(),
  referrer: z.string().trim().nullish(),
  /**
   * The order's whole test list, when the registrar corrects it. Sending the
   * full list rather than add/remove deltas is what makes the edit safe under
   * two people editing at once: last writer wins on a set, where deltas would
   * silently compound. Lines already holding a result are never dropped —
   * see updateOrder in the storage layer.
   */
  testIds: uniqueTestIds.optional(),
});

/**
 * A sample status change, as the client sends it.
 *
 * The reason is required for a rejection and refused everywhere else, so a
 * rejected tube can never end up with a blank reason — the one field the
 * rejection report is built on. Enforced here rather than in the route so both
 * storage backends and the tests see the same rule.
 */
export const updateSampleSchema = z
  .object({
    status: z.enum(SAMPLE_STATUSES),
    rejectReason: z.enum(SAMPLE_REJECT_REASONS).nullish(),
    rejectNote: z.string().trim().max(300).nullish(),
  })
  .refine((v) => v.status !== "rad_etildi" || Boolean(v.rejectReason), {
    message: "Rad etish sababini tanlang",
    path: ["rejectReason"],
  });

export type UpdateSampleInput = z.infer<typeof updateSampleSchema>;

export const createPaymentSchema = z.object({
  /** Negative is allowed: that is how a refund is recorded. */
  amount: z.coerce.number().int().refine((n) => n !== 0, "Summani kiriting"),
  method: z.enum(PAYMENT_METHODS).default("naqd"),
  note: z.string().trim().nullish(),
});

export const insertExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().int().min(1, "Summani kiriting").max(10_000_000_000, "Summani tekshiring"),
  method: z.enum(PAYMENT_METHODS).default("naqd"),
  payee: z
    .string()
    .trim()
    .max(120, "Juda uzun")
    .nullish()
    .transform((v) => v || null),
  note: z
    .string()
    .trim()
    .max(300, "Izoh juda uzun")
    .nullish()
    .transform((v) => v || null),
  spentOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang")
    .default(() => localDayString(new Date())),
});

export const updateExpenseSchema = insertExpenseSchema.partial();

export const cancelExpenseSchema = z.object({
  reason: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300, "Juda uzun"),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

/**
 * The period of the same length that ends the day before `from` — what
 * "compared with the previous period" means on every finance screen.
 */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const day = 86_400_000;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.max(0, Math.round((end - start) / day)) + 1;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { from: iso(start - days * day), to: iso(start - day) };
}

/** Every calendar day from `from` to `to` inclusive, as YYYY-MM-DD; capped at 400. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const day = 86_400_000;
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length < 400; t += day) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: z.string().min(5, "Yangi parol kamida 5 ta belgidan iborat bo'lishi kerak"),
    confirmPassword: z.string().min(1, "Parolni takrorlang"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Parollar mos kelmadi",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Yangi parol eskisidan farq qilishi kerak",
    path: ["newPassword"],
  });

/** Local (not UTC) calendar day as YYYY-MM-DD. The lab's own day, not Greenwich's. */
export function localDayString(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export const saveResultsSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string().min(1),
        result: z.string().trim().nullish(),
        flag: z.enum(RESULT_FLAGS).nullish(),
        notes: z.string().trim().nullish(),
      }),
    )
    .min(1),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    username: z
      .string()
      .trim()
      .min(3, "Login kamida 3 ta belgidan iborat bo'lishi kerak")
      .regex(/^[a-z0-9_.-]+$/i, "Faqat lotin harflari, raqam va _ . - belgilari"),
    password: z.string().min(5, "Parol kamida 5 ta belgidan iborat bo'lishi kerak"),
    fullName: z.string().trim().min(3, "F.I.Sh kiriting"),
    role: z.string().trim().min(1, "Rolni tanlang"),
    isActive: z.boolean().default(true),
  });

export const updateUserSchema = insertUserSchema.partial().extend({
  password: z.string().min(5, "Parol kamida 5 ta belgidan iborat bo'lishi kerak").optional().or(z.literal("")),
});

const permissionList = z
  .array(z.string())
  .transform((list, ctx) => {
    const unknown = list.filter((p) => !isPermission(p));
    if (unknown.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Noma'lum ruxsat: ${unknown.join(", ")}` });
      return z.NEVER;
    }
    return Array.from(new Set(list)) as Permission[];
  });

export const insertRoleSchema = z.object({
  name: z.string().trim().min(2, "Rol nomini kiriting").max(60, "Nom juda uzun"),
  description: z.string().trim().max(240, "Tavsif juda uzun").nullish(),
  permissions: permissionList.default([]),
});

export const updateRoleSchema = insertRoleSchema.partial();

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqtni SS:DD ko'rinishida kiriting");

/**
 * A weekly timetable. Windows on one day must not overlap and each must end
 * after it starts — otherwise the appointment grid would offer the same slot
 * twice, or a slot that ends before it begins.
 */
export const scheduleSchema = z
  .array(z.object({ day: z.number().int().min(1).max(7), start: timeOfDay, end: timeOfDay }))
  .max(21, "Jadval juda uzun")
  .superRefine((slots, ctx) => {
    slots.forEach((s, i) => {
      if (s.end <= s.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${WEEKDAY_LABELS[s.day]}: tugash vaqti boshlanishidan keyin bo'lishi kerak`,
          path: [i],
        });
      }
    });
    for (const day of WEEKDAYS) {
      const same = slots.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < same.length; i++) {
        if (same[i].start < same[i - 1].end) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${WEEKDAY_LABELS[day]}: vaqt oraliqlari ustma-ust tushgan` });
        }
      }
    }
  })
  .transform((slots) => [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)));

export const insertDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Bo'lim nomini kiriting").max(80, "Nom juda uzun"),
  kind: z.enum(DEPARTMENT_KINDS).default("ambulator"),
  description: z.string().trim().max(240, "Tavsif juda uzun").nullish(),
  isActive: z.boolean().default(true),
});
export const updateDepartmentSchema = insertDepartmentSchema.partial();

export const insertDoctorSchema = z.object({
  userId: z.string().min(1, "Xodimni tanlang"),
  departmentId: z.string().min(1).nullish(),
  specialty: z.string().trim().min(2, "Mutaxassislikni kiriting").max(80, "Juda uzun"),
  room: z.string().trim().max(20, "Juda uzun").nullish(),
  consultationPrice: z.coerce.number().int().min(0, "Narx manfiy bo'lmasligi kerak").default(0),
  slotMinutes: z.coerce.number().int().min(5, "Kamida 5 daqiqa").max(240, "Ko'pi bilan 240 daqiqa").default(20),
  schedule: scheduleSchema.default([]),
  isActive: z.boolean().default(true),
});
/** The account a profile belongs to is fixed once created. */
export const updateDoctorSchema = insertDoctorSchema.omit({ userId: true }).partial();

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

export const insertServiceSchema = z.object({
  name: z.string().trim().min(2, "Xizmat nomini kiriting").max(120, "Nom juda uzun"),
  kind: z.enum(SERVICE_KINDS, { errorMap: () => ({ message: "Xizmat turini tanlang" }) }),
  departmentId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v || null),
  price: z.coerce.number().int("Narx butun son bo'lishi kerak").min(0, "Narx manfiy bo'lmasligi kerak").max(100_000_000, "Narx juda katta"),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "Kamida 5 daqiqa")
    .max(480, "Ko'pi bilan 8 soat")
    .nullish()
    .transform((v) => v ?? null),
  description: z
    .string()
    .trim()
    .max(300, "Tavsif juda uzun")
    .nullish()
    .transform((v) => v || null),
  isActive: z.boolean().default(true),
});
export const updateServiceSchema = insertServiceSchema.partial();
export type InsertService = z.infer<typeof insertServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani YYYY-MM-DD ko'rinishida kiriting");

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Bemorni tanlang"),
  doctorId: z.string().min(1, "Shifokorni tanlang"),
  serviceId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v || null),
  date: dayString,
  startTime: timeOfDay,
  reason: z
    .string()
    .trim()
    .max(300, "Juda uzun")
    .nullish()
    .transform((v) => v || null),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/** Moving a booking: another day, time, doctor or service. Only while it is still "yozildi". */
export const rescheduleAppointmentSchema = createAppointmentSchema.omit({ patientId: true }).partial().refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  "O'zgartirish uchun ma'lumot yo'q",
);
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  reason: z
    .string()
    .trim()
    .max(300, "Juda uzun")
    .nullish()
    .transform((v) => v || null),
});
export type AppointmentStatusInput = z.infer<typeof appointmentStatusSchema>;

const recordText = z
  .string()
  .max(4000, "Matn juda uzun (ko'pi bilan 4000 belgi)")
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null));

/** The six examination fields; each optional so a draft can be saved half-written. */
export const recordFieldsSchema = z.object({
  complaints: recordText,
  anamnesis: recordText,
  examination: recordText,
  preliminaryDiagnosis: recordText,
  finalDiagnosis: recordText,
  recommendations: recordText,
});
export type RecordFields = z.infer<typeof recordFieldsSchema>;

/** A draft save: the fields plus the revision the editor started from. */
export const saveRecordSchema = recordFieldsSchema.partial().extend({
  revision: z.number().int().min(0),
});

export const signRecordSchema = z.object({ revision: z.number().int().min(0) });

/** A correction to a signed record: the full new text and why it changed. */
export const amendRecordSchema = recordFieldsSchema.extend({
  revision: z.number().int().min(0),
  reason: z.string().trim().min(5, "Tuzatish sababini yozing (kamida 5 belgi)").max(300, "Juda uzun"),
});

export const insertAllergySchema = z.object({
  allergen: z.string().trim().min(2, "Allergenni kiriting").max(120, "Juda uzun"),
  reaction: z
    .string()
    .trim()
    .max(200, "Juda uzun")
    .nullish()
    .transform((v) => v || null),
});

export const removeAllergySchema = z.object({
  reason: z.string().trim().min(3, "Sababini yozing").max(200, "Juda uzun"),
});

/**
 * Session policy (TZ §12: "faol bo'lmagan seanslarni yopish").
 *
 * - idle: no activity for this long ends the session. 30 minutes by default:
 *   long enough not to bite a registrar between patients, short enough that a
 *   screen left open in a corridor does not stay signed in all afternoon.
 * - max: a session ends this long after sign-in however active it was — one
 *   shift — so a stolen cookie cannot live for weeks.
 */
export const securitySettingsSchema = z.object({
  sessionIdleMinutes: z.coerce.number().int().min(5, "Kamida 5 daqiqa").max(480, "Ko'pi bilan 8 soat"),
  sessionMaxHours: z.coerce.number().int().min(1, "Kamida 1 soat").max(168, "Ko'pi bilan 7 kun"),
  /**
   * Role keys whose holders must sign in with a second factor (TZ §12). Staff
   * in these roles who have not enrolled are sent to the enrolment screen on
   * their next sign-in; they cannot switch 2FA off.
   */
  mfaRequiredRoles: z
    .array(z.string().trim().min(1).max(64))
    .max(100)
    .transform((keys) => [...new Set(keys)]),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  sessionIdleMinutes: 30,
  sessionMaxHours: 12,
  mfaRequiredRoles: [],
};

/**
 * A code typed at sign-in or in the 2FA settings: either the six digits from
 * the authenticator app or a recovery code ("ABCD-2345"). Spaces and dashes are
 * forgiven — people copy them from wherever the code was shown.
 */
export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kodni kiriting")
    .max(32, "Kod juda uzun"),
});

export const mfaPasswordSchema = z.object({
  password: z.string().min(1, "Joriy parolni kiriting"),
});

export const mfaDisableSchema = mfaPasswordSchema.merge(mfaCodeSchema);

/** Why a session was ended — sent with the 401 so the login screen can say so. */
export const SESSION_END_CODES = ["SESSION_IDLE", "SESSION_MAX", "SESSION_REVOKED"] as const;
export type SessionEndCode = (typeof SESSION_END_CODES)[number];

/** One signed-in device, as the "Faol seanslar" panel lists it. */
export type ActiveSession = {
  /** A hash of the session id — the id itself never leaves the server. */
  id: string;
  current: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
  lastSeen: string | null;
};

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Loginni kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

export const labSettingsSchema = z.object({
  labName: z.string().trim().min(2, "Laboratoriya nomini kiriting"),
  tagline: z.string().trim().min(2, "Qisqa tavsif kiriting"),
  address: z.string().trim().nullish(),
  phone: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? normalizeUzPhone(v) : v)),
  director: z.string().trim().nullish(),
  licenseNumber: z.string().trim().nullish(),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertTest = z.infer<typeof insertTestSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type SaveResultsInput = z.infer<typeof saveResultsSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LabSettingsInput = z.infer<typeof labSettingsSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------- reporting

export type DashboardStatsData = {
  todayPatients: number;
  pendingTests: number;
  readyTests: number;
  /** Null for users without finance.view — the server withholds it. */
  todayRevenue: number | null;
  totalPatients: number;
  /** Null for users without finance.view — the server withholds it. */
  unpaidAmount: number | null;
};

export type RevenuePoint = {
  date: string;
  patients: number;
  tests: number;
  revenue: number;
};

export type RevenueReportData = {
  range: { from: string; to: string };
  points: RevenuePoint[];
  totalRevenue: number;
  totalPaid: number;
  totalPatients: number;
  totalTests: number;
  topTests: { name: string; count: number; revenue: number }[];
  byCategory: { category: string; count: number; revenue: number }[];
  /** Money out over the same range, and what is left of the money actually
      collected once it is deducted. Profit is computed against totalPaid, not
      totalRevenue: unpaid invoices are not cash in hand. */
  totalExpenses: number;
  netProfit: number;
  expensesByCategory: { category: string; amount: number }[];
  /** Who sent the patients, best first. Empty referrer is reported as "—". */
  byReferrer: { referrer: string; patients: number; revenue: number }[];
};
