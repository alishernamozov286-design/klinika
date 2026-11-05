var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/permissions.ts
function isPermission(value) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
function canonicalRoleKey(key) {
  if (!key) return "";
  return key === LEGACY_ADMIN ? SUPER_ADMIN : key;
}
function resolvePermissions(roleKey, stored) {
  if (canonicalRoleKey(roleKey) === SUPER_ADMIN) return [...ALL_PERMISSIONS];
  return Array.from(new Set((stored ?? []).filter(isPermission)));
}
var PERMISSION_GROUPS, PERMISSION_GROUP_LABEL, PERMISSIONS, ALL_PERMISSIONS, SUPER_ADMIN, LEGACY_ADMIN, SYSTEM_ROLES, SYSTEM_ROLE_KEYS;
var init_permissions = __esm({
  "shared/permissions.ts"() {
    "use strict";
    PERMISSION_GROUPS = [
      { key: "patients", label: "Bemorlar", description: "Bemorlar bazasi va shaxsiy kartalar" },
      { key: "orders", label: "Buyurtmalar", description: "Tahlil buyurtmalari" },
      { key: "lab", label: "Laboratoriya", description: "Namunalar, natijalar va tahlillar katalogi" },
      { key: "finance", label: "Kassa va moliya", description: "To'lovlar, qaytarishlar va xarajatlar" },
      { key: "reports", label: "Hisobotlar", description: "Statistika va ma'lumotlarni yuklab olish" },
      { key: "clinic", label: "Klinika tuzilmasi", description: "Bo'limlar va shifokorlar" },
      { key: "system", label: "Tizim", description: "Sozlamalar, xodimlar, rollar va xavfsizlik" }
    ];
    PERMISSION_GROUP_LABEL = Object.fromEntries(
      PERMISSION_GROUPS.map((g) => [g.key, g.label])
    );
    PERMISSIONS = {
      "patients.read": {
        group: "patients",
        label: "Ko'rish",
        description: "Bemorlar ro'yxati va ma'lumotlarini ko'rish"
      },
      "patients.create": {
        group: "patients",
        label: "Ro'yxatga olish",
        description: "Yangi bemor qo'shish"
      },
      "patients.update": {
        group: "patients",
        label: "Tahrirlash",
        description: "Bemor ma'lumotlarini o'zgartirish"
      },
      "patients.delete": {
        group: "patients",
        label: "O'chirish",
        description: "Bemorni bazadan butunlay o'chirish",
        sensitive: true
      },
      "orders.read": {
        group: "orders",
        label: "Ko'rish",
        description: "Buyurtmalar, tahlillar va natijalarni ko'rish"
      },
      "orders.create": {
        group: "orders",
        label: "Yaratish",
        description: "Bemorga tahlil buyurtma qilish"
      },
      "orders.update": {
        group: "orders",
        label: "Tahrirlash",
        description: "Tahlillar ro'yxati, chegirma va yo'naltiruvchini o'zgartirish"
      },
      "orders.cancel": {
        group: "orders",
        label: "Bekor qilish",
        description: "Buyurtmani bekor qilingan holatga o'tkazish"
      },
      "orders.delete": {
        group: "orders",
        label: "O'chirish",
        description: "Buyurtmani butunlay o'chirish",
        sensitive: true
      },
      "samples.manage": {
        group: "lab",
        label: "Namunalar",
        description: "Namuna olish, qabul qilish, rad etish va shtrix-kod skanerlash"
      },
      "results.enter": {
        group: "lab",
        label: "Natija kiritish",
        description: "Tahlil natijalarini kiritish va tuzatish"
      },
      "results.send": {
        group: "lab",
        label: "Natija yuborish",
        description: "Tayyor natijani bemorga Telegram orqali yuborish"
      },
      "tests.manage": {
        group: "lab",
        label: "Tahlillar katalogi",
        description: "Tahlil qo'shish, narx va referens oraliqlarni o'zgartirish"
      },
      "finance.view": {
        group: "finance",
        label: "Moliyaviy ko'rsatkichlar",
        description: "Bosh sahifada bugungi tushum va qarzdorlikni ko'rish"
      },
      "payments.create": {
        group: "finance",
        label: "To'lov qabul qilish",
        description: "Buyurtma uchun to'lov qabul qilish"
      },
      "payments.refund": {
        group: "finance",
        label: "To'lovni qaytarish",
        description: "Bemorga pulni qaytarish (TZ \xA79.2: faqat vakolatli shaxs)",
        sensitive: true
      },
      "payments.delete": {
        group: "finance",
        label: "To'lov yozuvini o'chirish",
        description: "Xato kiritilgan to'lov yozuvini o'chirish",
        sensitive: true
      },
      "expenses.read": {
        group: "finance",
        label: "Xarajatlarni ko'rish",
        description: "Xarajatlar ro'yxatini ko'rish"
      },
      "expenses.manage": {
        group: "finance",
        label: "Xarajatlarni boshqarish",
        description: "Xarajat qo'shish va o'chirish"
      },
      "reports.view": {
        group: "reports",
        label: "Hisobotlar",
        description: "Tushum, foyda, tahlillar va yo'naltiruvchilar hisobotlari"
      },
      "data.export": {
        group: "reports",
        label: "Bazani yuklab olish",
        description: "Bemorlar, buyurtmalar va xarajatlarni CSV ko'rinishida to'liq yuklab olish",
        sensitive: true
      },
      "departments.manage": {
        group: "clinic",
        label: "Bo'limlar",
        description: "Klinika bo'limlarini qo'shish, tahrirlash va yopish"
      },
      "doctors.manage": {
        group: "clinic",
        label: "Shifokorlar",
        description: "Shifokor profili: mutaxassislik, kabinet, qabul narxi va ish jadvali"
      },
      "settings.manage": {
        group: "system",
        label: "Klinika sozlamalari",
        description: "Klinika nomi, manzili, rekvizitlari va Telegram sozlamalari"
      },
      "users.manage": {
        group: "system",
        label: "Xodimlar",
        description: "Xodim qo'shish, tahrirlash, bloklash va qulfni ochish",
        sensitive: true
      },
      "roles.manage": {
        group: "system",
        label: "Rollar va ruxsatlar",
        description: "Rollarni yaratish va ularning ruxsatlarini o'zgartirish",
        sensitive: true
      },
      "audit.read": {
        group: "system",
        label: "Audit jurnali",
        description: "Kim, qachon, nima qilganini ko'rish"
      },
      "backup.download": {
        group: "system",
        label: "Zaxira nusxa",
        description: "Butun bazaning zaxira nusxasini yuklab olish",
        sensitive: true
      }
    };
    ALL_PERMISSIONS = Object.keys(PERMISSIONS);
    SUPER_ADMIN = "super_admin";
    LEGACY_ADMIN = "admin";
    SYSTEM_ROLES = [
      {
        key: SUPER_ADMIN,
        name: "Super administrator",
        description: "Butun tizimga to'liq kirish. Tahrirlab bo'lmaydi.",
        permissions: ALL_PERMISSIONS
      },
      {
        key: "rahbar",
        name: "Klinika rahbari",
        description: "Umumiy boshqaruv: barcha ma'lumotlarni ko'rish, hisobotlar, qaytarishlarni tasdiqlash",
        permissions: [
          "departments.manage",
          "doctors.manage",
          "patients.read",
          "orders.read",
          "orders.cancel",
          "finance.view",
          "payments.refund",
          "expenses.read",
          "reports.view",
          "data.export",
          "audit.read"
        ]
      },
      {
        key: "registrator",
        name: "Registrator",
        description: "Bemorlarni ro'yxatga olish, buyurtma va to'lov qabul qilish",
        permissions: [
          "patients.read",
          "patients.create",
          "patients.update",
          "orders.read",
          "orders.create",
          "orders.update",
          "samples.manage",
          "results.send",
          "finance.view",
          "payments.create"
        ]
      },
      {
        key: "shifokor",
        name: "Shifokor",
        description: "Tibbiy karta va buyurtmalar, bemor tahlil natijalarini ko'rish",
        permissions: ["patients.read", "orders.read"]
      },
      {
        key: "laborant",
        name: "Laborant",
        description: "Namunalarni qabul qilish va tahlil natijalarini kiritish",
        permissions: ["patients.read", "orders.read", "samples.manage", "results.enter", "results.send"]
      },
      {
        key: "lab_mudiri",
        name: "Laboratoriya mudiri",
        description: "Laboratoriya ishini nazorat qilish, natijalarni tasdiqlash, tahlillar katalogi",
        permissions: [
          "patients.read",
          "orders.read",
          "orders.cancel",
          "samples.manage",
          "results.enter",
          "results.send",
          "tests.manage",
          "reports.view"
        ]
      },
      {
        key: "omborchi",
        name: "Omborchi",
        description: "Ombor: kirim, chiqim va qoldiq",
        permissions: []
      },
      {
        key: "hamshira",
        name: "Statsionar hamshirasi",
        description: "Bemor parvarishi, muolajalar va namuna olish",
        permissions: ["patients.read", "orders.read", "samples.manage"]
      },
      {
        key: "kassir",
        name: "Kassa xodimi",
        description: "To'lovlarni qabul qilish",
        permissions: ["patients.read", "orders.read", "finance.view", "payments.create"]
      },
      {
        key: "buxgalter",
        name: "Buxgalter",
        description: "Moliyaviy hisobotlar va xarajatlar",
        permissions: [
          "orders.read",
          "finance.view",
          "expenses.read",
          "expenses.manage",
          "reports.view",
          "data.export"
        ]
      },
      {
        key: "auditor",
        name: "Auditor",
        description: "Ruxsat etilgan tarix va hisobotlarni faqat ko'rish",
        permissions: [
          "patients.read",
          "orders.read",
          "finance.view",
          "expenses.read",
          "reports.view",
          "audit.read"
        ]
      }
    ];
    SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  DEPARTMENT_KINDS: () => DEPARTMENT_KINDS,
  DEPARTMENT_KIND_LABELS: () => DEPARTMENT_KIND_LABELS,
  EXPENSE_CATEGORIES: () => EXPENSE_CATEGORIES,
  ORDER_STATUSES: () => ORDER_STATUSES,
  ORDER_STATUS_LABELS: () => ORDER_STATUS_LABELS,
  PAYMENT_METHODS: () => PAYMENT_METHODS,
  RESULT_FLAGS: () => RESULT_FLAGS,
  SAMPLE_REJECT_REASONS: () => SAMPLE_REJECT_REASONS,
  SAMPLE_STATUSES: () => SAMPLE_STATUSES,
  SAMPLE_STATUS_LABELS: () => SAMPLE_STATUS_LABELS,
  WEEKDAYS: () => WEEKDAYS,
  WEEKDAY_LABELS: () => WEEKDAY_LABELS,
  WEEKDAY_SHORT: () => WEEKDAY_SHORT,
  auditLog: () => auditLog,
  changePasswordSchema: () => changePasswordSchema,
  createOrderSchema: () => createOrderSchema,
  createPaymentSchema: () => createPaymentSchema,
  departments: () => departments,
  doctors: () => doctors,
  expenses: () => expenses,
  insertDepartmentSchema: () => insertDepartmentSchema,
  insertDoctorSchema: () => insertDoctorSchema,
  insertExpenseSchema: () => insertExpenseSchema,
  insertPatientSchema: () => insertPatientSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertTestSchema: () => insertTestSchema,
  insertUserSchema: () => insertUserSchema,
  labSettings: () => labSettings,
  labSettingsSchema: () => labSettingsSchema,
  localDayString: () => localDayString,
  loginSchema: () => loginSchema,
  nationalPhoneDigits: () => nationalPhoneDigits,
  normalizeUzPhone: () => normalizeUzPhone,
  orderTests: () => orderTests,
  orders: () => orders,
  patients: () => patients,
  payments: () => payments,
  roles: () => roles,
  samples: () => samples,
  saveResultsSchema: () => saveResultsSchema,
  scheduleSchema: () => scheduleSchema,
  sessions: () => sessions,
  telegramContacts: () => telegramContacts,
  tests: () => tests,
  updateDepartmentSchema: () => updateDepartmentSchema,
  updateDoctorSchema: () => updateDoctorSchema,
  updateOrderSchema: () => updateOrderSchema,
  updateRoleSchema: () => updateRoleSchema,
  updateSampleSchema: () => updateSampleSchema,
  updateUserSchema: () => updateUserSchema,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
function normalizeUzPhone(value) {
  const digits = nationalPhoneDigits(value);
  if (digits.length !== 9) return (value ?? "").trim();
  return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}
function nationalPhoneDigits(value) {
  const raw = (value ?? "").trim();
  const explicit = raw.match(/^\+\s*998\s*(.*)$/);
  if (explicit) return explicit[1].replace(/\D/g, "").slice(0, 9);
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("998")) return digits.slice(3, 12);
  if (digits.length === 10 && digits.startsWith("8")) return digits.slice(1);
  return digits.slice(0, 9);
}
function localDayString(value) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
var money, isoTimestamp, ORDER_STATUSES, ORDER_STATUS_LABELS, RESULT_FLAGS, PAYMENT_METHODS, SAMPLE_STATUSES, SAMPLE_STATUS_LABELS, SAMPLE_REJECT_REASONS, EXPENSE_CATEGORIES, DEPARTMENT_KINDS, DEPARTMENT_KIND_LABELS, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_LABELS, users, roles, departments, doctors, patients, tests, orders, orderTests, samples, payments, expenses, auditLog, telegramContacts, sessions, labSettings, insertPatientSchema, insertTestSchema, uniqueTestIds, createOrderSchema, updateOrderSchema, updateSampleSchema, createPaymentSchema, insertExpenseSchema, changePasswordSchema, saveResultsSchema, insertUserSchema, updateUserSchema, permissionList, insertRoleSchema, updateRoleSchema, timeOfDay, scheduleSchema, insertDepartmentSchema, updateDepartmentSchema, insertDoctorSchema, updateDoctorSchema, loginSchema, labSettingsSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_permissions();
    money = (name) => integer(name);
    isoTimestamp = (name) => timestamp(name, { mode: "string", withTimezone: true });
    ORDER_STATUSES = ["pending", "in_progress", "completed", "cancelled"];
    ORDER_STATUS_LABELS = {
      pending: "Kutilmoqda",
      in_progress: "Jarayonda",
      completed: "Tayyor",
      cancelled: "Bekor qilingan"
    };
    RESULT_FLAGS = ["low", "normal", "high"];
    PAYMENT_METHODS = ["naqd", "karta", "o'tkazma"];
    SAMPLE_STATUSES = ["kutilmoqda", "olindi", "qabul_qilindi", "rad_etildi"];
    SAMPLE_STATUS_LABELS = {
      kutilmoqda: "Kutilmoqda",
      olindi: "Olindi",
      qabul_qilindi: "Qabul qilindi",
      rad_etildi: "Rad etildi"
    };
    SAMPLE_REJECT_REASONS = [
      "Gemoliz",
      "Miqdori yetarli emas",
      "Noto'g'ri probirka",
      "Probirka buzilgan",
      "Belgilanmagan",
      "Ivib qolgan",
      "Boshqa"
    ];
    EXPENSE_CATEGORIES = [
      "Reaktivlar",
      "Ish haqi",
      "Ijara",
      "Kommunal",
      "Jihoz",
      "Soliq",
      "Boshqa"
    ];
    DEPARTMENT_KINDS = ["ambulator", "diagnostika", "laboratoriya", "statsionar", "boshqa"];
    DEPARTMENT_KIND_LABELS = {
      ambulator: "Ambulator qabul",
      diagnostika: "Diagnostika",
      laboratoriya: "Laboratoriya",
      statsionar: "Statsionar",
      boshqa: "Boshqa"
    };
    WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
    WEEKDAY_SHORT = { 1: "Du", 2: "Se", 3: "Ch", 4: "Pa", 5: "Ju", 6: "Sh", 7: "Ya" };
    WEEKDAY_LABELS = {
      1: "Dushanba",
      2: "Seshanba",
      3: "Chorshanba",
      4: "Payshanba",
      5: "Juma",
      6: "Shanba",
      7: "Yakshanba"
    };
    users = pgTable("users", {
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
      lastFailedAt: isoTimestamp("last_failed_at")
    });
    roles = pgTable("roles", {
      key: varchar("key").primaryKey(),
      name: text("name").notNull(),
      description: text("description"),
      permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
      /** One of the TZ §3 roles. These cannot be deleted; their key is fixed. */
      isSystem: boolean("is_system").notNull().default(false),
      createdAt: isoTimestamp("created_at").defaultNow().notNull(),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by")
    });
    departments = pgTable("departments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull().unique(),
      kind: text("kind").notNull().default("ambulator"),
      description: text("description"),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: isoTimestamp("created_at").defaultNow().notNull(),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by")
    });
    doctors = pgTable(
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
        schedule: json("schedule").$type().notNull().default(sql`'[]'::json`),
        isActive: boolean("is_active").notNull().default(true),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by")
      },
      (t) => ({ departmentIdx: index("IDX_doctors_department").on(t.departmentId) })
    );
    patients = pgTable("patients", {
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
      telegramLinkedAt: isoTimestamp("telegram_linked_at")
    });
    tests = pgTable("tests", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      price: money("price").notNull(),
      category: text("category").notNull(),
      unit: text("unit"),
      referenceRange: text("reference_range"),
      isActive: boolean("is_active").notNull().default(true)
    });
    orders = pgTable("orders", {
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
      telegramSentAt: isoTimestamp("telegram_sent_at")
    });
    orderTests = pgTable("order_tests", {
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
      completedAt: isoTimestamp("completed_at")
    });
    samples = pgTable(
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
        createdAt: isoTimestamp("created_at").defaultNow().notNull()
      },
      // Every order screen loads its sample by orderId; the barcode index backs
      // the scanner lookup, which must stay fast with a full year of tubes in it.
      (t) => ({
        orderIdx: index("IDX_samples_order").on(t.orderId),
        barcodeIdx: index("IDX_samples_barcode").on(t.barcode)
      })
    );
    payments = pgTable("payments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      orderId: varchar("order_id").notNull(),
      /** Negative for a refund, so the history reads as a ledger. */
      amount: money("amount").notNull(),
      method: text("method").notNull().default("naqd"),
      note: text("note"),
      createdBy: varchar("created_by"),
      createdByName: text("created_by_name"),
      createdAt: isoTimestamp("created_at").defaultNow().notNull()
    });
    expenses = pgTable("expenses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      category: text("category").notNull(),
      amount: money("amount").notNull(),
      note: text("note"),
      /** The day the money was actually spent, which is not always today. */
      spentOn: text("spent_on").notNull(),
      createdBy: varchar("created_by"),
      createdByName: text("created_by_name"),
      createdAt: isoTimestamp("created_at").defaultNow().notNull()
    });
    auditLog = pgTable(
      "audit_log",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        userId: varchar("user_id"),
        userName: text("user_name").notNull(),
        action: text("action").notNull(),
        entity: text("entity").notNull(),
        entityId: varchar("entity_id"),
        summary: text("summary").notNull(),
        createdAt: isoTimestamp("created_at").defaultNow().notNull()
      },
      (t) => ({ createdIdx: index("IDX_audit_created").on(t.createdAt) })
    );
    telegramContacts = pgTable("telegram_contacts", {
      chatId: text("chat_id").primaryKey(),
      phone: text("phone").notNull(),
      /** What Telegram calls them — shown to the registrator as a sanity check. */
      fullName: text("full_name"),
      username: text("username"),
      createdAt: isoTimestamp("created_at").defaultNow().notNull()
    });
    sessions = pgTable(
      "session",
      {
        sid: varchar("sid").primaryKey(),
        sess: json("sess").notNull(),
        expire: timestamp("expire", { precision: 6, mode: "date" }).notNull()
      },
      (t) => ({ expireIdx: index("IDX_session_expire").on(t.expire) })
    );
    labSettings = pgTable("lab_settings", {
      id: varchar("id").primaryKey().default("default"),
      labName: text("lab_name").notNull().default("MedLab"),
      tagline: text("tagline").notNull().default("Tibbiy Laboratoriya"),
      address: text("address"),
      phone: text("phone"),
      director: text("director"),
      licenseNumber: text("license_number")
    });
    insertPatientSchema = createInsertSchema(patients).omit({ id: true, patientNumber: true, createdAt: true, telegramChatId: true, telegramLinkedAt: true }).extend({
      fullName: z.string().trim().min(3, "F.I.Sh kamida 3 ta belgidan iborat bo'lishi kerak"),
      phone: z.string().trim().min(7, "Telefon raqamini to'g'ri kiriting").transform(normalizeUzPhone),
      age: z.coerce.number().int().min(0, "Yosh manfiy bo'lmasligi kerak").max(130, "Yoshni tekshiring").nullish(),
      gender: z.enum(["erkak", "ayol"]).nullish(),
      address: z.string().trim().nullish()
    });
    insertTestSchema = createInsertSchema(tests).omit({ id: true }).extend({
      name: z.string().trim().min(2, "Tahlil nomini kiriting"),
      price: z.coerce.number().int().min(0, "Narx manfiy bo'lmasligi kerak"),
      category: z.string().trim().min(2, "Kategoriyani tanlang"),
      unit: z.string().trim().nullish(),
      referenceRange: z.string().trim().nullish(),
      isActive: z.boolean().default(true)
    });
    uniqueTestIds = z.array(z.string()).min(1, "Kamida bitta tahlil tanlang").transform((ids) => Array.from(new Set(ids)));
    createOrderSchema = z.object({
      patientId: z.string().min(1, "Bemorni tanlang"),
      testIds: uniqueTestIds,
      discount: z.coerce.number().int().min(0).default(0),
      paidAmount: z.coerce.number().int().min(0).default(0),
      notes: z.string().trim().nullish(),
      referrer: z.string().trim().nullish()
    });
    updateOrderSchema = z.object({
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
      testIds: uniqueTestIds.optional()
    });
    updateSampleSchema = z.object({
      status: z.enum(SAMPLE_STATUSES),
      rejectReason: z.enum(SAMPLE_REJECT_REASONS).nullish(),
      rejectNote: z.string().trim().max(300).nullish()
    }).refine((v) => v.status !== "rad_etildi" || Boolean(v.rejectReason), {
      message: "Rad etish sababini tanlang",
      path: ["rejectReason"]
    });
    createPaymentSchema = z.object({
      /** Negative is allowed: that is how a refund is recorded. */
      amount: z.coerce.number().int().refine((n) => n !== 0, "Summani kiriting"),
      method: z.enum(PAYMENT_METHODS).default("naqd"),
      note: z.string().trim().nullish()
    });
    insertExpenseSchema = z.object({
      category: z.enum(EXPENSE_CATEGORIES),
      amount: z.coerce.number().int().min(1, "Summani kiriting"),
      note: z.string().trim().nullish(),
      spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang").default(() => localDayString(/* @__PURE__ */ new Date()))
    });
    changePasswordSchema = z.object({
      currentPassword: z.string().min(1, "Joriy parolni kiriting"),
      newPassword: z.string().min(5, "Yangi parol kamida 5 ta belgidan iborat bo'lishi kerak"),
      confirmPassword: z.string().min(1, "Parolni takrorlang")
    }).refine((v) => v.newPassword === v.confirmPassword, {
      message: "Parollar mos kelmadi",
      path: ["confirmPassword"]
    }).refine((v) => v.newPassword !== v.currentPassword, {
      message: "Yangi parol eskisidan farq qilishi kerak",
      path: ["newPassword"]
    });
    saveResultsSchema = z.object({
      results: z.array(
        z.object({
          id: z.string().min(1),
          result: z.string().trim().nullish(),
          flag: z.enum(RESULT_FLAGS).nullish(),
          notes: z.string().trim().nullish()
        })
      ).min(1)
    });
    insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true }).extend({
      username: z.string().trim().min(3, "Login kamida 3 ta belgidan iborat bo'lishi kerak").regex(/^[a-z0-9_.-]+$/i, "Faqat lotin harflari, raqam va _ . - belgilari"),
      password: z.string().min(5, "Parol kamida 5 ta belgidan iborat bo'lishi kerak"),
      fullName: z.string().trim().min(3, "F.I.Sh kiriting"),
      role: z.string().trim().min(1, "Rolni tanlang"),
      isActive: z.boolean().default(true)
    });
    updateUserSchema = insertUserSchema.partial().extend({
      password: z.string().min(5, "Parol kamida 5 ta belgidan iborat bo'lishi kerak").optional().or(z.literal(""))
    });
    permissionList = z.array(z.string()).transform((list, ctx) => {
      const unknown = list.filter((p) => !isPermission(p));
      if (unknown.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Noma'lum ruxsat: ${unknown.join(", ")}` });
        return z.NEVER;
      }
      return Array.from(new Set(list));
    });
    insertRoleSchema = z.object({
      name: z.string().trim().min(2, "Rol nomini kiriting").max(60, "Nom juda uzun"),
      description: z.string().trim().max(240, "Tavsif juda uzun").nullish(),
      permissions: permissionList.default([])
    });
    updateRoleSchema = insertRoleSchema.partial();
    timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqtni SS:DD ko'rinishida kiriting");
    scheduleSchema = z.array(z.object({ day: z.number().int().min(1).max(7), start: timeOfDay, end: timeOfDay })).max(21, "Jadval juda uzun").superRefine((slots, ctx) => {
      slots.forEach((s, i) => {
        if (s.end <= s.start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${WEEKDAY_LABELS[s.day]}: tugash vaqti boshlanishidan keyin bo'lishi kerak`,
            path: [i]
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
    }).transform((slots) => [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)));
    insertDepartmentSchema = z.object({
      name: z.string().trim().min(2, "Bo'lim nomini kiriting").max(80, "Nom juda uzun"),
      kind: z.enum(DEPARTMENT_KINDS).default("ambulator"),
      description: z.string().trim().max(240, "Tavsif juda uzun").nullish(),
      isActive: z.boolean().default(true)
    });
    updateDepartmentSchema = insertDepartmentSchema.partial();
    insertDoctorSchema = z.object({
      userId: z.string().min(1, "Xodimni tanlang"),
      departmentId: z.string().min(1).nullish(),
      specialty: z.string().trim().min(2, "Mutaxassislikni kiriting").max(80, "Juda uzun"),
      room: z.string().trim().max(20, "Juda uzun").nullish(),
      consultationPrice: z.coerce.number().int().min(0, "Narx manfiy bo'lmasligi kerak").default(0),
      slotMinutes: z.coerce.number().int().min(5, "Kamida 5 daqiqa").max(240, "Ko'pi bilan 240 daqiqa").default(20),
      schedule: scheduleSchema.default([]),
      isActive: z.boolean().default(true)
    });
    updateDoctorSchema = insertDoctorSchema.omit({ userId: true }).partial();
    loginSchema = z.object({
      username: z.string().trim().min(1, "Loginni kiriting"),
      password: z.string().min(1, "Parolni kiriting")
    });
    labSettingsSchema = z.object({
      labName: z.string().trim().min(2, "Laboratoriya nomini kiriting"),
      tagline: z.string().trim().min(2, "Qisqa tavsif kiriting"),
      address: z.string().trim().nullish(),
      phone: z.string().trim().nullish().transform((v) => v ? normalizeUzPhone(v) : v),
      director: z.string().trim().nullish(),
      licenseNumber: z.string().trim().nullish()
    });
  }
});

