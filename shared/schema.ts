import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { isPermission, type Permission } from "./permissions";

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
  age: integer("age"),
  gender: text("gender"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
  // Set by the Telegram bot when the patient shares their contact; null means
  // "not connected yet", and results for them stay queued until they are.
  telegramChatId: text("telegram_chat_id"),
  telegramLinkedAt: isoTimestamp("telegram_linked_at"),
});

export const tests = pgTable("tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: money("price").notNull(),
  category: text("category").notNull(),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  isActive: boolean("is_active").notNull().default(true),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Human-facing receipt number. Postgres assigns it from an identity
  // sequence so concurrent registrars can never collide on the same number.
  orderNumber: integer("order_number").generatedByDefaultAsIdentity({ startWith: 1001 }).notNull(),
  patientId: varchar("patient_id").notNull(),
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
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  createdAt: isoTimestamp("created_at").defaultNow().notNull(),
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
};

export type Patient = typeof patients.$inferSelect;

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

export type Test = typeof tests.$inferSelect;

// `status` and `flag` are plain text columns; narrow them for the app.
export type Order = Omit<typeof orders.$inferSelect, "status"> & { status: OrderStatus };

export type OrderTest = Omit<typeof orderTests.$inferSelect, "flag"> & { flag: ResultFlag | null };

export type LabSettings = typeof labSettings.$inferSelect;

export type TelegramContact = typeof telegramContacts.$inferSelect;

export type Payment = Omit<typeof payments.$inferSelect, "method"> & { method: PaymentMethod };

// `status` is a plain text column; narrow it for the app.
export type Sample = Omit<typeof samples.$inferSelect, "status"> & { status: SampleStatus };

export type Expense = typeof expenses.$inferSelect;

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

export const insertPatientSchema = createInsertSchema(patients)
  // patientNumber is allocated by the store, never accepted from the client.
  .omit({ id: true, patientNumber: true, createdAt: true, telegramChatId: true, telegramLinkedAt: true })
  .extend({
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
  amount: z.coerce.number().int().min(1, "Summani kiriting"),
  note: z.string().trim().nullish(),
  spentOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang")
    .default(() => localDayString(new Date())),
});

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