// server/password.ts
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, KEY_LEN);
  return `${buf.toString("hex")}.${salt}`;
}
async function verifyPassword(password, stored) {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(password, salt, KEY_LEN);
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
var scryptAsync, KEY_LEN;
var init_password = __esm({
  "server/password.ts"() {
    "use strict";
    scryptAsync = promisify(scrypt);
    KEY_LEN = 64;
  }
});

// shared/reference-range.ts
function parseResultValue(result) {
  const raw = (result ?? "").trim().replace(",", ".");
  if (!raw) return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
function parseBounds(clause) {
  const text2 = clause.trim();
  const between = text2.match(new RegExp(`(${NUM})\\s*[-\u2013\u2014]\\s*(${NUM})`));
  if (between) {
    const min = toNum(between[1]);
    const max = toNum(between[2]);
    if (min <= max) return { min, max };
    return null;
  }
  const upper = text2.match(new RegExp(`[<\u2264]\\s*(${NUM})`));
  if (upper) return { max: toNum(upper[1]) };
  const lower = text2.match(new RegExp(`[>\u2265]\\s*(${NUM})`));
  if (lower) return { min: toNum(lower[1]) };
  return null;
}
function selectClause(range, ctx) {
  const clauses = range.split(/[,;]/).map((c) => c.trim()).filter(Boolean);
  const sexed = clauses.filter((c) => MALE.test(c) || FEMALE.test(c));
  if (sexed.length === 0) return range;
  const gender = (ctx.gender ?? "").trim().toLowerCase();
  const wantMale = MALE.test(gender);
  const wantFemale = FEMALE.test(gender);
  if (!wantMale && !wantFemale) return null;
  const match = sexed.find((c) => wantMale ? MALE.test(c) : FEMALE.test(c));
  if (!match) return null;
  return match.replace(/^[^:]*:/, "");
}
function computeFlag(result, referenceRange, ctx = {}) {
  const value = parseResultValue(result);
  if (value === null) return null;
  const range = (referenceRange ?? "").trim();
  if (!range) return null;
  const clause = selectClause(range, ctx);
  if (clause === null) return null;
  const bounds = parseBounds(clause);
  if (!bounds) return null;
  if (bounds.min === void 0 && bounds.max === void 0) return null;
  if (bounds.min !== void 0 && value < bounds.min) return "low";
  if (bounds.max !== void 0 && value > bounds.max) return "high";
  return "normal";
}
var NUM, toNum, MALE, FEMALE;
var init_reference_range = __esm({
  "shared/reference-range.ts"() {
    "use strict";
    NUM = String.raw`-?\d+(?:[.,]\d+)?`;
    toNum = (s) => Number(s.replace(",", "."));
    MALE = /erkak|мужч|male/i;
    FEMALE = /ayol|женщ|female/i;
  }
});

// server/storage-types.ts
function localDay(value) {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayKey() {
  return localDay(/* @__PURE__ */ new Date());
}
function resolveFlag(incoming, line, gender) {
  if (incoming.flag) return incoming.flag;
  return computeFlag(incoming.result, line.referenceRange, { gender });
}
function byActiveThenName(name) {
  return (a, b) => Number(b.isActive) - Number(a.isActive) || name(a).localeCompare(name(b));
}
function sortRoles(list) {
  const rank = (r) => {
    const i = SYSTEM_ROLE_KEYS.indexOf(r.key);
    return r.isSystem && i >= 0 ? i : SYSTEM_ROLE_KEYS.length;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
var DEFAULT_SETTINGS, SEED_USERS;
var init_storage_types = __esm({
  "server/storage-types.ts"() {
    "use strict";
    init_reference_range();
    init_permissions();
    DEFAULT_SETTINGS = {
      id: "default",
      labName: "MedLab",
      tagline: "Tibbiy Laboratoriya",
      address: null,
      phone: null,
      director: null,
      licenseNumber: null
    };
    SEED_USERS = [
      // A single word on purpose: the dashboard greets people by their given name,
      // which it takes to be the second word of "Familiya Ism Otasining-ismi".
      // A two-word job title would come out as "Salom, administratori".
      { username: "admin", password: "admin123", fullName: "Administrator", role: SUPER_ADMIN }
    ];
  }
});

// shared/tests-data.ts
var defaultTests, testReferences;
var init_tests_data = __esm({
  "shared/tests-data.ts"() {
    "use strict";
    defaultTests = [
      // Gematologiya
      { id: "1", name: "Umumiy qon tahlili", price: 3e4, category: "Gematologiya" },
      { id: "2", name: "Umumiy qon tahlili l\u0435\u0439koformula, Trombotsitlar bilan", price: 5e4, category: "Gematologiya" },
      { id: "3", name: "Gemoglobin", price: 2e4, category: "Gematologiya" },
      { id: "4", name: "Eritrotsitlar chukish tezligi (ECHT)", price: 2e4, category: "Gematologiya" },
      { id: "5", name: "Qon ivish vaqti (VSK)", price: 2e4, category: "Gematologiya" },
      // Umumiy klinika
      { id: "6", name: "Umumiy siydik tahlili", price: 4e4, category: "Umumiy klinika" },
      { id: "7", name: "Nicheporenko usulida siydik tahlili", price: 4e4, category: "Umumiy klinika" },
      { id: "8", name: "Siydikdagi ut pigmentlarini aniqlash", price: 4e4, category: "Umumiy klinika" },
      { id: "9", name: "Siydikdagi keton tanachalarini aniqlash", price: 4e4, category: "Umumiy klinika" },
      { id: "10", name: "Siydikdagi glyukoza miqdorini aniqlash", price: 4e4, category: "Umumiy klinika" },
      { id: "11", name: "Siydikda oksil miqdorini aniqlash", price: 4e4, category: "Umumiy klinika" },
      // Kaprologiya
      { id: "12", name: "Umumiy ahlat tahlili", price: 3e4, category: "Kaprologiya" },
      { id: "13", name: "Ahlatda gijja tuxumlarini aniqlash", price: 3e4, category: "Kaprologiya" },
      { id: "14", name: "Ahlatni yashirin qonga tekshirish", price: 6e4, category: "Kaprologiya" },
      // Qonning biokimyoviy tahlili
      { id: "15", name: "Umumiy oksil", price: 25e3, category: "Biokimyoviy tahlil" },
      { id: "16", name: "Albumin", price: 35e3, category: "Biokimyoviy tahlil" },
      { id: "17", name: "ALT-Alaninaminotransferaza", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "18", name: "AST-Aspartataminotransferaza", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "19", name: "Billirubin: Umumiy, erkin, bog'langan", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "20", name: "Ishkoriy fosfataza", price: 3e4, category: "Biokimyoviy tahlil" },
      { id: "21", name: "Alfa-amilaza", price: 35e3, category: "Biokimyoviy tahlil" },
      { id: "22", name: "Glyukoza", price: 25e3, category: "Biokimyoviy tahlil" },
      { id: "23", name: "Mochevina", price: 25e3, category: "Biokimyoviy tahlil" },
      { id: "24", name: "Kreatinin", price: 25e3, category: "Biokimyoviy tahlil" },
      { id: "25", name: "MB-KFK-kreatininfosfokinaza", price: 4e4, category: "Biokimyoviy tahlil" },
      { id: "26", name: "Xolesterin", price: 3e4, category: "Biokimyoviy tahlil" },
      { id: "27", name: "Triglitserid", price: 4e4, category: "Biokimyoviy tahlil" },
      { id: "28", name: "Yuqori zichlikdagi lipoproteidlar", price: 45e3, category: "Biokimyoviy tahlil" },
      { id: "29", name: "Past zichlikdagi lipoproteidlar", price: 55e3, category: "Biokimyoviy tahlil" },
      { id: "30", name: "Mochevoy kislota", price: 4e4, category: "Biokimyoviy tahlil" },
      { id: "31", name: "Mochevoy kislota siydikda", price: 5e4, category: "Biokimyoviy tahlil" },
      { id: "32", name: "Kaliy", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "33", name: "Kaltsiy", price: 25e3, category: "Biokimyoviy tahlil" },
      { id: "34", name: "Xlor", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "35", name: "Natriy", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "36", name: "Magniy", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "37", name: "Laktatdegidrogenaza (LDG)", price: 5e4, category: "Biokimyoviy tahlil" },
      { id: "38", name: "Temir", price: 3e4, category: "Biokimyoviy tahlil" },
      { id: "39", name: "Revmatoidli omil", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "40", name: "Antistreptozin-O (ASLO)", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "41", name: "SRB-S-reaktiv oksil", price: 2e4, category: "Biokimyoviy tahlil" },
      { id: "42", name: "Revmatoidli omil miqdoriy", price: 7e4, category: "Biokimyoviy tahlil" },
      { id: "43", name: "Antistreptozin-O (ASLO) miqdoriy", price: 7e4, category: "Biokimyoviy tahlil" },
      { id: "44", name: "Glikgemoglobin", price: 7e4, category: "Biokimyoviy tahlil" },
      // Koagulogramma
      { id: "45", name: "PTI-Protrombin indeksi", price: 5e4, category: "Koagulogramma" },
      { id: "46", name: "ACHTV-Aktivlangan tromboplastin hosil bo'lish vaqti", price: 25e3, category: "Koagulogramma" },
      { id: "47", name: "Fibrinogen", price: 25e3, category: "Koagulogramma" },
      { id: "48", name: "Trombo-test", price: 1e4, category: "Koagulogramma" },
      // Qalqonsimon bez gormonlari
      { id: "49", name: "T3", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "50", name: "T4", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "51", name: "TTG", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "52", name: "T3-sv", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "53", name: "T4-sv", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "54", name: "At-TPO", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      { id: "55", name: "At-TG", price: 8e4, category: "Qalqonsimon bez gormonlari" },
      // Reproduktiv sistema
      { id: "56", name: "FSG", price: 7e4, category: "Reproduktiv sistema" },
      { id: "57", name: "LG", price: 7e4, category: "Reproduktiv sistema" },
      { id: "58", name: "Prolaktin", price: 9e4, category: "Reproduktiv sistema" },
      { id: "59", name: "Esteradiol", price: 8e4, category: "Reproduktiv sistema" },
      { id: "60", name: "XGCh", price: 6e4, category: "Reproduktiv sistema" },
      { id: "61", name: "AMG-Antimyuleriv gormon", price: 1e5, category: "Reproduktiv sistema" },
      { id: "62", name: "Testosteron", price: 8e4, category: "Reproduktiv sistema" },
      { id: "63", name: "Testosteron-erkin", price: 8e4, category: "Reproduktiv sistema" },
      { id: "64", name: "Progesteron", price: 8e4, category: "Reproduktiv sistema" },
      // Allergiya
      { id: "65", name: "Immunoglobulin E IgG", price: 7e4, category: "Allergiya" },
      // Buyrak usti bezi gormoni
      { id: "66", name: "Kortizol", price: 8e4, category: "Buyrak usti bezi gormoni" },
      // Oshqozon osti bezi gormoni
      { id: "67", name: "Insulin", price: 8e4, category: "Oshqozon osti bezi gormoni" },
      { id: "68", name: "S-Peptid", price: 8e4, category: "Oshqozon osti bezi gormoni" },
      // Gepatologiya
      { id: "69", name: "Gepatit A IgG", price: 6e4, category: "Gepatologiya" },
      { id: "70", name: "HBsAg", price: 2e4, category: "Gepatologiya" },
      { id: "71", name: "Anti-HCV", price: 2e4, category: "Gepatologiya" },
      { id: "72", name: "Gepatit D", price: 9e4, category: "Gepatologiya" },
      // Infeksiyalar
      { id: "73", name: "Gerpes 1-2 tip IgG", price: 6e4, category: "Infeksiyalar" },
      { id: "74", name: "Tsitomegalovirus IgG", price: 6e4, category: "Infeksiyalar" },
      { id: "75", name: "Xlamidiya IgG", price: 6e4, category: "Infeksiyalar" },
      { id: "76", name: "Toksoplazma IgG", price: 6e4, category: "Infeksiyalar" },
      { id: "77", name: "Mikoplazma IgG", price: 6e4, category: "Infeksiyalar" },
      { id: "78", name: "Ureoplazma IgG", price: 6e4, category: "Infeksiyalar" },
      // Ovqat hazm qilish sistemasi
      { id: "79", name: "Helikobakter pilori IgG", price: 7e4, category: "Ovqat hazm qilish sistemasi" },
      // Gelmintlar
      { id: "80", name: "Exinokokk IgG", price: 7e4, category: "Gelmintlar" },
      { id: "81", name: "Lyambliya IgA,M,G", price: 7e4, category: "Gelmintlar" },
      { id: "82", name: "Askarida IgG", price: 7e4, category: "Gelmintlar" },
      { id: "83", name: "Gelmintlar: Opistorxoz, Trixinella, Toksokar IgG", price: 7e4, category: "Gelmintlar" },
      // Onkomarker
      { id: "84", name: "CA-125Ag - tuxumdonlar onkomarkeri", price: 8e4, category: "Onkomarker" },
      { id: "85", name: "CA-15-3Ag - sut bezi onkomarkeri", price: 8e4, category: "Onkomarker" },
      { id: "86", name: "CA-19-9Ag - oshqozon osti bezi onkomarkeri", price: 8e4, category: "Onkomarker" },
      { id: "87", name: "REA - Rakoviy-embrional antigen", price: 8e4, category: "Onkomarker" },
      { id: "88", name: "AFP - Alfa-fetoprotein", price: 8e4, category: "Onkomarker" },
      { id: "89", name: "PSA - prostata spetsifik antigeni", price: 8e4, category: "Onkomarker" },
      // Yallig'lanish jarayoni
      { id: "90", name: "S-Reaktiv oksil miqdoriy", price: 85e3, category: "Yallig'lanish jarayoni" },
      { id: "91", name: "Prokalsitonin", price: 14e4, category: "Yallig'lanish jarayoni" },
      { id: "92", name: "Interleikin-6", price: 23e4, category: "Yallig'lanish jarayoni" },
      { id: "93", name: "Ferritin", price: 13e4, category: "Yallig'lanish jarayoni" },
      { id: "94", name: "ATSTSP", price: 22e4, category: "Yallig'lanish jarayoni" },
      { id: "95", name: "ANA-HEp-2", price: 25e4, category: "Yallig'lanish jarayoni" },
      // Qon ivish sistemasi
      { id: "96", name: "D-Dimer", price: 13e4, category: "Qon ivish sistemasi" },
      // Suv-tuz almashinuvi
      { id: "97", name: "Vitamin D3", price: 12e4, category: "Suv-tuz almashinuvi" },
      // Ekspress testlar - Gepatologiya
      { id: "98", name: "Gepatit B ekspress", price: 3e4, category: "Ekspress testlar" },
      { id: "99", name: "Gepatit C ekspress", price: 3e4, category: "Ekspress testlar" },
      { id: "100", name: "Gepatit A IgM (ekspress)", price: 8e4, category: "Ekspress testlar" },
      // Jinsiy yo'l bilan yuqadigan kasalliklar
      { id: "101", name: "Siflis ekspress", price: 7e4, category: "Jinsiy yo'l bilan yuqadigan kasalliklar" },
      { id: "102", name: "OIV ekspress", price: 7e4, category: "Jinsiy yo'l bilan yuqadigan kasalliklar" },
      // Zoonoz infeksiyalar
      { id: "103", name: "Brutsellyoz", price: 8e4, category: "Zoonoz infeksiyalar" },
      // Pulmanologiya
      { id: "104", name: "Tuberkulyoz", price: 9e4, category: "Pulmanologiya" },
      // n-COV-19
      { id: "105", name: "n-COV-19 Ag-surtma", price: 6e4, category: "COVID-19" },
      { id: "106", name: "n-COV-19 IgM-IgG-qonda", price: 6e4, category: "COVID-19" },
      // Kardiologiya
      { id: "107", name: "Troponin", price: 5e4, category: "Kardiologiya" },
      // PTsR
      { id: "108", name: "Gepatit-B sifatiy", price: 22e4, category: "PTsR" },
      { id: "109", name: "Gepatit-B miqdoriy", price: 22e4, category: "PTsR" },
      { id: "110", name: "Gepatit-S sifatiy", price: 22e4, category: "PTsR" },
      { id: "111", name: "Gepatit-S miqdoriy", price: 28e4, category: "PTsR" },
      { id: "112", name: "Gepatit-S Genotip", price: 27e4, category: "PTsR" },
      { id: "113", name: "Gepatit-D miqdoriy", price: 27e4, category: "PTsR" },
      // IXLA
      { id: "114", name: "T3 (IXLA)", price: 8e4, category: "IXLA" },
      { id: "115", name: "T4 (IXLA)", price: 8e4, category: "IXLA" },
      { id: "116", name: "FT3 (IXLA)", price: 8e4, category: "IXLA" },
      { id: "117", name: "FT4 (IXLA)", price: 8e4, category: "IXLA" },
      { id: "118", name: "TTG (IXLA)", price: 8e4, category: "IXLA" },
      { id: "119", name: "At-TPO (IXLA)", price: 8e4, category: "IXLA" }
    ];
    testReferences = {
      "3": { unit: "g/l", referenceRange: "Erkak: 130-170, Ayol: 120-150" },
      "4": { unit: "mm/soat", referenceRange: "Erkak: 2-10, Ayol: 2-15" },
      "5": { unit: "daqiqa", referenceRange: "5-10" },
      "15": { unit: "g/l", referenceRange: "64-83" },
      "16": { unit: "g/l", referenceRange: "35-52" },
      "17": { unit: "U/l", referenceRange: "< 41" },
      "18": { unit: "U/l", referenceRange: "< 40" },
      "19": { unit: "mkmol/l", referenceRange: "Umumiy: 3.4-20.5" },
      "20": { unit: "U/l", referenceRange: "40-150" },
      "21": { unit: "U/l", referenceRange: "28-100" },
      "22": { unit: "mmol/l", referenceRange: "3.9-6.1" },
      "23": { unit: "mmol/l", referenceRange: "2.5-8.3" },
      "24": { unit: "mkmol/l", referenceRange: "Erkak: 62-106, Ayol: 44-80" },
      "25": { unit: "U/l", referenceRange: "< 25" },
      "26": { unit: "mmol/l", referenceRange: "< 5.2" },
      "27": { unit: "mmol/l", referenceRange: "< 1.7" },
      "28": { unit: "mmol/l", referenceRange: "Erkak: > 1.0, Ayol: > 1.2" },
      "29": { unit: "mmol/l", referenceRange: "< 3.0" },
      "30": { unit: "mkmol/l", referenceRange: "Erkak: 202-416, Ayol: 143-339" },
      "32": { unit: "mmol/l", referenceRange: "3.5-5.1" },
      "33": { unit: "mmol/l", referenceRange: "2.15-2.55" },
      "34": { unit: "mmol/l", referenceRange: "98-107" },
      "35": { unit: "mmol/l", referenceRange: "136-145" },
      "36": { unit: "mmol/l", referenceRange: "0.66-1.07" },
      "37": { unit: "U/l", referenceRange: "125-220" },
      "38": { unit: "mkmol/l", referenceRange: "Erkak: 11-28, Ayol: 7-26" },
      "39": { referenceRange: "Manfiy" },
      "40": { referenceRange: "Manfiy" },
      "41": { referenceRange: "Manfiy" },
      "42": { unit: "ME/ml", referenceRange: "< 14" },
      "43": { unit: "ME/ml", referenceRange: "< 200" },
      "44": { unit: "%", referenceRange: "4.0-6.0" },
      "45": { unit: "%", referenceRange: "70-130" },
      "46": { unit: "sek", referenceRange: "25-35" },
      "47": { unit: "g/l", referenceRange: "2.0-4.0" },
      "49": { unit: "nmol/l", referenceRange: "1.3-2.7" },
      "50": { unit: "nmol/l", referenceRange: "66-181" },
      "51": { unit: "mkME/ml", referenceRange: "0.4-4.0" },
      "52": { unit: "pmol/l", referenceRange: "3.1-6.8" },
      "53": { unit: "pmol/l", referenceRange: "12-22" },
      "54": { unit: "ME/ml", referenceRange: "< 34" },
      "55": { unit: "ME/ml", referenceRange: "< 115" },
      "58": { unit: "ng/ml", referenceRange: "Erkak: 2.6-13.1, Ayol: 3.3-26.7" },
      "60": { unit: "mME/ml", referenceRange: "Homilador emas: < 5" },
      "62": { unit: "nmol/l", referenceRange: "Erkak: 8.6-29, Ayol: 0.3-2.4" },
      "66": { unit: "nmol/l", referenceRange: "Ertalab: 171-536" },
      "67": { unit: "mkME/ml", referenceRange: "2.6-24.9" },
      "70": { referenceRange: "Manfiy" },
      "71": { referenceRange: "Manfiy" },
      "84": { unit: "U/ml", referenceRange: "< 35" },
      "85": { unit: "U/ml", referenceRange: "< 31.3" },
      "86": { unit: "U/ml", referenceRange: "< 37" },
      "87": { unit: "ng/ml", referenceRange: "< 5" },
      "88": { unit: "ME/ml", referenceRange: "< 10" },
      "89": { unit: "ng/ml", referenceRange: "< 4.0" },
      "90": { unit: "mg/l", referenceRange: "< 5" },
      "91": { unit: "ng/ml", referenceRange: "< 0.5" },
      "92": { unit: "pg/ml", referenceRange: "< 7" },
      "93": { unit: "ng/ml", referenceRange: "Erkak: 30-400, Ayol: 13-150" },
      "96": { unit: "ng/ml", referenceRange: "< 500" },
      "97": { unit: "ng/ml", referenceRange: "30-100" },
      "98": { referenceRange: "Manfiy" },
      "99": { referenceRange: "Manfiy" },
      "101": { referenceRange: "Manfiy" },
      "102": { referenceRange: "Manfiy" },
      "103": { referenceRange: "Manfiy" },
      "104": { referenceRange: "Manfiy" },
      "105": { referenceRange: "Manfiy" },
      "106": { referenceRange: "Manfiy" },
      "107": { unit: "ng/ml", referenceRange: "< 0.04" },
      "114": { unit: "nmol/l", referenceRange: "1.3-2.7" },
      "115": { unit: "nmol/l", referenceRange: "66-181" },
      "116": { unit: "pmol/l", referenceRange: "3.1-6.8" },
      "117": { unit: "pmol/l", referenceRange: "12-22" },
      "118": { unit: "mkME/ml", referenceRange: "0.4-4.0" },
      "119": { unit: "ME/ml", referenceRange: "< 34" },
      // --- Ko'p ko'rsatkichli panellar -------------------------------------
      // Bitta son emas, blankaga bir nechta ko'rsatkich yoziladi. Soxta yagona
      // oraliq berishdan ko'ra, tabiatini ochiq yozgan to'g'riroq.
      "1": { referenceRange: "Ko'rsatkichlar bo'yicha" },
      "2": { referenceRange: "Ko'rsatkichlar bo'yicha" },
      "6": { referenceRange: "Ko'rsatkichlar bo'yicha" },
      "12": { referenceRange: "Ko'rsatkichlar bo'yicha" },
      // --- Umumiy klinika ---------------------------------------------------
      "7": { unit: "1 ml", referenceRange: "Leyk. < 2000, Erit. < 1000" },
      "8": { referenceRange: "Manfiy" },
      "9": { referenceRange: "Manfiy" },
      "10": { referenceRange: "Manfiy" },
      "11": { unit: "g/l", referenceRange: "< 0.033" },
      // --- Kaprologiya ------------------------------------------------------
      "13": { referenceRange: "Topilmadi" },
      "14": { referenceRange: "Manfiy" },
      // --- Biokimyo / koagulogramma ----------------------------------------
      "31": { unit: "mmol/sut", referenceRange: "1.48-4.43" },
      "48": { referenceRange: "IV-V daraja" },
      // --- Reproduktiv gormonlar -------------------------------------------
      // Ayol qiymatlari sikl fazasiga bog'liq; bu yerda eng ko'p ishlatiladigan
      // follikulyar/lyuteal faza berilgan, laborant zarur bo'lsa tuzatadi.
      "56": { unit: "mME/ml", referenceRange: "Erkak: 1.5-12.4, Ayol: 3.5-12.5" },
      "57": { unit: "mME/ml", referenceRange: "Erkak: 1.7-8.6, Ayol: 2.4-12.6" },
      "59": { unit: "pg/ml", referenceRange: "Erkak: 7.6-42.6, Ayol: 12.5-166" },
      "61": { unit: "ng/ml", referenceRange: "1.0-10.6" },
      "63": { unit: "pg/ml", referenceRange: "Erkak: 8.8-27.0, Ayol: 0.29-3.18" },
      "64": { unit: "ng/ml", referenceRange: "Erkak: 0.2-1.4, Ayol: 1.7-27.0" },
      "68": { unit: "ng/ml", referenceRange: "1.1-4.4" },
      // --- Immunologiya -----------------------------------------------------
      "65": { unit: "ME/ml", referenceRange: "< 100" },
      "94": { unit: "ME/ml", referenceRange: "< 17" },
      "95": { referenceRange: "Manfiy (< 1:80)" },
      // --- Serologiya: sifatiy testlar --------------------------------------
      "69": { referenceRange: "Manfiy" },
      "72": { referenceRange: "Manfiy" },
      "73": { referenceRange: "Manfiy" },
      "74": { referenceRange: "Manfiy" },
      "75": { referenceRange: "Manfiy" },
      "76": { referenceRange: "Manfiy" },
      "77": { referenceRange: "Manfiy" },
      "78": { referenceRange: "Manfiy" },
      "79": { referenceRange: "Manfiy" },
      "80": { referenceRange: "Manfiy" },
      "81": { referenceRange: "Manfiy" },
      "82": { referenceRange: "Manfiy" },
      "83": { referenceRange: "Manfiy" },
      "100": { referenceRange: "Manfiy" },
      // --- PTsR -------------------------------------------------------------
      "108": { referenceRange: "Aniqlanmadi" },
      "110": { referenceRange: "Aniqlanmadi" },
      "112": { referenceRange: "Aniqlanmadi" },
      "109": { unit: "ME/ml", referenceRange: "Aniqlanmadi" },
      "111": { unit: "ME/ml", referenceRange: "Aniqlanmadi" },
      "113": { unit: "ME/ml", referenceRange: "Aniqlanmadi" }
    };
  }
});

// shared/sample.ts
function sampleBarcode(orderNumber) {
  return `${BARCODE_PREFIX}-${orderNumber}`;
}
function parseBarcode(value) {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return null;
  const match = raw.match(new RegExp(`^(?:${BARCODE_PREFIX}[-\\s]?)?(\\d{1,9})$`));
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
function transitionError(from, to) {
  if (from === to) return `Namuna allaqachon "${SAMPLE_STATUS_LABELS[to]}" holatida`;
  if (from === "rad_etildi") return "Rad etilgan namunani qayta ochib bo'lmaydi";
  return `"${SAMPLE_STATUS_LABELS[from]}" holatidan "${SAMPLE_STATUS_LABELS[to]}" holatiga o'tib bo'lmaydi`;
}
var BARCODE_PREFIX, TRANSITIONS;
var init_sample = __esm({
  "shared/sample.ts"() {
    "use strict";
    init_schema();
    BARCODE_PREFIX = "LAB";
    TRANSITIONS = {
      kutilmoqda: ["olindi", "rad_etildi"],
      olindi: ["qabul_qilindi", "kutilmoqda", "rad_etildi"],
      qabul_qilindi: ["olindi", "rad_etildi"],
      // Terminal: the tube is physically gone. A new draw is a new sample.
      rad_etildi: []
    };
  }
});

// server/db-pg.ts
var db_pg_exports = {};
__export(db_pg_exports, {
  db: () => db,
  pool: () => pool
});
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
var pool, db;
var init_db_pg = __esm({
  "server/db-pg.ts"() {
    "use strict";
    init_schema();
    neonConfig.webSocketConstructor = ws;
    neonConfig.poolQueryViaFetch = true;
    neonConfig.useSecureWebSocket = true;
    neonConfig.pipelineConnect = false;
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL topilmadi \u2014 .env faylini tekshiring");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 1e4,
      // 10 soniya
      idleTimeoutMillis: 3e4,
      // 30 soniya
      max: 10,
      // maksimal connection soni
      // Query timeout - agar so'rov juda uzoq davom etsa, bekor qiladi
      query_timeout: 3e4,
      // 30 soniya
      // Statement timeout - har bir SQL statement uchun
      statement_timeout: 3e4
      // 30 soniya
    });
    pool.on("error", (err) => {
      console.error("[db] pool xatosi (so'rov qayta uriniladi):", err.message);
    });
    db = drizzle(pool, { schema: schema_exports });
  }
});

// server/storage-pg.ts
var storage_pg_exports = {};
__export(storage_pg_exports, {
  PgStorage: () => PgStorage,
  isMissingTable: () => isMissingTable
});
import { and, asc, desc, eq, gte, inArray, lte, or, sql as sql2 } from "drizzle-orm";
function isMissingTable(err) {
  return err?.code === "42P01";
}
var iso, mapUser, mapPatient, mapOrder, mapItem, mapSample, strip, dayExpr, mapRole, mapDepartment, doctorSelect, mapDoctor, PgStorage;
var init_storage_pg = __esm({
  "server/storage-pg.ts"() {
    "use strict";
    init_tests_data();
    init_schema();
    init_sample();
    init_db_pg();
    init_password();
    init_permissions();
    init_storage_types();
    iso = (value) => value ? new Date(value).toISOString() : value;
    mapUser = (row) => ({ ...row, createdAt: iso(row.createdAt) });
    mapPatient = (row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      telegramLinkedAt: iso(row.telegramLinkedAt)
    });
    mapOrder = (row) => ({
      ...row,
      status: row.status,
      createdAt: iso(row.createdAt),
      completedAt: iso(row.completedAt),
      telegramSentAt: iso(row.telegramSentAt)
    });
    mapItem = (row) => ({
      ...row,
      flag: row.flag,
      completedAt: iso(row.completedAt)
    });
    mapSample = (row) => ({
      ...row,
      status: row.status,
      createdAt: iso(row.createdAt),
      collectedAt: iso(row.collectedAt),
      receivedAt: iso(row.receivedAt),
      rejectedAt: iso(row.rejectedAt)
    });
    strip = (user) => {
      const { password: _password, ...pub } = mapUser(user);
      return pub;
    };
    dayExpr = sql2`(${orders.createdAt} AT TIME ZONE current_setting('TIMEZONE'))::date`;
    mapRole = (row) => ({
      ...row,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt),
      permissions: (row.permissions ?? []).filter(isPermission)
    });
    mapDepartment = (row) => ({
      ...row,
      kind: row.kind,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt)
    });
    doctorSelect = () => db.select({
      doctor: doctors,
      fullName: users.fullName,
      username: users.username,
      userActive: users.isActive,
      departmentName: departments.name
    }).from(doctors).leftJoin(users, eq(users.id, doctors.userId)).leftJoin(departments, eq(departments.id, doctors.departmentId));
    mapDoctor = (row) => ({
      ...row.doctor,
      schedule: row.doctor.schedule ?? [],
      createdAt: iso(row.doctor.createdAt) ?? row.doctor.createdAt,
      updatedAt: iso(row.doctor.updatedAt),
      fullName: row.fullName ?? "\u2014",
      username: row.username ?? "",
      userActive: row.userActive ?? false,
      departmentName: row.departmentName ?? null
    });
    PgStorage = class {
      async seed() {
        let createdTests = 0;
        const [{ count: testCount }] = await db.select({ count: sql2`count(*)::int` }).from(tests);
        if (testCount === 0) {
          const rows = defaultTests.map((t) => {
            const ref = testReferences[t.id];
            return {
              id: t.id,
              name: t.name,
              price: t.price,
              category: t.category,
              unit: ref?.unit ?? null,
              referenceRange: ref?.referenceRange ?? null,
              isActive: true
            };
          });
          await db.insert(tests).values(rows);
          createdTests = rows.length;
        }
        let createdUsers = 0;
        const [{ count: userCount }] = await db.select({ count: sql2`count(*)::int` }).from(users);
        if (userCount === 0) {
          for (const u of SEED_USERS) {
            await db.insert(users).values({
              username: u.username,
              password: await hashPassword(u.password),
              fullName: u.fullName,
              role: u.role,
              isActive: true
            });
          }
          createdUsers = SEED_USERS.length;
        }
        const existing = await db.select().from(labSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(labSettings).values(DEFAULT_SETTINGS);
        }
        const migrated = await db.update(users).set({ role: SUPER_ADMIN }).where(eq(users.role, LEGACY_ADMIN)).returning({ id: users.id });
        let createdRoles = 0;
        try {
          const inserted = await db.insert(roles).values(
            SYSTEM_ROLES.map((r) => ({
              key: r.key,
              name: r.name,
              description: r.description,
              permissions: [...r.permissions],
              isSystem: true
            }))
          ).onConflictDoNothing({ target: roles.key }).returning({ key: roles.key });
          createdRoles = inserted.length;
        } catch (err) {
          if (!isMissingTable(err)) throw err;
          console.warn(
            "[rbac] 'roles' jadvali topilmadi \u2014 standart rollar ishlatiladi. Jadvalni yaratish uchun: npm run db:roles"
          );
        }
        return { createdTests, createdUsers, createdRoles, migratedAdmins: migrated.length };
      }
      // ---------------------------------------------------------------- roles
      async listRoles() {
        const rows = await db.select({
          role: roles,
          userCount: sql2`(SELECT count(*)::int FROM ${users} WHERE ${users.role} = ${roles.key})`
        }).from(roles);
        return sortRoles(rows.map((r) => ({ ...mapRole(r.role), userCount: r.userCount })));
      }
      async getRole(key) {
        const [row] = await db.select().from(roles).where(eq(roles.key, key)).limit(1);
        return row && mapRole(row);
      }
      async createRole(input, actor) {
        const [row] = await db.insert(roles).values({
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          permissions: [...input.permissions],
          isSystem: input.isSystem ?? false,
          updatedBy: actor.id
        }).returning();
        return mapRole(row);
      }
      async updateRole(key, input, actor) {
        const patch = {
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        };
        if (input.name !== void 0) patch.name = input.name;
        if (input.description !== void 0) patch.description = input.description ?? null;
        if (input.permissions !== void 0) patch.permissions = [...input.permissions];
        const [row] = await db.update(roles).set(patch).where(eq(roles.key, key)).returning();
        return row && mapRole(row);
      }
      async deleteRole(key) {
        const rows = await db.delete(roles).where(and(eq(roles.key, key), eq(roles.isSystem, false))).returning({ key: roles.key });
        return rows.length > 0;
      }
      // ---------------------------------------------------------- departments
      async listDepartments() {
        const rows = await db.select({
          dept: departments,
          doctorCount: sql2`(SELECT count(*)::int FROM ${doctors} WHERE ${doctors.departmentId} = ${departments.id})`
        }).from(departments).orderBy(desc(departments.isActive), asc(departments.name));
        return rows.map((r) => ({ ...mapDepartment(r.dept), doctorCount: r.doctorCount }));
      }
      async getDepartment(id) {
        const [row] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
        return row && mapDepartment(row);
      }
      async createDepartment(input, actor) {
        const [row] = await db.insert(departments).values({
          name: input.name,
          kind: input.kind,
          description: input.description ?? null,
          isActive: input.isActive ?? true,
          updatedBy: actor.id
        }).returning();
        return mapDepartment(row);
      }
      async updateDepartment(id, input, actor) {
        const patch = {
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        };
        if (input.name !== void 0) patch.name = input.name;
        if (input.kind !== void 0) patch.kind = input.kind;
        if (input.description !== void 0) patch.description = input.description ?? null;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        const [row] = await db.update(departments).set(patch).where(eq(departments.id, id)).returning();
        return row && mapDepartment(row);
      }
      async deleteDepartment(id) {
        const rows = await db.delete(departments).where(eq(departments.id, id)).returning({ id: departments.id });
        return rows.length > 0;
      }
      // -------------------------------------------------------------- doctors
      async listDoctors(opts = {}) {
        const where = [];
        if (opts.activeOnly) where.push(eq(doctors.isActive, true), eq(users.isActive, true));
        if (opts.departmentId) where.push(eq(doctors.departmentId, opts.departmentId));
        const rows = await doctorSelect().where(where.length ? and(...where) : void 0).orderBy(desc(doctors.isActive), asc(users.fullName));
        return rows.map(mapDoctor);
      }
      async getDoctor(id) {
        const [row] = await doctorSelect().where(eq(doctors.id, id)).limit(1);
        return row && mapDoctor(row);
      }
      async getDoctorByUser(userId) {
        const [row] = await doctorSelect().where(eq(doctors.userId, userId)).limit(1);
        return row && mapDoctor(row);
      }
      async createDoctor(input, actor) {
        const [row] = await db.insert(doctors).values({
          userId: input.userId,
          departmentId: input.departmentId ?? null,
          specialty: input.specialty,
          room: input.room ?? null,
          consultationPrice: input.consultationPrice,
          slotMinutes: input.slotMinutes,
          schedule: input.schedule,
          isActive: input.isActive ?? true,
          updatedBy: actor.id
        }).returning({ id: doctors.id });
        return await this.getDoctor(row.id);
      }
      async updateDoctor(id, input, actor) {
        const patch = {
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        };
        if (input.departmentId !== void 0) patch.departmentId = input.departmentId ?? null;
        if (input.specialty !== void 0) patch.specialty = input.specialty;
        if (input.room !== void 0) patch.room = input.room ?? null;
        if (input.consultationPrice !== void 0) patch.consultationPrice = input.consultationPrice;
        if (input.slotMinutes !== void 0) patch.slotMinutes = input.slotMinutes;
        if (input.schedule !== void 0) patch.schedule = input.schedule;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        const rows = await db.update(doctors).set(patch).where(eq(doctors.id, id)).returning({ id: doctors.id });
        return rows.length ? this.getDoctor(id) : void 0;
      }
      async deleteDoctor(id) {
        const rows = await db.delete(doctors).where(eq(doctors.id, id)).returning({ id: doctors.id });
        return rows.length > 0;
      }
      // ---------------------------------------------------------------- users
      async listUsers() {
        const rows = await db.select().from(users).orderBy(asc(users.fullName));
        return rows.map(strip);
      }
      async getUser(id) {
        const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        return row && mapUser(row);
      }
      async getUserByUsername(username) {
        const [row] = await db.select().from(users).where(sql2`lower(${users.username}) = lower(${username})`).limit(1);
        return row && mapUser(row);
      }
      async createUser(input) {
        const [row] = await db.insert(users).values({
          username: input.username,
          password: await hashPassword(input.password),
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive ?? true
        }).returning();
        return strip(row);
      }
      async updateUser(id, input) {
        const patch = {};
        if (input.username) patch.username = input.username;
        if (input.fullName) patch.fullName = input.fullName;
        if (input.role) patch.role = input.role;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        if (input.password) patch.password = await hashPassword(input.password);
        if (Object.keys(patch).length === 0) {
          const current = await this.getUser(id);
          return current ? strip(current) : void 0;
        }
        const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
        return row ? strip(row) : void 0;
      }
      async deleteUser(id) {
        const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
        return rows.length > 0;
      }
      async setLockState(userId, state) {
        await db.update(users).set({
          failedAttempts: state.failedAttempts,
          lockedUntil: state.lockedUntil,
          lockLevel: state.lockLevel,
          // Stamped on every write so an admin can see when the trouble started.
          lastFailedAt: state.failedAttempts > 0 || state.lockedUntil ? (/* @__PURE__ */ new Date()).toISOString() : null
        }).where(eq(users.id, userId));
      }
      // ------------------------------------------------------------- patients
      async listPatients(query = {}) {
        const search = query.search?.trim();
        let where;
        if (search) {
          const like = "%" + search + "%";
          const parts = [
            sql2`${patients.fullName} ILIKE ${like}`,
            sql2`${patients.phone} ILIKE ${like}`,
            sql2`coalesce(${patients.address}, '') ILIKE ${like}`
          ];
          const digits = search.replace(/\D/g, "");
          if (digits.length >= 3) {
            parts.push(sql2`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}`);
          }
          const numberMatch = search.match(/^#?\s*(\d{1,9})$/);
          if (numberMatch) parts.push(eq(patients.patientNumber, Number(numberMatch[1])));
          where = or(...parts);
        }
        let q = db.select().from(patients).where(where).orderBy(desc(patients.createdAt), desc(patients.patientNumber)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const [rows, [{ count }]] = await Promise.all([
          q,
          db.select({ count: sql2`count(*)::int` }).from(patients).where(where)
        ]);
        return { items: rows.map(mapPatient), total: count };
      }
      async getPatient(id) {
        const [row] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
        return row && mapPatient(row);
      }
      async getPatientByPhone(phone) {
        const digits = nationalPhoneDigits(phone);
        if (digits.length !== 9) return void 0;
        const [row] = await db.select().from(patients).where(sql2`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits}`).orderBy(desc(patients.createdAt)).limit(1);
        return row && mapPatient(row);
      }
      async getPatientByChatId(chatId) {
        const [row] = await db.select().from(patients).where(eq(patients.telegramChatId, chatId)).limit(1);
        return row && mapPatient(row);
      }
      async createPatient(input) {
        const [row] = await db.insert(patients).values({
          fullName: input.fullName,
          phone: input.phone,
          address: input.address ?? null,
          age: input.age ?? null,
          gender: input.gender ?? null
        }).returning();
        return mapPatient(row);
      }
      async updatePatient(id, input) {
        const patch = {};
        if (input.fullName !== void 0) patch.fullName = input.fullName;
        if (input.phone !== void 0) patch.phone = input.phone;
        if (input.address !== void 0) patch.address = input.address ?? null;
        if (input.age !== void 0) patch.age = input.age ?? null;
        if (input.gender !== void 0) patch.gender = input.gender ?? null;
        if (Object.keys(patch).length === 0) return this.getPatient(id);
        const [row] = await db.update(patients).set(patch).where(eq(patients.id, id)).returning();
        return row && mapPatient(row);
      }
      async deletePatient(id) {
        const [{ count }] = await db.select({ count: sql2`count(*)::int` }).from(orders).where(eq(orders.patientId, id));
        if (count > 0) {
          throw new Error("Bu bemorda buyurtmalar mavjud \u2014 avval buyurtmalarni o'chiring");
        }
        const rows = await db.delete(patients).where(eq(patients.id, id)).returning({ id: patients.id });
        return rows.length > 0;
      }
      // ---------------------------------------------------------------- tests
      async listTests(opts = {}) {
        return db.select().from(tests).where(opts.activeOnly ? eq(tests.isActive, true) : void 0).orderBy(asc(tests.category), asc(tests.name));
      }
      async getTest(id) {
        const [row] = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
        return row;
      }
      async createTest(input) {
        const [row] = await db.insert(tests).values({
          name: input.name,
          price: input.price,
          category: input.category,
          unit: input.unit ?? null,
          referenceRange: input.referenceRange ?? null,
          isActive: input.isActive ?? true
        }).returning();
        return row;
      }
      async updateTest(id, input) {
        const patch = {};
        if (input.name !== void 0) patch.name = input.name;
        if (input.price !== void 0) patch.price = input.price;
        if (input.category !== void 0) patch.category = input.category;
        if (input.unit !== void 0) patch.unit = input.unit ?? null;
        if (input.referenceRange !== void 0) patch.referenceRange = input.referenceRange ?? null;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        if (Object.keys(patch).length === 0) return this.getTest(id);
        const [row] = await db.update(tests).set(patch).where(eq(tests.id, id)).returning();
        return row;
      }
      async deleteTest(id) {
        const rows = await db.delete(tests).where(eq(tests.id, id)).returning({ id: tests.id });
        return rows.length > 0;
      }
      // --------------------------------------------------------------- orders
      /** Attaches patient + line items + sample to a set of orders in three extra queries. */
      async hydrate(rows) {
        if (rows.length === 0) return [];
        const orderIds = rows.map((o) => o.id);
        const patientIds = Array.from(new Set(rows.map((o) => o.patientId)));
        const [items, people, tubes] = await Promise.all([
          db.select().from(orderTests).where(inArray(orderTests.orderId, orderIds)),
          db.select().from(patients).where(inArray(patients.id, patientIds)),
          db.select().from(samples).where(inArray(samples.orderId, orderIds))
        ]);
        const byPatient = new Map(people.map((p) => [p.id, mapPatient(p)]));
        const bySample = new Map(tubes.map((s) => [s.orderId, mapSample(s)]));
        const byOrder = /* @__PURE__ */ new Map();
        for (const item of items) {
          const list = byOrder.get(item.orderId) ?? [];
          list.push(mapItem(item));
          byOrder.set(item.orderId, list);
        }
        return rows.map((row) => ({
          ...mapOrder(row),
          patient: byPatient.get(row.patientId) ?? null,
          items: byOrder.get(row.id) ?? [],
          // Null for orders created before sample tracking existed.
          sample: bySample.get(row.id) ?? null
        }));
      }
      async listOrders(query = {}) {
        const base = [];
        if (query.patientId) base.push(eq(orders.patientId, query.patientId));
        if (query.from) base.push(gte(dayExpr, sql2`${query.from}::date`));
        if (query.to) base.push(lte(dayExpr, sql2`${query.to}::date`));
        const search = query.search?.trim();
        if (search) {
          const like = "%" + search + "%";
          const digits = search.replace(/\D/g, "");
          const phoneDigits = digits.length >= 3 ? sql2` OR regexp_replace(p.phone, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}` : sql2``;
          base.push(sql2`(
        EXISTS (SELECT 1 FROM ${patients} p
                WHERE p.id = ${orders.patientId}
                  AND (p.full_name ILIKE ${like} OR p.phone ILIKE ${like}${phoneDigits}))
        OR ${orders.orderNumber}::text ILIKE ${like}
        OR EXISTS (SELECT 1 FROM ${orderTests} ot
                   WHERE ot.order_id = ${orders.id} AND ot.test_name ILIKE ${like})
      )`);
        }
        const baseWhere = base.length ? and(...base) : void 0;
        const notCancelled = sql2`${orders.status} <> 'cancelled'`;
        const hasItems = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot WHERE ot.order_id = ${orders.id})`;
        const hasBlank = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot
                                 WHERE ot.order_id = ${orders.id}
                                   AND (ot.result IS NULL OR ot.result = ''))`;
        const readyExpr = sql2`(${hasItems} AND NOT ${hasBlank})`;
        const conditions = [...base];
        if (query.status) conditions.push(eq(orders.status, query.status));
        if (query.queue) {
          conditions.push(notCancelled);
          conditions.push(query.queue === "waiting" ? hasBlank : readyExpr);
        }
        const where = conditions.length ? and(...conditions) : void 0;
        let q = db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const liveBase = baseWhere ? and(baseWhere, notCancelled) : notCancelled;
        const billable = where ? and(where, notCancelled) : notCancelled;
        const [rows, statusRows, [queueRow], [totalsRow], [{ count }]] = await Promise.all([
          q,
          db.select({ status: orders.status, count: sql2`count(*)::int` }).from(orders).where(baseWhere).groupBy(orders.status),
          db.select({
            waiting: sql2`count(*) FILTER (WHERE ${hasBlank})::int`,
            ready: sql2`count(*) FILTER (WHERE ${readyExpr})::int`
          }).from(orders).where(liveBase),
          db.select({
            sum: sql2`coalesce(sum(${orders.totalAmount}), 0)::int`,
            paid: sql2`coalesce(sum(${orders.paidAmount}), 0)::int`
          }).from(orders).where(billable),
          db.select({ count: sql2`count(*)::int` }).from(orders).where(where)
        ]);
        const counts = { all: 0, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
        for (const row of statusRows) {
          counts.all += row.count;
          if (row.status in counts) counts[row.status] = row.count;
        }
        const sum = totalsRow?.sum ?? 0;
        const paid = totalsRow?.paid ?? 0;
        return {
          items: await this.hydrate(rows),
          total: count,
          summary: {
            counts,
            results: { waiting: queueRow?.waiting ?? 0, ready: queueRow?.ready ?? 0 },
            totals: { sum, paid, debt: Math.max(0, sum - paid) }
          }
        };
      }
      async getOrder(id) {
        const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        const [hydrated] = await this.hydrate(rows);
        if (!hydrated) return void 0;
        hydrated.payments = await this.listPayments(id);
        return hydrated;
      }
      async listPayments(orderId) {
        const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
        return rows.map((r) => ({
          ...r,
          method: r.method,
          createdAt: iso(r.createdAt)
        }));
      }
      /**
       * orders.paidAmount is a cache of the ledger. Recomputing it from the rows
       * after every change is what keeps the two from drifting — incrementing it in
       * place silently loses a payment whenever a write fails halfway.
       */
      async syncPaid(tx, orderId) {
        await tx.update(orders).set({
          paidAmount: sql2`greatest(0, (SELECT coalesce(sum(amount), 0)::int FROM ${payments} WHERE order_id = ${orderId}))`
        }).where(eq(orders.id, orderId));
      }
      async createOrder(input) {
        const patient = await this.getPatient(input.patientId);
        if (!patient) throw new Error("Bemor topilmadi");
        const selected = await db.select().from(tests).where(inArray(tests.id, input.testIds));
        if (selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");
        const subtotal = selected.reduce((sum, t) => sum + t.price, 0);
        const discount = Math.min(input.discount, subtotal);
        const total = subtotal - discount;
        const opening = Math.min(input.paidAmount, total);
        const orderId = await db.transaction(async (tx) => {
          const [order] = await tx.insert(orders).values({
            patientId: input.patientId,
            totalAmount: total,
            discount,
            paidAmount: opening,
            status: "pending",
            notes: input.notes ?? null,
            referrer: input.referrer ?? null,
            createdBy: input.createdBy ?? null
          }).returning({ id: orders.id, orderNumber: orders.orderNumber });
          await tx.insert(orderTests).values(
            selected.map((t) => ({
              orderId: order.id,
              testId: t.id,
              testName: t.name,
              price: t.price,
              unit: t.unit,
              referenceRange: t.referenceRange
            }))
          );
          await tx.insert(samples).values({
            orderId: order.id,
            barcode: sampleBarcode(order.orderNumber),
            status: "kutilmoqda"
          });
          if (opening > 0) {
            const [staff] = input.createdBy ? await tx.select({ fullName: users.fullName }).from(users).where(eq(users.id, input.createdBy)).limit(1) : [];
            await tx.insert(payments).values({
              orderId: order.id,
              amount: opening,
              method: "naqd",
              createdBy: input.createdBy ?? null,
              createdByName: staff?.fullName ?? "\u2014"
            });
          }
          return order.id;
        });
        return await this.getOrder(orderId);
      }
      async updateOrder(id, input) {
        const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (!current) return void 0;
        if (input.testIds) await this.replaceOrderTests(id, input.testIds);
        const patch = {};
        if (input.discount !== void 0 || input.testIds) {
          const [{ subtotal }] = await db.select({ subtotal: sql2`coalesce(sum(${orderTests.price}), 0)::int` }).from(orderTests).where(eq(orderTests.orderId, id));
          patch.discount = Math.min(input.discount ?? current.discount, subtotal);
          patch.totalAmount = subtotal - patch.discount;
        }
        if (input.notes !== void 0) patch.notes = input.notes ?? null;
        if (input.referrer !== void 0) patch.referrer = input.referrer ?? null;
        if (input.status) {
          patch.status = input.status;
          patch.completedAt = input.status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null;
        }
        if (Object.keys(patch).length > 0) {
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
      async replaceOrderTests(orderId, testIds) {
        const current = await db.select().from(orderTests).where(eq(orderTests.orderId, orderId));
        const wanted = new Set(testIds);
        const drop = current.filter((i) => !wanted.has(i.testId) && !i.result).map((i) => i.id);
        const present = new Set(current.filter((i) => !drop.includes(i.id)).map((i) => i.testId));
        const addIds = testIds.filter((t) => !present.has(t));
        const toAdd = addIds.length ? await db.select().from(tests).where(inArray(tests.id, addIds)) : [];
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
                referenceRange: t.referenceRange
              }))
            );
          }
        });
      }
      async saveResults(id, results, actor) {
        const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        if (!current) return void 0;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [patient] = await db.select({ gender: patients.gender }).from(patients).where(eq(patients.id, current.patientId)).limit(1);
        const lines = await db.select({ id: orderTests.id, referenceRange: orderTests.referenceRange }).from(orderTests).where(eq(orderTests.orderId, id));
        const rangeById = new Map(lines.map((l) => [l.id, l.referenceRange]));
        await db.transaction(async (tx) => {
          for (const incoming of results) {
            const value = incoming.result?.trim() || null;
            const flag = resolveFlag(
              incoming,
              { referenceRange: rangeById.get(incoming.id) ?? null },
              patient?.gender
            );
            await tx.update(orderTests).set({
              result: value,
              flag,
              notes: incoming.notes?.trim() || null,
              completedAt: value ? now : null,
              ...value && actor ? { enteredBy: actor.name } : {}
            }).where(and(eq(orderTests.id, incoming.id), eq(orderTests.orderId, id)));
          }
          if (current.status !== "cancelled") {
            const [{ total, filled }] = await tx.select({
              total: sql2`count(*)::int`,
              filled: sql2`count(${orderTests.result})::int`
            }).from(orderTests).where(eq(orderTests.orderId, id));
            const status = total > 0 && filled === total ? "completed" : filled > 0 ? "in_progress" : "pending";
            await tx.update(orders).set({ status, completedAt: status === "completed" ? now : null }).where(eq(orders.id, id));
          }
        });
        return this.getOrder(id);
      }
      async deleteOrder(id) {
        return db.transaction(async (tx) => {
          await tx.delete(orderTests).where(eq(orderTests.orderId, id));
          await tx.delete(payments).where(eq(payments.orderId, id));
          await tx.delete(samples).where(eq(samples.orderId, id));
          const rows = await tx.delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
          return rows.length > 0;
        });
      }
      // -------------------------------------------------------------- samples
      async getOrderByBarcode(barcode) {
        const orderNumber = parseBarcode(barcode);
        if (orderNumber === null) return void 0;
        const [row] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
        return row ? this.getOrder(row.id) : void 0;
      }
      async updateSampleStatus(orderId, input, actor) {
        const [current] = await db.select().from(samples).where(eq(samples.orderId, orderId)).limit(1);
        if (!current) return void 0;
        const from = current.status;
        if (!canTransition(from, input.status)) return { error: transitionError(from, input.status) };
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const patch = { status: input.status };
        switch (input.status) {
          case "olindi":
            patch.collectedAt = now;
            patch.collectedBy = actor.id;
            patch.collectedByName = actor.name;
            patch.receivedAt = null;
            patch.receivedBy = null;
            patch.receivedByName = null;
            break;
          case "qabul_qilindi":
            patch.receivedAt = now;
            patch.receivedBy = actor.id;
            patch.receivedByName = actor.name;
            break;
          case "kutilmoqda":
            patch.collectedAt = null;
            patch.collectedBy = null;
            patch.collectedByName = null;
            patch.receivedAt = null;
            patch.receivedBy = null;
            patch.receivedByName = null;
            break;
          case "rad_etildi":
            patch.rejectedAt = now;
            patch.rejectedBy = actor.id;
            patch.rejectedByName = actor.name;
            patch.rejectReason = input.rejectReason ?? null;
            patch.rejectNote = input.rejectNote ?? null;
            break;
        }
        const [updated] = await db.update(samples).set(patch).where(eq(samples.id, current.id)).returning();
        const order = await this.getOrder(orderId);
        if (!order) return void 0;
        return { sample: mapSample(updated), order };
      }
      // ------------------------------------------------------------- payments
      async addPayment(orderId, input, actor) {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) return void 0;
        const [{ paid }] = await db.select({ paid: sql2`coalesce(sum(${payments.amount}), 0)::int` }).from(payments).where(eq(payments.orderId, orderId));
        const room = order.totalAmount - paid;
        const amount = input.amount > 0 ? Math.min(input.amount, room) : Math.max(input.amount, -paid);
        if (amount === 0) {
          throw new Error(
            input.amount > 0 ? "Buyurtma allaqachon to'liq to'langan" : "Qaytariladigan to'lov yo'q"
          );
        }
        await db.transaction(async (tx) => {
          await tx.insert(payments).values({
            orderId,
            amount,
            method: input.method,
            note: input.note?.trim() || null,
            createdBy: actor.id,
            createdByName: actor.name
          });
          await this.syncPaid(tx, orderId);
        });
        return this.getOrder(orderId);
      }
      async deletePayment(paymentId) {
        const [row] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
        if (!row) return false;
        await db.transaction(async (tx) => {
          await tx.delete(payments).where(eq(payments.id, paymentId));
          await this.syncPaid(tx, row.orderId);
        });
        return true;
      }
      // ------------------------------------------------------------- expenses
      async listExpenses(query = {}) {
        const parts = [];
        if (query.from) parts.push(gte(expenses.spentOn, query.from));
        if (query.to) parts.push(lte(expenses.spentOn, query.to));
        const where = parts.length ? and(...parts) : void 0;
        let q = db.select().from(expenses).where(where).orderBy(desc(expenses.spentOn), desc(expenses.createdAt)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const [rows, [agg]] = await Promise.all([
          q,
          db.select({
            count: sql2`count(*)::int`,
            sum: sql2`coalesce(sum(${expenses.amount}), 0)::int`
          }).from(expenses).where(where)
        ]);
        return {
          items: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
          total: agg?.count ?? 0,
          total_amount: agg?.sum ?? 0
        };
      }
      async createExpense(input, actor) {
        const [row] = await db.insert(expenses).values({
          category: input.category,
          amount: input.amount,
          note: input.note?.trim() || null,
          spentOn: input.spentOn,
          createdBy: actor.id,
          createdByName: actor.name
        }).returning();
        return { ...row, createdAt: iso(row.createdAt) };
      }
      async deleteExpense(id) {
        const rows = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
        return rows.length > 0;
      }
      // ---------------------------------------------------------------- audit
      async writeAudit(input) {
        await db.insert(auditLog).values({
          userId: input.actor.id,
          userName: input.actor.name,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          summary: input.summary
        });
      }
      async listAudit(query = {}) {
        const where = query.entity ? eq(auditLog.entity, query.entity) : void 0;
        let q = db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const [rows, [{ count }]] = await Promise.all([
          q,
          db.select({ count: sql2`count(*)::int` }).from(auditLog).where(where)
        ]);
        return { items: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })), total: count };
      }
      // ------------------------------------------------------------- telegram
      async linkTelegram(patientId, chatId) {
        await db.update(patients).set({ telegramChatId: null, telegramLinkedAt: null }).where(and(eq(patients.telegramChatId, chatId), sql2`${patients.id} <> ${patientId}`));
        const [row] = await db.update(patients).set({ telegramChatId: chatId, telegramLinkedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(patients.id, patientId)).returning();
        return row && mapPatient(row);
      }
      async savePendingContact(input) {
        const values = {
          chatId: input.chatId,
          phone: input.phone,
          fullName: input.fullName ?? null,
          username: input.username ?? null
        };
        await db.insert(telegramContacts).values(values).onConflictDoUpdate({ target: telegramContacts.chatId, set: values });
      }
      /** Digits-only suffix match, same rule as getPatientByPhone. */
      pendingByPhone(phone) {
        const digits = nationalPhoneDigits(phone);
        if (digits.length !== 9) return void 0;
        return sql2`regexp_replace(${telegramContacts.phone}, '[^0-9]', '', 'g') LIKE ${"%" + digits}`;
      }
      async findPendingContact(phone) {
        const where = this.pendingByPhone(phone);
        if (!where) return void 0;
        const [row] = await db.select().from(telegramContacts).where(where).orderBy(desc(telegramContacts.createdAt)).limit(1);
        return row && { ...row, createdAt: iso(row.createdAt) };
      }
      async deletePendingContact(chatId) {
        await db.delete(telegramContacts).where(eq(telegramContacts.chatId, chatId));
      }
      async unlinkTelegram(chatId) {
        const rows = await db.update(patients).set({ telegramChatId: null, telegramLinkedAt: null }).where(eq(patients.telegramChatId, chatId)).returning({ id: patients.id });
        return rows.length;
      }
      async listUndeliveredOrders(patientId, limit = 5) {
        const rows = await db.select().from(orders).where(
          and(
            eq(orders.patientId, patientId),
            eq(orders.status, "completed"),
            sql2`${orders.telegramSentAt} IS NULL`
          )
        ).orderBy(desc(orders.createdAt)).limit(limit);
        return this.hydrate(rows);
      }
      async markTelegramSent(orderId) {
        await db.update(orders).set({ telegramSentAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq(orders.id, orderId));
      }
      // ------------------------------------------------------------ reporting
      async getDashboardStats() {
        const today = todayKey();
        const { rows } = await db.execute(sql2`
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
          WHERE ot.result IS NOT NULL)::int                                                   AS ready,
        (SELECT count(*) FROM ${patients})::int                                               AS total_patients,
        (SELECT coalesce(sum(greatest(total_amount - paid_amount, 0)), 0) FROM active)::int    AS unpaid
    `);
        const r = rows[0];
        return {
          todayPatients: r?.today_patients ?? 0,
          pendingTests: r?.pending ?? 0,
          readyTests: r?.ready ?? 0,
          todayRevenue: r?.today_revenue ?? 0,
          totalPatients: r?.total_patients ?? 0,
          unpaidAmount: r?.unpaid ?? 0
        };
      }
      async getRevenueReport(from, to) {
        const inRange = and(
          sql2`${orders.status} <> 'cancelled'`,
          gte(dayExpr, sql2`${from}::date`),
          lte(dayExpr, sql2`${to}::date`)
        );
        const [orderDays, testDays] = await Promise.all([
          db.select({
            date: sql2`to_char(${dayExpr}, 'YYYY-MM-DD')`,
            patients: sql2`count(distinct ${orders.patientId})::int`,
            revenue: sql2`coalesce(sum(${orders.totalAmount}), 0)::int`
          }).from(orders).where(inRange).groupBy(dayExpr).orderBy(asc(dayExpr)),
          db.select({
            date: sql2`to_char(${dayExpr}, 'YYYY-MM-DD')`,
            tests: sql2`count(*)::int`
          }).from(orderTests).innerJoin(orders, eq(orders.id, orderTests.orderId)).where(inRange).groupBy(dayExpr)
        ]);
        const testsByDay = new Map(testDays.map((r) => [r.date, r.tests]));
        const points = orderDays.map((d) => ({ ...d, tests: testsByDay.get(d.date) ?? 0 }));
        const [[totals], topTests, byCategory] = await Promise.all([
          db.select({
            totalRevenue: sql2`coalesce(sum(${orders.totalAmount}), 0)::int`,
            totalPaid: sql2`coalesce(sum(${orders.paidAmount}), 0)::int`,
            totalPatients: sql2`count(distinct ${orders.patientId})::int`
          }).from(orders).where(inRange),
          db.select({
            name: orderTests.testName,
            count: sql2`count(*)::int`,
            revenue: sql2`coalesce(sum(${orderTests.price}), 0)::int`
          }).from(orderTests).innerJoin(orders, eq(orders.id, orderTests.orderId)).where(inRange).groupBy(orderTests.testName).orderBy(desc(sql2`sum(${orderTests.price})`)).limit(8),
          db.select({
            category: sql2`coalesce(${tests.category}, 'Boshqa')`,
            count: sql2`count(*)::int`,
            revenue: sql2`coalesce(sum(${orderTests.price}), 0)::int`
          }).from(orderTests).innerJoin(orders, eq(orders.id, orderTests.orderId)).leftJoin(tests, eq(tests.id, orderTests.testId)).where(inRange).groupBy(sql2`coalesce(${tests.category}, 'Boshqa')`).orderBy(desc(sql2`sum(${orderTests.price})`))
        ]);
        const spentInRange = and(gte(expenses.spentOn, from), lte(expenses.spentOn, to));
        const [expensesByCategory, byReferrer] = await Promise.all([
          db.select({
            category: expenses.category,
            amount: sql2`coalesce(sum(${expenses.amount}), 0)::int`
          }).from(expenses).where(spentInRange).groupBy(expenses.category).orderBy(desc(sql2`sum(${expenses.amount})`)),
          db.select({
            referrer: sql2`coalesce(nullif(btrim(${orders.referrer}), ''), '—')`,
            patients: sql2`count(distinct ${orders.patientId})::int`,
            revenue: sql2`coalesce(sum(${orders.totalAmount}), 0)::int`
          }).from(orders).where(inRange).groupBy(sql2`coalesce(nullif(btrim(${orders.referrer}), ''), '—')`).orderBy(desc(sql2`sum(${orders.totalAmount})`)).limit(10)
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
          byReferrer
        };
      }
      // ------------------------------------------------------------- settings
      async getSettings() {
        const [row] = await db.select().from(labSettings).limit(1);
        return row ?? DEFAULT_SETTINGS;
      }
      async updateSettings(input) {
        const values = {
          id: "default",
          labName: input.labName,
          tagline: input.tagline,
          address: input.address ?? null,
          phone: input.phone ?? null,
          director: input.director ?? null,
          licenseNumber: input.licenseNumber ?? null
        };
        const [row] = await db.insert(labSettings).values(values).onConflictDoUpdate({ target: labSettings.id, set: values }).returning();
        return row;
      }
    };
  }
});

// server/db.ts
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
function readDbSync() {
  try {
    const raw = fsSync.readFileSync(DB_FILE, "utf8");
    const base = emptyDb();
    const saved = JSON.parse(raw);
    return { ...base, ...saved, counters: { ...base.counters, ...saved.counters } };
  } catch {
    return emptyDb();
  }
}
function writeDb(db2) {
  queue = queue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TMP_FILE, JSON.stringify(db2, null, 2), "utf8");
    await fs.rename(TMP_FILE, DB_FILE);
  });
  return queue;
}
var DATA_DIR, DB_FILE, TMP_FILE, emptyDb, queue;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    DATA_DIR = process.env.MEDLAB_TEST_DIR ? path.resolve(process.env.MEDLAB_TEST_DIR) : path.resolve(import.meta.dirname, "..", ".data");
    DB_FILE = path.join(DATA_DIR, "db.json");
    TMP_FILE = path.join(DATA_DIR, "db.tmp.json");
    emptyDb = () => ({
      users: [],
      roles: [],
      departments: [],
      doctors: [],
      patients: [],
      tests: [],
      orders: [],
      orderTests: [],
      samples: [],
      payments: [],
      expenses: [],
      auditLog: [],
      telegramContacts: [],
      settings: {
        id: "default",
        labName: "MedLab",
        tagline: "Tibbiy Laboratoriya",
        address: "Toshkent sh., Chilonzor t., 12-mavze",
        phone: "+998 71 200 00 00",
        director: null,
        licenseNumber: null
      },
      counters: { orderNumber: 1e3, patientNumber: 0 }
    });
    queue = Promise.resolve();
  }
});

// server/storage-file.ts
var storage_file_exports = {};
__export(storage_file_exports, {
  FileStorage: () => FileStorage
});
import { randomUUID } from "crypto";
function contains(haystack, needle) {
  return (haystack ?? "").toLowerCase().includes(needle);
}
function phoneContains(phone, search) {
  const needle = digitsOf(search);
  return needle.length >= 3 && digitsOf(phone).includes(needle);
}
function asNumberSearch(search) {
  const match = search.trim().match(/^#?\s*(\d{1,9})$/);
  return match ? Number(match[1]) : null;
}
function isWaiting(order) {
  return order.items.some((i) => !i.result);
}
function isReady(order) {
  return order.items.length > 0 && order.items.every((i) => i.result);
}
var digitsOf, copyRole, FileStorage;
var init_storage_file = __esm({
  "server/storage-file.ts"() {
    "use strict";
    init_tests_data();
    init_schema();
    init_sample();
    init_db();
    init_password();
    init_permissions();
    init_storage_types();
    digitsOf = (value) => (value ?? "").replace(/\D/g, "");
    copyRole = (r) => ({ ...r, permissions: [...r.permissions] });
    FileStorage = class {
      db;
      constructor() {
        this.db = readDbSync();
      }
      persist() {
        return writeDb(this.db);
      }
      async seed() {
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
              isActive: true
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
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              failedAttempts: 0,
              lockedUntil: null,
              lockLevel: 0,
              lastFailedAt: null
            });
          }
          createdUsers = SEED_USERS.length;
        }
        const numbered = this.backfillPatientNumbers();
        let createdRoles = 0;
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
            updatedBy: null
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
        if (createdTests || createdUsers || numbered || createdRoles || migratedAdmins) await this.persist();
        return { createdTests, createdUsers, createdRoles, migratedAdmins };
      }
      // ---------------------------------------------------------------- roles
      async listRoles() {
        const counts = /* @__PURE__ */ new Map();
        for (const u of this.db.users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
        return sortRoles(this.db.roles).map((r) => ({ ...copyRole(r), userCount: counts.get(r.key) ?? 0 }));
      }
      /**
       * Roles are handed out as copies. The routes read a role, update it, then
       * diff the two for the audit log; returning the stored object itself made
       * "before" change along with the update and the diff come out empty.
       */
      async getRole(key) {
        const role = this.db.roles.find((r) => r.key === key);
        return role && copyRole(role);
      }
      async createRole(input, actor) {
        if (this.db.roles.some((r) => r.key === input.key)) {
          throw new Error("Bu kalitli rol allaqachon mavjud");
        }
        const role = {
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          permissions: [...input.permissions],
          isSystem: input.isSystem ?? false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: null,
          updatedBy: actor.id
        };
        this.db.roles.push(role);
        await this.persist();
        return copyRole(role);
      }
      async updateRole(key, input, actor) {
        const role = this.db.roles.find((r) => r.key === key);
        if (!role) return void 0;
        if (input.name !== void 0) role.name = input.name;
        if (input.description !== void 0) role.description = input.description ?? null;
        if (input.permissions !== void 0) role.permissions = [...input.permissions];
        role.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        role.updatedBy = actor.id;
        await this.persist();
        return copyRole(role);
      }
      async deleteRole(key) {
        const role = this.db.roles.find((r) => r.key === key);
        if (!role || role.isSystem) return false;
        this.db.roles = this.db.roles.filter((r) => r.key !== key);
        await this.persist();
        return true;
      }
      // ---------------------------------------------------------- departments
      async listDepartments() {
        return this.db.departments.map((d) => ({ ...d, doctorCount: this.db.doctors.filter((doc) => doc.departmentId === d.id).length })).sort(byActiveThenName((d) => d.name));
      }
      async getDepartment(id) {
        const d = this.db.departments.find((x) => x.id === id);
        return d && { ...d };
      }
      async createDepartment(input, actor) {
        const dept = {
          id: randomUUID(),
          name: input.name,
          kind: input.kind,
          description: input.description ?? null,
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: null,
          updatedBy: actor.id
        };
        this.db.departments.push(dept);
        await this.persist();
        return { ...dept };
      }
      async updateDepartment(id, input, actor) {
        const d = this.db.departments.find((x) => x.id === id);
        if (!d) return void 0;
        if (input.name !== void 0) d.name = input.name;
        if (input.kind !== void 0) d.kind = input.kind;
        if (input.description !== void 0) d.description = input.description ?? null;
        if (input.isActive !== void 0) d.isActive = input.isActive;
        d.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        d.updatedBy = actor.id;
        await this.persist();
        return { ...d };
      }
      async deleteDepartment(id) {
        const before = this.db.departments.length;
        this.db.departments = this.db.departments.filter((d) => d.id !== id);
        if (this.db.departments.length === before) return false;
        await this.persist();
        return true;
      }
      // -------------------------------------------------------------- doctors
      doctorDetails(doc) {
        const user = this.db.users.find((u) => u.id === doc.userId);
        const dept = doc.departmentId ? this.db.departments.find((d) => d.id === doc.departmentId) : void 0;
        return {
          ...doc,
          schedule: doc.schedule.map((s) => ({ ...s })),
          fullName: user?.fullName ?? "\u2014",
          username: user?.username ?? "",
          userActive: user?.isActive ?? false,
          departmentName: dept?.name ?? null
        };
      }
      async listDoctors(opts = {}) {
        return this.db.doctors.filter((d) => !opts.activeOnly || d.isActive).filter((d) => !opts.departmentId || d.departmentId === opts.departmentId).map((d) => this.doctorDetails(d)).filter((d) => !opts.activeOnly || d.userActive).sort(byActiveThenName((d) => d.fullName));
      }
      async getDoctor(id) {
        const doc = this.db.doctors.find((d) => d.id === id);
        return doc && this.doctorDetails(doc);
      }
      async getDoctorByUser(userId) {
        const doc = this.db.doctors.find((d) => d.userId === userId);
        return doc && this.doctorDetails(doc);
      }
      async createDoctor(input, actor) {
        if (this.db.doctors.some((d) => d.userId === input.userId)) {
          throw new Error("Bu xodimning shifokor profili allaqachon bor");
        }
        const doc = {
          id: randomUUID(),
          userId: input.userId,
          departmentId: input.departmentId ?? null,
          specialty: input.specialty,
          room: input.room ?? null,
          consultationPrice: input.consultationPrice,
          slotMinutes: input.slotMinutes,
          schedule: input.schedule.map((s) => ({ ...s })),
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: null,
          updatedBy: actor.id
        };
        this.db.doctors.push(doc);
        await this.persist();
        return this.doctorDetails(doc);
      }
      async updateDoctor(id, input, actor) {
        const doc = this.db.doctors.find((d) => d.id === id);
        if (!doc) return void 0;
        if (input.departmentId !== void 0) doc.departmentId = input.departmentId ?? null;
        if (input.specialty !== void 0) doc.specialty = input.specialty;
        if (input.room !== void 0) doc.room = input.room ?? null;
        if (input.consultationPrice !== void 0) doc.consultationPrice = input.consultationPrice;
        if (input.slotMinutes !== void 0) doc.slotMinutes = input.slotMinutes;
        if (input.schedule !== void 0) doc.schedule = input.schedule.map((s) => ({ ...s }));
        if (input.isActive !== void 0) doc.isActive = input.isActive;
        doc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        doc.updatedBy = actor.id;
        await this.persist();
        return this.doctorDetails(doc);
      }
      async deleteDoctor(id) {
        const before = this.db.doctors.length;
        this.db.doctors = this.db.doctors.filter((d) => d.id !== id);
        if (this.db.doctors.length === before) return false;
        await this.persist();
        return true;
      }
      /**
       * Gives a number to every patient saved before patientNumber existed, oldest
       * first, so the sequence still reads as the order people walked in. Returns
       * how many were touched; zero on every boot after the first.
       */
      backfillPatientNumbers() {
        const missing = this.db.patients.filter((p) => typeof p.patientNumber !== "number").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        let next = Math.max(
          this.db.counters.patientNumber,
          ...this.db.patients.map((p) => p.patientNumber ?? 0),
          0
        );
        for (const patient of missing) patient.patientNumber = ++next;
        this.db.counters.patientNumber = next;
        return missing.length;
      }
      // ---------------------------------------------------------------- users
      async listUsers() {
        return this.db.users.map(({ password: _password, ...rest }) => rest).sort((a, b) => a.fullName.localeCompare(b.fullName));
      }
      async getUser(id) {
        return this.db.users.find((u) => u.id === id);
      }
      async getUserByUsername(username) {
        return this.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      }
      async createUser(input) {
        const user = {
          id: randomUUID(),
          username: input.username,
          password: await hashPassword(input.password),
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          failedAttempts: 0,
          lockedUntil: null,
          lockLevel: 0,
          lastFailedAt: null
        };
        this.db.users.push(user);
        await this.persist();
        const { password: _password, ...pub } = user;
        return pub;
      }
      async updateUser(id, input) {
        const user = this.db.users.find((u) => u.id === id);
        if (!user) return void 0;
        if (input.username) user.username = input.username;
        if (input.fullName) user.fullName = input.fullName;
        if (input.role) user.role = input.role;
        if (input.isActive !== void 0) user.isActive = input.isActive;
        if (input.password) user.password = await hashPassword(input.password);
        await this.persist();
        const { password: _password, ...pub } = user;
        return pub;
      }
      async deleteUser(id) {
        const before = this.db.users.length;
        this.db.users = this.db.users.filter((u) => u.id !== id);
        if (this.db.users.length === before) return false;
        await this.persist();
        return true;
      }
      async setLockState(userId, state) {
        const user = this.db.users.find((u) => u.id === userId);
        if (!user) return;
        user.failedAttempts = state.failedAttempts;
        user.lockedUntil = state.lockedUntil;
        user.lockLevel = state.lockLevel;
        user.lastFailedAt = state.failedAttempts > 0 || state.lockedUntil ? (/* @__PURE__ */ new Date()).toISOString() : null;
        await this.persist();
      }
      // ------------------------------------------------------------- patients
      async listPatients(query = {}) {
        const search = query.search?.trim().toLowerCase();
        let rows = [...this.db.patients];
        if (search) {
          const wantedNumber = asNumberSearch(search);
          rows = rows.filter(
            (p) => p.patientNumber === wantedNumber || contains(p.fullName, search) || contains(p.phone, search) || phoneContains(p.phone, search) || contains(p.address, search)
          );
        }
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.patientNumber - a.patientNumber);
        const total = rows.length;
        const offset = query.offset ?? 0;
        const limit = query.limit ?? total;
        return { items: rows.slice(offset, offset + limit), total };
      }
      async getPatient(id) {
        return this.db.patients.find((p) => p.id === id);
      }
      async getPatientByPhone(phone) {
        const digits = nationalPhoneDigits(phone);
        if (digits.length !== 9) return void 0;
        return [...this.db.patients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => nationalPhoneDigits(p.phone) === digits);
      }
      async getPatientByChatId(chatId) {
        return this.db.patients.find((p) => p.telegramChatId === chatId);
      }
      async createPatient(input) {
        this.db.counters.patientNumber += 1;
        const patient = {
          id: randomUUID(),
          patientNumber: this.db.counters.patientNumber,
          fullName: input.fullName,
          phone: input.phone,
          address: input.address ?? null,
          age: input.age ?? null,
          gender: input.gender ?? null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          telegramChatId: null,
          telegramLinkedAt: null
        };
        this.db.patients.push(patient);
        await this.persist();
        return patient;
      }
      async updatePatient(id, input) {
        const patient = this.db.patients.find((p) => p.id === id);
        if (!patient) return void 0;
        if (input.fullName !== void 0) patient.fullName = input.fullName;
        if (input.phone !== void 0) patient.phone = input.phone;
        if (input.address !== void 0) patient.address = input.address ?? null;
        if (input.age !== void 0) patient.age = input.age ?? null;
        if (input.gender !== void 0) patient.gender = input.gender ?? null;
        await this.persist();
        return patient;
      }
      async deletePatient(id) {
        if (this.db.orders.some((o) => o.patientId === id)) {
          throw new Error("Bu bemorda buyurtmalar mavjud \u2014 avval buyurtmalarni o'chiring");
        }
        const before = this.db.patients.length;
        this.db.patients = this.db.patients.filter((p) => p.id !== id);
        if (this.db.patients.length === before) return false;
        await this.persist();
        return true;
      }
      // ---------------------------------------------------------------- tests
      async listTests(opts = {}) {
        const rows = opts.activeOnly ? this.db.tests.filter((t) => t.isActive) : [...this.db.tests];
        return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      }
      async getTest(id) {
        return this.db.tests.find((t) => t.id === id);
      }
      async createTest(input) {
        const test = {
          id: randomUUID(),
          name: input.name,
          price: input.price,
          category: input.category,
          unit: input.unit ?? null,
          referenceRange: input.referenceRange ?? null,
          isActive: input.isActive ?? true
        };
        this.db.tests.push(test);
        await this.persist();
        return test;
      }
      async updateTest(id, input) {
        const test = this.db.tests.find((t) => t.id === id);
        if (!test) return void 0;
        if (input.name !== void 0) test.name = input.name;
        if (input.price !== void 0) test.price = input.price;
        if (input.category !== void 0) test.category = input.category;
        if (input.unit !== void 0) test.unit = input.unit ?? null;
        if (input.referenceRange !== void 0) test.referenceRange = input.referenceRange ?? null;
        if (input.isActive !== void 0) test.isActive = input.isActive;
        await this.persist();
        return test;
      }
      async deleteTest(id) {
        const before = this.db.tests.length;
        this.db.tests = this.db.tests.filter((t) => t.id !== id);
        if (this.db.tests.length === before) return false;
        await this.persist();
        return true;
      }
      // --------------------------------------------------------------- orders
      /** `withPayments` is opt-in: the list screens never render the ledger. */
      hydrate(order, withPayments = false) {
        const full = {
          ...order,
          patient: this.db.patients.find((p) => p.id === order.patientId) ?? null,
          items: this.db.orderTests.filter((ot) => ot.orderId === order.id),
          // Null for orders created before sample tracking existed.
          sample: this.db.samples.find((s) => s.orderId === order.id) ?? null
        };
        if (withPayments) {
          full.payments = this.db.payments.filter((p) => p.orderId === order.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
        return full;
      }
      /**
       * orders.paidAmount is a cache of the ledger. Recomputing it from the rows
       * after every change is what keeps the two from drifting — the alternative,
       * incrementing it in place, silently loses a payment whenever a write fails
       * halfway.
       */
      syncPaid(orderId) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order) return;
        const sum = this.db.payments.filter((p) => p.orderId === orderId).reduce((acc, p) => acc + p.amount, 0);
        order.paidAmount = Math.max(0, sum);
      }
      async listOrders(query = {}) {
        const search = query.search?.trim().toLowerCase();
        let base = this.db.orders.map((o) => this.hydrate(o));
        if (query.patientId) base = base.filter((o) => o.patientId === query.patientId);
        if (query.from) base = base.filter((o) => localDay(o.createdAt) >= query.from);
        if (query.to) base = base.filter((o) => localDay(o.createdAt) <= query.to);
        if (search) {
          base = base.filter(
            (o) => contains(o.patient?.fullName, search) || contains(o.patient?.phone, search) || phoneContains(o.patient?.phone, search) || String(o.orderNumber).includes(search) || o.items.some((i) => contains(i.testName, search))
          );
        }
        const counts = { all: base.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
        for (const o of base) counts[o.status] += 1;
        const live = base.filter((o) => o.status !== "cancelled");
        const results = {
          waiting: live.filter(isWaiting).length,
          ready: live.filter(isReady).length
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
          summary: { counts, results, totals: { sum, paid, debt: Math.max(0, sum - paid) } }
        };
      }
      async getOrder(id) {
        const order = this.db.orders.find((o) => o.id === id);
        return order ? this.hydrate(order, true) : void 0;
      }
      async createOrder(input) {
        if (!this.db.patients.some((p) => p.id === input.patientId)) {
          throw new Error("Bemor topilmadi");
        }
        const selected = input.testIds.map((id) => this.db.tests.find((t) => t.id === id)).filter((t) => Boolean(t));
        if (selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");
        const subtotal = selected.reduce((sum, t) => sum + t.price, 0);
        const discount = Math.min(input.discount, subtotal);
        const total = subtotal - discount;
        this.db.counters.orderNumber += 1;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const order = {
          id: randomUUID(),
          orderNumber: this.db.counters.orderNumber,
          patientId: input.patientId,
          totalAmount: total,
          discount,
          paidAmount: 0,
          // set by syncPaid below, from the opening payment
          status: "pending",
          notes: input.notes ?? null,
          referrer: input.referrer ?? null,
          createdBy: input.createdBy ?? null,
          createdAt: now,
          completedAt: null,
          telegramSentAt: null
        };
        this.db.orders.push(order);
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
          createdAt: now
        });
        const opening = Math.min(input.paidAmount, total);
        if (opening > 0) {
          this.db.payments.push({
            id: randomUUID(),
            orderId: order.id,
            amount: opening,
            method: "naqd",
            note: null,
            createdBy: input.createdBy ?? null,
            createdByName: this.db.users.find((u) => u.id === input.createdBy)?.fullName ?? "\u2014",
            createdAt: now
          });
        }
        this.syncPaid(order.id);
        for (const t of selected) {
          const item = {
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
            completedAt: null
          };
          this.db.orderTests.push(item);
        }
        await this.persist();
        return this.hydrate(order, true);
      }
      async updateOrder(id, input) {
        const order = this.db.orders.find((o) => o.id === id);
        if (!order) return void 0;
        if (input.testIds) this.replaceOrderTests(id, input.testIds);
        if (input.discount !== void 0 || input.testIds) {
          const subtotal = this.db.orderTests.filter((i) => i.orderId === id).reduce((s, i) => s + i.price, 0);
          const discount = input.discount ?? order.discount;
          order.discount = Math.min(discount, subtotal);
          order.totalAmount = subtotal - order.discount;
        }
        if (input.notes !== void 0) order.notes = input.notes ?? null;
        if (input.referrer !== void 0) order.referrer = input.referrer ?? null;
        if (input.status) {
          order.status = input.status;
          order.completedAt = input.status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null;
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
      replaceOrderTests(orderId, testIds) {
        const current = this.db.orderTests.filter((i) => i.orderId === orderId);
        const wanted = new Set(testIds);
        const keep = new Set(
          current.filter((i) => wanted.has(i.testId) || i.result).map((i) => i.id)
        );
        this.db.orderTests = this.db.orderTests.filter(
          (i) => i.orderId !== orderId || keep.has(i.id)
        );
        const present = new Set(
          this.db.orderTests.filter((i) => i.orderId === orderId).map((i) => i.testId)
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
            completedAt: null
          });
          present.add(testId);
        }
      }
      async saveResults(id, results, actor) {
        const order = this.db.orders.find((o) => o.id === id);
        if (!order) return void 0;
        const patient = this.db.patients.find((p) => p.id === order.patientId);
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
      async deleteOrder(id) {
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
      async getOrderByBarcode(barcode) {
        const orderNumber = parseBarcode(barcode);
        if (orderNumber === null) return void 0;
        const order = this.db.orders.find((o) => o.orderNumber === orderNumber);
        return order ? this.hydrate(order, true) : void 0;
      }
      async updateSampleStatus(orderId, input, actor) {
        const sample = this.db.samples.find((s) => s.orderId === orderId);
        if (!sample) return void 0;
        const from = sample.status;
        if (!canTransition(from, input.status)) return { error: transitionError(from, input.status) };
        const now = (/* @__PURE__ */ new Date()).toISOString();
        sample.status = input.status;
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
            sample.rejectReason = input.rejectReason ?? null;
            sample.rejectNote = input.rejectNote ?? null;
            break;
        }
        await this.persist();
        const order = this.hydrate(this.db.orders.find((o) => o.id === orderId), true);
        return { sample, order };
      }
      // ------------------------------------------------------------- payments
      async addPayment(orderId, input, actor) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order) return void 0;
        const paid = this.db.payments.filter((p) => p.orderId === orderId).reduce((s, p) => s + p.amount, 0);
        const room = order.totalAmount - paid;
        const amount = input.amount > 0 ? Math.min(input.amount, room) : Math.max(input.amount, -paid);
        if (amount === 0) {
          throw new Error(
            input.amount > 0 ? "Buyurtma allaqachon to'liq to'langan" : "Qaytariladigan to'lov yo'q"
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        this.syncPaid(orderId);
        await this.persist();
        return this.hydrate(order, true);
      }
      async deletePayment(paymentId) {
        const row = this.db.payments.find((p) => p.id === paymentId);
        if (!row) return false;
        this.db.payments = this.db.payments.filter((p) => p.id !== paymentId);
        this.syncPaid(row.orderId);
        await this.persist();
        return true;
      }
      // ------------------------------------------------------------- expenses
      async listExpenses(query = {}) {
        let rows = [...this.db.expenses];
        if (query.from) rows = rows.filter((e) => e.spentOn >= query.from);
        if (query.to) rows = rows.filter((e) => e.spentOn <= query.to);
        rows.sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.createdAt.localeCompare(a.createdAt));
        const total = rows.length;
        const total_amount = rows.reduce((s, e) => s + e.amount, 0);
        const offset = query.offset ?? 0;
        const limit = query.limit ?? total;
        return { items: rows.slice(offset, offset + limit), total, total_amount };
      }
      async createExpense(input, actor) {
        const row = {
          id: randomUUID(),
          category: input.category,
          amount: input.amount,
          note: input.note?.trim() || null,
          spentOn: input.spentOn,
          createdBy: actor.id,
          createdByName: actor.name,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.db.expenses.push(row);
        await this.persist();
        return row;
      }
      async deleteExpense(id) {
        const before = this.db.expenses.length;
        this.db.expenses = this.db.expenses.filter((e) => e.id !== id);
        if (this.db.expenses.length === before) return false;
        await this.persist();
        return true;
      }
      // ---------------------------------------------------------------- audit
      async writeAudit(input) {
        this.db.auditLog.push({
          id: randomUUID(),
          userId: input.actor.id,
          userName: input.actor.name,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          summary: input.summary,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (this.db.auditLog.length > 5e3) {
          this.db.auditLog = this.db.auditLog.slice(-5e3);
        }
        await this.persist();
      }
      async listAudit(query = {}) {
        let rows = [...this.db.auditLog];
        if (query.entity) rows = rows.filter((e) => e.entity === query.entity);
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const total = rows.length;
        const offset = query.offset ?? 0;
        const limit = query.limit ?? total;
        return { items: rows.slice(offset, offset + limit), total };
      }
      // ------------------------------------------------------------- telegram
      async linkTelegram(patientId, chatId) {
        const patient = this.db.patients.find((p) => p.id === patientId);
        if (!patient) return void 0;
        for (const other of this.db.patients) {
          if (other.id !== patientId && other.telegramChatId === chatId) {
            other.telegramChatId = null;
            other.telegramLinkedAt = null;
          }
        }
        patient.telegramChatId = chatId;
        patient.telegramLinkedAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.persist();
        return patient;
      }
      async savePendingContact(input) {
        const row = {
          chatId: input.chatId,
          phone: input.phone,
          fullName: input.fullName ?? null,
          username: input.username ?? null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.db.telegramContacts = this.db.telegramContacts.filter((c) => c.chatId !== input.chatId);
        this.db.telegramContacts.push(row);
        await this.persist();
      }
      async findPendingContact(phone) {
        const digits = nationalPhoneDigits(phone);
        if (digits.length !== 9) return void 0;
        return [...this.db.telegramContacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((c) => nationalPhoneDigits(c.phone) === digits);
      }
      async deletePendingContact(chatId) {
        const before = this.db.telegramContacts.length;
        this.db.telegramContacts = this.db.telegramContacts.filter((c) => c.chatId !== chatId);
        if (this.db.telegramContacts.length !== before) await this.persist();
      }
      async unlinkTelegram(chatId) {
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
      async listUndeliveredOrders(patientId, limit = 5) {
        return this.db.orders.filter((o) => o.patientId === patientId && o.status === "completed" && !o.telegramSentAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((o) => this.hydrate(o));
      }
      async markTelegramSent(orderId) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order) return;
        order.telegramSentAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.persist();
      }
      // ------------------------------------------------------------ reporting
      async getDashboardStats() {
        const today = todayKey();
        const todayOrders = this.db.orders.filter(
          (o) => localDay(o.createdAt) === today && o.status !== "cancelled"
        );
        const activeOrderIds = new Set(
          this.db.orders.filter((o) => o.status !== "cancelled").map((o) => o.id)
        );
        const activeItems = this.db.orderTests.filter((i) => activeOrderIds.has(i.orderId));
        return {
          todayPatients: new Set(todayOrders.map((o) => o.patientId)).size,
          pendingTests: activeItems.filter((i) => !i.result).length,
          readyTests: activeItems.filter((i) => Boolean(i.result)).length,
          todayRevenue: todayOrders.reduce((sum, o) => sum + o.paidAmount, 0),
          totalPatients: this.db.patients.length,
          unpaidAmount: this.db.orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.paidAmount), 0)
        };
      }
      async getRevenueReport(from, to) {
        const inRange = this.db.orders.filter((o) => {
          const day = localDay(o.createdAt);
          return day >= from && day <= to && o.status !== "cancelled";
        });
        const byDay = /* @__PURE__ */ new Map();
        for (const order of inRange) {
          const day = localDay(order.createdAt);
          const bucket = byDay.get(day) ?? { patients: /* @__PURE__ */ new Set(), tests: 0, revenue: 0 };
          bucket.patients.add(order.patientId);
          bucket.tests += this.db.orderTests.filter((i) => i.orderId === order.id).length;
          bucket.revenue += order.totalAmount;
          byDay.set(day, bucket);
        }
        const points = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, b]) => ({ date, patients: b.patients.size, tests: b.tests, revenue: b.revenue }));
        const orderIds = new Set(inRange.map((o) => o.id));
        const items = this.db.orderTests.filter((i) => orderIds.has(i.orderId));
        const testAgg = /* @__PURE__ */ new Map();
        const catAgg = /* @__PURE__ */ new Map();
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
        const refAgg = /* @__PURE__ */ new Map();
        for (const order of inRange) {
          const key = order.referrer?.trim() || "\u2014";
          const bucket = refAgg.get(key) ?? { patients: /* @__PURE__ */ new Set(), revenue: 0 };
          bucket.patients.add(order.patientId);
          bucket.revenue += order.totalAmount;
          refAgg.set(key, bucket);
        }
        const spent = this.db.expenses.filter((e) => e.spentOn >= from && e.spentOn <= to);
        const totalExpenses = spent.reduce((s, e) => s + e.amount, 0);
        const expAgg = /* @__PURE__ */ new Map();
        for (const e of spent) expAgg.set(e.category, (expAgg.get(e.category) ?? 0) + e.amount);
        const totalPaid = inRange.reduce((s, o) => s + o.paidAmount, 0);
        return {
          range: { from, to },
          points,
          totalRevenue: inRange.reduce((s, o) => s + o.totalAmount, 0),
          totalPaid,
          totalPatients: new Set(inRange.map((o) => o.patientId)).size,
          totalTests: items.length,
          topTests: Array.from(testAgg.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
          byCategory: Array.from(catAgg.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.revenue - a.revenue),
          totalExpenses,
          // Against money actually collected, not invoiced: an unpaid bill is not
          // cash the lab can spend.
          netProfit: totalPaid - totalExpenses,
          expensesByCategory: Array.from(expAgg.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          byReferrer: Array.from(refAgg.entries()).map(([referrer, v]) => ({ referrer, patients: v.patients.size, revenue: v.revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
        };
      }
      // ------------------------------------------------------------- settings
      async getSettings() {
        return this.db.settings;
      }
      async updateSettings(input) {
        this.db.settings = {
          ...this.db.settings,
          labName: input.labName,
          tagline: input.tagline,
          address: input.address ?? null,
          phone: input.phone ?? null,
          director: input.director ?? null,
          licenseNumber: input.licenseNumber ?? null
        };
        await this.persist();
        return this.db.settings;
      }
    };
  }
});

// server/env.ts
try {
  process.loadEnvFile(".env");
} catch {
}

// server/app.ts
import express from "express";

// server/routes.ts
init_schema();
init_permissions();
import passport2 from "passport";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// shared/lockout.ts
var MINUTE = 60 * 1e3;
var HOUR = 60 * MINUTE;
var ATTEMPTS_BEFORE_LOCK = 3;
var LOCK_DURATIONS_MS = [1 * HOUR, 2 * HOUR, 3 * HOUR];
var FINAL_LOCK_MS = 7 * 24 * HOUR;
var UNLOCKED = { failedAttempts: 0, lockedUntil: null, lockLevel: 0 };
function lockRemainingMs(lockedUntil, now = Date.now()) {
  if (!lockedUntil) return 0;
  const until = new Date(lockedUntil).getTime();
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - now);
}
function registerFailure(state, now = Date.now()) {
  const attempts2 = state.failedAttempts + 1;
  const threshold = state.lockLevel === 0 ? ATTEMPTS_BEFORE_LOCK : 1;
  if (attempts2 < threshold) {
    return {
      failedAttempts: attempts2,
      lockedUntil: state.lockedUntil,
      lockLevel: state.lockLevel,
      justLocked: false,
      lockedForMs: null
    };
  }
  const duration = lockDurationFor(state.lockLevel);
  return {
    // The count restarts for the next round; lockLevel is what remembers.
    failedAttempts: 0,
    lockedUntil: new Date(now + duration).toISOString(),
    lockLevel: state.lockLevel + 1,
    justLocked: true,
    lockedForMs: duration
  };
}
function lockDurationFor(level) {
  return LOCK_DURATIONS_MS[level] ?? FINAL_LOCK_MS;
}
function isFinalLock(state) {
  return state.lockLevel > LOCK_DURATIONS_MS.length;
}
function registerSuccess() {
  return { ...UNLOCKED };
}
function formatLockRemaining(ms) {
  if (ms <= 0) return "0 daqiqa";
  const totalMinutes = Math.ceil(ms / MINUTE);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor(totalMinutes % (24 * 60) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) {
    parts.push(`${days} kun`);
    if (hours > 0) parts.push(`${hours} soat`);
  } else if (hours > 0) {
    parts.push(`${hours} soat`);
    if (minutes > 0) parts.push(`${minutes} daqiqa`);
  } else {
    parts.push(`${minutes} daqiqa`);
  }
  return parts.join(" ");
}
function lockMessage(remainingMs, finalLock) {
  const left = formatLockRemaining(remainingMs);
  if (finalLock) {
    return `Hisob bir haftaga qulflandi. ${left} qoldi \u2014 administratorga murojaat qiling.`;
  }
  return `Ko'p marta xato parol kiritildi. Hisob qulflandi, ${left} dan so'ng qayta urinib ko'ring.`;
}
function attemptsLeftMessage(attemptsLeft, lockLevel = 0) {
  if (attemptsLeft <= 0) return null;
  if (lockLevel > 0) {
    const next = formatLockRemaining(lockDurationFor(lockLevel));
    return `Diqqat: yana bitta xato urinishda hisob ${next}ga qulflanadi.`;
  }
  return attemptsLeft === 1 ? "Yana bitta xato urinishdan so'ng hisob 1 soatga qulflanadi." : `Yana ${attemptsLeft} ta urinish qoldi \u2014 keyin hisob qulflanadi.`;
}

// server/auth.ts
init_password();
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import createMemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

// server/storage.ts
init_storage_types();
var usingPostgres = Boolean(process.env.DATABASE_URL);
async function createStorage() {
  if (usingPostgres) {
    const { PgStorage: PgStorage2 } = await Promise.resolve().then(() => (init_storage_pg(), storage_pg_exports));
    return new PgStorage2();
  }
  const { FileStorage: FileStorage2 } = await Promise.resolve().then(() => (init_storage_file(), storage_file_exports));
  return new FileStorage2();
}
var storage = await createStorage();

// server/rbac.ts
init_permissions();
var ROLE_TTL_MS = 6e4;
var cache = null;
var inflight = null;
function fallbackRoles() {
  const now = (/* @__PURE__ */ new Date(0)).toISOString();
  return new Map(
    SYSTEM_ROLES.map((r) => [
      r.key,
      {
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: [...r.permissions],
        isSystem: true,
        createdAt: now,
        updatedAt: null,
        updatedBy: null
      }
    ])
  );
}
async function fetchRoles() {
  try {
    const list = await storage.listRoles();
    return new Map(list.map(({ userCount: _count, ...role }) => [role.key, role]));
  } catch (err) {
    if (err?.code === "42P01") return fallbackRoles();
    throw err;
  }
}
async function getRoles() {
  if (cache && Date.now() - cache.loadedAt < ROLE_TTL_MS) return cache.roles;
  inflight ??= fetchRoles().then((roles2) => {
    cache = { roles: roles2, loadedAt: Date.now() };
    return roles2;
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}
function invalidateRoles() {
  cache = null;
}
async function toSessionUser(user) {
  const key = canonicalRoleKey(user.role);
  const role = (await getRoles()).get(key);
  return {
    ...user,
    role: key,
    roleName: role?.name ?? (key === SUPER_ADMIN ? "Super administrator" : "Rol belgilanmagan"),
    permissions: resolvePermissions(key, role?.permissions)
  };
}
function hasPermission(req, permission) {
  return Boolean(req.user?.permissions?.includes(permission));
}
function isSuperAdmin(req) {
  return req.user?.role === SUPER_ADMIN;
}
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Avval tizimga kiring" });
    }
    if (!permissions.some((p) => hasPermission(req, p))) {
      return res.status(403).json({ message: "Bu amal uchun ruxsatingiz yo'q" });
    }
    next();
  };
}

// server/auth.ts
var pool2 = process.env.DATABASE_URL ? (await Promise.resolve().then(() => (init_db_pg(), db_pg_exports))).pool : null;
var MemoryStore = createMemoryStore(session);
var PgSession = connectPgSimple(session);
function createSessionStore() {
  if (!pool2) {
    return new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1e3 });
  }
  return new PgSession({
    pool: pool2,
    // Pool obyektini to'g'ridan-to'g'ri ulash
    tableName: "session",
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60
    // seconds
  });
}
var SESSION_USER_TTL_MS = 3e4;
var sessionUsers = /* @__PURE__ */ new Map();
function forgetSessionUser(id) {
  sessionUsers.delete(id);
}
function setupAuth(app) {
  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "medlab-dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: createSessionStore(),
      // The session is only ended by an explicit logout, so the cookie is given
      // a year and `rolling` pushes that expiry forward on every request.
      rolling: true,
      cookie: {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1e3,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      }
    })
  );
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await verifyPassword(password, user.password)) {
          return done(null, false, { message: "Login yoki parol noto'g'ri" });
        }
        if (!user.isActive) {
          return done(null, false, { message: "Hisob bloklangan. Administratorga murojaat qiling" });
        }
        const { password: _password, ...pub } = user;
        return done(null, await toSessionUser(pub));
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const hit = sessionUsers.get(id);
      if (hit && hit.expires > Date.now()) return done(null, await toSessionUser(hit.user));
      const user = await storage.getUser(id);
      if (!user || !user.isActive) {
        sessionUsers.delete(id);
        return done(null, false);
      }
      const { password: _password, ...pub } = user;
      sessionUsers.set(id, { user: pub, expires: Date.now() + SESSION_USER_TTL_MS });
      done(null, await toSessionUser(pub));
    } catch (err) {
      done(err);
    }
  });
  app.use(passport.initialize());
  app.use(passport.session());
}
var MAX_ATTEMPTS = 8;
var WINDOW_MS = 15 * 60 * 1e3;
var attempts = /* @__PURE__ */ new Map();
var MAX_TRACKED = 5e3;
function attemptKey(req) {
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  return `${req.ip ?? "?"}|${username}`;
}
function sweep(now) {
  for (const [key, a] of attempts) {
    if (now - a.firstAt > WINDOW_MS && now > a.blockedUntil) attempts.delete(key);
  }
  if (attempts.size > MAX_TRACKED) {
    const oldest = [...attempts.entries()].sort((a, b) => a[1].firstAt - b[1].firstAt);
    for (const [key] of oldest.slice(0, attempts.size - MAX_TRACKED)) attempts.delete(key);
  }
}
function loginRateLimit(req, res, next) {
  const now = Date.now();
  sweep(now);
  const entry = attempts.get(attemptKey(req));
  if (entry && now < entry.blockedUntil) {
    const minutes = Math.ceil((entry.blockedUntil - now) / 6e4);
    return res.status(429).json({
      message: `Juda ko'p urinish. ${minutes} daqiqadan so'ng qayta urinib ko'ring`
    });
  }
  next();
}
function recordFailedLogin(req) {
  const now = Date.now();
  const key = attemptKey(req);
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + WINDOW_MS;
    entry.count = 0;
    entry.firstAt = now;
  }
}
function clearFailedLogins(req) {
  attempts.delete(attemptKey(req));
}
function requireAuth(req, res, next) {
  if (!req.isAuthenticated?.()) {
    return res.status(401).json({ message: "Avval tizimga kiring" });
  }
  next();
}

// server/csv.ts
function field(value) {
  if (value === null || value === void 0) return "";
  let text2 = String(value);
  if (/^[=+\-@\t\r]/.test(text2)) text2 = "'" + text2;
  if (/[",\r\n]/.test(text2)) return `"${text2.replace(/"/g, '""')}"`;
  return text2;
}
function toCsv(headers, rows) {
  const lines = [headers.map(field).join(","), ...rows.map((r) => r.map(field).join(","))];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
function csvHeaders(res, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
}
function stamp() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// server/routes.ts
init_password();

// server/telegram.ts
init_schema();
import { Bot, GrammyError, Keyboard, webhookCallback } from "grammy";

// server/logger.ts
function log(message, source = "express") {
  const time = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${time} [${source}] ${message}`);
}

// server/telegram.ts
var token = process.env.TELEGRAM_BOT_TOKEN?.trim();
var telegramEnabled = Boolean(token);
var telegramUsesWebhook = Boolean(process.env.VERCEL);
var webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || void 0;
var MAX_MESSAGE = 3500;
var CONTACT_BUTTON = "\u{1F4F1} Telefon raqamimni yuborish";
var FLAG_MARKS = { low: "\u{1F53B}", high: "\u{1F53A}", normal: "\u2705" };
var contactKeyboard = () => new Keyboard().requestContact(CONTACT_BUTTON).resized().oneTime();
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function isOrderReady(order) {
  return order.items.length > 0 && order.items.every((i) => Boolean(i.result));
}
function buildResultMessage(order, settings) {
  const head = [
    `\u{1F9EA} <b>${escapeHtml(settings.labName)}</b> \u2014 tahlil natijasi`,
    "",
    `Hurmatli <b>${escapeHtml(order.patient?.fullName ?? "bemor")}</b>,`,
    `<b>#${order.orderNumber}</b> raqamli buyurtmangiz natijalari tayyor` + (order.completedAt ? ` (${formatDate(order.completedAt)}).` : "."),
    ""
  ].join("\n");
  const items = order.items.map((item) => {
    const mark = item.flag && FLAG_MARKS[item.flag] || "\u2022";
    const value = [item.result, item.unit].filter(Boolean).join(" ");
    let line = `${mark} <b>${escapeHtml(item.testName)}</b>: ${escapeHtml(value)}`;
    if (item.referenceRange) line += `
     <i>me'yor: ${escapeHtml(item.referenceRange)}</i>`;
    if (item.notes) line += `
     <i>${escapeHtml(item.notes)}</i>`;
    return line;
  });
  const foot = [
    "",
    "\u2139\uFE0F Natijalar tashxis o'rnini bosmaydi \u2014 shifokoringiz bilan maslahatlashing.",
    settings.phone ? `\u260E\uFE0F ${escapeHtml(settings.phone)}` : null,
    settings.address ? `\u{1F4CD} ${escapeHtml(settings.address)}` : null
  ].filter((l) => l !== null).join("\n");
  const chunks = [];
  let current = head;
  for (const line of [...items, foot]) {
    if (current.length + line.length + 1 > MAX_MESSAGE) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }
  if (current) chunks.push(current);
  return chunks;
}
var instance = null;
function getBot() {
  if (!instance) {
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
    instance = new Bot(token);
    registerHandlers(instance);
    instance.catch((err) => console.error("[telegram]", err.error));
  }
  return instance;
}
function registerHandlers(bot) {
  bot.command("start", async (ctx) => {
    const linked = await patientOfChat(ctx.chat.id);
    if (linked) {
      await ctx.reply(
        `Assalomu alaykum, <b>${escapeHtml(linked.fullName)}</b>! Siz allaqachon ulangansiz \u2014 tahlil natijalaringiz tayyor bo'lishi bilan shu yerga yuboriladi.

/natijalarim \u2014 oxirgi natijalaringizni ko'rish
/stop \u2014 xabarnomalarni to'xtatish`,
        { parse_mode: "HTML" }
      );
      return;
    }
    await ctx.reply(
      "Assalomu alaykum! \u{1F44B}\n\nTahlil natijalaringizni shu yerdan olish uchun pastdagi tugma orqali telefon raqamingizni yuboring. Raqam laboratoriyada ro'yxatdan o'tgan raqam bilan bir xil bo'lishi kerak.",
      { reply_markup: contactKeyboard() }
    );
  });
  bot.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(
        "Iltimos, <b>o'zingizning</b> raqamingizni tugma orqali yuboring.",
        { parse_mode: "HTML", reply_markup: contactKeyboard() }
      );
      return;
    }
    const patient = await storage.getPatientByPhone(contact.phone_number);
    if (!patient) {
      await storage.savePendingContact({
        chatId: String(ctx.chat.id),
        phone: normalizeUzPhone(contact.phone_number),
        fullName: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null,
        username: ctx.from.username ?? null
      });
      await ctx.reply(
        "Rahmat, raqamingiz qabul qilindi! \u2705\n\nHozircha bu raqam bo'yicha ro'yxatdan o'tmagansiz. Laboratoriyaga kelib ro'yxatdan o'tishingiz bilan shu chat avtomatik bog'lanadi va natijalaringiz shu yerga keladi.",
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }
    await storage.linkTelegram(patient.id, String(ctx.chat.id));
    await ctx.reply(
      `Rahmat, <b>${escapeHtml(patient.fullName)}</b>! \u2705

Bundan buyon tahlil natijalaringiz tayyor bo'lishi bilan shu yerga yuboriladi.`,
      { parse_mode: "HTML", reply_markup: { remove_keyboard: true } }
    );
    const pending = await storage.listUndeliveredOrders(patient.id);
    for (const order of pending.reverse()) {
      await deliverOrderResults(order);
    }
  });
  bot.command("natijalarim", async (ctx) => {
    const patient = await patientOfChat(ctx.chat.id);
    if (!patient) {
      await ctx.reply("Avval telefon raqamingizni yuboring.", { reply_markup: contactKeyboard() });
      return;
    }
    const { items } = await storage.listOrders({ patientId: patient.id, status: "completed", limit: 3 });
    const ready = items.filter(isOrderReady);
    if (ready.length === 0) {
      await ctx.reply("Hozircha tayyor natijangiz yo'q. Tayyor bo'lishi bilan xabar beramiz. \u23F3");
      return;
    }
    const settings = await storage.getSettings();
    for (const order of ready.reverse()) {
      for (const chunk of buildResultMessage(order, settings)) {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      }
    }
  });
  bot.command("stop", async (ctx) => {
    await storage.deletePendingContact(String(ctx.chat.id));
    const removed = await storage.unlinkTelegram(String(ctx.chat.id));
    await ctx.reply(
      removed ? "Xabarnomalar to'xtatildi. Qayta ulanish uchun /start bosing." : "Siz ulanmagansiz. Ulanish uchun /start bosing.",
      { reply_markup: { remove_keyboard: true } }
    );
  });
  bot.on("message", async (ctx) => {
    const patient = await patientOfChat(ctx.chat.id);
    if (patient) {
      await ctx.reply(
        "Natijalaringiz tayyor bo'lishi bilan avtomatik yuboriladi.\n\n/natijalarim \u2014 oxirgi natijalar\n/stop \u2014 xabarnomalarni to'xtatish"
      );
      return;
    }
    await ctx.reply("Boshlash uchun telefon raqamingizni yuboring.", { reply_markup: contactKeyboard() });
  });
}
function patientOfChat(chatId) {
  return storage.getPatientByChatId(String(chatId));
}
function telegramWebhook() {
  const callback = webhookCallback(getBot(), "express", { secretToken: webhookSecret });
  return async (req, res) => {
    try {
      await callback(req, res);
    } catch (err) {
      console.error("[telegram] webhook", err);
      if (!res.headersSent) res.sendStatus(200);
    }
  };
}
async function claimPendingContact(patient) {
  if (!telegramEnabled || patient.telegramChatId) return patient;
  let linked = patient;
  try {
    const pending = await storage.findPendingContact(patient.phone);
    if (!pending) return patient;
    linked = await storage.linkTelegram(patient.id, pending.chatId) ?? patient;
    await storage.deletePendingContact(pending.chatId);
    const settings = await storage.getSettings();
    await getBot().api.sendMessage(
      pending.chatId,
      `Assalomu alaykum, <b>${escapeHtml(linked.fullName)}</b>! \u2705

${escapeHtml(settings.labName)} tizimida ro'yxatdan o'tdingiz. Tahlil natijalaringiz tayyor bo'lishi bilan shu yerga yuboriladi.`,
      { parse_mode: "HTML" }
    );
    for (const order of (await storage.listUndeliveredOrders(linked.id)).reverse()) {
      await deliverOrderResults(order);
    }
  } catch (err) {
    console.error("[telegram] claim", err);
  }
  return linked;
}
async function telegramPhoneStatus(phone) {
  if (!telegramEnabled) return { connected: false, source: null, telegramName: null };
  const patient = await storage.getPatientByPhone(phone);
  if (patient?.telegramChatId) return { connected: true, source: "patient", telegramName: null };
  const pending = await storage.findPendingContact(phone);
  if (pending) return { connected: true, source: "pending", telegramName: pending.fullName };
  return { connected: false, source: null, telegramName: null };
}
async function deliverOrderResults(order, opts = {}) {
  if (!telegramEnabled) return { sent: false, reason: "Telegram bot sozlanmagan" };
  if (order.status === "cancelled") return { sent: false, reason: "Buyurtma bekor qilingan" };
  if (!isOrderReady(order)) return { sent: false, reason: "Natijalar to'liq emas" };
  const chatId = order.patient?.telegramChatId;
  if (!chatId) return { sent: false, reason: "Bemor Telegram botga ulanmagan" };
  if (order.telegramSentAt && !opts.force) return { sent: false, reason: "Allaqachon yuborilgan" };
  const settings = await storage.getSettings();
  try {
    for (const chunk of buildResultMessage(order, settings)) {
      await getBot().api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
    }
  } catch (err) {
    if (err instanceof GrammyError && err.error_code === 403) {
      await storage.unlinkTelegram(chatId);
      return { sent: false, reason: "Bemor botni bloklagan" };
    }
    const reason = err instanceof Error ? err.message : "Telegramga yuborilmadi";
    console.error("[telegram] send", err);
    return { sent: false, reason };
  }
  await storage.markTelegramSent(order.id);
  log(`[telegram] #${order.orderNumber} natijasi yuborildi`);
  return { sent: true };
}
async function notifyIfReady(order) {
  if (!telegramEnabled) return { sent: false, reason: "Telegram bot sozlanmagan" };
  try {
    return await deliverOrderResults(order);
  } catch (err) {
    console.error("[telegram] notify", err);
    return { sent: false, reason: err instanceof Error ? err.message : "Xatolik" };
  }
}
var cachedMe = null;
async function telegramBotInfo() {
  if (!telegramEnabled) return null;
  if (cachedMe) return cachedMe;
  try {
    const me = await getBot().api.getMe();
    cachedMe = { id: me.id, username: me.username };
    return cachedMe;
  } catch (err) {
    console.error("[telegram] getMe", err);
    return null;
  }
}

// server/routes.ts
var handle = (fn) => (req, res, next) => fn(req, res).catch(next);
var numberParam = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
var stringParam = (value) => typeof value === "string" && value ? value : void 0;
function actorOf(req) {
  return { id: req.user?.id ?? null, name: req.user?.fullName ?? "Tizim" };
}
async function audit(req, action, entity, entityId, summary) {
  try {
    await storage.writeAudit({ actor: actorOf(req), action, entity, entityId, summary });
  } catch (err) {
    console.error("[audit] yozib bo'lmadi:", err);
  }
}
async function registerRoutes(app) {
  setupAuth(app);
  console.log(`[db] ${usingPostgres ? "Postgres (Neon)" : "Mahalliy JSON (.data/db.json)"}`);
  const seeded = await storage.seed();
  if (seeded.createdTests) {
    console.log(`[seed] ${seeded.createdTests} ta tahlil narxlar ro'yxatiga yuklandi`);
  }
  if (seeded.createdUsers) {
    console.log("[seed] Standart foydalanuvchilar yaratildi \u2014 admin / admin123");
  }
  if (telegramEnabled && telegramUsesWebhook) {
    app.post("/api/telegram/webhook", telegramWebhook());
    console.log("[telegram] webhook yo'li: POST /api/telegram/webhook");
  } else if (!telegramEnabled) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN yo'q \u2014 bot o'chirilgan");
  }
  app.get(
    "/api/telegram/status",
    requireAuth,
    handle(async (_req, res) => {
      const info = await telegramBotInfo();
      res.json({ enabled: telegramEnabled, username: info?.username ?? null });
    })
  );
  app.get(
    "/api/telegram/phone",
    requirePermission("patients.create", "patients.update"),
    handle(async (req, res) => {
      const phone = typeof req.query.phone === "string" ? req.query.phone : "";
      res.json(await telegramPhoneStatus(phone));
    })
  );
  app.post("/api/login", loginRateLimit, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    }
    handle(async (request, response) => {
      const account = await storage.getUserByUsername(parsed.data.username);
      if (account) {
        const remaining = lockRemainingMs(account.lockedUntil);
        if (remaining > 0) {
          return response.status(423).json({
            message: lockMessage(remaining, isFinalLock(account)),
            lockedUntil: account.lockedUntil
          });
        }
      }
      passport2.authenticate(
        "local",
        async (err, user, info) => {
          if (err) return next(err);
          if (!user) {
            recordFailedLogin(request);
            if (!account) {
              return response.status(401).json({ message: info?.message ?? "Login yoki parol noto'g'ri" });
            }
            if (!account.isActive) {
              return response.status(401).json({ message: info?.message ?? "Login yoki parol noto'g'ri" });
            }
            const decision = registerFailure(account);
            await storage.setLockState(account.id, decision);
            if (decision.justLocked) {
              await audit(
                request,
                "login",
                "auth",
                account.id,
                `${account.fullName} hisobi qulflandi (${formatLockRemaining(decision.lockedForMs ?? 0)})`
              );
              return response.status(423).json({
                message: lockMessage(decision.lockedForMs ?? 0, isFinalLock(decision)),
                lockedUntil: decision.lockedUntil
              });
            }
            const left = decision.lockLevel > 0 ? 1 : ATTEMPTS_BEFORE_LOCK - decision.failedAttempts;
            return response.status(401).json({
              message: info?.message ?? "Login yoki parol noto'g'ri",
              warning: attemptsLeftMessage(left, decision.lockLevel),
              attemptsLeft: left
            });
          }
          request.logIn(user, async (loginErr) => {
            if (loginErr) return next(loginErr);
            clearFailedLogins(request);
            if (account && (account.failedAttempts > 0 || account.lockLevel > 0)) {
              await storage.setLockState(account.id, registerSuccess());
            }
            void audit(request, "login", "auth", user.id, `${user.fullName} tizimga kirdi`);
            response.json(user);
          });
        }
      )(request, response, next);
    })(req, res, next);
  });
  app.post(
    "/api/user/password",
    requireAuth,
    handle(async (req, res) => {
      const input = changePasswordSchema.parse(req.body);
      const me = req.user;
      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!await verifyPassword(input.currentPassword, full.password)) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }
      await storage.updateUser(me.id, { password: input.newPassword });
      await audit(req, "update", "user", me.id, `${me.fullName} parolini o'zgartirdi`);
      res.sendStatus(204);
    })
  );
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.sendStatus(204));
    });
  });
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Avval tizimga kiring" });
    res.json(req.user);
  });
  app.get(
    "/api/patients",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const result = await storage.listPatients({
        search: typeof req.query.search === "string" ? req.query.search : void 0,
        limit: numberParam(req.query.limit),
        offset: numberParam(req.query.offset, 0)
      });
      res.json(result);
    })
  );
  app.get(
    "/api/patients/:id",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      res.json(patient);
    })
  );
  app.get(
    "/api/patients/:id/orders",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const result = await storage.listOrders({ patientId: req.params.id });
      res.json(result);
    })
  );
  app.post(
    "/api/patients",
    requirePermission("patients.create"),
    handle(async (req, res) => {
      const input = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(input);
      await audit(req, "create", "patient", patient.id, `\u2116${patient.patientNumber} ${patient.fullName}`);
      res.status(201).json(await claimPendingContact(patient));
    })
  );
  app.patch(
    "/api/patients/:id",
    requirePermission("patients.update"),
    handle(async (req, res) => {
      const input = insertPatientSchema.partial().parse(req.body);
      const patient = await storage.updatePatient(req.params.id, input);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      await audit(req, "update", "patient", patient.id, `\u2116${patient.patientNumber} ${patient.fullName} tahrirlandi`);
      res.json(await claimPendingContact(patient));
    })
  );
  app.delete(
    "/api/patients/:id",
    requirePermission("patients.delete"),
    handle(async (req, res) => {
      const before = await storage.getPatient(req.params.id);
      const ok = await storage.deletePatient(req.params.id);
      if (!ok) return res.status(404).json({ message: "Bemor topilmadi" });
      await audit(req, "delete", "patient", req.params.id, `${before?.fullName ?? "Bemor"} o'chirildi`);
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/tests",
    requireAuth,
    handle(async (req, res) => {
      res.json(await storage.listTests({ activeOnly: req.query.all !== "1" }));
    })
  );
  app.post(
    "/api/tests",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const test = await storage.createTest(insertTestSchema.parse(req.body));
      await audit(req, "create", "test", test.id, `"${test.name}" qo'shildi \u2014 ${test.price} so'm`);
      res.status(201).json(test);
    })
  );
  app.patch(
    "/api/tests/:id",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const input = insertTestSchema.partial().parse(req.body);
      const before = await storage.getTest(req.params.id);
      const test = await storage.updateTest(req.params.id, input);
      if (!test) return res.status(404).json({ message: "Tahlil topilmadi" });
      const priceMoved = before && before.price !== test.price;
      await audit(
        req,
        "update",
        "test",
        test.id,
        priceMoved ? `"${test.name}" narxi ${before.price} \u2192 ${test.price} so'm` : `"${test.name}" tahrirlandi`
      );
      res.json(test);
    })
  );
  app.delete(
    "/api/tests/:id",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const before = await storage.getTest(req.params.id);
      const ok = await storage.deleteTest(req.params.id);
      if (!ok) return res.status(404).json({ message: "Tahlil topilmadi" });
      await audit(req, "delete", "test", req.params.id, `"${before?.name ?? "Tahlil"}" o'chirildi`);
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/orders",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const statusParam = req.query.status;
      const status = ORDER_STATUSES.find((s) => s === statusParam);
      const queueParam = req.query.queue;
      const queue2 = queueParam === "waiting" || queueParam === "ready" ? queueParam : void 0;
      const result = await storage.listOrders({
        search: typeof req.query.search === "string" ? req.query.search : void 0,
        status,
        queue: queue2,
        patientId: typeof req.query.patientId === "string" ? req.query.patientId : void 0,
        from: typeof req.query.from === "string" ? req.query.from : void 0,
        to: typeof req.query.to === "string" ? req.query.to : void 0,
        limit: numberParam(req.query.limit),
        offset: numberParam(req.query.offset, 0)
      });
      res.json(result);
    })
  );
  app.get(
    "/api/orders/:id",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      res.json(order);
    })
  );
  app.post(
    "/api/orders",
    requirePermission("orders.create"),
    handle(async (req, res) => {
      const input = createOrderSchema.parse(req.body);
      const order = await storage.createOrder({ ...input, createdBy: req.user?.id ?? null });
      await audit(
        req,
        "create",
        "order",
        order.id,
        `#${order.orderNumber} buyurtma yaratildi \u2014 ${order.items.length} ta tahlil`
      );
      res.status(201).json(order);
    })
  );
  app.patch(
    "/api/orders/:id",
    requirePermission("orders.update", "orders.cancel"),
    handle(async (req, res) => {
      const input = updateOrderSchema.parse(req.body);
      const before = await storage.getOrder(req.params.id);
      if (!before) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const touchesCancel = input.status !== void 0 && input.status !== before.status && (input.status === "cancelled" || before.status === "cancelled");
      const editsOther = input.status !== void 0 && !touchesCancel && input.status !== before.status || input.testIds !== void 0 || input.discount !== void 0 || input.paidAmount !== void 0 || input.notes !== void 0 || input.referrer !== void 0;
      if (touchesCancel && !hasPermission(req, "orders.cancel")) {
        return res.status(403).json({ message: "Buyurtmani bekor qilish uchun ruxsatingiz yo'q" });
      }
      if (editsOther && !hasPermission(req, "orders.update")) {
        return res.status(403).json({ message: "Buyurtmani tahrirlash uchun ruxsatingiz yo'q" });
      }
      const order = await storage.updateOrder(req.params.id, input);
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const changes = [];
      if (input.testIds && before.items.length !== order.items.length) {
        changes.push(`tahlillar ${before.items.length} \u2192 ${order.items.length} ta`);
      }
      if (input.discount !== void 0 && before.discount !== order.discount) {
        changes.push(`chegirma ${before.discount} \u2192 ${order.discount}`);
      }
      if (input.status && before.status !== order.status) {
        changes.push(`holat ${before.status} \u2192 ${order.status}`);
      }
      if (input.referrer !== void 0 && (before.referrer ?? "") !== (order.referrer ?? "")) {
        changes.push(`yo'naltirgan: ${order.referrer || "\u2014"}`);
      }
      if (changes.length) {
        await audit(req, "update", "order", order.id, `#${order.orderNumber}: ${changes.join(", ")}`);
      }
      if (order.status === "completed") await notifyIfReady(order);
      res.json(order);
    })
  );
  app.post(
    "/api/orders/:id/results",
    requirePermission("results.enter"),
    handle(async (req, res) => {
      const { results } = saveResultsSchema.parse(req.body);
      const order = await storage.saveResults(req.params.id, results, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      await audit(
        req,
        "results",
        "order",
        order.id,
        `#${order.orderNumber}: ${results.length} ta natija saqlandi`
      );
      const delivery = await notifyIfReady(order);
      res.json({ ...order, telegram: delivery });
    })
  );
  app.post(
    "/api/orders/:id/telegram",
    requirePermission("results.send"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const result = await deliverOrderResults(order, { force: true });
      if (!result.sent) return res.status(400).json({ message: result.reason ?? "Yuborilmadi" });
      res.json({ ...await storage.getOrder(req.params.id), telegram: result });
    })
  );
  app.patch(
    "/api/orders/:id/sample",
    requirePermission("samples.manage"),
    handle(async (req, res) => {
      const input = updateSampleSchema.parse(req.body);
      const result = await storage.updateSampleStatus(req.params.id, input, actorOf(req));
      if (!result) return res.status(404).json({ message: "Namuna topilmadi" });
      if ("error" in result) return res.status(409).json({ message: result.error });
      const { sample, order } = result;
      const detail = input.status === "rad_etildi" ? `rad etildi \u2014 ${sample.rejectReason}` : SAMPLE_STATUS_LABELS[sample.status];
      await audit(req, "sample", "order", order.id, `#${order.orderNumber} namuna: ${detail}`);
      res.json(order);
    })
  );
  app.get(
    "/api/samples/scan",
    requirePermission("samples.manage"),
    handle(async (req, res) => {
      const code = String(req.query.code ?? "");
      const order = await storage.getOrderByBarcode(code);
      if (!order) return res.status(404).json({ message: "Bunday barcode topilmadi" });
      res.json(order);
    })
  );
  app.delete(
    "/api/orders/:id",
    requirePermission("orders.delete"),
    handle(async (req, res) => {
      const before = await storage.getOrder(req.params.id);
      const ok = await storage.deleteOrder(req.params.id);
      if (!ok) return res.status(404).json({ message: "Buyurtma topilmadi" });
      await audit(
        req,
        "delete",
        "order",
        req.params.id,
        `#${before?.orderNumber ?? "?"} buyurtma o'chirildi (${before?.patient?.fullName ?? "\u2014"})`
      );
      res.sendStatus(204);
    })
  );
  app.post(
    "/api/orders/:id/payments",
    requirePermission("payments.create", "payments.refund"),
    handle(async (req, res) => {
      const input = createPaymentSchema.parse(req.body);
      const needed = input.amount < 0 ? "payments.refund" : "payments.create";
      if (!hasPermission(req, needed)) {
        return res.status(403).json({
          message: needed === "payments.refund" ? "To'lovni qaytarish uchun ruxsatingiz yo'q" : "To'lov qabul qilish uchun ruxsatingiz yo'q"
        });
      }
      const order = await storage.addPayment(req.params.id, input, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const latest = order.payments?.[0];
      await audit(
        req,
        latest && latest.amount < 0 ? "refund" : "payment",
        "order",
        order.id,
        `#${order.orderNumber}: ${latest?.amount ?? input.amount} so'm (${input.method})`
      );
      res.status(201).json(order);
    })
  );
  app.delete(
    "/api/payments/:id",
    requirePermission("payments.delete"),
    handle(async (req, res) => {
      const ok = await storage.deletePayment(req.params.id);
      if (!ok) return res.status(404).json({ message: "To'lov topilmadi" });
      await audit(req, "delete", "payment", req.params.id, "To'lov yozuvi o'chirildi");
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/expenses",
    requirePermission("expenses.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listExpenses({
          from: stringParam(req.query.from),
          to: stringParam(req.query.to),
          limit: numberParam(req.query.limit),
          offset: numberParam(req.query.offset, 0)
        })
      );
    })
  );
  app.post(
    "/api/expenses",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const input = insertExpenseSchema.parse(req.body);
      const row = await storage.createExpense(input, actorOf(req));
      await audit(req, "create", "expense", row.id, `${row.category}: ${row.amount} so'm`);
      res.status(201).json(row);
    })
  );
  app.delete(
    "/api/expenses/:id",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const ok = await storage.deleteExpense(req.params.id);
      if (!ok) return res.status(404).json({ message: "Xarajat topilmadi" });
      await audit(req, "delete", "expense", req.params.id, "Xarajat o'chirildi");
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/audit",
    requirePermission("audit.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listAudit({
          entity: stringParam(req.query.entity),
          limit: numberParam(req.query.limit, 50),
          offset: numberParam(req.query.offset, 0)
        })
      );
    })
  );
  app.get(
    "/api/export/patients.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listPatients({ search: stringParam(req.query.search) });
      csvHeaders(res, `bemorlar-${stamp()}.csv`);
      res.send(
        toCsv(
          ["\u2116", "F.I.Sh", "Telefon", "Yosh", "Jinsi", "Manzil", "Telegram", "Ro'yxatdan o'tgan"],
          items.map((p) => [
            p.patientNumber,
            p.fullName,
            p.phone,
            p.age ?? "",
            p.gender ?? "",
            p.address ?? "",
            p.telegramChatId ? "ha" : "yo'q",
            localDay(p.createdAt)
          ])
        )
      );
    })
  );
  app.get(
    "/api/export/orders.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listOrders({
        from: stringParam(req.query.from),
        to: stringParam(req.query.to),
        search: stringParam(req.query.search)
      });
      csvHeaders(res, `buyurtmalar-${stamp()}.csv`);
      res.send(
        toCsv(
          [
            "Buyurtma \u2116",
            "Sana",
            "Bemor \u2116",
            "Bemor",
            "Telefon",
            "Tahlillar",
            "Tahlil soni",
            "Jami",
            "Chegirma",
            "To'langan",
            "Qarz",
            "Holat",
            "Yo'naltirgan"
          ],
          items.map((o) => [
            o.orderNumber,
            localDay(o.createdAt),
            o.patient?.patientNumber ?? "",
            o.patient?.fullName ?? "",
            o.patient?.phone ?? "",
            o.items.map((i) => i.testName).join("; "),
            o.items.length,
            o.totalAmount,
            o.discount,
            o.paidAmount,
            Math.max(0, o.totalAmount - o.paidAmount),
            ORDER_STATUS_LABELS[o.status],
            o.referrer ?? ""
          ])
        )
      );
    })
  );
  app.get(
    "/api/export/expenses.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listExpenses({
        from: stringParam(req.query.from),
        to: stringParam(req.query.to)
      });
      csvHeaders(res, `xarajatlar-${stamp()}.csv`);
      res.send(
        toCsv(
          ["Sana", "Kategoriya", "Summa", "Izoh", "Kim kiritdi"],
          items.map((e) => [e.spentOn, e.category, e.amount, e.note ?? "", e.createdByName ?? ""])
        )
      );
    })
  );
  app.get(
    "/api/backup",
    requirePermission("backup.download"),
    handle(async (req, res) => {
      const [patientsAll, ordersAll, testsAll, usersAll, expensesAll, settings] = await Promise.all([
        storage.listPatients(),
        storage.listOrders(),
        storage.listTests(),
        storage.listUsers(),
        storage.listExpenses(),
        storage.getSettings()
      ]);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="medlab-backup-${stamp()}.json"`);
      res.setHeader("Cache-Control", "no-store");
      await audit(req, "export", "backup", null, "To'liq zaxira nusxa yuklandi");
      res.send(
        JSON.stringify(
          {
            version: 2,
            exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
            settings,
            // Passwords are hashes, but they are still credentials — a backup
            // file gets emailed around, so they do not travel with it.
            users: usersAll.map(({ ...u }) => u),
            tests: testsAll,
            patients: patientsAll.items,
            orders: ordersAll.items,
            expenses: expensesAll.items
          },
          null,
          2
        )
      );
    })
  );
  app.get(
    "/api/stats",
    requireAuth,
    handle(async (req, res) => {
      const stats = await storage.getDashboardStats();
      if (!hasPermission(req, "finance.view")) {
        return res.json({ ...stats, todayRevenue: null, unpaidAmount: null });
      }
      res.json(stats);
    })
  );
  app.get(
    "/api/reports/revenue",
    requirePermission("reports.view"),
    handle(async (req, res) => {
      const today = localDay(/* @__PURE__ */ new Date());
      const defaultFrom = /* @__PURE__ */ new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 29);
      const from = typeof req.query.from === "string" ? req.query.from : localDay(defaultFrom);
      const to = typeof req.query.to === "string" ? req.query.to : today;
      res.json(await storage.getRevenueReport(from, to));
    })
  );
  app.get(
    "/api/settings",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.getSettings());
    })
  );
  app.put(
    "/api/settings",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const saved = await storage.updateSettings(labSettingsSchema.parse(req.body));
      await audit(req, "update", "settings", "default", "Laboratoriya ma'lumotlari yangilandi");
      res.json(saved);
    })
  );
  const denied = (res, message) => res.status(403).json({ message });
  const isSuperRole = (role) => role === SUPER_ADMIN || role === LEGACY_ADMIN;
  async function checkAssignableRole(req, res, requested) {
    const roleKey = requested === LEGACY_ADMIN ? SUPER_ADMIN : requested;
    const role = await storage.getRole(roleKey).catch(() => void 0);
    if (!role && !SYSTEM_ROLE_KEYS.includes(roleKey)) {
      res.status(400).json({ message: "Bunday rol mavjud emas" });
      return false;
    }
    if (roleKey === SUPER_ADMIN) {
      if (!isSuperAdmin(req)) {
        denied(res, "Super administrator rolini faqat super administrator bera oladi");
        return false;
      }
      return true;
    }
    const granted = (await toSessionUser({ ...req.user, role: roleKey })).permissions;
    const missing = granted.filter((p) => !hasPermission(req, p));
    if (missing.length) {
      denied(
        res,
        `Bu rolda sizda yo'q ruxsatlar bor (${missing.map((p) => PERMISSIONS[p].label).join(", ")}). Uni faqat yuqoriroq vakolatli xodim bera oladi.`
      );
      return false;
    }
    return true;
  }
  async function activeSuperAdminCount() {
    return (await storage.listUsers()).filter((u) => u.isActive && isSuperRole(u.role)).length;
  }
  app.get(
    "/api/users",
    requirePermission("users.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listUsers());
    })
  );
  app.post(
    "/api/users",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const input = insertUserSchema.parse(req.body);
      if (!await checkAssignableRole(req, res, input.role)) return;
      if (await storage.getUserByUsername(input.username)) {
        return res.status(409).json({ message: "Bu login allaqachon band" });
      }
      const user = await storage.createUser(input);
      const { roleName } = await toSessionUser(user);
      await audit(req, "create", "user", user.id, `${user.fullName} (${roleName}) qo'shildi`);
      res.status(201).json(user);
    })
  );
  app.patch(
    "/api/users/:id",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const input = updateUserSchema.parse(req.body);
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (isSuperRole(target.role) && !isSuperAdmin(req)) {
        return denied(res, "Super administrator hisobini faqat super administrator o'zgartira oladi");
      }
      const nextRole = input.role;
      const roleChanges = nextRole !== void 0 && nextRole !== target.role;
      const deactivates = input.isActive === false && target.isActive;
      const isSelf = target.id === req.user?.id;
      if (isSelf && roleChanges) {
        return res.status(400).json({ message: "O'z rolingizni o'zgartira olmaysiz" });
      }
      if (isSelf && deactivates) {
        return res.status(400).json({ message: "O'z hisobingizni bloklay olmaysiz" });
      }
      if (roleChanges && !await checkAssignableRole(req, res, nextRole)) return;
      const losesSuper = deactivates || roleChanges && !isSuperRole(nextRole);
      if (isSuperRole(target.role) && target.isActive && losesSuper && await activeSuperAdminCount() <= 1) {
        return res.status(400).json({
          message: "Tizimda kamida bitta faol super administrator qolishi kerak"
        });
      }
      if (input.username) {
        const existing = await storage.getUserByUsername(input.username);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ message: "Bu login allaqachon band" });
        }
      }
      const user = await storage.updateUser(req.params.id, input);
      forgetSessionUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      const changes = [];
      if (roleChanges) {
        const [from, to] = await Promise.all([
          toSessionUser({ ...user, role: target.role }),
          toSessionUser(user)
        ]);
        changes.push(`rol: ${from.roleName} \u2192 ${to.roleName}`);
      }
      if (input.isActive !== void 0 && input.isActive !== target.isActive) {
        changes.push(input.isActive ? "faollashtirildi" : "bloklandi");
      }
      if (input.password) changes.push("paroli almashtirildi");
      if (input.fullName && input.fullName !== target.fullName) changes.push("F.I.Sh o'zgardi");
      if (input.username && input.username !== target.username) changes.push(`login: @${input.username}`);
      await audit(
        req,
        "update",
        "user",
        user.id,
        `${user.fullName} \u2014 ${changes.length ? changes.join(", ") : "ma'lumotlari yangilandi"}`
      );
      res.json(user);
    })
  );
  app.post(
    "/api/users/:id/unlock",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      await storage.setLockState(user.id, registerSuccess());
      await audit(req, "update", "user", user.id, `${user.fullName} \u2014 hisob qulfi ochildi`);
      const { password: _password, ...pub } = user;
      res.json({ ...pub, failedAttempts: 0, lockedUntil: null, lockLevel: 0 });
    })
  );
  app.delete(
    "/api/users/:id",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      if (req.params.id === req.user?.id) {
        return res.status(400).json({ message: "O'z hisobingizni o'chira olmaysiz" });
      }
      const before = await storage.getUser(req.params.id);
      if (!before) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (isSuperRole(before.role)) {
        if (!isSuperAdmin(req)) {
          return denied(res, "Super administrator hisobini faqat super administrator o'chira oladi");
        }
        if (before.isActive && await activeSuperAdminCount() <= 1) {
          return res.status(400).json({
            message: "Tizimda kamida bitta faol super administrator qolishi kerak"
          });
        }
      }
      const profile = await storage.getDoctorByUser(req.params.id).catch(() => void 0);
      if (profile) await storage.deleteDoctor(profile.id);
      const ok = await storage.deleteUser(req.params.id);
      forgetSessionUser(req.params.id);
      if (!ok) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      await audit(req, "delete", "user", req.params.id, `${before.fullName} o'chirildi`);
      res.sendStatus(204);
    })
  );
  async function newRoleKey(name) {
    const base = name.toLowerCase().replace(/[‘’ʻʼ']/g, "").normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "rol";
    const taken = /* @__PURE__ */ new Set([
      ...(await storage.listRoles()).map((r) => r.key),
      ...SYSTEM_ROLE_KEYS,
      LEGACY_ADMIN
    ]);
    let key = base;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    return key;
  }
  const beyondOwn = (req, next, prev = []) => isSuperAdmin(req) ? [] : next.filter((p) => !prev.includes(p) && !hasPermission(req, p));
  const labelList = (list) => list.map((p) => `${PERMISSION_GROUP_LABEL[PERMISSIONS[p].group]}: ${PERMISSIONS[p].label}`).join(", ");
  app.get(
    "/api/roles",
    requirePermission("users.manage", "roles.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listRoles());
    })
  );
  app.post(
    "/api/roles",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      const input = insertRoleSchema.parse(req.body);
      const over = beyondOwn(req, input.permissions);
      if (over.length) {
        return denied(res, `O'zingizda yo'q ruxsatlarni bera olmaysiz: ${labelList(over)}`);
      }
      const role = await storage.createRole({ ...input, key: await newRoleKey(input.name) }, actorOf(req));
      invalidateRoles();
      await audit(
        req,
        "create",
        "role",
        role.key,
        `"${role.name}" roli yaratildi (${role.permissions.length} ta ruxsat)`
      );
      res.status(201).json({ ...role, userCount: 0 });
    })
  );
  app.patch(
    "/api/roles/:key",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      if (req.params.key === SUPER_ADMIN) {
        return res.status(400).json({ message: "Super administrator rolini o'zgartirib bo'lmaydi" });
      }
      const input = updateRoleSchema.parse(req.body);
      const before = await storage.getRole(req.params.key);
      if (!before) return res.status(404).json({ message: "Rol topilmadi" });
      if (input.permissions) {
        const over = beyondOwn(req, input.permissions, before.permissions);
        if (over.length) {
          return denied(res, `O'zingizda yo'q ruxsatlarni bera olmaysiz: ${labelList(over)}`);
        }
      }
      const role = await storage.updateRole(req.params.key, input, actorOf(req));
      if (!role) return res.status(404).json({ message: "Rol topilmadi" });
      invalidateRoles();
      const changes = [];
      if (input.name !== void 0 && input.name !== before.name) changes.push(`nomi "${input.name}"`);
      if (input.permissions) {
        const added = role.permissions.filter((p) => !before.permissions.includes(p));
        const removed = before.permissions.filter((p) => !role.permissions.includes(p));
        if (added.length) changes.push(`qo'shildi: ${labelList(added)}`);
        if (removed.length) changes.push(`olib tashlandi: ${labelList(removed)}`);
      }
      if (changes.length) {
        await audit(req, "update", "role", role.key, `"${role.name}" roli \u2014 ${changes.join("; ")}`);
      }
      const userCount = (await storage.listRoles()).find((r) => r.key === role.key)?.userCount ?? 0;
      res.json({ ...role, userCount });
    })
  );
  app.delete(
    "/api/roles/:key",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      const role = (await storage.listRoles()).find((r) => r.key === req.params.key);
      if (!role) return res.status(404).json({ message: "Rol topilmadi" });
      if (role.isSystem) {
        return res.status(400).json({ message: "TZ'dagi tizim rollarini o'chirib bo'lmaydi" });
      }
      if (role.userCount > 0) {
        return res.status(409).json({
          message: `Bu rolda ${role.userCount} ta xodim bor. Avval ularga boshqa rol bering.`
        });
      }
      await storage.deleteRole(role.key);
      invalidateRoles();
      await audit(req, "delete", "role", role.key, `"${role.name}" roli o'chirildi`);
      res.sendStatus(204);
    })
  );
  const emptyIfMissing = (err, empty) => {
    if (err?.code === "42P01") return empty;
    throw err;
  };
  app.get(
    "/api/departments",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.listDepartments().catch((e) => emptyIfMissing(e, [])));
    })
  );
  async function departmentNameTaken(name, exceptId) {
    const key = name.trim().toLowerCase();
    return (await storage.listDepartments()).some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === key);
  }
  app.post(
    "/api/departments",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const input = insertDepartmentSchema.parse(req.body);
      if (await departmentNameTaken(input.name)) {
        return res.status(409).json({ message: "Bunday nomli bo'lim allaqachon bor" });
      }
      const dept = await storage.createDepartment(input, actorOf(req));
      await audit(req, "create", "department", dept.id, `"${dept.name}" bo'limi qo'shildi (${DEPARTMENT_KIND_LABELS[dept.kind]})`);
      res.status(201).json({ ...dept, doctorCount: 0 });
    })
  );
  app.patch(
    "/api/departments/:id",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const input = updateDepartmentSchema.parse(req.body);
      const before = await storage.getDepartment(req.params.id);
      if (!before) return res.status(404).json({ message: "Bo'lim topilmadi" });
      if (input.name && await departmentNameTaken(input.name, before.id)) {
        return res.status(409).json({ message: "Bunday nomli bo'lim allaqachon bor" });
      }
      const dept = await storage.updateDepartment(req.params.id, input, actorOf(req));
      if (!dept) return res.status(404).json({ message: "Bo'lim topilmadi" });
      const changes = [];
      if (input.name && input.name !== before.name) changes.push(`nomi: ${before.name} \u2192 ${dept.name}`);
      if (input.kind && input.kind !== before.kind) changes.push(`turi: ${DEPARTMENT_KIND_LABELS[dept.kind]}`);
      if (input.isActive !== void 0 && input.isActive !== before.isActive) {
        changes.push(dept.isActive ? "qayta ochildi" : "yopildi");
      }
      await audit(req, "update", "department", dept.id, `"${dept.name}" bo'limi \u2014 ${changes.join(", ") || "tavsif yangilandi"}`);
      const doctorCount = (await storage.listDoctors({ departmentId: dept.id })).length;
      res.json({ ...dept, doctorCount });
    })
  );
  app.delete(
    "/api/departments/:id",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const dept = (await storage.listDepartments()).find((d) => d.id === req.params.id);
      if (!dept) return res.status(404).json({ message: "Bo'lim topilmadi" });
      if (dept.doctorCount > 0) {
        return res.status(409).json({
          message: `Bu bo'limda ${dept.doctorCount} ta shifokor bor. Ularni boshqa bo'limga o'tkazing yoki bo'limni yoping.`
        });
      }
      await storage.deleteDepartment(dept.id);
      await audit(req, "delete", "department", dept.id, `"${dept.name}" bo'limi o'chirildi`);
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/doctors",
    requireAuth,
    handle(async (req, res) => {
      const list = await storage.listDoctors({
        activeOnly: req.query.active === "1",
        departmentId: stringParam(req.query.departmentId)
      }).catch((e) => emptyIfMissing(e, []));
      res.json(list);
    })
  );
  app.get(
    "/api/doctors/candidates",
    requirePermission("doctors.manage"),
    handle(async (_req, res) => {
      const taken = new Set((await storage.listDoctors().catch((e) => emptyIfMissing(e, []))).map((d) => d.userId));
      const users2 = (await storage.listUsers()).filter((u) => u.isActive && !taken.has(u.id)).sort((a, b) => Number(b.role === "shifokor") - Number(a.role === "shifokor") || a.fullName.localeCompare(b.fullName));
      const named = await Promise.all(users2.map(async (u) => ({ id: u.id, fullName: u.fullName, role: u.role, roleName: (await toSessionUser(u)).roleName })));
      res.json(named);
    })
  );
  async function checkDepartment(res, id) {
    if (!id) return true;
    const dept = await storage.getDepartment(id);
    if (!dept) {
      res.status(400).json({ message: "Bo'lim topilmadi" });
      return false;
    }
    if (!dept.isActive) {
      res.status(400).json({ message: `"${dept.name}" bo'limi yopilgan` });
      return false;
    }
    return true;
  }
  app.post(
    "/api/doctors",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const input = insertDoctorSchema.parse(req.body);
      const user = await storage.getUser(input.userId);
      if (!user) return res.status(400).json({ message: "Xodim topilmadi" });
      if (await storage.getDoctorByUser(input.userId)) {
        return res.status(409).json({ message: "Bu xodimning shifokor profili allaqachon bor" });
      }
      if (!await checkDepartment(res, input.departmentId)) return;
      const doctor = await storage.createDoctor(input, actorOf(req));
      await audit(req, "create", "doctor", doctor.id, `${doctor.fullName} \u2014 shifokor profili (${doctor.specialty})`);
      res.status(201).json(doctor);
    })
  );
  app.patch(
    "/api/doctors/:id",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const input = updateDoctorSchema.parse(req.body);
      const before = await storage.getDoctor(req.params.id);
      if (!before) return res.status(404).json({ message: "Shifokor topilmadi" });
      if (input.departmentId && input.departmentId !== before.departmentId) {
        if (!await checkDepartment(res, input.departmentId)) return;
      }
      const doctor = await storage.updateDoctor(req.params.id, input, actorOf(req));
      if (!doctor) return res.status(404).json({ message: "Shifokor topilmadi" });
      const changes = [];
      if (input.specialty && input.specialty !== before.specialty) changes.push(`mutaxassislik: ${doctor.specialty}`);
      if (input.departmentId !== void 0 && doctor.departmentId !== before.departmentId) {
        changes.push(`bo'lim: ${before.departmentName ?? "\u2014"} \u2192 ${doctor.departmentName ?? "\u2014"}`);
      }
      if (input.room !== void 0 && (input.room ?? null) !== before.room) changes.push(`kabinet: ${doctor.room ?? "\u2014"}`);
      if (input.consultationPrice !== void 0 && input.consultationPrice !== before.consultationPrice) {
        changes.push(`narx: ${before.consultationPrice} \u2192 ${doctor.consultationPrice}`);
      }
      if (input.schedule !== void 0) changes.push("ish jadvali yangilandi");
      if (input.isActive !== void 0 && input.isActive !== before.isActive) {
        changes.push(doctor.isActive ? "qabul qayta ochildi" : "qabul to'xtatildi");
      }
      await audit(req, "update", "doctor", doctor.id, `${doctor.fullName} \u2014 ${changes.join(", ") || "profil yangilandi"}`);
      res.json(doctor);
    })
  );
  app.delete(
    "/api/doctors/:id",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const before = await storage.getDoctor(req.params.id);
      if (!before) return res.status(404).json({ message: "Shifokor topilmadi" });
      await storage.deleteDoctor(before.id);
      await audit(req, "delete", "doctor", before.id, `${before.fullName} \u2014 shifokor profili o'chirildi`);
      res.sendStatus(204);
    })
  );
  app.use("/api", (err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(err).toString() });
    }
    if (err?.code === "42P01") {
      return res.status(503).json({
        message: "Ma'lumotlar bazasi yangilanmagan. Administrator migratsiyani ishga tushirishi kerak (npm run db:clinic)."
      });
    }
    if (err instanceof Error) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
}

// server/app.ts
async function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${Date.now() - start}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "\u2026";
      log(logLine);
    });
    next();
  });
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = typeof err === "object" && err && "status" in err ? Number(err.status) : 500;
    const message = err instanceof Error ? err.message : "Ichki xatolik";
    console.error("[error]", err);
    if (!res.headersSent) res.status(status || 500).json({ message });
  });
  return app;
}

// server/serverless.ts
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
var appPromise = createApp();
function restoreOriginalUrl(req) {
  if (!req.url) return;
  const url = new URL(req.url, "http://localhost");
  const original = url.searchParams.get("__path");
  if (!original) return;
  url.searchParams.delete("__path");
  const query = url.searchParams.toString();
  req.url = query ? `${original}?${query}` : original;
}
async function handler(req, res) {
  restoreOriginalUrl(req);
  const app = await appPromise;
  app(req, res);
}
export {
  handler as default
};
