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
      { key: "appointments", label: "Navbat va qabul", description: "Shifokor qabuliga yozish, navbat va shifokor kabineti" },
      { key: "medical", label: "Tibbiy karta", description: "Ko'rik yozuvlari, tashxislar, allergiyalar va yo'llanmalar (TZ \xA75)" },
      { key: "orders", label: "Buyurtmalar", description: "Tahlil buyurtmalari" },
      { key: "lab", label: "Laboratoriya", description: "Namunalar, natijalar va tahlillar katalogi" },
      { key: "finance", label: "Kassa va moliya", description: "To'lovlar, qaytarishlar va xarajatlar" },
      { key: "reports", label: "Hisobotlar", description: "Statistika va ma'lumotlarni yuklab olish" },
      { key: "clinic", label: "Klinika tuzilmasi", description: "Bo'limlar, shifokorlar va xizmatlar" },
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
      "appointments.read": {
        group: "appointments",
        label: "Ko'rish",
        description: "Barcha shifokorlar navbati va qabullar jadvalini ko'rish"
      },
      "appointments.manage": {
        group: "appointments",
        label: "Qabulga yozish",
        description: `Qabulga yozish, "keldi" deb belgilash, ko'chirish va bekor qilish`
      },
      "appointments.serve": {
        group: "appointments",
        label: "Qabul o'tkazish",
        description: "Shifokor kabineti: o'z navbatidagi bemorni chaqirish va qabulni yakunlash"
      },
      "records.read": {
        group: "medical",
        label: "Ko'rish",
        description: "Elektron tibbiy karta: ko'riklar, tashxislar, allergiyalar"
      },
      "records.write": {
        group: "medical",
        label: "Ko'rik yozish",
        description: "O'z qabulidagi bemorga ko'rik yozuvi va allergiya kiritish"
      },
      "records.sign": {
        group: "medical",
        label: "Tasdiqlash",
        description: "O'z ko'rik yozuvini tasdiqlash (tasdiqlangach qulflanadi)"
      },
      "records.amend": {
        group: "medical",
        label: "Tuzatish",
        description: "Tasdiqlangan yozuvga sababli tuzatish kiritish; eski nusxa saqlanadi",
        sensitive: true
      },
      "referrals.read": {
        group: "medical",
        label: "Yo'llanmalarni ko'rish",
        description: "Shifokor yo'llanmalari: tahlil, UZI va tekshiruvlar, konsultatsiyalar"
      },
      "referrals.create": {
        group: "medical",
        label: "Yo'llanma berish",
        description: "O'z qabulidan laboratoriya, tekshiruv va mutaxassis konsultatsiyasiga yo'llanma berish"
      },
      "referrals.manage": {
        group: "medical",
        label: "Yo'llanmalarni boshqarish",
        description: "Bemor foydalanmaydigan yo'llanmani sabab bilan bekor qilish"
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
        description: "Xato kiritilgan buyurtmani o'chirish (faqat to'lovi va natijasi bo'lmasa)",
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
      "results.verify": {
        group: "lab",
        label: "Natijani tasdiqlash",
        description: "Laborant kiritgan natijani tekshirish, tasdiqlash yoki sabab bilan qaytarish (TZ \xA76.1.5)"
      },
      "results.amend": {
        group: "lab",
        label: "Tasdiqlangan natijani tuzatish",
        description: "Tasdiqlangan natijaga sababli tuzatish kiritish; eski qiymat versiya sifatida saqlanadi",
        sensitive: true
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
        label: "To'lov yozuvini bekor qilish",
        description: "Xato kiritilgan to'lovni sabab bilan bekor qilish (yozuv tarixda qoladi)",
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
      "services.manage": {
        group: "clinic",
        label: "Xizmatlar katalogi",
        description: "Xizmatlar (ko'rik, UZI, muolaja) va ularning narxlarini boshqarish"
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
          "services.manage",
          "appointments.read",
          "records.read",
          "referrals.read",
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
          "appointments.read",
          "appointments.manage",
          "referrals.read",
          "referrals.manage",
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
        permissions: [
          "patients.read",
          "orders.read",
          "appointments.serve",
          "records.read",
          "records.write",
          "records.sign",
          "records.amend",
          "referrals.read",
          "referrals.create"
        ]
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
          "results.verify",
          "results.amend",
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
        permissions: ["patients.read", "appointments.read", "orders.read", "finance.view", "payments.create"]
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
          "appointments.read",
          "referrals.read",
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

// shared/patient-identity.ts
function nameKey(name) {
  return (name ?? "").toLowerCase().split("").map((c) => CYR[c] ?? c).join("").replace(/[‘’ʻʼ'`]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ").trim();
}
function shortNameKey(name) {
  return nameKey(name).split(" ").slice(0, 2).join(" ");
}
function normalizePassport(value) {
  const v = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v || null;
}
function normalizePinfl(value) {
  const v = (value ?? "").replace(/\D/g, "");
  return v || null;
}
function compareIdentity(input, candidate) {
  const strong = [];
  const weak = [];
  const pinfl = normalizePinfl(input.pinfl);
  const passport3 = normalizePassport(input.passport);
  const sameName = Boolean(input.fullName) && shortNameKey(input.fullName) === shortNameKey(candidate.fullName);
  const samePhone = (input.phoneDigits ?? "").length === 9 && input.phoneDigits === candidate.phoneDigits;
  const sameBirth = Boolean(input.birthDate) && input.birthDate === candidate.birthDate;
  if (pinfl && pinfl === normalizePinfl(candidate.pinfl)) strong.push("JShShIR bir xil");
  if (passport3 && passport3 === normalizePassport(candidate.passport)) strong.push("Pasport bir xil");
  if (sameName && samePhone) strong.push("Ism va telefon bir xil");
  if (sameName && sameBirth) strong.push("Ism va tug'ilgan sana bir xil");
  if (strong.length) return { strength: "strong", reasons: strong };
  if (samePhone) weak.push("Telefon raqami bir xil");
  if (sameName) weak.push(sameBirth === false && input.birthDate && candidate.birthDate ? "Ismi bir xil, tug'ilgan sanasi boshqa" : "Ismi bir xil");
  return weak.length ? { strength: "weak", reasons: weak } : null;
}
function ageFromBirthDate(birthDate, today = /* @__PURE__ */ new Date()) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || today.getMonth() + 1 === m && today.getDate() < d) age--;
  return age >= 0 ? age : null;
}
function patientAge(p) {
  return ageFromBirthDate(p?.birthDate) ?? p?.age ?? null;
}
var CYR;
var init_patient_identity = __esm({
  "shared/patient-identity.ts"() {
    "use strict";
    CYR = {
      \u0430: "a",
      \u0431: "b",
      \u0432: "v",
      \u0433: "g",
      \u0493: "g'",
      \u0434: "d",
      \u0435: "e",
      \u0451: "yo",
      \u0436: "j",
      \u0437: "z",
      \u0438: "i",
      \u0439: "y",
      \u043A: "k",
      \u049B: "q",
      \u043B: "l",
      \u043C: "m",
      \u043D: "n",
      \u043E: "o",
      \u045E: "o'",
      \u043F: "p",
      \u0440: "r",
      \u0441: "s",
      \u0442: "t",
      \u0443: "u",
      \u0444: "f",
      \u0445: "x",
      \u04B3: "h",
      \u0446: "s",
      \u0447: "ch",
      \u0448: "sh",
      \u0449: "sh",
      \u044A: "",
      \u044B: "i",
      \u044C: "",
      \u044D: "e",
      \u044E: "yu",
      \u044F: "ya"
    };
  }
});

// shared/lab-catalogue.ts
function classifyTest(input) {
  const name = input.name.toLowerCase();
  const cat = input.category.toLowerCase();
  let group;
  if (has(name, "glikgemoglobin", "hba1c", "insulin", "s-peptid", "c-peptid")) group = "diabet";
  else if (has(name, "at-tpo", "anti-tpo", "at-tg", "anti-tg")) group = "immunologiya";
  else if (has(name, "d-dimer", "qon ivish", "protrombin", "fibrinogen", "trombo-test", "mno", "achtv")) group = "koagulologiya";
  else if (has(cat, "gematolog")) group = "gematologiya";
  else if (has(cat, "koagul", "qon ivish")) group = "koagulologiya";
  else if (has(cat, "umumiy klinika") || has(name, "siydik") && !has(cat, "biokim")) group = "siydik";
  else if (has(cat, "kaprolog", "koprolog") || has(name, "ahlat", "najas")) group = "boshqa";
  else if (has(cat, "gormon", "reproduktiv", "ixla")) group = "gormonlar";
  else if (has(cat, "allergiya", "onkomarker", "yallig", "immun")) group = "immunologiya";
  else if (has(cat, "infeksiya", "gepatolog", "gelmint", "ptsr", "pcr", "covid", "ekspress", "jinsiy", "zoonoz", "pulmanolog", "ovqat hazm")) {
    group = "infeksiyalar";
  } else if (has(cat, "biokim", "kardiolog", "suv-tuz", "elektrolit")) group = "biokimyo";
  else group = "boshqa";
  let sampleType;
  if (has(name, "surtma", "mazok")) sampleType = "surtma";
  else if (group === "siydik" || has(name, "siydik")) sampleType = "siydik";
  else if (group === "boshqa" && has(cat, "kaprolog", "koprolog") || has(name, "ahlat", "najas")) sampleType = "najas";
  else if (group === "koagulologiya") sampleType = "qon_sitrat";
  else if (group === "gematologiya" || has(name, "glikgemoglobin", "hba1c") || has(cat, "ptsr", "pcr")) sampleType = "qon_edta";
  else sampleType = "qon_zardob";
  return { group, sampleType };
}
function isTestGroup(value) {
  return typeof value === "string" && TEST_GROUPS.includes(value);
}
function orderGroups(groups) {
  const seen = /* @__PURE__ */ new Set();
  for (const g of Array.from(groups)) if (g) seen.add(g);
  return TEST_GROUPS.filter((g) => seen.has(g));
}
var TEST_GROUPS, SAMPLE_TYPES, SAMPLE_QUALITIES, SAMPLE_QUALITY_LABELS, has;
var init_lab_catalogue = __esm({
  "shared/lab-catalogue.ts"() {
    "use strict";
    TEST_GROUPS = [
      "gematologiya",
      "biokimyo",
      "gormonlar",
      "immunologiya",
      "koagulologiya",
      "diabet",
      "infeksiyalar",
      "siydik",
      "boshqa"
    ];
    SAMPLE_TYPES = ["qon_edta", "qon_zardob", "qon_sitrat", "siydik", "najas", "surtma", "boshqa"];
    SAMPLE_QUALITIES = ["yaxshi", "gemoliz", "lipemiya", "ikterik", "laxta", "kam_hajm"];
    SAMPLE_QUALITY_LABELS = {
      yaxshi: "Yaxshi",
      gemoliz: "Gemoliz",
      lipemiya: "Lipemiya",
      ikterik: "Ikterik",
      laxta: "Laxtalangan",
      kam_hajm: "Hajm yetarli emas"
    };
    has = (text2, ...needles) => needles.some((n) => text2.includes(n));
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  APPOINTMENT_STATUSES: () => APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS: () => APPOINTMENT_STATUS_LABELS,
  DEFAULT_SECURITY_SETTINGS: () => DEFAULT_SECURITY_SETTINGS,
  DEPARTMENT_KINDS: () => DEPARTMENT_KINDS,
  DEPARTMENT_KIND_LABELS: () => DEPARTMENT_KIND_LABELS,
  EXPENSE_CATEGORIES: () => EXPENSE_CATEGORIES,
  EXPENSE_STATUSES: () => EXPENSE_STATUSES,
  NOTIFICATION_KINDS: () => NOTIFICATION_KINDS,
  ORDER_STATUSES: () => ORDER_STATUSES,
  ORDER_STATUS_LABELS: () => ORDER_STATUS_LABELS,
  PAYMENT_METHODS: () => PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS: () => PAYMENT_METHOD_LABELS,
  RECORD_CODE_FIELDS: () => RECORD_CODE_FIELDS,
  RECORD_CODE_FOR: () => RECORD_CODE_FOR,
  RECORD_CODE_LABELS: () => RECORD_CODE_LABELS,
  RECORD_FIELDS: () => RECORD_FIELDS,
  RECORD_FIELD_LABELS: () => RECORD_FIELD_LABELS,
  RECORD_STATUSES: () => RECORD_STATUSES,
  RECORD_STATUS_LABELS: () => RECORD_STATUS_LABELS,
  REFERRAL_EXAM_SERVICE_KINDS: () => REFERRAL_EXAM_SERVICE_KINDS,
  REFERRAL_KINDS: () => REFERRAL_KINDS,
  REFERRAL_KIND_LABELS: () => REFERRAL_KIND_LABELS,
  REFERRAL_STAGES: () => REFERRAL_STAGES,
  REFERRAL_STAGE_LABELS: () => REFERRAL_STAGE_LABELS,
  REFERRAL_STATUSES: () => REFERRAL_STATUSES,
  RESULT_FLAGS: () => RESULT_FLAGS,
  SAMPLE_REJECT_REASONS: () => SAMPLE_REJECT_REASONS,
  SAMPLE_STATUSES: () => SAMPLE_STATUSES,
  SAMPLE_STATUS_LABELS: () => SAMPLE_STATUS_LABELS,
  SERVICE_KINDS: () => SERVICE_KINDS,
  SERVICE_KIND_LABELS: () => SERVICE_KIND_LABELS,
  SESSION_END_CODES: () => SESSION_END_CODES,
  WEEKDAYS: () => WEEKDAYS,
  WEEKDAY_LABELS: () => WEEKDAY_LABELS,
  WEEKDAY_SHORT: () => WEEKDAY_SHORT,
  amendRecordSchema: () => amendRecordSchema,
  amendResultSchema: () => amendResultSchema,
  appSettings: () => appSettings,
  appointmentStatusSchema: () => appointmentStatusSchema,
  appointments: () => appointments,
  auditLog: () => auditLog,
  cancelExpenseSchema: () => cancelExpenseSchema,
  cancelReferralSchema: () => cancelReferralSchema,
  changePasswordSchema: () => changePasswordSchema,
  createAppointmentSchema: () => createAppointmentSchema,
  createOrderSchema: () => createOrderSchema,
  createPaymentSchema: () => createPaymentSchema,
  createReferralSchema: () => createReferralSchema,
  daysBetween: () => daysBetween,
  departments: () => departments,
  doctors: () => doctors,
  emergencyContactSchema: () => emergencyContactSchema,
  expenses: () => expenses,
  icd10: () => icd10,
  importIcdUzSchema: () => importIcdUzSchema,
  insertAllergySchema: () => insertAllergySchema,
  insertDepartmentSchema: () => insertDepartmentSchema,
  insertDoctorSchema: () => insertDoctorSchema,
  insertExpenseSchema: () => insertExpenseSchema,
  insertPatientSchema: () => insertPatientSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertServiceSchema: () => insertServiceSchema,
  insertTestSchema: () => insertTestSchema,
  insertUserSchema: () => insertUserSchema,
  labSettings: () => labSettings,
  labSettingsSchema: () => labSettingsSchema,
  localDayString: () => localDayString,
  loginSchema: () => loginSchema,
  medicalRecordVersions: () => medicalRecordVersions,
  medicalRecords: () => medicalRecords,
  mfaCodeSchema: () => mfaCodeSchema,
  mfaDisableSchema: () => mfaDisableSchema,
  mfaPasswordSchema: () => mfaPasswordSchema,
  nationalPhoneDigits: () => nationalPhoneDigits,
  normalizeUzPhone: () => normalizeUzPhone,
  notifications: () => notifications,
  orderTestVersions: () => orderTestVersions,
  orderTests: () => orderTests,
  orders: () => orders,
  patientAllergies: () => patientAllergies,
  patientContacts: () => patientContacts,
  patients: () => patients,
  payments: () => payments,
  previousRange: () => previousRange,
  recordFieldsSchema: () => recordFieldsSchema,
  referrals: () => referrals,
  removeAllergySchema: () => removeAllergySchema,
  rescheduleAppointmentSchema: () => rescheduleAppointmentSchema,
  returnResultsSchema: () => returnResultsSchema,
  roles: () => roles,
  samples: () => samples,
  saveRecordSchema: () => saveRecordSchema,
  saveResultsSchema: () => saveResultsSchema,
  scheduleSchema: () => scheduleSchema,
  securitySettingsSchema: () => securitySettingsSchema,
  services: () => services,
  sessions: () => sessions,
  signRecordSchema: () => signRecordSchema,
  telegramContacts: () => telegramContacts,
  tests: () => tests,
  updateDepartmentSchema: () => updateDepartmentSchema,
  updateDoctorSchema: () => updateDoctorSchema,
  updateExpenseSchema: () => updateExpenseSchema,
  updateIcdUzSchema: () => updateIcdUzSchema,
  updateOrderSchema: () => updateOrderSchema,
  updateRoleSchema: () => updateRoleSchema,
  updateSampleSchema: () => updateSampleSchema,
  updateServiceSchema: () => updateServiceSchema,
  updateUserSchema: () => updateUserSchema,
  userMfa: () => userMfa,
  users: () => users,
  verifyResultsSchema: () => verifyResultsSchema,
  visits: () => visits,
  voidPaymentSchema: () => voidPaymentSchema
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, index, json, uniqueIndex } from "drizzle-orm/pg-core";
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
function previousRange(from, to) {
  const day = 864e5;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const days = Math.max(0, Math.round((end - start) / day)) + 1;
  const iso2 = (t) => new Date(t).toISOString().slice(0, 10);
  return { from: iso2(start - days * day), to: iso2(start - day) };
}
function daysBetween(from, to) {
  const out = [];
  const day = 864e5;
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end && out.length < 400; t += day) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
function localDayString(value) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
var money, isoTimestamp, ORDER_STATUSES, ORDER_STATUS_LABELS, RESULT_FLAGS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SAMPLE_STATUSES, SAMPLE_STATUS_LABELS, SAMPLE_REJECT_REASONS, EXPENSE_CATEGORIES, EXPENSE_STATUSES, DEPARTMENT_KINDS, DEPARTMENT_KIND_LABELS, SERVICE_KINDS, SERVICE_KIND_LABELS, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, RECORD_STATUSES, RECORD_STATUS_LABELS, RECORD_FIELDS, RECORD_CODE_FIELDS, RECORD_CODE_FOR, RECORD_CODE_LABELS, RECORD_FIELD_LABELS, REFERRAL_KINDS, REFERRAL_KIND_LABELS, REFERRAL_EXAM_SERVICE_KINDS, REFERRAL_STATUSES, REFERRAL_STAGES, REFERRAL_STAGE_LABELS, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_LABELS, users, roles, userMfa, departments, doctors, services, appointments, medicalRecords, medicalRecordVersions, referrals, icd10, notifications, patientAllergies, patients, patientContacts, tests, visits, orders, orderTests, orderTestVersions, samples, payments, expenses, auditLog, telegramContacts, sessions, appSettings, labSettings, NOTIFICATION_KINDS, birthDateSchema, emergencyContactSchema, insertPatientSchema, insertTestSchema, uniqueTestIds, createOrderSchema, updateOrderSchema, updateSampleSchema, createPaymentSchema, voidPaymentSchema, insertExpenseSchema, updateExpenseSchema, cancelExpenseSchema, changePasswordSchema, saveResultsSchema, insertUserSchema, updateUserSchema, permissionList, insertRoleSchema, updateRoleSchema, timeOfDay, scheduleSchema, insertDepartmentSchema, updateDepartmentSchema, insertDoctorSchema, updateDoctorSchema, insertServiceSchema, updateServiceSchema, dayString, createAppointmentSchema, rescheduleAppointmentSchema, appointmentStatusSchema, recordText, icdCode, recordFieldsSchema, saveRecordSchema, signRecordSchema, amendRecordSchema, insertAllergySchema, referralNote, createReferralSchema, cancelReferralSchema, verifyResultsSchema, returnResultsSchema, amendResultSchema, updateIcdUzSchema, importIcdUzSchema, removeAllergySchema, securitySettingsSchema, DEFAULT_SECURITY_SETTINGS, mfaCodeSchema, mfaPasswordSchema, mfaDisableSchema, SESSION_END_CODES, loginSchema, labSettingsSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_permissions();
    init_patient_identity();
    init_lab_catalogue();
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
    PAYMENT_METHOD_LABELS = {
      naqd: "Naqd",
      karta: "Karta",
      "o'tkazma": "Bank o'tkazmasi"
    };
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
    EXPENSE_STATUSES = ["active", "cancelled"];
    DEPARTMENT_KINDS = ["ambulator", "diagnostika", "laboratoriya", "statsionar", "boshqa"];
    DEPARTMENT_KIND_LABELS = {
      ambulator: "Ambulator qabul",
      diagnostika: "Diagnostika",
      laboratoriya: "Laboratoriya",
      statsionar: "Statsionar",
      boshqa: "Boshqa"
    };
    SERVICE_KINDS = ["konsultatsiya", "uzi", "muolaja", "boshqa"];
    SERVICE_KIND_LABELS = {
      konsultatsiya: "Shifokor ko'rigi",
      laboratoriya: "Laboratoriya",
      uzi: "UZI",
      muolaja: "Muolaja",
      boshqa: "Boshqa"
    };
    APPOINTMENT_STATUSES = ["scheduled", "arrived", "in_progress", "completed", "no_show", "cancelled"];
    APPOINTMENT_STATUS_LABELS = {
      scheduled: "Yozildi",
      arrived: "Keldi",
      in_progress: "Qabulda",
      completed: "Yakunlandi",
      no_show: "Kelmadi",
      cancelled: "Bekor qilindi"
    };
    RECORD_STATUSES = ["draft", "signed"];
    RECORD_STATUS_LABELS = {
      draft: "Qoralama",
      signed: "Tasdiqlangan"
    };
    RECORD_FIELDS = [
      "complaints",
      "anamnesis",
      "examination",
      "preliminaryDiagnosis",
      "finalDiagnosis",
      "recommendations"
    ];
    RECORD_CODE_FIELDS = ["preliminaryDiagnosisCode", "finalDiagnosisCode"];
    RECORD_CODE_FOR = {
      preliminaryDiagnosis: "preliminaryDiagnosisCode",
      finalDiagnosis: "finalDiagnosisCode"
    };
    RECORD_CODE_LABELS = {
      preliminaryDiagnosisCode: "Dastlabki tashxis MKB-10 kodi",
      finalDiagnosisCode: "Yakuniy tashxis MKB-10 kodi"
    };
    RECORD_FIELD_LABELS = {
      complaints: "Shikoyatlar",
      anamnesis: "Anamnez",
      examination: "Ko'rik natijalari",
      preliminaryDiagnosis: "Dastlabki tashxis",
      finalDiagnosis: "Yakuniy tashxis",
      recommendations: "Tavsiyalar"
    };
    REFERRAL_KINDS = ["lab", "exam", "consult"];
    REFERRAL_KIND_LABELS = {
      lab: "Laboratoriya tahlillari",
      exam: "Tekshiruv",
      consult: "Mutaxassis konsultatsiyasi"
    };
    REFERRAL_EXAM_SERVICE_KINDS = ["uzi", "boshqa"];
    REFERRAL_STATUSES = ["active", "cancelled"];
    REFERRAL_STAGES = ["awaiting_booking", "scheduled", "in_lab", "done", "cancelled"];
    REFERRAL_STAGE_LABELS = {
      awaiting_booking: "Navbatga yozilmagan",
      scheduled: "Navbatga yozilgan",
      in_lab: "Laboratoriyada",
      done: "Bajarildi",
      cancelled: "Bekor qilingan"
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
      createdBy: varchar("created_by"),
      /** Profile edits by an admin. Sign-in lock bookkeeping below does not count. */
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by"),
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
      /** Null for the built-in roles, which the system seeds. */
      createdBy: varchar("created_by"),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by")
    });
    userMfa = pgTable("user_mfa", {
      userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
      secret: text("secret").notNull(),
      lastUsedStep: integer("last_used_step").notNull().default(0),
      recoveryCodes: text("recovery_codes").array().notNull().default(sql`'{}'::text[]`),
      enabledAt: isoTimestamp("enabled_at").defaultNow().notNull(),
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
      createdBy: varchar("created_by"),
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
        createdBy: varchar("created_by"),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by")
      },
      (t) => ({ departmentIdx: index("IDX_doctors_department").on(t.departmentId) })
    );
    services = pgTable(
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
        updatedBy: varchar("updated_by")
      },
      (t) => ({ departmentIdx: index("IDX_services_department").on(t.departmentId) })
    );
    appointments = pgTable(
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
        /** The referral this booking fulfils (B3.5), if any. */
        referralId: varchar("referral_id"),
        arrivedAt: isoTimestamp("arrived_at"),
        startedAt: isoTimestamp("started_at"),
        completedAt: isoTimestamp("completed_at"),
        cancelledAt: isoTimestamp("cancelled_at"),
        cancelledBy: varchar("cancelled_by"),
        cancelReason: text("cancel_reason"),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        createdBy: varchar("created_by"),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by")
      },
      (t) => ({
        dayIdx: index("IDX_appointments_date_doctor").on(t.date, t.doctorId),
        patientIdx: index("IDX_appointments_patient").on(t.patientId),
        queueIdx: uniqueIndex("UQ_appointments_queue").on(t.doctorId, t.date, t.queueNumber),
        // One live booking per doctor per start time — the database is the last
        // word when two registrars take the same slot at the same moment.
        slotIdx: uniqueIndex("UQ_appointments_slot").on(t.doctorId, t.date, t.startTime).where(sql`status NOT IN ('cancelled', 'no_show')`),
        // One live booking per referral: two registrars cannot book it twice.
        referralIdx: uniqueIndex("UQ_appointments_referral").on(t.referralId).where(sql`referral_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show')`)
      })
    );
    medicalRecords = pgTable(
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
        /** MKB-10 codes for the two diagnoses (B3.4) — optional; the text stays the diagnosis. */
        preliminaryDiagnosisCode: varchar("preliminary_diagnosis_code"),
        finalDiagnosisCode: varchar("final_diagnosis_code"),
        signedAt: isoTimestamp("signed_at"),
        signedBy: varchar("signed_by"),
        /** The last correction: when, and why. */
        amendedAt: isoTimestamp("amended_at"),
        amendReason: text("amend_reason"),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        createdBy: varchar("created_by"),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by")
      },
      (t) => ({
        appointmentIdx: uniqueIndex("UQ_medical_records_appointment").on(t.appointmentId),
        patientIdx: index("IDX_medical_records_patient").on(t.patientId),
        doctorStatusIdx: index("IDX_medical_records_doctor_status").on(t.doctorId, t.status)
      })
    );
    medicalRecordVersions = pgTable(
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
        preliminaryDiagnosisCode: varchar("preliminary_diagnosis_code"),
        finalDiagnosisCode: varchar("final_diagnosis_code"),
        signedAt: isoTimestamp("signed_at"),
        signedBy: varchar("signed_by"),
        /** Who replaced this version, when, and why. */
        replacedAt: isoTimestamp("replaced_at").defaultNow().notNull(),
        replacedBy: varchar("replaced_by"),
        replaceReason: text("replace_reason").notNull()
      },
      (t) => ({ recordVersionIdx: uniqueIndex("UQ_medical_record_versions").on(t.recordId, t.version) })
    );
    referrals = pgTable(
      "referrals",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        /** "Yo'llanma №12": what the patient and the lab quote. */
        referralNumber: integer("referral_number").generatedByDefaultAsIdentity({ startWith: 1 }).notNull(),
        patientId: varchar("patient_id").notNull(),
        visitId: varchar("visit_id"),
        /** The examination it was issued from; null only for future non-clinic sources. */
        appointmentId: varchar("appointment_id"),
        /** Issuing doctor (doctors.id). */
        doctorId: varchar("doctor_id").notNull(),
        kind: text("kind").notNull(),
        status: text("status").notNull().default("active"),
        /** exam: the catalogue service (UZI, ...). */
        serviceId: varchar("service_id"),
        /** consult: the specialty, and optionally the one doctor asked for. */
        targetSpecialty: text("target_specialty"),
        targetDoctorId: varchar("target_doctor_id"),
        /** Clinical indication: why the doctor sends the patient. */
        note: text("note"),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        createdBy: varchar("created_by"),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by"),
        cancelledAt: isoTimestamp("cancelled_at"),
        cancelledBy: varchar("cancelled_by"),
        cancelReason: text("cancel_reason")
      },
      (t) => ({
        patientIdx: index("IDX_referrals_patient").on(t.patientId),
        appointmentIdx: index("IDX_referrals_appointment").on(t.appointmentId),
        statusIdx: index("IDX_referrals_status_kind").on(t.status, t.kind)
      })
    );
    icd10 = pgTable(
      "icd10",
      {
        code: varchar("code").primaryKey(),
        kind: text("kind").notNull(),
        nameRu: text("name_ru").notNull(),
        nameUz: text("name_uz"),
        chapter: varchar("chapter").notNull(),
        block: varchar("block"),
        parentCode: varchar("parent_code"),
        isActual: boolean("is_actual").notNull().default(true),
        selectable: boolean("selectable").notNull().default(false),
        sortOrder: integer("sort_order").notNull(),
        updatedAt: isoTimestamp("updated_at"),
        updatedBy: varchar("updated_by")
      },
      (t) => ({ sortIdx: index("IDX_icd10_sort").on(t.sortOrder) })
    );
    notifications = pgTable(
      "notifications",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        userId: varchar("user_id").notNull(),
        kind: text("kind").notNull(),
        title: text("title").notNull(),
        body: text("body"),
        /** Where clicking it takes the reader, an app path. */
        link: text("link"),
        /** The order (or other row) it is about. */
        entityId: varchar("entity_id"),
        /** Out-of-range values or a correction: drawn so it is not missed. */
        important: boolean("important").notNull().default(false),
        dedupeKey: text("dedupe_key").unique(),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        readAt: isoTimestamp("read_at")
      },
      (t) => ({ userIdx: index("IDX_notifications_user").on(t.userId, t.createdAt) })
    );
    patientAllergies = pgTable(
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
        removeReason: text("remove_reason")
      },
      (t) => ({ patientIdx: index("IDX_patient_allergies_patient").on(t.patientId) })
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
      createdBy: varchar("created_by"),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by"),
      // Set by the Telegram bot when the patient shares their contact; null means
      // "not connected yet", and results for them stay queued until they are.
      telegramChatId: text("telegram_chat_id"),
      telegramLinkedAt: isoTimestamp("telegram_linked_at")
    });
    patientContacts = pgTable(
      "patient_contacts",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        patientId: varchar("patient_id").notNull(),
        name: text("name").notNull(),
        /** "Onasi", "Turmush o'rtog'i"… free text. */
        relation: text("relation"),
        phone: text("phone").notNull(),
        isEmergency: boolean("is_emergency").notNull().default(true),
        createdAt: isoTimestamp("created_at").defaultNow().notNull()
      },
      (t) => ({ patientIdx: index("IDX_patient_contacts_patient").on(t.patientId) })
    );
    tests = pgTable("tests", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      name: text("name").notNull(),
      price: money("price").notNull(),
      category: text("category").notNull(),
      /** One of the eight TZ §6.2 groups (shared/lab-catalogue.ts); `category` stays the clinic's finer heading. */
      group: text("group").notNull().default("boshqa"),
      /** What is drawn and into which container (B4.3). */
      sampleType: text("sample_type").notNull().default("qon_zardob"),
      unit: text("unit"),
      referenceRange: text("reference_range"),
      isActive: boolean("is_active").notNull().default(true),
      /** Null on catalogue rows that predate these columns (B1.10). */
      createdAt: isoTimestamp("created_at").defaultNow(),
      createdBy: varchar("created_by"),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by")
    });
    visits = pgTable(
      "visits",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        patientId: varchar("patient_id").notNull(),
        /** The clinic's local calendar day, YYYY-MM-DD. */
        visitDate: text("visit_date").notNull(),
        createdAt: isoTimestamp("created_at").defaultNow().notNull(),
        createdBy: varchar("created_by")
      },
      (t) => ({
        patientDayIdx: uniqueIndex("UQ_visits_patient_day").on(t.patientId, t.visitDate)
      })
    );
    orders = pgTable("orders", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      // Human-facing receipt number. Postgres assigns it from an identity
      // sequence so concurrent registrars can never collide on the same number.
      orderNumber: integer("order_number").generatedByDefaultAsIdentity({ startWith: 1001 }).notNull(),
      patientId: varchar("patient_id").notNull(),
      /** The visit this order belongs to; null only for rows older than visits. */
      visitId: varchar("visit_id"),
      /** The doctor's lab referral this order fulfils (B3.5); null for desk orders. UQ_orders_referral (migration). */
      referralId: varchar("referral_id"),
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
      /** Staff edits: tests, discount, status, results, payments. Telegram delivery is not one. */
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by"),
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
      /** Snapshot like the price: the tube this line was drawn into (B4.3). Null on older lines. */
      sampleType: text("sample_type"),
      result: text("result"),
      flag: text("flag"),
      notes: text("notes"),
      /** Who signed off this value. A result on a medical form always has to be
          answerable for, and orders.createdBy only covers the registration. */
      enteredBy: varchar("entered_by"),
      /** The same person as an id, so verification can tell who checked whose work. */
      enteredById: varchar("entered_by_id"),
      completedAt: isoTimestamp("completed_at"),
      /**
       * Verification by the lab head (TZ §6.1.5, B4.5). Only a verified value
       * leaves the lab — on the blank, to Telegram, to the doctor. Once verified
       * the value is locked; a correction goes through amendment and keeps the
       * replaced value in order_test_versions.
       */
      verifiedAt: isoTimestamp("verified_at"),
      verifiedBy: varchar("verified_by"),
      verifiedByName: text("verified_by_name"),
      /** Sent back to the laborant with a reason; cleared when the value is re-entered. */
      returnedAt: isoTimestamp("returned_at"),
      returnedByName: text("returned_by_name"),
      returnReason: text("return_reason"),
      /** 1 for the value as first verified; each amendment adds one. */
      version: integer("version").notNull().default(1)
    }, (t) => ({
      // Backs the "has any order used this test?" check that guards deletion.
      testIdx: index("IDX_order_tests_test").on(t.testId)
    }));
    orderTestVersions = pgTable(
      "order_test_versions",
      {
        id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
        orderTestId: varchar("order_test_id").notNull(),
        orderId: varchar("order_id").notNull(),
        version: integer("version").notNull(),
        result: text("result"),
        flag: text("flag"),
        notes: text("notes"),
        enteredBy: text("entered_by"),
        verifiedAt: isoTimestamp("verified_at"),
        verifiedByName: text("verified_by_name"),
        replacedAt: isoTimestamp("replaced_at").defaultNow().notNull(),
        replacedBy: varchar("replaced_by"),
        replacedByName: text("replaced_by_name"),
        replaceReason: text("replace_reason").notNull()
      },
      (t) => ({ lineVersionIdx: uniqueIndex("UQ_order_test_versions").on(t.orderTestId, t.version) })
    );
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
        /** Quality judged on reception (TZ §6.1.3 "namuna sifati"); null until received. */
        quality: text("quality"),
        qualityNote: text("quality_note"),
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
      createdAt: isoTimestamp("created_at").defaultNow().notNull(),
      voidedAt: isoTimestamp("voided_at"),
      voidedBy: varchar("voided_by"),
      voidedByName: text("voided_by_name"),
      voidReason: text("void_reason")
    });
    expenses = pgTable("expenses", {
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
      updatedBy: varchar("updated_by")
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
    appSettings = pgTable("app_settings", {
      key: varchar("key").primaryKey(),
      value: json("value").notNull(),
      updatedAt: isoTimestamp("updated_at"),
      updatedBy: varchar("updated_by")
    });
    labSettings = pgTable("lab_settings", {
      id: varchar("id").primaryKey().default("default"),
      labName: text("lab_name").notNull().default("MedLab"),
      tagline: text("tagline").notNull().default("Tibbiy Laboratoriya"),
      address: text("address"),
      phone: text("phone"),
      director: text("director"),
      licenseNumber: text("license_number")
    });
    NOTIFICATION_KINDS = ["lab_result", "lab_result_amended"];
    birthDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tug'ilgan sanani tanlang").refine((v) => !Number.isNaN(Date.parse(v)), "Sana noto'g'ri").refine((v) => v <= localDayString(/* @__PURE__ */ new Date()), "Tug'ilgan sana kelajakda bo'lishi mumkin emas").refine((v) => Number(v.slice(0, 4)) >= (/* @__PURE__ */ new Date()).getFullYear() - 130, "Tug'ilgan sanani tekshiring");
    emergencyContactSchema = z.object({
      name: z.string().trim().min(2, "Aloqa uchun shaxs ismini kiriting").max(120),
      relation: z.string().trim().max(60).nullish().transform((v) => v || null),
      phone: z.string().trim().min(7, "Telefon raqamini to'g'ri kiriting").transform(normalizeUzPhone)
    });
    insertPatientSchema = createInsertSchema(patients).omit({
      id: true,
      patientNumber: true,
      createdAt: true,
      createdBy: true,
      updatedAt: true,
      updatedBy: true,
      telegramChatId: true,
      telegramLinkedAt: true
    }).extend({
      birthDate: z.union([birthDateSchema, z.literal("")]).nullish().transform((v) => v || null),
      passport: z.string().trim().max(20, "Pasport raqami juda uzun").nullish().transform((v) => normalizePassport(v)).refine((v) => v === null || /^[A-Z]{2}\d{7}$/.test(v) || /^[A-Z0-9]{5,20}$/.test(v), "Pasport raqamini tekshiring"),
      pinfl: z.string().nullish().transform((v) => normalizePinfl(v)).refine((v) => v === null || /^\d{14}$/.test(v), "JShShIR 14 ta raqamdan iborat bo'lishi kerak"),
      /** Replaces the emergency contact; null removes it, undefined leaves it alone. */
      emergencyContact: emergencyContactSchema.nullish(),
      /** Sent after the registrar has seen the duplicate warning and confirmed. */
      allowDuplicate: z.boolean().optional(),
      fullName: z.string().trim().min(3, "F.I.Sh kamida 3 ta belgidan iborat bo'lishi kerak"),
      phone: z.string().trim().min(7, "Telefon raqamini to'g'ri kiriting").transform(normalizeUzPhone),
      age: z.coerce.number().int().min(0, "Yosh manfiy bo'lmasligi kerak").max(130, "Yoshni tekshiring").nullish(),
      gender: z.enum(["erkak", "ayol"]).nullish(),
      address: z.string().trim().nullish()
    });
    insertTestSchema = createInsertSchema(tests).omit({ id: true, createdAt: true, createdBy: true, updatedAt: true, updatedBy: true }).extend({
      name: z.string().trim().min(2, "Tahlil nomini kiriting"),
      price: z.coerce.number().int().min(0, "Narx manfiy bo'lmasligi kerak"),
      category: z.string().trim().min(2, "Kategoriyani tanlang"),
      group: z.enum(TEST_GROUPS, { errorMap: () => ({ message: "Guruhni tanlang" }) }),
      sampleType: z.enum(SAMPLE_TYPES, { errorMap: () => ({ message: "Namuna turini tanlang" }) }),
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
      rejectNote: z.string().trim().max(300).nullish(),
      /** On reception only; "yaxshi" when not given. */
      quality: z.enum(SAMPLE_QUALITIES).nullish(),
      qualityNote: z.string().trim().max(300).nullish()
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
    voidPaymentSchema = z.object({
      reason: z.string().trim().min(5, "Bekor qilish sababini yozing (kamida 5 belgi)").max(300, "Juda uzun")
    });
    insertExpenseSchema = z.object({
      category: z.enum(EXPENSE_CATEGORIES),
      amount: z.coerce.number().int().min(1, "Summani kiriting").max(1e10, "Summani tekshiring"),
      method: z.enum(PAYMENT_METHODS).default("naqd"),
      payee: z.string().trim().max(120, "Juda uzun").nullish().transform((v) => v || null),
      note: z.string().trim().max(300, "Izoh juda uzun").nullish().transform((v) => v || null),
      spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang").default(() => localDayString(/* @__PURE__ */ new Date()))
    });
    updateExpenseSchema = insertExpenseSchema.partial();
    cancelExpenseSchema = z.object({
      reason: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300, "Juda uzun")
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
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true,
      createdBy: true,
      updatedAt: true,
      updatedBy: true,
      failedAttempts: true,
      lockedUntil: true,
      lockLevel: true,
      lastFailedAt: true
    }).extend({
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
    insertServiceSchema = z.object({
      name: z.string().trim().min(2, "Xizmat nomini kiriting").max(120, "Nom juda uzun"),
      kind: z.enum(SERVICE_KINDS, { errorMap: () => ({ message: "Xizmat turini tanlang" }) }),
      departmentId: z.string().min(1).nullish().transform((v) => v || null),
      price: z.coerce.number().int("Narx butun son bo'lishi kerak").min(0, "Narx manfiy bo'lmasligi kerak").max(1e8, "Narx juda katta"),
      durationMinutes: z.coerce.number().int().min(5, "Kamida 5 daqiqa").max(480, "Ko'pi bilan 8 soat").nullish().transform((v) => v ?? null),
      description: z.string().trim().max(300, "Tavsif juda uzun").nullish().transform((v) => v || null),
      isActive: z.boolean().default(true)
    });
    updateServiceSchema = insertServiceSchema.partial();
    dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani YYYY-MM-DD ko'rinishida kiriting");
    createAppointmentSchema = z.object({
      patientId: z.string().min(1, "Bemorni tanlang"),
      doctorId: z.string().min(1, "Shifokorni tanlang"),
      serviceId: z.string().min(1).nullish().transform((v) => v || null),
      date: dayString,
      startTime: timeOfDay,
      reason: z.string().trim().max(300, "Juda uzun").nullish().transform((v) => v || null),
      /** Booking a doctor's referral (B3.5). */
      referralId: z.string().min(1).nullish().transform((v) => v || null)
    });
    rescheduleAppointmentSchema = createAppointmentSchema.omit({ patientId: true, referralId: true }).partial().refine(
      (v) => Object.values(v).some((x) => x !== void 0),
      "O'zgartirish uchun ma'lumot yo'q"
    );
    appointmentStatusSchema = z.object({
      status: z.enum(APPOINTMENT_STATUSES),
      reason: z.string().trim().max(300, "Juda uzun").nullish().transform((v) => v || null)
    });
    recordText = z.string().max(4e3, "Matn juda uzun (ko'pi bilan 4000 belgi)").nullish().transform((v) => v?.trim() ? v.trim() : null);
    icdCode = z.string().trim().toUpperCase().nullish().transform((v) => v || null).refine((v) => v === null || /^[A-Z]\d\d(\.\d{1,2})?$/.test(v), "MKB-10 kodi noto'g'ri (masalan: I10, E11.9)");
    recordFieldsSchema = z.object({
      complaints: recordText,
      anamnesis: recordText,
      examination: recordText,
      preliminaryDiagnosis: recordText,
      finalDiagnosis: recordText,
      recommendations: recordText,
      preliminaryDiagnosisCode: icdCode,
      finalDiagnosisCode: icdCode
    });
    saveRecordSchema = recordFieldsSchema.partial().extend({
      revision: z.number().int().min(0)
    });
    signRecordSchema = z.object({ revision: z.number().int().min(0) });
    amendRecordSchema = recordFieldsSchema.extend({
      revision: z.number().int().min(0),
      reason: z.string().trim().min(5, "Tuzatish sababini yozing (kamida 5 belgi)").max(300, "Juda uzun")
    });
    insertAllergySchema = z.object({
      allergen: z.string().trim().min(2, "Allergenni kiriting").max(120, "Juda uzun"),
      reaction: z.string().trim().max(200, "Juda uzun").nullish().transform((v) => v || null)
    });
    referralNote = z.string().trim().max(500, "Juda uzun").nullish().transform((v) => v || null);
    createReferralSchema = z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("lab"),
        testIds: z.array(z.string().min(1)).min(1, "Kamida bitta tahlilni tanlang").max(60, "Juda ko'p tahlil").transform((ids) => Array.from(new Set(ids))),
        note: referralNote
      }),
      z.object({
        kind: z.literal("exam"),
        serviceIds: z.array(z.string().min(1)).min(1, "Kamida bitta tekshiruvni tanlang").max(10, "Juda ko'p tekshiruv").transform((ids) => Array.from(new Set(ids))),
        note: referralNote
      }),
      z.object({
        kind: z.literal("consult"),
        targetSpecialty: z.string().trim().min(2, "Mutaxassislikni tanlang").max(80, "Juda uzun"),
        targetDoctorId: z.string().min(1).nullish().transform((v) => v || null),
        note: z.string().trim().min(3, "Konsultatsiya sababini yozing").max(500, "Juda uzun")
      })
    ]);
    cancelReferralSchema = z.object({
      reason: z.string().trim().min(3, "Bekor qilish sababini yozing").max(300, "Juda uzun")
    });
    verifyResultsSchema = z.object({
      itemIds: z.array(z.string().min(1)).max(200).optional()
    });
    returnResultsSchema = z.object({
      itemIds: z.array(z.string().min(1)).min(1, "Qaytariladigan tahlilni tanlang").max(200),
      reason: z.string().trim().min(3, "Qaytarish sababini yozing").max(300, "Juda uzun")
    });
    amendResultSchema = z.object({
      result: z.string().trim().min(1, "Natijani kiriting").max(200, "Juda uzun"),
      flag: z.enum(RESULT_FLAGS).nullish().transform((v) => v ?? null),
      notes: z.string().trim().max(300, "Juda uzun").nullish().transform((v) => v || null),
      reason: z.string().trim().min(5, "Tuzatish sababini yozing (kamida 5 belgi)").max(300, "Juda uzun")
    });
    updateIcdUzSchema = z.object({
      nameUz: z.string().trim().max(400, "Juda uzun").nullish().transform((v) => v || null)
    });
    importIcdUzSchema = z.object({
      csv: z.string().min(1, "Fayl bo'sh").max(5e6, "Fayl juda katta")
    });
    removeAllergySchema = z.object({
      reason: z.string().trim().min(3, "Sababini yozing").max(200, "Juda uzun")
    });
    securitySettingsSchema = z.object({
      sessionIdleMinutes: z.coerce.number().int().min(5, "Kamida 5 daqiqa").max(480, "Ko'pi bilan 8 soat"),
      sessionMaxHours: z.coerce.number().int().min(1, "Kamida 1 soat").max(168, "Ko'pi bilan 7 kun"),
      /**
       * Role keys whose holders must sign in with a second factor (TZ §12). Staff
       * in these roles who have not enrolled are sent to the enrolment screen on
       * their next sign-in; they cannot switch 2FA off.
       */
      mfaRequiredRoles: z.array(z.string().trim().min(1).max(64)).max(100).transform((keys) => [...new Set(keys)])
    });
    DEFAULT_SECURITY_SETTINGS = {
      sessionIdleMinutes: 30,
      sessionMaxHours: 12,
      mfaRequiredRoles: []
    };
    mfaCodeSchema = z.object({
      code: z.string().trim().min(1, "Kodni kiriting").max(32, "Kod juda uzun")
    });
    mfaPasswordSchema = z.object({
      password: z.string().min(1, "Joriy parolni kiriting")
    });
    mfaDisableSchema = mfaPasswordSchema.merge(mfaCodeSchema);
    SESSION_END_CODES = ["SESSION_IDLE", "SESSION_MAX", "SESSION_REVOKED"];
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
function planResultSave(lines, incoming, gender) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const changes = [];
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
function buildPatientCard(patient, orderList, visitList, payments2, appointmentList = []) {
  const visitDate = new Map(visitList.map((v) => [v.id, v.visitDate]));
  const groups = /* @__PURE__ */ new Map();
  const attended = appointmentList.filter((a) => ATTENDED_STATUSES.includes(a.status));
  for (const a of attended) {
    const key = a.visitId ?? `day:${a.date}`;
    const date = a.visitId && visitDate.get(a.visitId) || a.date;
    const g = groups.get(key) ?? { key, date, orders: [], appointments: [], billed: 0, paid: 0 };
    g.appointments.push(a);
    groups.set(key, g);
  }
  for (const order of orderList) {
    const key = order.visitId ?? `day:${localDay(order.createdAt)}`;
    const date = order.visitId && visitDate.get(order.visitId) || localDay(order.createdAt);
    const g = groups.get(key) ?? { key, date, orders: [], appointments: [], billed: 0, paid: 0 };
    g.orders.push(order);
    if (order.status !== "cancelled") {
      g.billed += order.totalAmount;
      g.paid += order.paidAmount;
    }
    groups.set(key, g);
  }
  const visits2 = [...groups.values()].map((g) => ({
    ...g,
    orders: g.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    appointments: g.appointments.sort((a, b) => a.startTime.localeCompare(b.startTime))
  })).sort((a, b) => b.date.localeCompare(a.date));
  const live = orderList.filter((o) => o.status !== "cancelled");
  const billed = live.reduce((s, o) => s + o.totalAmount, 0);
  const paid = live.reduce((s, o) => s + o.paidAmount, 0);
  const times = [
    ...orderList.map((o) => o.createdAt),
    ...attended.map((a) => a.arrivedAt ?? a.createdAt)
  ].sort();
  return {
    patient,
    visits: visits2,
    payments: [...payments2].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    totals: {
      visits: visits2.filter((v) => v.appointments.length > 0 || v.orders.some((o) => o.status !== "cancelled")).length,
      orders: orderList.length,
      billed,
      paid,
      debt: Math.max(0, billed - paid),
      firstVisitAt: times[0] ?? null,
      lastVisitAt: times[times.length - 1] ?? null
    }
  };
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
var StorageConflict, DEFAULT_SETTINGS, SEED_USERS, ATTENDED_STATUSES;
var init_storage_types = __esm({
  "server/storage-types.ts"() {
    "use strict";
    init_reference_range();
    init_permissions();
    StorageConflict = class extends Error {
      constructor(message) {
        super(message);
        this.name = "StorageConflict";
      }
    };
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
    ATTENDED_STATUSES = ["arrived", "in_progress", "completed"];
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
  const match = raw.match(new RegExp(`^(?:${BARCODE_PREFIX}[-\\s]?)?(\\d{1,9})(?:[-\\s][EZSUNTX])?$`));
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

// shared/referral.ts
function referralStage(r) {
  if (r.status === "cancelled") return "cancelled";
  if (r.kind === "lab") {
    if (!r.order || r.order.status === "cancelled") return "cancelled";
    return r.order.tests > 0 && r.order.verified === r.order.tests ? "done" : "in_lab";
  }
  if (!r.booking) return "awaiting_booking";
  return r.booking.status === "completed" ? "done" : "scheduled";
}
function referralBookingProblem(referral, booking) {
  if (referral.status === "cancelled") return "Yo'llanma bekor qilingan";
  if (referral.kind === "lab") return "Laboratoriya yo'llanmasi qabulga yozilmaydi: buyurtma laboratoriyaga allaqachon tushgan";
  if (referral.patientId !== booking.patientId) return "Yo'llanma boshqa bemorga berilgan";
  if (referral.kind === "exam" && booking.serviceId !== referral.serviceId) {
    return `Yo'llanma "${referral.serviceName ?? "tekshiruv"}" xizmatiga berilgan, qabul shu xizmat bilan bo'lishi kerak`;
  }
  if (referral.kind === "consult") {
    if (referral.targetDoctorId && booking.doctorId !== referral.targetDoctorId) {
      return `Yo'llanma ${referral.targetDoctorName ?? "boshqa shifokor"}ga berilgan`;
    }
    const want = (referral.targetSpecialty ?? "").trim().toLowerCase();
    if (!referral.targetDoctorId && want && booking.doctorSpecialty.trim().toLowerCase() !== want) {
      return `Yo'llanma "${referral.targetSpecialty}" mutaxassisiga berilgan`;
    }
  }
  return null;
}
function referralSubject(r) {
  if (r.kind === "lab") {
    const names = r.order?.testNames ?? [];
    if (names.length === 0) return "Laboratoriya tahlillari";
    return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} va yana ${names.length - 3} ta`;
  }
  if (r.kind === "exam") return r.serviceName ?? "Tekshiruv";
  return r.targetDoctorName ? `${r.targetSpecialty} \xB7 ${r.targetDoctorName}` : r.targetSpecialty ?? "Konsultatsiya";
}
var isExamServiceKind;
var init_referral = __esm({
  "shared/referral.ts"() {
    "use strict";
    init_schema();
    isExamServiceKind = (kind) => REFERRAL_EXAM_SERVICE_KINDS.includes(kind);
  }
});

// shared/lab-verification.ts
function lineState(l) {
  if (l.verifiedAt) return "verified";
  if (!l.result || !l.result.trim()) return "empty";
  if (l.returnedAt) return "returned";
  return "review";
}
function labProgress(items) {
  const p = { total: items.length, empty: 0, returned: 0, review: 0, verified: 0, released: false };
  for (const i of items) p[lineState(i)]++;
  p.released = p.total > 0 && p.verified === p.total;
  return p;
}
var isOrderReleased, releasedLines, needsEntry, needsReview, LINE_STATE_LABELS, LEGACY_VERIFIER;
var init_lab_verification = __esm({
  "shared/lab-verification.ts"() {
    "use strict";
    isOrderReleased = (order) => labProgress(order.items).released;
    releasedLines = (items) => items.filter((i) => lineState(i) === "verified");
    needsEntry = (items) => items.some((i) => {
      const s = lineState(i);
      return s === "empty" || s === "returned";
    });
    needsReview = (items) => items.some((i) => lineState(i) === "review");
    LINE_STATE_LABELS = {
      empty: "Kiritilmagan",
      returned: "Qaytarilgan",
      review: "Tasdiqlash kutilmoqda",
      verified: "Tasdiqlangan"
    };
    LEGACY_VERIFIER = "Tasdiqlash joriy etilishidan oldingi natija";
  }
});

// shared/lab-board.ts
function summarizeLabBoard(orders2, day, dayOf) {
  const counts = {
    today: 0,
    awaitingSample: 0,
    rejected: 0,
    inProgress: 0,
    review: 0,
    readyToday: 0,
    cancelledToday: 0
  };
  const groupsToday = {};
  for (const o of orders2) {
    if (o.status === "cancelled") {
      if (dayOf(o.updatedAt ?? o.createdAt) === day) counts.cancelledToday += 1;
      continue;
    }
    if (dayOf(o.createdAt) === day) {
      counts.today += 1;
      for (const g of orderGroups(o.groups ?? [])) groupsToday[g] = (groupsToday[g] ?? 0) + 1;
    }
    if (awaitsSample(o)) {
      counts.awaitingSample += 1;
      if (o.sample.status === "rad_etildi") counts.rejected += 1;
    } else if (needsEntry(o.items)) {
      counts.inProgress += 1;
    }
    if (needsReview(o.items)) counts.review += 1;
    if (o.items.length > 0 && isOrderReleased(o)) {
      const last = o.items.reduce((m, i) => i.verifiedAt && i.verifiedAt > m ? i.verifiedAt : m, "");
      if (last && dayOf(last) === day) counts.readyToday += 1;
    }
  }
  return { counts, groupsToday };
}
var LAB_BOARD_AWAITING_LIMIT, awaitsSample;
var init_lab_board = __esm({
  "shared/lab-board.ts"() {
    "use strict";
    init_lab_verification();
    init_lab_catalogue();
    LAB_BOARD_AWAITING_LIMIT = 6;
    awaitsSample = (o) => o.status !== "cancelled" && !!o.sample && o.sample.status !== "qabul_qilindi";
  }
});

// shared/branding.ts
function decodedLength(b64) {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return b64.length / 4 * 3 - pad;
}
function checkLogo(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl) return { ok: false, message: "Rasm yuborilmadi" };
  const m = DATA_URL.exec(dataUrl);
  if (!m || m[2].length % 4 !== 0) return { ok: false, message: "Faqat PNG yoki JPEG rasm yuklash mumkin" };
  const mime = m[1];
  const bytes = decodedLength(m[2]);
  if (bytes > LOGO_MAX_BYTES) {
    return { ok: false, message: `Rasm juda katta: ${Math.round(bytes / 1024)} KB (ko'pi bilan ${LOGO_MAX_BYTES / 1024} KB)` };
  }
  const head = atob(m[2].slice(0, 16));
  const magic = MAGIC[mime];
  if (head.length < magic.length || magic.some((b, i) => head.charCodeAt(i) !== b)) {
    return { ok: false, message: "Fayl mazmuni rasm turiga mos emas" };
  }
  return { ok: true, mime, bytes };
}
var LOGO_MAX_BYTES, DATA_URL, MAGIC;
var init_branding = __esm({
  "shared/branding.ts"() {
    "use strict";
    LOGO_MAX_BYTES = 300 * 1024;
    DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;
    MAGIC = {
      "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
      "image/jpeg": [255, 216, 255]
    };
  }
});

// shared/icd10.ts
function normalizeIcdCode(input) {
  const map = { \u0410: "A", \u0412: "B", \u0415: "E", \u041A: "K", \u041C: "M", \u041D: "H", \u041E: "O", \u0420: "P", \u0421: "C", \u0422: "T", \u0425: "X" };
  return input.trim().toUpperCase().replace(/[АВЕКМНОРСТХ]/g, (c) => map[c] ?? c).replace(",", ".");
}
function kindOf(code, hasParent) {
  if (!hasParent) return "chapter";
  if (code.includes("-")) return "block";
  return code.includes(".") ? "subcategory" : "category";
}
function splitCsvLine(line, sep) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseNsiIcd10(text2) {
  const lines = text2.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0], ";").map((h) => h.trim().toUpperCase());
  const col = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`MKB-10 faylida "${name}" ustuni yo'q`);
    return i;
  };
  const [iId, iCode, iName, iParent, iActual] = ["ID", "MKB_CODE", "MKB_NAME", "ID_PARENT", "ACTUAL"].map(col);
  const raw = lines.slice(1).map((l) => splitCsvLine(l, ";"));
  const byId = new Map(raw.map((r) => [r[iId], r]));
  const chapterOf = (r) => {
    let cur = r;
    for (let guard = 0; cur[iParent] && guard < 8; guard++) cur = byId.get(cur[iParent]) ?? cur;
    return cur;
  };
  return raw.map((r, index2) => {
    const code = r[iCode].trim();
    const parent = r[iParent] ? byId.get(r[iParent]) : void 0;
    const kind = kindOf(code, Boolean(r[iParent]));
    const chapterRow = chapterOf(r);
    let blockCode = null;
    if (kind === "block") blockCode = code;
    else if (kind !== "chapter") {
      let cur = parent;
      for (let guard = 0; cur && guard < 6; guard++) {
        if (cur[iCode].includes("-")) {
          blockCode = cur[iCode].trim();
          break;
        }
        cur = cur[iParent] ? byId.get(cur[iParent]) : void 0;
      }
    }
    const isActual = r[iActual].trim() === "1";
    return {
      code,
      kind,
      nameRu: r[iName].trim(),
      chapter: chapterRow[iCode].trim(),
      block: blockCode,
      parentCode: parent ? parent[iCode].trim() : null,
      isActual,
      selectable: isActual && (kind === "category" || kind === "subcategory"),
      sortOrder: index2 + 1
    };
  });
}
function parseUzNames(text2) {
  const lines = text2.replace(/^﻿/, "").split(/\r?\n/);
  const names = /* @__PURE__ */ new Map();
  const rejected = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const sep = line.includes(";") ? ";" : ",";
    const [rawCode, ...rest] = splitCsvLine(line, sep);
    const code = normalizeIcdCode(rawCode ?? "");
    const name = rest.join(sep).trim();
    if (i === 0 && !isIcdCode(code) && !code.includes("-")) return;
    if (!isIcdCode(code) && !/^[A-Z]\d\d-[A-Z]\d\d$/.test(code) && !/^[IVXL]+$/.test(code) || !name) {
      rejected.push(i + 1);
      return;
    }
    names.set(code, name.slice(0, 400));
  });
  return { names, rejected };
}
var ICD_SOURCE, ICD_CODE_RE, isIcdCode;
var init_icd10 = __esm({
  "shared/icd10.ts"() {
    "use strict";
    ICD_SOURCE = "Rossiya SSV NSI, OID 1.2.643.5.1.13.13.11.1005, v2.27";
    ICD_CODE_RE = /^[A-Z]\d\d(\.\d{1,2})?$/;
    isIcdCode = (code) => ICD_CODE_RE.test(code);
  }
});

// server/lab-rules.ts
function pickForVerification(lines, itemIds) {
  if (!itemIds) {
    const waiting = lines.filter((l) => lineState(l) === "review");
    if (waiting.length === 0) throw new StorageConflict("Tasdiqlash kutayotgan natija yo'q");
    return waiting;
  }
  const byId = new Map(lines.map((l) => [l.id, l]));
  return Array.from(new Set(itemIds)).map((id) => {
    const line = byId.get(id);
    if (!line) throw new StorageConflict("Tahlil bu buyurtmada topilmadi");
    const state = lineState(line);
    if (state !== "review") {
      throw new StorageConflict(`"${line.testName}": ${LINE_STATE_LABELS[state].toLowerCase()}, tasdiqlash kutmayapti`);
    }
    return line;
  });
}
function amendProblem(line, input) {
  if (!line.verifiedAt) return "Faqat tasdiqlangan natija tuzatiladi. Tasdiqlanmagan natijani laborant o'zgartiradi";
  if (input.result === (line.result ?? "") && input.flag === (line.flag ?? null) && input.notes === (line.notes || null)) {
    return "Natija o'zgarmagan";
  }
  return null;
}
var init_lab_rules = __esm({
  "server/lab-rules.ts"() {
    "use strict";
    init_lab_verification();
    init_storage_types();
  }
});

// shared/patient-links.ts
function patientHistoryProblem(counts) {
  const held = BLOCKING_TABLES.filter((t) => (counts[t] ?? 0) > 0).map((t) => PATIENT_LINKS[t].label);
  if (held.length === 0) return null;
  return `Bemor kartasida ${held.join(", ")} bor, uni o'chirib bo'lmaydi. Takroriy karta bo'lsa, uni asosiy kartaga birlashtiring.`;
}
var PATIENT_LINKS, BLOCKING_TABLES;
var init_patient_links = __esm({
  "shared/patient-links.ts"() {
    "use strict";
    PATIENT_LINKS = {
      patient_contacts: { merge: "move-keep-target-emergency", delete: "cascade" },
      /** A visit is only the day's envelope; without orders or appointments it holds nothing. */
      visits: { merge: "combine-same-day", delete: "cascade" },
      orders: { merge: "move", delete: "block", label: "laboratoriya buyurtmalari" },
      appointments: { merge: "move", delete: "block", label: "qabullar" },
      medical_records: { merge: "move", delete: "block", label: "ko'rik yozuvlari" },
      patient_allergies: { merge: "move", delete: "block", label: "allergiyalar" },
      referrals: { merge: "move", delete: "block", label: "yo'llanmalar" }
    };
    BLOCKING_TABLES = Object.keys(PATIENT_LINKS).filter(
      (t) => PATIENT_LINKS[t].delete === "block"
    );
  }
});

// shared/ledger.ts
function orderDeleteProblem(paymentRows, resultLines) {
  if (paymentRows > 0) {
    return "Buyurtmada to'lov yozuvlari bor, uni o'chirib bo'lmaydi. Buyurtmani bekor qiling: moliyaviy tarix saqlanadi.";
  }
  if (resultLines > 0) {
    return "Buyurtmada tahlil natijalari bor, uni o'chirib bo'lmaydi. Buyurtmani bekor qiling: natijalar saqlanadi.";
  }
  return null;
}
function ledgerTotal(rows) {
  return rows.reduce((sum, p) => p.voidedAt ? sum : sum + p.amount, 0);
}
var PAYMENT_ALREADY_VOIDED, TEST_IN_USE;
var init_ledger = __esm({
  "shared/ledger.ts"() {
    "use strict";
    PAYMENT_ALREADY_VOIDED = "Bu to'lov allaqachon bekor qilingan";
    TEST_IN_USE = "Bu tahlil buyurtmalarda ishlatilgan, uni o'chirib bo'lmaydi. Uni faolsizlantiring: katalogdan yo'qoladi, tarix saqlanadi.";
  }
});

// shared/appointment.ts
function weekdayOf(date) {
  const d = (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).getUTCDay();
  return d === 0 ? 7 : d;
}
function daysBetween2(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}
function isValidDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
function clockNow(now = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes()
  };
}
function slotStarts(schedule, slotMinutes, date) {
  if (slotMinutes <= 0) return [];
  const day = weekdayOf(date);
  const starts = [];
  for (const w of schedule.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start))) {
    const end = toMinutes(w.end);
    for (let t = toMinutes(w.start); t + slotMinutes <= end; t += slotMinutes) starts.push(fromMinutes(t));
  }
  return starts;
}
function overlaps(aStart, aLen, bStart, bLen) {
  const a = toMinutes(aStart);
  const b = toMinutes(bStart);
  return a < b + bLen && b < a + aLen;
}
function findClash(bookings, startTime, durationMinutes, ignoreId) {
  return bookings.find(
    (b) => b.id !== ignoreId && holdsSlot(b.status) && overlaps(b.startTime, b.durationMinutes, startTime, durationMinutes)
  );
}
function buildSlots(starts, slotMinutes, bookings, date, now) {
  return starts.map((startTime) => {
    const endTime = fromMinutes(toMinutes(startTime) + slotMinutes);
    const clash = findClash(bookings, startTime, slotMinutes);
    if (clash) {
      return {
        startTime,
        endTime,
        available: false,
        reason: "taken",
        takenBy: clash.patientName ? { appointmentId: clash.id, patientName: clash.patientName, queueNumber: clash.queueNumber ?? 0 } : void 0
      };
    }
    const past = date < now.date || date === now.date && toMinutes(endTime) <= now.minutes;
    return past ? { startTime, endTime, available: false, reason: "past" } : { startTime, endTime, available: true };
  });
}
function bookingProblem(opts) {
  const { date, startTime, slotMinutes, starts, bookings, now } = opts;
  if (!isValidDay(date)) return "Sana noto'g'ri";
  if (date < now.date) return "O'tgan kunga yozib bo'lmaydi";
  if (daysBetween2(now.date, date) > MAX_BOOKING_DAYS_AHEAD) {
    return `${MAX_BOOKING_DAYS_AHEAD} kundan uzoq muddatga yozib bo'lmaydi`;
  }
  if (starts.length === 0) return "Shifokor bu kuni qabul qilmaydi";
  if (!starts.includes(startTime)) return "Bu vaqt shifokorning ish jadvaliga to'g'ri kelmaydi";
  if (date === now.date && toMinutes(startTime) + slotMinutes <= now.minutes) return "Bu vaqt allaqachon o'tib ketgan";
  const clash = findClash(bookings, startTime, slotMinutes, opts.ignoreId);
  if (clash) return `Bu vaqt band${clash.queueNumber ? ` (navbat \u2116${clash.queueNumber})` : ""}`;
  return null;
}
function nextQueueNumber(existing) {
  return existing.reduce((max, n) => Math.max(max, n), 0) + 1;
}
function checkTransition(from, to, who) {
  if (from === to) return { ok: false, status: 400, message: "Qabul allaqachon shu holatda" };
  const actor = TRANSITIONS2[from][to];
  if (!actor) return { ok: false, status: 400, message: TRANSITION_REFUSALS[from] ?? "Bu holatga o'tkazib bo'lmaydi" };
  const allowed = actor === "desk" ? who.desk : actor === "doctor" ? who.ownDoctor : who.desk || who.ownDoctor;
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      message: actor === "doctor" ? "Bu amalni faqat qabul qiluvchi shifokor bajaradi" : "Bu amal uchun ruxsatingiz yo'q"
    };
  }
  return { ok: true };
}
function nextInLine(list) {
  return list.filter((a) => a.status === "arrived").sort((a, b) => a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber)[0];
}
var ACTIVE_STATUSES, holdsSlot, MAX_BOOKING_DAYS_AHEAD, toMinutes, fromMinutes, TRANSITIONS2, TRANSITION_REFUSALS, needsReason;
var init_appointment = __esm({
  "shared/appointment.ts"() {
    "use strict";
    ACTIVE_STATUSES = ["scheduled", "arrived", "in_progress", "completed"];
    holdsSlot = (status) => ACTIVE_STATUSES.includes(status);
    MAX_BOOKING_DAYS_AHEAD = 90;
    toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    fromMinutes = (total) => {
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    TRANSITIONS2 = {
      scheduled: { arrived: "desk", cancelled: "desk", no_show: "either" },
      // Back to "scheduled" undoes a check-in made by mistake.
      arrived: { in_progress: "doctor", scheduled: "desk", cancelled: "desk", no_show: "either" },
      // Back to "arrived": the doctor called the wrong patient, or sends them for a test first.
      in_progress: { completed: "doctor", arrived: "doctor" },
      // A late patient who turns up after all.
      no_show: { arrived: "desk" },
      completed: {},
      cancelled: {}
    };
    TRANSITION_REFUSALS = {
      completed: "Yakunlangan qabulni o'zgartirib bo'lmaydi",
      cancelled: "Bekor qilingan qabulni o'zgartirib bo'lmaydi. Yangi qabulga yozing"
    };
    needsReason = (to) => to === "cancelled";
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
  appointmentSelect: () => appointmentSelect,
  isMissingTable: () => isMissingTable,
  referralSelect: () => referralSelect
});
import { and, asc, desc, eq, gte, inArray, isNull, lte, notInArray, or, sql as sql2 } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
function isMissingTable(err) {
  return err?.code === "42P01";
}
var iso, mapUser, mapTest, mapPatient, mapContact, mapOrder, mapItem, mapSample, strip, dayExpr, mapIcd, mapPayment, mapRole, mapExpense, mapDepartment, doctorSelect, mapService, mapAppointment, appointmentSelect, mapAppointmentRow, issuerUser, targetDoctor, targetUser, cancelUser, referralSelect, mapReferral, LIVE_BOOKING, lockDoctorDay, tableExists, appointmentsTableExists, mapRecord, signer, recordSelect, mapRecordRow, recordConflict, mapDoctor, PgStorage;
var init_storage_pg = __esm({
  "server/storage-pg.ts"() {
    "use strict";
    init_tests_data();
    init_schema();
    init_sample();
    init_referral();
    init_lab_catalogue();
    init_lab_board();
    init_branding();
    init_icd10();
    init_lab_rules();
    init_patient_links();
    init_ledger();
    init_appointment();
    init_patient_identity();
    init_db_pg();
    init_password();
    init_permissions();
    init_storage_types();
    iso = (value) => value ? new Date(value).toISOString() : value;
    mapUser = (row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    });
    mapTest = (row) => ({
      ...row,
      group: row.group,
      sampleType: row.sampleType,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    });
    mapPatient = (row) => ({
      ...row,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      telegramLinkedAt: iso(row.telegramLinkedAt)
    });
    mapContact = (row) => ({
      ...row,
      createdAt: iso(row.createdAt)
    });
    mapOrder = (row) => ({
      ...row,
      status: row.status,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      completedAt: iso(row.completedAt),
      telegramSentAt: iso(row.telegramSentAt)
    });
    mapItem = (row) => ({
      ...row,
      flag: row.flag,
      completedAt: iso(row.completedAt),
      verifiedAt: iso(row.verifiedAt),
      returnedAt: iso(row.returnedAt)
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
    mapIcd = (row) => {
      const { updatedBy: _by, ...rest } = row;
      return { ...rest, kind: row.kind, updatedAt: iso(row.updatedAt) };
    };
    mapPayment = (row) => ({
      ...row,
      method: row.method,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      voidedAt: iso(row.voidedAt)
    });
    mapRole = (row) => ({
      ...row,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt),
      permissions: (row.permissions ?? []).filter(isPermission)
    });
    mapExpense = (row) => ({
      ...row,
      method: row.method,
      status: row.status,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt),
      cancelledAt: iso(row.cancelledAt)
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
    mapService = (row) => ({
      ...row,
      kind: row.kind,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt)
    });
    mapAppointment = (row) => ({
      ...row,
      status: row.status,
      arrivedAt: iso(row.arrivedAt),
      startedAt: iso(row.startedAt),
      completedAt: iso(row.completedAt),
      cancelledAt: iso(row.cancelledAt),
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt)
    });
    appointmentSelect = () => db.select({
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
      serviceName: services.name
    }).from(appointments).leftJoin(patients, eq(patients.id, appointments.patientId)).leftJoin(doctors, eq(doctors.id, appointments.doctorId)).leftJoin(users, eq(users.id, doctors.userId)).leftJoin(departments, eq(departments.id, doctors.departmentId)).leftJoin(services, eq(services.id, appointments.serviceId));
    mapAppointmentRow = (r) => ({
      ...mapAppointment(r.a),
      patientNumber: r.patientNumber ?? 0,
      patientName: r.patientName ?? "\u2014",
      patientPhone: r.patientPhone ?? "",
      patientBirthDate: r.patientBirthDate ?? null,
      patientAge: patientAge({ birthDate: r.patientBirthDate, age: r.patientAgeRaw }),
      patientGender: r.patientGender ?? null,
      doctorName: r.doctorName ?? "\u2014",
      doctorUserId: r.doctorUserId ?? "",
      specialty: r.specialty ?? "",
      room: r.room ?? null,
      departmentName: r.departmentName ?? null,
      serviceName: r.serviceName ?? null
    });
    issuerUser = alias(users, "issuer_user");
    targetDoctor = alias(doctors, "target_doctor");
    targetUser = alias(users, "target_user");
    cancelUser = alias(users, "cancel_user");
    referralSelect = () => db.select({
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
      cancelledByName: cancelUser.fullName
    }).from(referrals).leftJoin(patients, eq(patients.id, referrals.patientId)).leftJoin(doctors, eq(doctors.id, referrals.doctorId)).leftJoin(issuerUser, eq(issuerUser.id, doctors.userId)).leftJoin(services, eq(services.id, referrals.serviceId)).leftJoin(targetDoctor, eq(targetDoctor.id, referrals.targetDoctorId)).leftJoin(targetUser, eq(targetUser.id, targetDoctor.userId)).leftJoin(cancelUser, eq(cancelUser.id, referrals.cancelledBy));
    mapReferral = (row) => ({
      ...row,
      kind: row.kind,
      status: row.status,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt),
      cancelledAt: iso(row.cancelledAt)
    });
    LIVE_BOOKING = sql2`status NOT IN ('cancelled', 'no_show')`;
    lockDoctorDay = (tx, doctorId, date) => tx.execute(sql2`SELECT pg_advisory_xact_lock(hashtext(${`appointments:${doctorId}:${date}`}))`);
    tableExists = async (tx, table) => {
      const { rows } = await tx.execute(sql2`SELECT to_regclass(${"public." + table}) IS NOT NULL AS ok`);
      return Boolean(rows[0]?.ok);
    };
    appointmentsTableExists = (tx) => tableExists(tx, "appointments");
    mapRecord = (row) => ({
      ...row,
      status: row.status,
      signedAt: iso(row.signedAt),
      amendedAt: iso(row.amendedAt),
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt)
    });
    signer = alias(users, "signer");
    recordSelect = () => db.select({
      r: medicalRecords,
      patientNumber: patients.patientNumber,
      patientName: patients.fullName,
      doctorName: users.fullName,
      doctorUserId: doctors.userId,
      specialty: doctors.specialty,
      date: appointments.date,
      startTime: appointments.startTime,
      signedByName: signer.fullName
    }).from(medicalRecords).leftJoin(patients, eq(patients.id, medicalRecords.patientId)).leftJoin(doctors, eq(doctors.id, medicalRecords.doctorId)).leftJoin(users, eq(users.id, doctors.userId)).leftJoin(appointments, eq(appointments.id, medicalRecords.appointmentId)).leftJoin(signer, eq(signer.id, medicalRecords.signedBy));
    mapRecordRow = (r) => ({
      ...mapRecord(r.r),
      patientNumber: r.patientNumber ?? 0,
      patientName: r.patientName ?? "\u2014",
      doctorName: r.doctorName ?? "\u2014",
      doctorUserId: r.doctorUserId ?? "",
      specialty: r.specialty ?? "",
      date: r.date ?? (iso(r.r.createdAt) ?? r.r.createdAt).slice(0, 10),
      startTime: r.startTime ?? "",
      signedByName: r.signedByName ?? null
    });
    recordConflict = (status) => new StorageConflict(
      status === "signed" ? "Yozuv allaqachon tasdiqlangan. Sahifani yangilang" : "Yozuv boshqa oynada o'zgartirilgan. Sahifani yangilang \u2014 oxirgi saqlangan matn ko'rinadi"
    );
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
              ...classifyTest(t),
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
          userCount: sql2`(SELECT count(*)::int FROM ${users} u WHERE u.role = "roles"."key")`
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
          createdBy: actor.id,
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
          doctorCount: sql2`(SELECT count(*)::int FROM ${doctors} d WHERE d.department_id = "departments"."id")`
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
          createdBy: actor.id,
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
          createdBy: actor.id,
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
      // ------------------------------------------------------------- services
      async listServices(opts = {}) {
        const rows = await db.select({
          service: services,
          departmentName: departments.name,
          appointmentCount: sql2`(SELECT count(*)::int FROM appointments ap WHERE ap.service_id = "services"."id")`
        }).from(services).leftJoin(departments, eq(departments.id, services.departmentId)).where(opts.activeOnly ? eq(services.isActive, true) : void 0).orderBy(desc(services.isActive), asc(services.kind), asc(services.name)).catch(async (err) => {
          if (!isMissingTable(err) || !await this.servicesTableExists()) throw err;
          const plain = await db.select({ service: services, departmentName: departments.name }).from(services).leftJoin(departments, eq(departments.id, services.departmentId)).where(opts.activeOnly ? eq(services.isActive, true) : void 0).orderBy(desc(services.isActive), asc(services.kind), asc(services.name));
          return plain.map((r) => ({ ...r, appointmentCount: 0 }));
        });
        return rows.map((r) => ({
          ...mapService(r.service),
          departmentName: r.departmentName ?? null,
          appointmentCount: r.appointmentCount ?? 0
        }));
      }
      async servicesTableExists() {
        const { rows } = await db.execute(sql2`SELECT to_regclass('public.services') IS NOT NULL AS ok`);
        return Boolean(rows[0]?.ok);
      }
      async getService(id) {
        const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
        return row && mapService(row);
      }
      async serviceDetails(id) {
        return (await this.listServices()).find((x) => x.id === id);
      }
      async createService(input, actor) {
        const [row] = await db.insert(services).values({
          name: input.name,
          kind: input.kind,
          departmentId: input.departmentId ?? null,
          price: input.price,
          durationMinutes: input.durationMinutes ?? null,
          description: input.description ?? null,
          isActive: input.isActive ?? true,
          createdBy: actor.id
        }).returning({ id: services.id });
        return await this.serviceDetails(row.id);
      }
      async updateService(id, input, actor) {
        const patch = { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor.id };
        if (input.name !== void 0) patch.name = input.name;
        if (input.kind !== void 0) patch.kind = input.kind;
        if (input.departmentId !== void 0) patch.departmentId = input.departmentId ?? null;
        if (input.price !== void 0) patch.price = input.price;
        if (input.durationMinutes !== void 0) patch.durationMinutes = input.durationMinutes ?? null;
        if (input.description !== void 0) patch.description = input.description ?? null;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        const rows = await db.update(services).set(patch).where(eq(services.id, id)).returning({ id: services.id });
        return rows.length ? this.serviceDetails(id) : void 0;
      }
      async deleteService(id) {
        const rows = await db.delete(services).where(eq(services.id, id)).returning({ id: services.id });
        return rows.length > 0;
      }
      // --------------------------------------------------------- appointments
      async listAppointments(q) {
        const where = [];
        if (q.date) where.push(eq(appointments.date, q.date));
        if (q.beforeDate) where.push(sql2`${appointments.date} < ${q.beforeDate}`);
        if (q.doctorId) where.push(eq(appointments.doctorId, q.doctorId));
        if (q.patientId) where.push(eq(appointments.patientId, q.patientId));
        if (q.statuses?.length) where.push(inArray(appointments.status, q.statuses));
        const rows = await appointmentSelect().where(where.length ? and(...where) : void 0).orderBy(
          ...q.patientId ? [desc(appointments.date), desc(appointments.startTime)] : [asc(appointments.date), asc(appointments.startTime), asc(appointments.queueNumber)]
        ).limit(Math.min(q.limit ?? 500, 2e3));
        return rows.map(mapAppointmentRow);
      }
      async getAppointment(id) {
        const [row] = await appointmentSelect().where(eq(appointments.id, id)).limit(1);
        return row && mapAppointmentRow(row);
      }
      /** The doctor's bookings for a day, read inside the locked transaction. */
      async dayBookings(tx, doctorId, date) {
        const rows = await tx.select().from(appointments).where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date)));
        return rows.map(mapAppointment);
      }
      async createAppointment(input, actor, check) {
        const id = await db.transaction(async (tx) => {
          await lockDoctorDay(tx, input.doctorId, input.date);
          if (input.referralId) {
            const [ref] = await tx.select({ id: referrals.id, status: referrals.status }).from(referrals).where(eq(referrals.id, input.referralId)).for("update");
            if (!ref || ref.status !== "active") throw new StorageConflict("Yo'llanma bekor qilingan yoki topilmadi");
            const [taken] = await tx.select({ date: appointments.date, startTime: appointments.startTime }).from(appointments).where(and(eq(appointments.referralId, input.referralId), LIVE_BOOKING)).limit(1);
            if (taken) throw new StorageConflict(`Bu yo'llanma bo'yicha bemor allaqachon yozilgan (${taken.date} ${taken.startTime})`);
          }
          const day = await this.dayBookings(tx, input.doctorId, input.date);
          const problem = check(day);
          if (problem) throw new StorageConflict(problem);
          const [row] = await tx.insert(appointments).values({
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
            createdBy: actor.id
          }).returning({ id: appointments.id });
          return row.id;
        });
        return await this.getAppointment(id);
      }
      async rescheduleAppointment(id, patch, actor, check) {
        await db.transaction(async (tx) => {
          await lockDoctorDay(tx, patch.doctorId, patch.date);
          const [current] = await tx.select().from(appointments).where(eq(appointments.id, id)).limit(1).for("update");
          if (!current) throw new StorageConflict("Qabul topilmadi");
          if (current.status !== "scheduled") throw new StorageConflict(`Faqat "yozildi" holatidagi qabulni ko'chirish mumkin`);
          const day = await this.dayBookings(tx, patch.doctorId, patch.date);
          const problem = check(day);
          if (problem) throw new StorageConflict(problem);
          const sameQueue = current.doctorId === patch.doctorId && current.date === patch.date;
          await tx.update(appointments).set({
            doctorId: patch.doctorId,
            date: patch.date,
            startTime: patch.startTime,
            durationMinutes: patch.durationMinutes,
            serviceId: patch.serviceId,
            price: patch.price,
            reason: patch.reason,
            queueNumber: sameQueue ? current.queueNumber : nextQueueNumber(day.map((a) => a.queueNumber)),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedBy: actor.id
          }).where(eq(appointments.id, id));
        });
        return await this.getAppointment(id);
      }
      async setAppointmentStatus(id, change, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const patch = { status: change.to, updatedAt: now, updatedBy: actor.id };
        switch (change.to) {
          case "arrived":
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
            patch.arrivedAt = null;
            patch.visitId = null;
            break;
        }
        const updated = await db.transaction(async (tx) => {
          if (change.to === "arrived" && change.from !== "in_progress") {
            const [current] = await tx.select({ patientId: appointments.patientId }).from(appointments).where(eq(appointments.id, id)).limit(1);
            if (current) {
              const [visit] = await tx.insert(visits).values({ patientId: current.patientId, visitDate: todayKey(), createdBy: actor.id }).onConflictDoUpdate({ target: [visits.patientId, visits.visitDate], set: { patientId: sql2`excluded.patient_id` } }).returning({ id: visits.id });
              patch.visitId = visit.id;
            }
          }
          return tx.update(appointments).set(patch).where(and(eq(appointments.id, id), eq(appointments.status, change.from))).returning({ id: appointments.id });
        });
        if (!updated.length) throw new StorageConflict("Qabul holati boshqa joyda o'zgartirilgan. Sahifani yangilang");
        return await this.getAppointment(id);
      }
      // ---------------------------------------------------- examination records
      async listRecords(q) {
        const where = [];
        if (q.appointmentIds && q.appointmentIds.length === 0) return [];
        if (q.patientId) where.push(eq(medicalRecords.patientId, q.patientId));
        if (q.appointmentIds) where.push(inArray(medicalRecords.appointmentId, q.appointmentIds));
        if (q.doctorId) where.push(eq(medicalRecords.doctorId, q.doctorId));
        if (q.status) where.push(eq(medicalRecords.status, q.status));
        const rows = await recordSelect().where(where.length ? and(...where) : void 0).orderBy(desc(appointments.date), desc(appointments.startTime), desc(medicalRecords.createdAt)).limit(Math.min(q.limit ?? 500, 2e3));
        return rows.map(mapRecordRow);
      }
      async getRecord(id) {
        const [row] = await recordSelect().where(eq(medicalRecords.id, id)).limit(1);
        return row && mapRecordRow(row);
      }
      async getRecordByAppointment(appointmentId) {
        const [row] = await recordSelect().where(eq(medicalRecords.appointmentId, appointmentId)).limit(1);
        return row && mapRecordRow(row);
      }
      async openRecord(input, actor) {
        await db.insert(medicalRecords).values({
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          doctorId: input.doctorId,
          visitId: input.visitId,
          createdBy: actor.id
        }).onConflictDoNothing({ target: medicalRecords.appointmentId });
        return await this.getRecordByAppointment(input.appointmentId);
      }
      async saveRecordDraft(id, revision, fields, actor) {
        const rows = await db.update(medicalRecords).set({ ...fields, revision: revision + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor.id }).where(and(eq(medicalRecords.id, id), eq(medicalRecords.status, "draft"), eq(medicalRecords.revision, revision))).returning({ id: medicalRecords.id });
        if (!rows.length) throw recordConflict((await this.getRecord(id))?.status);
        return await this.getRecord(id);
      }
      async signRecord(id, revision, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const rows = await db.update(medicalRecords).set({ status: "signed", signedAt: now, signedBy: actor.id, revision: revision + 1, updatedAt: now, updatedBy: actor.id }).where(and(eq(medicalRecords.id, id), eq(medicalRecords.status, "draft"), eq(medicalRecords.revision, revision))).returning({ id: medicalRecords.id });
        if (!rows.length) throw recordConflict((await this.getRecord(id))?.status);
        return await this.getRecord(id);
      }
      async amendRecord(id, revision, fields, reason, actor) {
        await db.transaction(async (tx) => {
          const [current] = await tx.select().from(medicalRecords).where(eq(medicalRecords.id, id)).limit(1).for("update");
          if (!current) throw new StorageConflict("Yozuv topilmadi");
          if (current.status !== "signed") throw new StorageConflict("Faqat tasdiqlangan yozuvga tuzatish kiritiladi");
          if (current.revision !== revision) throw recordConflict(void 0);
          const now = (/* @__PURE__ */ new Date()).toISOString();
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
            replaceReason: reason
          });
          await tx.update(medicalRecords).set({
            ...fields,
            version: current.version + 1,
            revision: current.revision + 1,
            signedAt: now,
            signedBy: actor.id,
            amendedAt: now,
            amendReason: reason,
            updatedAt: now,
            updatedBy: actor.id
          }).where(eq(medicalRecords.id, id));
        });
        return await this.getRecord(id);
      }
      async listRecordVersions(recordId) {
        const rows = await db.select({ v: medicalRecordVersions, replacedByName: users.fullName }).from(medicalRecordVersions).leftJoin(users, eq(users.id, medicalRecordVersions.replacedBy)).where(eq(medicalRecordVersions.recordId, recordId)).orderBy(desc(medicalRecordVersions.version));
        return rows.map((r) => ({
          ...r.v,
          signedAt: iso(r.v.signedAt),
          replacedAt: iso(r.v.replacedAt) ?? r.v.replacedAt,
          replacedByName: r.replacedByName ?? null
        }));
      }
      // ------------------------------------------------------------- allergies
      allergySelect() {
        return db.select({ a: patientAllergies, createdByName: users.fullName }).from(patientAllergies).leftJoin(users, eq(users.id, patientAllergies.createdBy));
      }
      mapAllergy(r) {
        return {
          ...r.a,
          createdAt: iso(r.a.createdAt) ?? r.a.createdAt,
          removedAt: iso(r.a.removedAt),
          createdByName: r.createdByName ?? null
        };
      }
      async listAllergies(patientId, opts = {}) {
        const rows = await this.allergySelect().where(
          opts.includeInactive ? eq(patientAllergies.patientId, patientId) : and(eq(patientAllergies.patientId, patientId), eq(patientAllergies.isActive, true))
        ).orderBy(desc(patientAllergies.isActive), desc(patientAllergies.createdAt));
        return rows.map((r) => this.mapAllergy(r));
      }
      async getAllergy(id) {
        const [row] = await this.allergySelect().where(eq(patientAllergies.id, id)).limit(1);
        return row && this.mapAllergy(row);
      }
      async addAllergy(patientId, input, actor) {
        const [row] = await db.insert(patientAllergies).values({ patientId, allergen: input.allergen, reaction: input.reaction, createdBy: actor.id }).returning({ id: patientAllergies.id });
        return await this.getAllergy(row.id);
      }
      async deactivateAllergy(id, reason, actor) {
        const rows = await db.update(patientAllergies).set({ isActive: false, removedAt: (/* @__PURE__ */ new Date()).toISOString(), removedBy: actor.id, removeReason: reason }).where(and(eq(patientAllergies.id, id), eq(patientAllergies.isActive, true))).returning({ id: patientAllergies.id });
        if (!rows.length) throw new StorageConflict("Bu yozuv allaqachon faol emas");
        return await this.getAllergy(id);
      }
      // ---------------------------------------------------------------- MKB-10
      async searchIcd(query) {
        const q = query.q.trim();
        const parts = [];
        if (!query.all) parts.push(eq(icd10.selectable, true));
        const code = normalizeIcdCode(q);
        if (/^[A-Z]\d/.test(code)) {
          parts.push(sql2`${icd10.code} LIKE ${code.replace(/[%_]/g, "") + "%"}`);
        } else if (q) {
          for (const word of q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
            const like = `%${word.replace(/[%_]/g, "")}%`;
            parts.push(sql2`(${icd10.nameRu} ILIKE ${like} OR coalesce(${icd10.nameUz}, '') ILIKE ${like})`);
          }
        }
        const rows = await db.select().from(icd10).where(parts.length ? and(...parts) : void 0).orderBy(asc(icd10.sortOrder)).limit(query.limit);
        return rows.map(mapIcd);
      }
      async getIcd(codes) {
        if (codes.length === 0) return [];
        const rows = await db.select().from(icd10).where(inArray(icd10.code, codes));
        return rows.map(mapIcd);
      }
      async icdStats() {
        const [r] = await db.select({
          total: sql2`count(*)::int`,
          selectable: sql2`count(*) FILTER (WHERE ${icd10.selectable})::int`,
          withUzbek: sql2`count(*) FILTER (WHERE ${icd10.nameUz} IS NOT NULL AND ${icd10.nameUz} <> '')::int`
        }).from(icd10);
        return { total: r?.total ?? 0, selectable: r?.selectable ?? 0, withUzbek: r?.withUzbek ?? 0, source: ICD_SOURCE };
      }
      async setIcdUzName(code, nameUz, actor) {
        const [row] = await db.update(icd10).set({ nameUz, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor.id }).where(eq(icd10.code, code)).returning();
        return row && mapIcd(row);
      }
      async importIcdUzNames(names, actor) {
        const codes = [...names.keys()];
        if (codes.length === 0) return { updated: 0, unknown: [] };
        return db.transaction(async (tx) => {
          const known = /* @__PURE__ */ new Set();
          for (let i = 0; i < codes.length; i += 1e3) {
            const slice = codes.slice(i, i + 1e3);
            for (const r of await tx.select({ code: icd10.code }).from(icd10).where(inArray(icd10.code, slice))) known.add(r.code);
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const pairs = codes.filter((c) => known.has(c));
          for (let i = 0; i < pairs.length; i += 1e3) {
            const chunk = pairs.slice(i, i + 1e3);
            await tx.execute(sql2`
          UPDATE icd10 AS t SET name_uz = v.name, updated_at = ${now}, updated_by = ${actor.id}
          FROM (VALUES ${sql2.join(chunk.map((c) => sql2`(${c}, ${names.get(c)})`), sql2`, `)}) AS v(code, name)
          WHERE t.code = v.code`);
          }
          return { updated: pairs.length, unknown: codes.filter((c) => !known.has(c)) };
        });
      }
      // -------------------------------------------------------- notifications
      async createNotification(input) {
        const rows = await db.insert(notifications).values(input).onConflictDoNothing({ target: notifications.dedupeKey }).returning({ id: notifications.id });
        return rows.length > 0;
      }
      async listNotifications(userId, limit) {
        const [items, [{ unread }]] = await Promise.all([
          db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit),
          db.select({ unread: sql2`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        ]);
        return {
          unread,
          items: items.map(({ dedupeKey: _key, ...n }) => ({
            ...n,
            kind: n.kind,
            createdAt: iso(n.createdAt) ?? n.createdAt,
            readAt: iso(n.readAt)
          }))
        };
      }
      async markNotificationRead(userId, id) {
        const rows = await db.update(notifications).set({ readAt: (/* @__PURE__ */ new Date()).toISOString() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt))).returning({ id: notifications.id });
        return rows.length > 0;
      }
      async markAllNotificationsRead(userId) {
        const rows = await db.update(notifications).set({ readAt: (/* @__PURE__ */ new Date()).toISOString() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).returning({ id: notifications.id });
        return rows.length;
      }
      // ------------------------------------------------------------ referrals
      async listReferrals(q) {
        if (q.ids && q.ids.length === 0) return [];
        const parts = [];
        if (q.ids) parts.push(inArray(referrals.id, q.ids));
        if (q.patientId) parts.push(eq(referrals.patientId, q.patientId));
        if (q.appointmentId) parts.push(eq(referrals.appointmentId, q.appointmentId));
        if (q.awaitingBooking) {
          parts.push(eq(referrals.status, "active"));
          parts.push(sql2`"referrals"."kind" <> 'lab'`);
          parts.push(sql2`NOT EXISTS (SELECT 1 FROM appointments x
        WHERE x.referral_id = "referrals"."id" AND x.status NOT IN ('cancelled', 'no_show'))`);
        }
        const query = referralSelect().where(parts.length ? and(...parts) : void 0).orderBy(q.awaitingBooking ? asc(referrals.createdAt) : desc(referrals.createdAt));
        const rows = await (q.limit ? query.limit(q.limit) : query);
        return this.withProgress(rows);
      }
      async getReferral(id) {
        return (await this.listReferrals({ ids: [id] }))[0];
      }
      /** Adds the order or booking behind each referral, and the stage it puts it in. Two parallel queries. */
      async withProgress(rows) {
        if (rows.length === 0) return [];
        const labIds = rows.filter((r) => r.r.kind === "lab").map((r) => r.r.id);
        const bookedIds = rows.filter((r) => r.r.kind !== "lab").map((r) => r.r.id);
        const [orderRows, bookingRows] = await Promise.all([
          labIds.length ? db.select({
            id: orders.id,
            referralId: orders.referralId,
            orderNumber: orders.orderNumber,
            status: orders.status,
            totalAmount: orders.totalAmount,
            paidAmount: orders.paidAmount,
            tests: sql2`count(${orderTests.id})::int`,
            done: sql2`count(${orderTests.result})::int`,
            verified: sql2`count(${orderTests.verifiedAt})::int`,
            results: sql2`coalesce(json_agg(json_build_object(
                  'testName', ${orderTests.testName}, 'result', ${orderTests.result}, 'unit', ${orderTests.unit},
                  'referenceRange', ${orderTests.referenceRange}, 'flag', ${orderTests.flag})
                ORDER BY ${orderTests.testName}) FILTER (WHERE ${orderTests.verifiedAt} IS NOT NULL), '[]'::json)`,
            names: sql2`coalesce(array_agg(${orderTests.testName} ORDER BY ${orderTests.testName})
                FILTER (WHERE ${orderTests.id} IS NOT NULL), '{}')`
          }).from(orders).leftJoin(orderTests, eq(orderTests.orderId, orders.id)).where(inArray(orders.referralId, labIds)).groupBy(orders.id) : Promise.resolve([]),
          bookedIds.length ? appointmentSelect().where(
            and(inArray(appointments.referralId, bookedIds), notInArray(appointments.status, ["cancelled", "no_show"]))
          ) : Promise.resolve([])
        ]);
        const orderBy = new Map(
          orderRows.map((o) => [
            o.referralId,
            {
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              totalAmount: o.totalAmount,
              paidAmount: o.paidAmount,
              tests: o.tests,
              done: o.done,
              verified: o.verified,
              results: o.results ?? [],
              testNames: o.names ?? []
            }
          ])
        );
        const bookingBy = /* @__PURE__ */ new Map();
        for (const b of bookingRows.map(mapAppointmentRow)) {
          bookingBy.set(b.referralId, {
            id: b.id,
            date: b.date,
            startTime: b.startTime,
            status: b.status,
            queueNumber: b.queueNumber,
            doctorName: b.doctorName
          });
        }
        return rows.map((r) => {
          const base = mapReferral(r.r);
          const order = orderBy.get(base.id) ?? null;
          const booking = bookingBy.get(base.id) ?? null;
          return {
            ...base,
            patientNumber: r.patientNumber ?? 0,
            patientName: r.patientName ?? "\u2014",
            patientPhone: r.patientPhone ?? "",
            doctorName: r.doctorName ?? "\u2014",
            doctorUserId: r.doctorUserId ?? "",
            specialty: r.specialty ?? "",
            serviceName: r.serviceName ?? null,
            serviceKind: r.serviceKind ?? null,
            servicePrice: r.servicePrice ?? null,
            targetDoctorName: r.targetDoctorName ?? null,
            cancelledByName: r.cancelledByName ?? null,
            order,
            booking,
            stage: referralStage({ kind: base.kind, status: base.status, order, booking })
          };
        });
      }
      async createReferrals(input, actor) {
        const selected = input.kind === "lab" ? (await db.select().from(tests).where(inArray(tests.id, input.testIds))).map(mapTest) : [];
        if (input.kind === "lab" && selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");
        const ids = await db.transaction(async (tx) => {
          const origin = {
            patientId: input.patientId,
            visitId: input.visitId,
            appointmentId: input.appointmentId,
            doctorId: input.doctorId,
            note: input.note,
            createdBy: actor.id
          };
          if (input.kind === "lab") {
            const [ref2] = await tx.insert(referrals).values({ ...origin, kind: "lab" }).returning({ id: referrals.id });
            await this.insertOrderTx(
              tx,
              {
                patientId: input.patientId,
                testIds: input.testIds,
                discount: 0,
                paidAmount: 0,
                notes: input.note,
                referrer: input.referrer,
                createdBy: actor.id
              },
              selected,
              ref2.id
            );
            return [ref2.id];
          }
          if (input.kind === "exam") {
            const made = await tx.insert(referrals).values(input.serviceIds.map((serviceId) => ({ ...origin, kind: "exam", serviceId }))).returning({ id: referrals.id });
            return made.map((r) => r.id);
          }
          const [ref] = await tx.insert(referrals).values({ ...origin, kind: "consult", targetSpecialty: input.targetSpecialty, targetDoctorId: input.targetDoctorId }).returning({ id: referrals.id });
          return [ref.id];
        });
        return this.listReferrals({ ids });
      }
      async cancelReferral(id, reason, actor) {
        const found = await db.transaction(async (tx) => {
          const [ref] = await tx.select().from(referrals).where(eq(referrals.id, id)).for("update");
          if (!ref) return false;
          if (ref.status === "cancelled") throw new StorageConflict("Yo'llanma allaqachon bekor qilingan");
          const now = (/* @__PURE__ */ new Date()).toISOString();
          if (ref.kind === "lab") {
            const [order] = await tx.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status }).from(orders).where(eq(orders.referralId, id)).for("update");
            if (order && order.status !== "cancelled") {
              const orderId = order.id;
              const { rows: [held] } = await tx.execute(sql2`
            SELECT
              (SELECT count(*) FROM payments p WHERE p.order_id = ${orderId} AND p.voided_at IS NULL)::int AS paid,
              (SELECT count(*) FROM order_tests ot WHERE ot.order_id = ${orderId} AND ot.result IS NOT NULL)::int AS results`);
              if ((held?.paid ?? 0) > 0 || (held?.results ?? 0) > 0) {
                throw new StorageConflict(
                  `Tahlil buyurtmasi #${order.orderNumber} bo'yicha to'lov yoki natija bor. Uni registratura yoki laboratoriya hal qiladi`
                );
              }
              await tx.update(orders).set({ status: "cancelled", completedAt: null, updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, order.id));
            }
          } else {
            const [booked] = await tx.select({ date: appointments.date, startTime: appointments.startTime }).from(appointments).where(and(eq(appointments.referralId, id), LIVE_BOOKING)).limit(1);
            if (booked) {
              throw new StorageConflict(`Bemor bu yo'llanma bo'yicha navbatga yozilgan (${booked.date} ${booked.startTime}). Avval qabulni bekor qiling`);
            }
          }
          await tx.update(referrals).set({ status: "cancelled", cancelledAt: now, cancelledBy: actor.id, cancelReason: reason, updatedAt: now, updatedBy: actor.id }).where(eq(referrals.id, id));
          return true;
        });
        return found ? this.getReferral(id) : void 0;
      }
      async doctorHasAppointments(doctorId) {
        if (!await appointmentsTableExists(db)) return false;
        const [row] = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.doctorId, doctorId)).limit(1);
        return Boolean(row);
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
      async createUser(input, actor) {
        const [row] = await db.insert(users).values({
          username: input.username,
          password: await hashPassword(input.password),
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive ?? true,
          createdBy: actor?.id ?? null
        }).returning();
        return strip(row);
      }
      async updateUser(id, input, actor) {
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
        patch.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        patch.updatedBy = actor?.id ?? null;
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
      // ------------------------------------------------------------------ 2FA
      async mfaAvailable() {
        try {
          await db.select({ userId: userMfa.userId }).from(userMfa).limit(1);
          return true;
        } catch (err) {
          if (isMissingTable(err)) return false;
          throw err;
        }
      }
      async getUserMfa(userId) {
        try {
          const [row] = await db.select().from(userMfa).where(eq(userMfa.userId, userId)).limit(1);
          return row;
        } catch (err) {
          if (isMissingTable(err)) return void 0;
          throw err;
        }
      }
      async listMfaEnrollments() {
        try {
          return await db.select({ userId: userMfa.userId, enabledAt: userMfa.enabledAt }).from(userMfa);
        } catch (err) {
          if (isMissingTable(err)) return [];
          throw err;
        }
      }
      async saveUserMfa(input, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const values = {
          secret: input.secret,
          recoveryCodes: input.recoveryCodes,
          lastUsedStep: input.lastUsedStep,
          enabledAt: now,
          updatedAt: now,
          updatedBy: actor.id
        };
        const [row] = await db.insert(userMfa).values({ userId: input.userId, ...values }).onConflictDoUpdate({ target: userMfa.userId, set: values }).returning();
        return row;
      }
      async replaceRecoveryCodes(userId, hashes, actor) {
        const rows = await db.update(userMfa).set({ recoveryCodes: hashes, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor.id }).where(eq(userMfa.userId, userId)).returning({ userId: userMfa.userId });
        return rows.length > 0;
      }
      async consumeMfaStep(userId, step) {
        const rows = await db.update(userMfa).set({ lastUsedStep: step }).where(and(eq(userMfa.userId, userId), sql2`${userMfa.lastUsedStep} < ${step}`)).returning({ userId: userMfa.userId });
        return rows.length > 0;
      }
      async consumeRecoveryCode(userId, hash) {
        const rows = await db.update(userMfa).set({
          recoveryCodes: sql2`array_remove(${userMfa.recoveryCodes}, ${hash}::text)`,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).where(and(eq(userMfa.userId, userId), sql2`${hash}::text = ANY(${userMfa.recoveryCodes})`)).returning({ userId: userMfa.userId });
        return rows.length > 0;
      }
      async deleteUserMfa(userId) {
        try {
          const rows = await db.delete(userMfa).where(eq(userMfa.userId, userId)).returning({ userId: userMfa.userId });
          return rows.length > 0;
        } catch (err) {
          if (isMissingTable(err)) return false;
          throw err;
        }
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
          const compact = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (compact.length >= 5) parts.push(sql2`coalesce(${patients.passport}, '') LIKE ${"%" + compact + "%"}`);
          if (digits.length >= 6) parts.push(sql2`coalesce(${patients.pinfl}, '') LIKE ${"%" + digits + "%"}`);
          where = or(...parts);
        }
        const withAppointments = await this.hasAppointmentsTable();
        const lastVisitAt = withAppointments ? sql2`(SELECT max(t) FROM (
            SELECT o.created_at AS t FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled'
            UNION ALL
            SELECT ap.arrived_at FROM appointments ap WHERE ap.patient_id = "patients"."id"
              AND ap.arrived_at IS NOT NULL AND ap.status IN ('arrived', 'in_progress', 'completed')
          ) x)` : sql2`(SELECT max(o.created_at) FROM ${orders} o
          WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled')`;
        const visitCount = withAppointments ? sql2`(SELECT count(DISTINCT k)::int FROM (
            SELECT coalesce(o.visit_id, ((o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date)::text) AS k
              FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled'
            UNION ALL
            SELECT ap.visit_id FROM appointments ap WHERE ap.patient_id = "patients"."id"
              AND ap.visit_id IS NOT NULL AND ap.status IN ('arrived', 'in_progress', 'completed')
          ) x)` : sql2`(SELECT count(DISTINCT coalesce(o.visit_id,
            ((o.created_at AT TIME ZONE current_setting('TIMEZONE'))::date)::text))::int
          FROM ${orders} o WHERE o.patient_id = "patients"."id" AND o.status <> 'cancelled')`;
        let q = db.select({ patient: patients, lastVisitAt, visitCount }).from(patients).where(where).orderBy(desc(patients.createdAt), desc(patients.patientNumber)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const [rows, [{ count }]] = await Promise.all([
          q,
          db.select({ count: sql2`count(*)::int` }).from(patients).where(where)
        ]);
        return {
          items: rows.map((r) => ({
            ...mapPatient(r.patient),
            lastVisitAt: r.lastVisitAt ? new Date(r.lastVisitAt).toISOString() : null,
            visitCount: r.visitCount ?? 0
          })),
          total: count
        };
      }
      async getPatientDetails(id) {
        const [[row], contacts] = await Promise.all([
          db.select().from(patients).where(eq(patients.id, id)).limit(1),
          db.select().from(patientContacts).where(eq(patientContacts.patientId, id)).orderBy(asc(patientContacts.createdAt))
        ]);
        return row && { ...mapPatient(row), contacts: contacts.map(mapContact) };
      }
      async getPatientCard(id) {
        const [details, list, visitRows, paymentRows, appointmentList] = await Promise.all([
          this.getPatientDetails(id),
          this.listOrders({ patientId: id }),
          db.select().from(visits).where(eq(visits.patientId, id)),
          db.select({ payment: payments, orderNumber: orders.orderNumber }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(orders.patientId, id)),
          await this.hasAppointmentsTable() ? this.listAppointments({ patientId: id }) : Promise.resolve([])
        ]);
        if (!details) return void 0;
        return buildPatientCard(
          details,
          list.items,
          visitRows.map((v) => ({ ...v, createdAt: iso(v.createdAt) ?? v.createdAt })),
          paymentRows.map((r) => ({ ...mapPayment(r.payment), orderNumber: r.orderNumber })),
          appointmentList
        );
      }
      /**
       * Whether `npm run db:appointments` has run. Queries that join appointments
       * into older screens (patients list, patient card) pick their SQL by it, so
       * those screens keep working on a database not migrated yet. Once true it
       * stays true; until then it is re-checked at most once a minute.
       */
      appointmentsTable = { ok: false, at: 0 };
      async hasAppointmentsTable() {
        if (this.appointmentsTable.ok || Date.now() - this.appointmentsTable.at < 6e4) return this.appointmentsTable.ok;
        this.appointmentsTable = { ok: await appointmentsTableExists(db), at: Date.now() };
        return this.appointmentsTable.ok;
      }
      async findPatientCandidates(q) {
        const parts = [];
        if (q.pinfl) parts.push(eq(patients.pinfl, q.pinfl));
        if (q.passport) parts.push(eq(patients.passport, q.passport));
        if (q.phoneDigits?.length === 9) {
          parts.push(sql2`regexp_replace(${patients.phone}, '[^0-9]', '', 'g') LIKE ${"%" + q.phoneDigits}`);
        }
        for (const s of new Set([q.surname, q.nameKey].filter((v) => Boolean(v && v.length >= 2)))) {
          parts.push(sql2`${patients.fullName} ILIKE ${s + "%"}`);
        }
        if (!parts.length) return [];
        const where = q.excludeId ? and(or(...parts), sql2`${patients.id} <> ${q.excludeId}`) : or(...parts);
        const rows = await db.select().from(patients).where(where).limit(30);
        return rows.map(mapPatient);
      }
      async setEmergencyContact(tx, patientId, contact) {
        if (contact === void 0) return;
        await tx.delete(patientContacts).where(and(eq(patientContacts.patientId, patientId), eq(patientContacts.isEmergency, true)));
        if (contact) {
          await tx.insert(patientContacts).values({
            patientId,
            name: contact.name,
            relation: contact.relation ?? null,
            phone: contact.phone,
            isEmergency: true
          });
        }
      }
      async mergePatients(sourceId, targetId, actor) {
        if (sourceId === targetId) return void 0;
        const stamp2 = { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor?.id ?? null };
        return db.transaction(async (tx) => {
          const [[source], [target]] = await Promise.all([
            tx.select().from(patients).where(eq(patients.id, sourceId)).limit(1),
            tx.select().from(patients).where(eq(patients.id, targetId)).limit(1)
          ]);
          if (!source || !target) return void 0;
          const moved = await tx.update(orders).set({ patientId: targetId, ...stamp2 }).where(eq(orders.patientId, sourceId)).returning({ id: orders.id });
          const [{ hasEmergency }] = await tx.select({ hasEmergency: sql2`count(*) > 0` }).from(patientContacts).where(and(eq(patientContacts.patientId, targetId), eq(patientContacts.isEmergency, true)));
          const movedContacts = await tx.update(patientContacts).set({ patientId: targetId }).where(
            hasEmergency ? and(eq(patientContacts.patientId, sourceId), eq(patientContacts.isEmergency, false)) : eq(patientContacts.patientId, sourceId)
          ).returning({ id: patientContacts.id });
          await tx.delete(patientContacts).where(eq(patientContacts.patientId, sourceId));
          await tx.execute(sql2`
        UPDATE ${orders} o SET visit_id = tv.id
        FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
        WHERE sv.patient_id = ${sourceId} AND o.visit_id = sv.id`);
          let movedAppointments = 0;
          if (await appointmentsTableExists(tx)) {
            await tx.execute(sql2`
          UPDATE appointments ap SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND ap.visit_id = sv.id`);
            const movedAp = await tx.update(appointments).set({ patientId: targetId }).where(eq(appointments.patientId, sourceId)).returning({ id: appointments.id });
            movedAppointments = movedAp.length;
          }
          if (await tableExists(tx, "medical_records")) {
            await tx.execute(sql2`
          UPDATE medical_records mr SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND mr.visit_id = sv.id`);
            await tx.update(medicalRecords).set({ patientId: targetId }).where(eq(medicalRecords.patientId, sourceId));
          }
          if (await tableExists(tx, "patient_allergies")) {
            await tx.update(patientAllergies).set({ patientId: targetId }).where(eq(patientAllergies.patientId, sourceId));
          }
          if (await tableExists(tx, "referrals")) {
            await tx.execute(sql2`
          UPDATE referrals rf SET visit_id = tv.id
          FROM ${visits} sv JOIN ${visits} tv ON tv.visit_date = sv.visit_date AND tv.patient_id = ${targetId}
          WHERE sv.patient_id = ${sourceId} AND rf.visit_id = sv.id`);
            await tx.update(referrals).set({ patientId: targetId }).where(eq(referrals.patientId, sourceId));
          }
          await tx.execute(sql2`
        DELETE FROM ${visits} sv USING ${visits} tv
        WHERE sv.patient_id = ${sourceId} AND tv.patient_id = ${targetId} AND tv.visit_date = sv.visit_date`);
          await tx.update(visits).set({ patientId: targetId }).where(eq(visits.patientId, sourceId));
          const fill = {};
          for (const k of ["birthDate", "passport", "pinfl", "address", "gender", "age"]) {
            if (target[k] == null && source[k] != null) fill[k] = source[k];
          }
          const takeChat = !target.telegramChatId && source.telegramChatId;
          await tx.delete(patients).where(eq(patients.id, sourceId));
          if (takeChat) {
            fill.telegramChatId = source.telegramChatId;
            fill.telegramLinkedAt = source.telegramLinkedAt;
          }
          await tx.update(patients).set({ ...fill, ...stamp2 }).where(eq(patients.id, targetId));
          return { orders: moved.length, contacts: movedContacts.length, appointments: movedAppointments };
        });
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
      async createPatient(input, actor) {
        const [row] = await db.insert(patients).values({
          fullName: input.fullName,
          phone: input.phone,
          address: input.address ?? null,
          age: input.age ?? null,
          gender: input.gender ?? null,
          birthDate: input.birthDate ?? null,
          passport: input.passport ?? null,
          pinfl: input.pinfl ?? null,
          createdBy: actor?.id ?? null,
          updatedBy: actor?.id ?? null
        }).returning();
        await this.setEmergencyContact(db, row.id, input.emergencyContact);
        return mapPatient(row);
      }
      async updatePatient(id, input, actor) {
        const patch = {
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor?.id ?? null
        };
        if (input.fullName !== void 0) patch.fullName = input.fullName;
        if (input.phone !== void 0) patch.phone = input.phone;
        if (input.address !== void 0) patch.address = input.address ?? null;
        if (input.age !== void 0) patch.age = input.age ?? null;
        if (input.gender !== void 0) patch.gender = input.gender ?? null;
        if (input.birthDate !== void 0) patch.birthDate = input.birthDate ?? null;
        if (input.passport !== void 0) patch.passport = input.passport ?? null;
        if (input.pinfl !== void 0) patch.pinfl = input.pinfl ?? null;
        const [row] = await db.update(patients).set(patch).where(eq(patients.id, id)).returning();
        if (!row) return void 0;
        await this.setEmergencyContact(db, id, input.emergencyContact);
        return mapPatient(row);
      }
      async deletePatient(id) {
        return db.transaction(async (tx) => {
          const [locked] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, id)).for("update");
          if (!locked) return false;
          const { rows: present } = await tx.execute(sql2`
        SELECT t.name FROM unnest(string_to_array(${BLOCKING_TABLES.join(",")}, ',')) AS t(name)
        WHERE to_regclass('public.' || t.name) IS NOT NULL`);
          const counts = {};
          if (present.length) {
            const { rows: rows2 } = await tx.execute(
              sql2.join(
                present.map(
                  ({ name }) => sql2`SELECT ${name}::text AS name, count(*)::int AS n FROM ${sql2.identifier(name)} x WHERE x.patient_id = ${id}`
                ),
                sql2` UNION ALL `
              )
            );
            for (const r of rows2) counts[r.name] = r.n;
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
      async listTests(opts = {}) {
        const rows = await db.select().from(tests).where(opts.activeOnly ? eq(tests.isActive, true) : void 0).orderBy(asc(tests.category), asc(tests.name));
        return rows.map(mapTest);
      }
      async getTest(id) {
        const [row] = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
        return row && mapTest(row);
      }
      async createTest(input, actor) {
        const [row] = await db.insert(tests).values({
          name: input.name,
          price: input.price,
          category: input.category,
          group: input.group,
          sampleType: input.sampleType,
          unit: input.unit ?? null,
          referenceRange: input.referenceRange ?? null,
          isActive: input.isActive ?? true,
          createdBy: actor.id
        }).returning();
        return mapTest(row);
      }
      async updateTest(id, input, actor) {
        const patch = {};
        if (input.name !== void 0) patch.name = input.name;
        if (input.price !== void 0) patch.price = input.price;
        if (input.category !== void 0) patch.category = input.category;
        if (input.group !== void 0) patch.group = input.group;
        if (input.sampleType !== void 0) patch.sampleType = input.sampleType;
        if (input.unit !== void 0) patch.unit = input.unit ?? null;
        if (input.referenceRange !== void 0) patch.referenceRange = input.referenceRange ?? null;
        if (input.isActive !== void 0) patch.isActive = input.isActive;
        if (Object.keys(patch).length === 0) return this.getTest(id);
        patch.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        patch.updatedBy = actor.id;
        const [row] = await db.update(tests).set(patch).where(eq(tests.id, id)).returning();
        return row && mapTest(row);
      }
      async deleteTest(id) {
        const { rows } = await db.execute(sql2`
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
      async hydrate(rows) {
        if (rows.length === 0) return [];
        const orderIds = rows.map((o) => o.id);
        const patientIds = Array.from(new Set(rows.map((o) => o.patientId)));
        const [items, people, tubes] = await Promise.all([
          db.select({ line: orderTests, group: tests.group }).from(orderTests).leftJoin(tests, eq(tests.id, orderTests.testId)).where(inArray(orderTests.orderId, orderIds)),
          db.select().from(patients).where(inArray(patients.id, patientIds)),
          db.select().from(samples).where(inArray(samples.orderId, orderIds))
        ]);
        const byPatient = new Map(people.map((p) => [p.id, mapPatient(p)]));
        const bySample = new Map(tubes.map((s) => [s.orderId, mapSample(s)]));
        const byOrder = /* @__PURE__ */ new Map();
        const groupsOf = /* @__PURE__ */ new Map();
        for (const { line, group } of items) {
          const list = byOrder.get(line.orderId) ?? [];
          list.push(mapItem(line));
          byOrder.set(line.orderId, list);
          const groups = groupsOf.get(line.orderId) ?? [];
          groups.push(group);
          groupsOf.set(line.orderId, groups);
        }
        const referralIds = Array.from(new Set(rows.map((o) => o.referralId).filter((id) => Boolean(id))));
        const numbers = referralIds.length ? await db.select({ id: referrals.id, n: referrals.referralNumber }).from(referrals).where(inArray(referrals.id, referralIds)) : [];
        const byReferral = new Map(numbers.map((r) => [r.id, r.n]));
        return rows.map((row) => ({
          ...mapOrder(row),
          patient: byPatient.get(row.patientId) ?? null,
          items: byOrder.get(row.id) ?? [],
          // Null for orders created before sample tracking existed.
          sample: bySample.get(row.id) ?? null,
          referralNumber: row.referralId ? byReferral.get(row.referralId) ?? null : null,
          groups: orderGroups(groupsOf.get(row.id) ?? [])
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
                WHERE p.id = "orders"."patient_id"
                  AND (p.full_name ILIKE ${like} OR p.phone ILIKE ${like}${phoneDigits}))
        OR ${orders.orderNumber}::text ILIKE ${like}
        OR EXISTS (SELECT 1 FROM ${orderTests} ot
                   WHERE ot.order_id = "orders"."id" AND ot.test_name ILIKE ${like})
      )`);
        }
        const scopeWhere = base.length ? and(...base) : void 0;
        const groupKey = query.group;
        if (groupKey) {
          base.push(sql2`EXISTS (SELECT 1 FROM ${orderTests} ot JOIN ${tests} t ON t.id = ot.test_id
                            WHERE ot.order_id = "orders"."id" AND t."group" = ${groupKey})`);
        }
        const baseWhere = base.length ? and(...base) : void 0;
        const notCancelled = sql2`${orders.status} <> 'cancelled'`;
        const hasItems = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot WHERE ot.order_id = "orders"."id")`;
        const hasBlank = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot
                                 WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL
                                   AND (ot.result IS NULL OR ot.result = '' OR ot.returned_at IS NOT NULL))`;
        const hasReview = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot
                                  WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL
                                    AND ot.result IS NOT NULL AND ot.result <> '' AND ot.returned_at IS NULL)`;
        const hasUnverified = sql2`EXISTS (SELECT 1 FROM ${orderTests} ot
                                      WHERE ot.order_id = "orders"."id" AND ot.verified_at IS NULL)`;
        const readyExpr = sql2`(${hasItems} AND NOT ${hasUnverified})`;
        const conditions = [...base];
        if (query.status) conditions.push(eq(orders.status, query.status));
        if (query.queue) {
          conditions.push(notCancelled);
          conditions.push(query.queue === "waiting" ? hasBlank : query.queue === "review" ? hasReview : readyExpr);
        }
        const where = conditions.length ? and(...conditions) : void 0;
        let q = db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const liveBase = baseWhere ? and(baseWhere, notCancelled) : notCancelled;
        const billable = where ? and(where, notCancelled) : notCancelled;
        const [rows, statusRows, [queueRow], [totalsRow], [{ count }], groupRows] = await Promise.all([
          q,
          db.select({ status: orders.status, count: sql2`count(*)::int` }).from(orders).where(baseWhere).groupBy(orders.status),
          db.select({
            waiting: sql2`count(*) FILTER (WHERE ${hasBlank})::int`,
            review: sql2`count(*) FILTER (WHERE ${hasReview})::int`,
            ready: sql2`count(*) FILTER (WHERE ${readyExpr})::int`
          }).from(orders).where(liveBase),
          db.select({
            sum: sql2`coalesce(sum(${orders.totalAmount}), 0)::int`,
            paid: sql2`coalesce(sum(${orders.paidAmount}), 0)::int`
          }).from(orders).where(billable),
          db.select({ count: sql2`count(*)::int` }).from(orders).where(where),
          db.select({ group: tests.group, count: sql2`count(DISTINCT ${orderTests.orderId})::int` }).from(orderTests).innerJoin(tests, eq(tests.id, orderTests.testId)).innerJoin(orders, eq(orders.id, orderTests.orderId)).where(scopeWhere).groupBy(tests.group)
        ]);
        const groups = {};
        for (const row of groupRows) if (isTestGroup(row.group)) groups[row.group] = row.count;
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
            results: { waiting: queueRow?.waiting ?? 0, review: queueRow?.review ?? 0, ready: queueRow?.ready ?? 0 },
            totals: { sum, paid, debt: Math.max(0, sum - paid) },
            groups
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
        return rows.map(mapPayment);
      }
      /**
       * orders.paidAmount is a cache of the ledger. Recomputing it from the rows
       * after every change is what keeps the two from drifting — incrementing it in
       * place silently loses a payment whenever a write fails halfway.
       */
      async syncPaid(tx, orderId, actor) {
        await tx.update(orders).set({
          paidAmount: sql2`greatest(0, (SELECT coalesce(sum(p.amount), 0)::int FROM payments p
          WHERE p.order_id = ${orderId} AND p.voided_at IS NULL))`,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        }).where(eq(orders.id, orderId));
      }
      async createOrder(input) {
        const patient = await this.getPatient(input.patientId);
        if (!patient) throw new Error("Bemor topilmadi");
        const selected = (await db.select().from(tests).where(inArray(tests.id, input.testIds))).map(mapTest);
        if (selected.length === 0) throw new Error("Tanlangan tahlillar topilmadi");
        const orderId = await db.transaction((tx) => this.insertOrderTx(tx, input, selected, null));
        return await this.getOrder(orderId);
      }
      /**
       * The order, its lines, its tube and the opening payment, written inside the
       * caller's transaction. Shared by the desk (createOrder) and the doctor's
       * lab referral (createReferrals), so both make exactly the same order.
       */
      async insertOrderTx(tx, input, selected, referralId) {
        const subtotal = selected.reduce((sum, t) => sum + t.price, 0);
        const discount = Math.min(input.discount, subtotal);
        const total = subtotal - discount;
        const opening = Math.min(input.paidAmount, total);
        {
          const [visit] = await tx.insert(visits).values({ patientId: input.patientId, visitDate: todayKey(), createdBy: input.createdBy ?? null }).onConflictDoUpdate({ target: [visits.patientId, visits.visitDate], set: { patientId: sql2`excluded.patient_id` } }).returning({ id: visits.id });
          const [order] = await tx.insert(orders).values({
            patientId: input.patientId,
            visitId: visit.id,
            totalAmount: total,
            discount,
            paidAmount: opening,
            status: "pending",
            notes: input.notes ?? null,
            referrer: input.referrer ?? null,
            referralId,
            createdBy: input.createdBy ?? null
          }).returning({ id: orders.id, orderNumber: orders.orderNumber });
          await tx.insert(orderTests).values(
            selected.map((t) => ({
              orderId: order.id,
              testId: t.id,
              testName: t.name,
              price: t.price,
              unit: t.unit,
              referenceRange: t.referenceRange,
              sampleType: t.sampleType
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
        }
      }
      async updateOrder(id, input, actor) {
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
        if (Object.keys(patch).length > 0 || input.testIds) {
          patch.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
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
                referenceRange: t.referenceRange,
                sampleType: t.sampleType
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
        await db.transaction(async (tx) => {
          const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, id)).for("update");
          const changes = planResultSave(
            lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt) })),
            results,
            patient?.gender
          );
          for (const c of changes) {
            await tx.update(orderTests).set({
              result: c.result,
              flag: c.flag,
              notes: c.notes,
              completedAt: c.result ? now : null,
              ...c.result && actor ? { enteredBy: actor.name, enteredById: actor.id } : {},
              // A re-entered value answers the lab head's return.
              returnedAt: null,
              returnedByName: null,
              returnReason: null
            }).where(and(eq(orderTests.id, c.id), eq(orderTests.orderId, id)));
          }
          const patch = { updatedAt: now, updatedBy: actor?.id ?? null };
          if (current.status !== "cancelled") {
            const [{ total, filled }] = await tx.select({
              total: sql2`count(*)::int`,
              filled: sql2`count(${orderTests.result})::int`
            }).from(orderTests).where(eq(orderTests.orderId, id));
            const status = total > 0 && filled === total ? "completed" : filled > 0 ? "in_progress" : "pending";
            patch.status = status;
            patch.completedAt = status === "completed" ? current.status === "completed" && current.completedAt ? current.completedAt : now : null;
          }
          if (changes.length) await tx.update(orders).set(patch).where(eq(orders.id, id));
        });
        return this.getOrder(id);
      }
      async verifyResults(orderId, itemIds, actor) {
        const outcome = await db.transaction(async (tx) => {
          const [order] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.id, orderId)).for("update");
          if (!order) return void 0;
          if (order.status === "cancelled") throw new StorageConflict("Buyurtma bekor qilingan");
          const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, orderId));
          const target = pickForVerification(
            lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt), returnedAt: iso(l.returnedAt) })),
            itemIds
          );
          const now = (/* @__PURE__ */ new Date()).toISOString();
          for (const l of target) {
            await tx.update(orderTests).set({ verifiedAt: now, verifiedBy: actor.id, verifiedByName: actor.name }).where(and(eq(orderTests.id, l.id), isNull(orderTests.verifiedAt)));
          }
          await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
          return { verified: target.length, selfChecked: target.filter((l) => l.enteredById && l.enteredById === actor.id).length };
        });
        if (!outcome) return void 0;
        return { order: await this.getOrder(orderId), ...outcome };
      }
      async returnResults(orderId, itemIds, reason, actor) {
        const found = await db.transaction(async (tx) => {
          const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("update");
          if (!order) return false;
          const lines = await tx.select().from(orderTests).where(eq(orderTests.orderId, orderId));
          const target = pickForVerification(
            lines.map((l) => ({ ...l, verifiedAt: iso(l.verifiedAt), returnedAt: iso(l.returnedAt) })),
            itemIds
          );
          const now = (/* @__PURE__ */ new Date()).toISOString();
          await tx.update(orderTests).set({ returnedAt: now, returnedByName: actor.name, returnReason: reason }).where(inArray(orderTests.id, target.map((l) => l.id)));
          await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
          return true;
        });
        return found ? this.getOrder(orderId) : void 0;
      }
      async amendResult(orderId, itemId, input, reason, actor) {
        const previous = await db.transaction(async (tx) => {
          const [line] = await tx.select().from(orderTests).where(and(eq(orderTests.id, itemId), eq(orderTests.orderId, orderId))).for("update");
          if (!line) return void 0;
          const problem = amendProblem({ ...line, verifiedAt: iso(line.verifiedAt) }, input);
          if (problem) throw new StorageConflict(problem);
          const now = (/* @__PURE__ */ new Date()).toISOString();
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
            replaceReason: reason
          });
          await tx.update(orderTests).set({
            result: input.result,
            flag: input.flag,
            notes: input.notes,
            version: line.version + 1,
            completedAt: now,
            enteredBy: actor.name,
            enteredById: actor.id,
            verifiedAt: now,
            verifiedBy: actor.id,
            verifiedByName: actor.name
          }).where(eq(orderTests.id, line.id));
          await tx.update(orders).set({ updatedAt: now, updatedBy: actor.id }).where(eq(orders.id, orderId));
          return { result: line.result, version: line.version };
        });
        if (!previous) return void 0;
        return { order: await this.getOrder(orderId), previous };
      }
      async listResultVersions(itemId) {
        const rows = await db.select().from(orderTestVersions).where(eq(orderTestVersions.orderTestId, itemId)).orderBy(desc(orderTestVersions.version));
        return rows.map((r) => ({
          ...r,
          flag: r.flag,
          verifiedAt: iso(r.verifiedAt),
          replacedAt: iso(r.replacedAt) ?? r.replacedAt
        }));
      }
      async deleteOrder(id) {
        return db.transaction(async (tx) => {
          const [locked] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, id)).for("update");
          if (!locked) return false;
          const { rows: [held] } = await tx.execute(sql2`
        SELECT
          (SELECT count(*) FROM payments p WHERE p.order_id = ${id})::int AS paid,
          (SELECT count(*) FROM order_tests ot WHERE ot.order_id = ${id} AND ot.result IS NOT NULL)::int AS results`);
          const problem = orderDeleteProblem(held?.paid ?? 0, held?.results ?? 0);
          if (problem) throw new StorageConflict(problem);
          await tx.delete(orderTests).where(eq(orderTests.orderId, id));
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
            patch.quality = null;
            patch.qualityNote = null;
            break;
          case "qabul_qilindi":
            patch.receivedAt = now;
            patch.receivedBy = actor.id;
            patch.receivedByName = actor.name;
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
        const [{ paid }] = await db.select({ paid: sql2`coalesce(sum(${payments.amount}), 0)::int` }).from(payments).where(and(eq(payments.orderId, orderId), isNull(payments.voidedAt)));
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
          await this.syncPaid(tx, orderId, actor);
        });
        return this.getOrder(orderId);
      }
      async voidPayment(paymentId, reason, actor) {
        const orderId = await db.transaction(async (tx) => {
          const [row] = await tx.update(payments).set({
            voidedAt: (/* @__PURE__ */ new Date()).toISOString(),
            voidedBy: actor.id,
            voidedByName: actor.name,
            voidReason: reason
          }).where(and(eq(payments.id, paymentId), isNull(payments.voidedAt))).returning({ orderId: payments.orderId });
          if (!row) {
            const [exists] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.id, paymentId)).limit(1);
            if (exists) throw new StorageConflict(PAYMENT_ALREADY_VOIDED);
            return void 0;
          }
          await this.syncPaid(tx, row.orderId, actor);
          return row.orderId;
        });
        return orderId ? this.getOrder(orderId) : void 0;
      }
      // ------------------------------------------------------------- expenses
      async listExpenses(query = {}) {
        const status = query.status ?? "active";
        const parts = [];
        if (query.from) parts.push(gte(expenses.spentOn, query.from));
        if (query.to) parts.push(lte(expenses.spentOn, query.to));
        if (query.category) parts.push(eq(expenses.category, query.category));
        if (query.method) parts.push(eq(expenses.method, query.method));
        const q0 = query.search?.trim();
        if (q0) {
          const like = `%${q0.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
          parts.push(or(sql2`${expenses.note} ILIKE ${like}`, sql2`${expenses.payee} ILIKE ${like}`));
        }
        if (status !== "all") parts.push(eq(expenses.status, status));
        const where = parts.length ? and(...parts) : void 0;
        let q = db.select().from(expenses).where(where).orderBy(desc(expenses.spentOn), desc(expenses.createdAt)).$dynamic();
        if (query.limit !== void 0) q = q.limit(query.limit);
        if (query.offset) q = q.offset(query.offset);
        const [rows, [agg]] = await Promise.all([
          q,
          db.select({
            count: sql2`count(*)::int`,
            sum: sql2`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::bigint::float8`
          }).from(expenses).where(where)
        ]);
        return {
          items: rows.map(mapExpense),
          total: agg?.count ?? 0,
          total_amount: agg?.sum ?? 0
        };
      }
      async getExpense(id) {
        const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
        return row && mapExpense(row);
      }
      async createExpense(input, actor) {
        const [row] = await db.insert(expenses).values({
          category: input.category,
          amount: input.amount,
          method: input.method,
          payee: input.payee ?? null,
          note: input.note ?? null,
          spentOn: input.spentOn,
          createdBy: actor.id,
          createdByName: actor.name
        }).returning();
        return mapExpense(row);
      }
      async updateExpense(id, input, actor) {
        const patch = {
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        };
        if (input.category !== void 0) patch.category = input.category;
        if (input.amount !== void 0) patch.amount = input.amount;
        if (input.method !== void 0) patch.method = input.method;
        if (input.payee !== void 0) patch.payee = input.payee ?? null;
        if (input.note !== void 0) patch.note = input.note ?? null;
        if (input.spentOn !== void 0) patch.spentOn = input.spentOn;
        const [row] = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning();
        return row && mapExpense(row);
      }
      async cancelExpense(id, reason, actor) {
        const [row] = await db.update(expenses).set({
          status: "cancelled",
          cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
          cancelledBy: actor.id,
          cancelledByName: actor.name,
          cancelReason: reason
        }).where(eq(expenses.id, id)).returning();
        return row && mapExpense(row);
      }
      /**
       * Five small aggregates run side by side. Each is one round trip, and they
       * overlap, so the dashboard costs about as much as a single query.
       */
      async getExpenseSummary(from, to) {
        const range = and(gte(expenses.spentOn, from), lte(expenses.spentOn, to));
        const active = and(range, eq(expenses.status, "active"));
        const prev = previousRange(from, to);
        const sumAmount = sql2`coalesce(sum(${expenses.amount}), 0)::bigint::float8`;
        const [byCategory, byMethod, perDay, [agg], [prevAgg]] = await Promise.all([
          db.select({ category: expenses.category, amount: sumAmount, count: sql2`count(*)::int` }).from(expenses).where(active).groupBy(expenses.category).orderBy(desc(sumAmount)),
          db.select({ method: expenses.method, amount: sumAmount, count: sql2`count(*)::int` }).from(expenses).where(active).groupBy(expenses.method).orderBy(desc(sumAmount)),
          db.select({ date: expenses.spentOn, amount: sumAmount }).from(expenses).where(active).groupBy(expenses.spentOn),
          db.select({
            total: sql2`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::bigint::float8`,
            count: sql2`count(*) FILTER (WHERE ${expenses.status} = 'active')::int`,
            largest: sql2`coalesce(max(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'active'), 0)::int`,
            cancelledCount: sql2`count(*) FILTER (WHERE ${expenses.status} = 'cancelled')::int`,
            cancelledAmount: sql2`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'cancelled'), 0)::bigint::float8`
          }).from(expenses).where(range),
          db.select({ total: sumAmount }).from(expenses).where(and(gte(expenses.spentOn, prev.from), lte(expenses.spentOn, prev.to), eq(expenses.status, "active")))
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
          cancelled: { count: agg?.cancelledCount ?? 0, amount: Number(agg?.cancelledAmount ?? 0) }
        };
      }
      async listExpensePayees(limit = 30) {
        const rows = await db.select({ payee: expenses.payee }).from(expenses).where(sql2`${expenses.payee} IS NOT NULL AND btrim(${expenses.payee}) <> ''`).groupBy(expenses.payee).orderBy(desc(sql2`count(*)`)).limit(limit);
        return rows.map((r) => r.payee).filter(Boolean);
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
        const parts = [];
        if (query.entity) parts.push(eq(auditLog.entity, query.entity));
        if (query.entityId) parts.push(eq(auditLog.entityId, query.entityId));
        if (query.action) parts.push(eq(auditLog.action, query.action));
        const where = parts.length ? and(...parts) : void 0;
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
          unpaidAmount: r?.unpaid ?? 0
        };
      }
      async getLabBoard(day) {
        const local = (col) => sql2.raw(`(${col} AT TIME ZONE current_setting('TIMEZONE'))::date`);
        const countsQuery = db.execute(sql2`
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
        const awaitingQuery = db.select().from(orders).where(
          and(
            sql2`${orders.status} <> 'cancelled'`,
            sql2`EXISTS (SELECT 1 FROM samples s WHERE s.order_id = "orders"."id" AND s.status <> 'qabul_qilindi')`
          )
        ).orderBy(asc(orders.createdAt)).limit(LAB_BOARD_AWAITING_LIMIT);
        const [{ rows }, waitingRows] = await Promise.all([countsQuery, awaitingQuery]);
        const r = rows[0];
        const groupsToday = {};
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
            cancelledToday: r?.cancelledToday ?? 0
          },
          groupsToday,
          awaiting: await this.hydrate(waitingRows)
        };
      }
      async getReceptionDay(day) {
        const { rows } = await db.execute(sql2`
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
              createdAt: iso(n.created_at)
            }))
          },
          payments: {
            orders: r?.orders ?? 0,
            paid: r?.paid ?? 0,
            partial: r?.partial ?? 0,
            unpaid: r?.unpaid ?? 0,
            billed,
            collected,
            due: Math.max(0, billed - collected)
          }
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
        const spentInRange = and(gte(expenses.spentOn, from), lte(expenses.spentOn, to), eq(expenses.status, "active"));
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
      // ------------------------------------------------------------- security
      async getSecuritySettings() {
        try {
          const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "security")).limit(1);
          const parsed = securitySettingsSchema.safeParse({ ...DEFAULT_SECURITY_SETTINGS, ...row?.value ?? {} });
          return parsed.success ? parsed.data : { ...DEFAULT_SECURITY_SETTINGS };
        } catch (err) {
          if (isMissingTable(err)) return { ...DEFAULT_SECURITY_SETTINGS };
          throw err;
        }
      }
      async updateSecuritySettings(input, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.insert(appSettings).values({ key: "security", value: input, updatedAt: now, updatedBy: actor.id }).onConflictDoUpdate({ target: appSettings.key, set: { value: input, updatedAt: now, updatedBy: actor.id } });
        return { ...input };
      }
      async getLogo() {
        try {
          const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "logo")).limit(1);
          const v = row?.value;
          return v && checkLogo(v.dataUrl).ok ? v : null;
        } catch (err) {
          if (isMissingTable(err)) return null;
          throw err;
        }
      }
      async setLogo(logo, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (!logo) {
          await db.delete(appSettings).where(eq(appSettings.key, "logo"));
          return;
        }
        await db.insert(appSettings).values({ key: "logo", value: logo, updatedAt: now, updatedBy: actor.id }).onConflictDoUpdate({ target: appSettings.key, set: { value: logo, updatedAt: now, updatedBy: actor.id } });
      }
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
      userMfa: [],
      roles: [],
      departments: [],
      doctors: [],
      services: [],
      appointments: [],
      medicalRecords: [],
      medicalRecordVersions: [],
      patientAllergies: [],
      referrals: [],
      notifications: [],
      icdUzNames: {},
      security: null,
      patients: [],
      patientContacts: [],
      visits: [],
      tests: [],
      orders: [],
      orderTests: [],
      orderTestVersions: [],
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
      counters: { orderNumber: 1e3, patientNumber: 0, referralNumber: 0 }
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
import { readFileSync } from "fs";
import path2 from "path";
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
var icdCache, UNVERIFIED, UNVOIDED, digitsOf, isWaiting, isReview, isReady, copyRole, normalizePatient, normalizeExpense, FileStorage;
var init_storage_file = __esm({
  "server/storage-file.ts"() {
    "use strict";
    init_tests_data();
    init_schema();
    init_patient_identity();
    init_appointment();
    init_sample();
    init_patient_links();
    init_referral();
    init_lab_catalogue();
    init_lab_board();
    init_icd10();
    init_lab_verification();
    init_lab_rules();
    init_ledger();
    init_db();
    init_password();
    init_permissions();
    init_storage_types();
    icdCache = null;
    UNVERIFIED = {
      verifiedAt: null,
      verifiedBy: null,
      verifiedByName: null,
      returnedAt: null,
      returnedByName: null,
      returnReason: null,
      version: 1
    };
    UNVOIDED = { voidedAt: null, voidedBy: null, voidedByName: null, voidReason: null };
    digitsOf = (value) => (value ?? "").replace(/\D/g, "");
    isWaiting = (order) => needsEntry(order.items);
    isReview = (order) => needsReview(order.items);
    isReady = (order) => isOrderReleased(order);
    copyRole = (r) => ({ ...r, permissions: [...r.permissions] });
    normalizePatient = (p) => ({
      ...p,
      birthDate: p.birthDate ?? null,
      passport: p.passport ?? null,
      pinfl: p.pinfl ?? null,
      updatedAt: p.updatedAt ?? null,
      updatedBy: p.updatedBy ?? null
    });
    normalizeExpense = (e) => ({
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
      updatedBy: e.updatedBy ?? null
    });
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
              ...classifyTest(t),
              unit: ref?.unit ?? null,
              referenceRange: ref?.referenceRange ?? null,
              isActive: true,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              createdBy: null,
              updatedAt: null,
              updatedBy: null
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
              createdBy: null,
              updatedAt: null,
              updatedBy: null,
              failedAttempts: 0,
              lockedUntil: null,
              lockLevel: 0,
              lastFailedAt: null
            });
          }
          createdUsers = SEED_USERS.length;
        }
        const numbered = this.backfillPatientNumbers();
        const visited = this.backfillVisits();
        this.backfillVerification();
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
            createdBy: null,
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
        if (createdTests || createdUsers || numbered || createdRoles || migratedAdmins || visited) await this.persist();
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
          createdBy: actor.id,
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
          createdBy: actor.id,
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
          createdBy: actor.id,
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
      // ------------------------------------------------------------- services
      serviceDetails(svc) {
        const dept = svc.departmentId ? this.db.departments.find((d) => d.id === svc.departmentId) : void 0;
        return {
          ...svc,
          departmentName: dept?.name ?? null,
          appointmentCount: this.db.appointments.filter((a) => a.serviceId === svc.id).length
        };
      }
      async listServices(opts = {}) {
        return this.db.services.filter((x) => !opts.activeOnly || x.isActive).map((x) => this.serviceDetails(x)).sort(
          (a, b) => Number(b.isActive) - Number(a.isActive) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
        );
      }
      async getService(id) {
        const svc = this.db.services.find((x) => x.id === id);
        return svc && { ...svc };
      }
      async createService(input, actor) {
        const svc = {
          id: randomUUID(),
          name: input.name,
          kind: input.kind,
          departmentId: input.departmentId ?? null,
          price: input.price,
          durationMinutes: input.durationMinutes ?? null,
          description: input.description ?? null,
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor.id,
          updatedAt: null,
          updatedBy: null
        };
        this.db.services.push(svc);
        await this.persist();
        return this.serviceDetails(svc);
      }
      async updateService(id, input, actor) {
        const svc = this.db.services.find((x) => x.id === id);
        if (!svc) return void 0;
        if (input.name !== void 0) svc.name = input.name;
        if (input.kind !== void 0) svc.kind = input.kind;
        if (input.departmentId !== void 0) svc.departmentId = input.departmentId ?? null;
        if (input.price !== void 0) svc.price = input.price;
        if (input.durationMinutes !== void 0) svc.durationMinutes = input.durationMinutes ?? null;
        if (input.description !== void 0) svc.description = input.description ?? null;
        if (input.isActive !== void 0) svc.isActive = input.isActive;
        svc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        svc.updatedBy = actor.id;
        await this.persist();
        return this.serviceDetails(svc);
      }
      async deleteService(id) {
        const before = this.db.services.length;
        this.db.services = this.db.services.filter((x) => x.id !== id);
        if (this.db.services.length === before) return false;
        await this.persist();
        return true;
      }
      // --------------------------------------------------------- appointments
      appointmentDetails(a) {
        const patient = this.db.patients.find((p) => p.id === a.patientId);
        const doctor = this.db.doctors.find((d) => d.id === a.doctorId);
        const user = doctor ? this.db.users.find((u) => u.id === doctor.userId) : void 0;
        const dept = doctor?.departmentId ? this.db.departments.find((d) => d.id === doctor.departmentId) : void 0;
        const svc = a.serviceId ? this.db.services.find((x) => x.id === a.serviceId) : void 0;
        return {
          ...a,
          patientNumber: patient?.patientNumber ?? 0,
          patientName: patient?.fullName ?? "\u2014",
          patientPhone: patient?.phone ?? "",
          patientBirthDate: patient?.birthDate ?? null,
          patientAge: patientAge(patient),
          patientGender: patient?.gender ?? null,
          doctorName: user?.fullName ?? "\u2014",
          doctorUserId: doctor?.userId ?? "",
          specialty: doctor?.specialty ?? "",
          room: doctor?.room ?? null,
          departmentName: dept?.name ?? null,
          serviceName: svc?.name ?? null
        };
      }
      async listAppointments(q) {
        const list = this.db.appointments.filter(
          (a) => (!q.date || a.date === q.date) && (!q.beforeDate || a.date < q.beforeDate) && (!q.doctorId || a.doctorId === q.doctorId) && (!q.patientId || a.patientId === q.patientId) && (!q.statuses?.length || q.statuses.includes(a.status))
        );
        list.sort(
          (a, b) => q.patientId ? b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime) : a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber
        );
        return list.slice(0, Math.min(q.limit ?? 500, 2e3)).map((a) => this.appointmentDetails(a));
      }
      async getAppointment(id) {
        const a = this.db.appointments.find((x) => x.id === id);
        return a && this.appointmentDetails(a);
      }
      dayBookings(doctorId, date) {
        return this.db.appointments.filter((a) => a.doctorId === doctorId && a.date === date).map((a) => ({ ...a }));
      }
      async createAppointment(input, actor, check) {
        if (input.referralId) {
          const ref = this.db.referrals.find((r) => r.id === input.referralId);
          if (!ref || ref.status !== "active") throw new StorageConflict("Yo'llanma bekor qilingan yoki topilmadi");
          const taken = this.liveBooking(input.referralId);
          if (taken) throw new StorageConflict(`Bu yo'llanma bo'yicha bemor allaqachon yozilgan (${taken.date} ${taken.startTime})`);
        }
        const day = this.dayBookings(input.doctorId, input.date);
        const problem = check(day);
        if (problem) throw new StorageConflict(problem);
        const a = {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor.id,
          updatedAt: null,
          updatedBy: null
        };
        this.db.appointments.push(a);
        await this.persist();
        return this.appointmentDetails(a);
      }
      async rescheduleAppointment(id, patch, actor, check) {
        const a = this.db.appointments.find((x) => x.id === id);
        if (!a) throw new StorageConflict("Qabul topilmadi");
        if (a.status !== "scheduled") throw new StorageConflict(`Faqat "yozildi" holatidagi qabulni ko'chirish mumkin`);
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
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: actor.id
        });
        await this.persist();
        return this.appointmentDetails(a);
      }
      async setAppointmentStatus(id, change, actor) {
        const a = this.db.appointments.find((x) => x.id === id);
        if (!a || a.status !== change.from) {
          throw new StorageConflict("Qabul holati boshqa joyda o'zgartirilgan. Sahifani yangilang");
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
      async doctorHasAppointments(doctorId) {
        return this.db.appointments.some((a) => a.doctorId === doctorId);
      }
      // ---------------------------------------------------- examination records
      recordDetails(r) {
        const doctor = this.db.doctors.find((d) => d.id === r.doctorId);
        const user = doctor ? this.db.users.find((u) => u.id === doctor.userId) : void 0;
        const appt = this.db.appointments.find((a) => a.id === r.appointmentId);
        const signer2 = r.signedBy ? this.db.users.find((u) => u.id === r.signedBy) : void 0;
        const patient = this.db.patients.find((p) => p.id === r.patientId);
        return {
          ...r,
          patientNumber: patient?.patientNumber ?? 0,
          patientName: patient?.fullName ?? "\u2014",
          doctorName: user?.fullName ?? "\u2014",
          doctorUserId: doctor?.userId ?? "",
          specialty: doctor?.specialty ?? "",
          date: appt?.date ?? r.createdAt.slice(0, 10),
          startTime: appt?.startTime ?? "",
          signedByName: signer2?.fullName ?? null
        };
      }
      /** Same wording as the Postgres store: "already signed", else "saved elsewhere". */
      recordConflict(status) {
        return new StorageConflict(
          status === "signed" ? "Yozuv allaqachon tasdiqlangan. Sahifani yangilang" : "Yozuv boshqa oynada o'zgartirilgan. Sahifani yangilang \u2014 oxirgi saqlangan matn ko'rinadi"
        );
      }
      async listRecords(q) {
        return this.db.medicalRecords.filter(
          (r) => (!q.patientId || r.patientId === q.patientId) && (!q.appointmentIds || q.appointmentIds.includes(r.appointmentId)) && (!q.doctorId || r.doctorId === q.doctorId) && (!q.status || r.status === q.status)
        ).map((r) => this.recordDetails(r)).sort(
          (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime) || b.createdAt.localeCompare(a.createdAt)
        ).slice(0, Math.min(q.limit ?? 500, 2e3));
      }
      async getRecord(id) {
        const r = this.db.medicalRecords.find((x) => x.id === id);
        return r && this.recordDetails({ ...r });
      }
      async getRecordByAppointment(appointmentId) {
        const r = this.db.medicalRecords.find((x) => x.appointmentId === appointmentId);
        return r && this.recordDetails({ ...r });
      }
      async openRecord(input, actor) {
        const existing = this.db.medicalRecords.find((r2) => r2.appointmentId === input.appointmentId);
        if (existing) return this.recordDetails({ ...existing });
        const r = {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor.id,
          updatedAt: null,
          updatedBy: null
        };
        this.db.medicalRecords.push(r);
        await this.persist();
        return this.recordDetails({ ...r });
      }
      async saveRecordDraft(id, revision, fields, actor) {
        const r = this.db.medicalRecords.find((x) => x.id === id);
        if (!r || r.status !== "draft" || r.revision !== revision) throw this.recordConflict(r?.status);
        for (const [k, v] of Object.entries(fields)) if (v !== void 0) r[k] = v;
        r.revision = revision + 1;
        r.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        r.updatedBy = actor.id;
        await this.persist();
        return this.recordDetails({ ...r });
      }
      async signRecord(id, revision, actor) {
        const r = this.db.medicalRecords.find((x) => x.id === id);
        if (!r || r.status !== "draft" || r.revision !== revision) throw this.recordConflict(r?.status);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        Object.assign(r, { status: "signed", signedAt: now, signedBy: actor.id, revision: revision + 1, updatedAt: now, updatedBy: actor.id });
        await this.persist();
        return this.recordDetails({ ...r });
      }
      async amendRecord(id, revision, fields, reason, actor) {
        const r = this.db.medicalRecords.find((x) => x.id === id);
        if (!r) throw new StorageConflict("Yozuv topilmadi");
        if (r.status !== "signed") throw new StorageConflict("Faqat tasdiqlangan yozuvga tuzatish kiritiladi");
        if (r.revision !== revision) throw this.recordConflict();
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
          replaceReason: reason
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
          updatedBy: actor.id
        });
        await this.persist();
        return this.recordDetails({ ...r });
      }
      async listRecordVersions(recordId) {
        return this.db.medicalRecordVersions.filter((v) => v.recordId === recordId).sort((a, b) => b.version - a.version).map((v) => ({ ...v, replacedByName: this.db.users.find((u) => u.id === v.replacedBy)?.fullName ?? null }));
      }
      // ------------------------------------------------------------- allergies
      allergyDetails(a) {
        return { ...a, createdByName: this.db.users.find((u) => u.id === a.createdBy)?.fullName ?? null };
      }
      async listAllergies(patientId, opts = {}) {
        return this.db.patientAllergies.filter((a) => a.patientId === patientId && (opts.includeInactive || a.isActive)).sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt)).map((a) => this.allergyDetails(a));
      }
      async getAllergy(id) {
        const a = this.db.patientAllergies.find((x) => x.id === id);
        return a && this.allergyDetails(a);
      }
      async addAllergy(patientId, input, actor) {
        const a = {
          id: randomUUID(),
          patientId,
          allergen: input.allergen,
          reaction: input.reaction,
          isActive: true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor.id,
          removedAt: null,
          removedBy: null,
          removeReason: null
        };
        this.db.patientAllergies.push(a);
        await this.persist();
        return this.allergyDetails(a);
      }
      async deactivateAllergy(id, reason, actor) {
        const a = this.db.patientAllergies.find((x) => x.id === id);
        if (!a || !a.isActive) throw new StorageConflict("Bu yozuv allaqachon faol emas");
        Object.assign(a, { isActive: false, removedAt: (/* @__PURE__ */ new Date()).toISOString(), removedBy: actor.id, removeReason: reason });
        await this.persist();
        return this.allergyDetails(a);
      }
      // ---------------------------------------------------------------- MKB-10
      /** The catalogue file, parsed once per process; Uzbek names come from the store. */
      icdRows() {
        if (!icdCache) {
          const file = path2.resolve(import.meta.dirname, "..", "data", "icd10", "mkb10-nsi-2.27.csv");
          icdCache = parseNsiIcd10(readFileSync(file, "utf8"));
        }
        return icdCache;
      }
      icdEntry(r) {
        const uz = this.db.icdUzNames?.[r.code];
        return { ...r, nameUz: uz ?? null, updatedAt: null };
      }
      async searchIcd(query) {
        const q = query.q.trim();
        const code = normalizeIcdCode(q);
        const words = /^[A-Z]\d/.test(code) ? [] : q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
        const out = [];
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
      async getIcd(codes) {
        const want = new Set(codes);
        return this.icdRows().filter((r) => want.has(r.code)).map((r) => this.icdEntry(r));
      }
      async icdStats() {
        const rows = this.icdRows();
        return {
          total: rows.length,
          selectable: rows.filter((r) => r.selectable).length,
          withUzbek: Object.values(this.db.icdUzNames ?? {}).filter((v) => v.trim()).length,
          source: ICD_SOURCE
        };
      }
      async setIcdUzName(code, nameUz, _actor) {
        const row = this.icdRows().find((r) => r.code === code);
        if (!row) return void 0;
        this.db.icdUzNames ??= {};
        if (nameUz) this.db.icdUzNames[code] = nameUz;
        else delete this.db.icdUzNames[code];
        await this.persist();
        return this.icdEntry(row);
      }
      async importIcdUzNames(names, _actor) {
        const known = new Set(this.icdRows().map((r) => r.code));
        this.db.icdUzNames ??= {};
        let updated = 0;
        const unknown = [];
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
      async createNotification(input) {
        if (input.dedupeKey && this.db.notifications.some((n) => n.dedupeKey === input.dedupeKey)) return false;
        this.db.notifications.push({ id: randomUUID(), ...input, createdAt: (/* @__PURE__ */ new Date()).toISOString(), readAt: null });
        await this.persist();
        return true;
      }
      async listNotifications(userId, limit) {
        const mine = this.db.notifications.filter((n) => n.userId === userId);
        return {
          unread: mine.filter((n) => !n.readAt).length,
          items: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(({ dedupeKey: _key, ...n }) => ({ ...n }))
        };
      }
      async markNotificationRead(userId, id) {
        const n = this.db.notifications.find((x) => x.id === id && x.userId === userId && !x.readAt);
        if (!n) return false;
        n.readAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.persist();
        return true;
      }
      async markAllNotificationsRead(userId) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
      liveBooking(referralId) {
        return this.db.appointments.find(
          (a) => a.referralId === referralId && a.status !== "cancelled" && a.status !== "no_show"
        );
      }
      referralDetails(r) {
        const patient = this.db.patients.find((p) => p.id === r.patientId);
        const issuer = this.db.doctors.find((d) => d.id === r.doctorId);
        const issuerUser2 = issuer && this.db.users.find((u) => u.id === issuer.userId);
        const service = r.serviceId ? this.db.services.find((s) => s.id === r.serviceId) : void 0;
        const target = r.targetDoctorId ? this.db.doctors.find((d) => d.id === r.targetDoctorId) : void 0;
        const targetUser2 = target && this.db.users.find((u) => u.id === target.userId);
        const canceller = r.cancelledBy ? this.db.users.find((u) => u.id === r.cancelledBy) : void 0;
        let order = null;
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
              results: lines.filter((i) => i.verifiedAt && i.result).sort((a, b) => a.testName.localeCompare(b.testName)).map((i) => ({ testName: i.testName, result: i.result, unit: i.unit, referenceRange: i.referenceRange, flag: i.flag })),
              testNames: lines.map((i) => i.testName).sort((a, b) => a.localeCompare(b))
            };
          }
        }
        let booking = null;
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
              doctorName: this.db.users.find((u) => u.id === doc?.userId)?.fullName ?? "\u2014"
            };
          }
        }
        return {
          ...r,
          patientNumber: patient?.patientNumber ?? 0,
          patientName: patient?.fullName ?? "\u2014",
          patientPhone: patient?.phone ?? "",
          doctorName: issuerUser2?.fullName ?? "\u2014",
          doctorUserId: issuer?.userId ?? "",
          specialty: issuer?.specialty ?? "",
          serviceName: service?.name ?? null,
          serviceKind: service?.kind ?? null,
          servicePrice: service?.price ?? null,
          targetDoctorName: targetUser2?.fullName ?? null,
          cancelledByName: canceller?.fullName ?? null,
          order,
          booking,
          stage: referralStage({ kind: r.kind, status: r.status, order, booking })
        };
      }
      async listReferrals(q) {
        let rows = this.db.referrals.filter(
          (r) => (!q.ids || q.ids.includes(r.id)) && (!q.patientId || r.patientId === q.patientId) && (!q.appointmentId || r.appointmentId === q.appointmentId) && (!q.awaitingBooking || r.status === "active" && r.kind !== "lab" && !this.liveBooking(r.id))
        );
        rows = rows.sort(
          (a, b) => q.awaitingBooking ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)
        );
        if (q.limit) rows = rows.slice(0, q.limit);
        return rows.map((r) => this.referralDetails(r));
      }
      async getReferral(id) {
        const r = this.db.referrals.find((x) => x.id === id);
        return r && this.referralDetails(r);
      }
      async createReferrals(input, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const make = (extra) => {
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
            ...extra
          };
        };
        let made;
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
              createdBy: actor.id
            },
            ref.id
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
      async cancelReferral(id, reason, actor) {
        const ref = this.db.referrals.find((r) => r.id === id);
        if (!ref) return void 0;
        if (ref.status === "cancelled") throw new StorageConflict("Yo'llanma allaqachon bekor qilingan");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (ref.kind === "lab") {
          const order = this.db.orders.find((o) => o.referralId === id);
          if (order && order.status !== "cancelled") {
            const paid = this.db.payments.some((p) => p.orderId === order.id && !p.voidedAt);
            const results = this.db.orderTests.some((i) => i.orderId === order.id && i.result);
            if (paid || results) {
              throw new StorageConflict(
                `Tahlil buyurtmasi #${order.orderNumber} bo'yicha to'lov yoki natija bor. Uni registratura yoki laboratoriya hal qiladi`
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
      async deleteDoctor(id) {
        const before = this.db.doctors.length;
        this.db.doctors = this.db.doctors.filter((d) => d.id !== id);
        if (this.db.doctors.length === before) return false;
        await this.persist();
        return true;
      }
      /** The patient's visit for `day`, created on first use. One per patient per day. */
      ensureVisit(patientId, day, createdBy) {
        const existing = this.db.visits.find((v) => v.patientId === patientId && v.visitDate === day);
        if (existing) return existing;
        const visit = { id: randomUUID(), patientId, visitDate: day, createdAt: (/* @__PURE__ */ new Date()).toISOString(), createdBy };
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
      backfillVerification() {
        for (const line of this.db.orderTests) {
          if (line.verifiedAt !== void 0) continue;
          Object.assign(line, {
            enteredById: null,
            returnedAt: null,
            returnedByName: null,
            returnReason: null,
            version: 1,
            verifiedBy: null,
            verifiedAt: line.result ? line.completedAt ?? (/* @__PURE__ */ new Date()).toISOString() : null,
            verifiedByName: line.result ? LEGACY_VERIFIER : null
          });
        }
      }
      backfillVisits() {
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
      async createUser(input, actor) {
        const user = {
          id: randomUUID(),
          username: input.username,
          password: await hashPassword(input.password),
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor?.id ?? null,
          updatedAt: null,
          updatedBy: null,
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
      async updateUser(id, input, actor) {
        const user = this.db.users.find((u) => u.id === id);
        if (!user) return void 0;
        const touched = Boolean(input.username || input.fullName || input.role || input.password) || input.isActive !== void 0;
        if (input.username) user.username = input.username;
        if (input.fullName) user.fullName = input.fullName;
        if (input.role) user.role = input.role;
        if (input.isActive !== void 0) user.isActive = input.isActive;
        if (input.password) user.password = await hashPassword(input.password);
        if (touched) {
          user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          user.updatedBy = actor?.id ?? null;
        }
        await this.persist();
        const { password: _password, ...pub } = user;
        return pub;
      }
      async deleteUser(id) {
        const before = this.db.users.length;
        this.db.users = this.db.users.filter((u) => u.id !== id);
        if (this.db.users.length === before) return false;
        this.db.userMfa = this.db.userMfa.filter((m) => m.userId !== id);
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
        let rows = this.db.patients.map(normalizePatient);
        if (search) {
          const wantedNumber = asNumberSearch(search);
          rows = rows.filter(
            (p) => p.patientNumber === wantedNumber || contains(p.fullName, search) || contains(p.phone, search) || phoneContains(p.phone, search) || contains(p.address, search) || (p.passport ?? "").toLowerCase().includes(search.replace(/\s/g, "")) || search.replace(/\D/g, "").length >= 6 && (p.pinfl ?? "").includes(search.replace(/\D/g, ""))
          );
        }
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.patientNumber - a.patientNumber);
        const total = rows.length;
        const offset = query.offset ?? 0;
        const limit = query.limit ?? total;
        const page = rows.slice(offset, offset + limit).map((p) => {
          const live = this.db.orders.filter((o) => o.patientId === p.id && o.status !== "cancelled");
          const attended = this.db.appointments.filter(
            (a) => a.patientId === p.id && a.arrivedAt && ATTENDED_STATUSES.includes(a.status)
          );
          const times = [...live.map((o) => o.createdAt), ...attended.map((a) => a.arrivedAt)];
          const last = times.reduce((m, t) => !m || t > m ? t : m, null);
          const days = /* @__PURE__ */ new Set([
            ...live.map((o) => o.visitId ?? localDay(o.createdAt)),
            ...attended.map((a) => a.visitId ?? `day:${a.date}`)
          ]);
          return { ...p, lastVisitAt: last, visitCount: days.size };
        });
        return { items: page, total };
      }
      async getPatient(id) {
        const p = this.db.patients.find((x) => x.id === id);
        return p && normalizePatient(p);
      }
      async getPatientDetails(id) {
        const p = await this.getPatient(id);
        if (!p) return void 0;
        const contacts = this.db.patientContacts.filter((c) => c.patientId === id).map((c) => ({ ...c }));
        return { ...p, contacts };
      }
      async getPatientCard(id) {
        const details = await this.getPatientDetails(id);
        if (!details) return void 0;
        const { items } = await this.listOrders({ patientId: id });
        const numbers = new Map(items.map((o) => [o.id, o.orderNumber]));
        const payments2 = this.db.payments.filter((p) => numbers.has(p.orderId)).map((p) => ({ ...p, orderNumber: numbers.get(p.orderId) }));
        const visits2 = this.db.visits.filter((v) => v.patientId === id);
        return buildPatientCard(details, items, visits2, payments2, await this.listAppointments({ patientId: id }));
      }
      async findPatientCandidates(q) {
        return this.db.patients.map(normalizePatient).filter((p) => p.id !== q.excludeId).filter(
          (p) => q.pinfl && p.pinfl === q.pinfl || q.passport && p.passport === q.passport || q.phoneDigits?.length === 9 && nationalPhoneDigits(p.phone) === q.phoneDigits || q.nameKey && nameKey(p.fullName).startsWith(q.nameKey)
        ).slice(0, 20);
      }
      /** Writes the emergency contact: replaced by a value, removed by null, kept by undefined. */
      setEmergencyContact(patientId, contact) {
        if (contact === void 0) return;
        this.db.patientContacts = this.db.patientContacts.filter((c) => !(c.patientId === patientId && c.isEmergency));
        if (contact) {
          const row = {
            id: randomUUID(),
            patientId,
            name: contact.name,
            relation: contact.relation ?? null,
            phone: contact.phone,
            isEmergency: true,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.db.patientContacts.push(row);
        }
      }
      async mergePatients(sourceId, targetId, actor) {
        const source = this.db.patients.find((p) => p.id === sourceId);
        const target = this.db.patients.find((p) => p.id === targetId);
        if (!source || !target || source.id === target.id) return void 0;
        const stamp2 = { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: actor?.id ?? null };
        let orders2 = 0;
        for (const o of this.db.orders) {
          if (o.patientId !== sourceId) continue;
          Object.assign(o, { patientId: targetId }, stamp2);
          orders2++;
        }
        Object.assign(target, stamp2);
        let contacts = 0;
        for (const c of this.db.patientContacts) {
          if (c.patientId !== sourceId) continue;
          if (c.isEmergency && this.db.patientContacts.some((x) => x.patientId === targetId && x.isEmergency)) continue;
          c.patientId = targetId;
          contacts++;
        }
        this.db.patientContacts = this.db.patientContacts.filter((c) => c.patientId !== sourceId);
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
        for (const k of ["birthDate", "passport", "pinfl", "address", "gender", "age"]) {
          if (target[k] == null && source[k] != null) target[k] = source[k];
        }
        if (!target.telegramChatId && source.telegramChatId) {
          target.telegramChatId = source.telegramChatId;
          target.telegramLinkedAt = source.telegramLinkedAt;
        }
        let appointments2 = 0;
        for (const a of this.db.appointments) if (a.patientId === sourceId) a.patientId = targetId, appointments2++;
        for (const r of this.db.medicalRecords) if (r.patientId === sourceId) r.patientId = targetId;
        for (const a of this.db.patientAllergies) if (a.patientId === sourceId) a.patientId = targetId;
        for (const r of this.db.referrals) if (r.patientId === sourceId) r.patientId = targetId;
        this.db.patients = this.db.patients.filter((p) => p.id !== sourceId);
        await this.persist();
        return { orders: orders2, contacts, appointments: appointments2 };
      }
      async getPatientByPhone(phone) {
        const digits = nationalPhoneDigits(phone);
        if (digits.length !== 9) return void 0;
        return [...this.db.patients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((p) => nationalPhoneDigits(p.phone) === digits);
      }
      async getPatientByChatId(chatId) {
        return this.db.patients.find((p) => p.telegramChatId === chatId);
      }
      async createPatient(input, actor) {
        this.db.counters.patientNumber += 1;
        const patient = {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor?.id ?? null,
          updatedAt: null,
          updatedBy: actor?.id ?? null,
          telegramChatId: null,
          telegramLinkedAt: null
        };
        this.db.patients.push(patient);
        this.setEmergencyContact(patient.id, input.emergencyContact);
        await this.persist();
        return { ...patient };
      }
      async updatePatient(id, input, actor) {
        const i = this.db.patients.findIndex((p) => p.id === id);
        if (i === -1) return void 0;
        const patient = normalizePatient(this.db.patients[i]);
        if (input.fullName !== void 0) patient.fullName = input.fullName;
        if (input.phone !== void 0) patient.phone = input.phone;
        if (input.address !== void 0) patient.address = input.address ?? null;
        if (input.age !== void 0) patient.age = input.age ?? null;
        if (input.gender !== void 0) patient.gender = input.gender ?? null;
        if (input.birthDate !== void 0) patient.birthDate = input.birthDate ?? null;
        if (input.passport !== void 0) patient.passport = input.passport ?? null;
        if (input.pinfl !== void 0) patient.pinfl = input.pinfl ?? null;
        patient.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        patient.updatedBy = actor?.id ?? null;
        this.db.patients[i] = patient;
        this.setEmergencyContact(id, input.emergencyContact);
        await this.persist();
        return { ...patient };
      }
      async deletePatient(id) {
        const mine = (rows) => rows.filter((r) => r.patientId === id).length;
        const problem = patientHistoryProblem({
          orders: mine(this.db.orders),
          appointments: mine(this.db.appointments),
          medical_records: mine(this.db.medicalRecords),
          patient_allergies: mine(this.db.patientAllergies),
          referrals: mine(this.db.referrals)
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
      async listTests(opts = {}) {
        const rows = opts.activeOnly ? this.db.tests.filter((t) => t.isActive) : [...this.db.tests];
        return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      }
      async getTest(id) {
        return this.db.tests.find((t) => t.id === id);
      }
      async createTest(input, actor) {
        const test = {
          id: randomUUID(),
          name: input.name,
          price: input.price,
          category: input.category,
          group: input.group,
          sampleType: input.sampleType,
          unit: input.unit ?? null,
          referenceRange: input.referenceRange ?? null,
          isActive: input.isActive ?? true,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: actor.id,
          updatedAt: null,
          updatedBy: null
        };
        this.db.tests.push(test);
        await this.persist();
        return test;
      }
      async updateTest(id, input, actor) {
        const test = this.db.tests.find((t) => t.id === id);
        if (!test) return void 0;
        const fields = ["name", "price", "category", "group", "sampleType", "unit", "referenceRange", "isActive"];
        if (fields.some((k) => input[k] !== void 0)) {
          test.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          test.updatedBy = actor.id;
        }
        if (input.name !== void 0) test.name = input.name;
        if (input.price !== void 0) test.price = input.price;
        if (input.category !== void 0) test.category = input.category;
        if (input.group !== void 0) test.group = input.group;
        if (input.sampleType !== void 0) test.sampleType = input.sampleType;
        if (input.unit !== void 0) test.unit = input.unit ?? null;
        if (input.referenceRange !== void 0) test.referenceRange = input.referenceRange ?? null;
        if (input.isActive !== void 0) test.isActive = input.isActive;
        await this.persist();
        return test;
      }
      async deleteTest(id) {
        if (this.db.orderTests.some((i) => i.testId === id)) throw new StorageConflict(TEST_IN_USE);
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
          referralNumber: order.referralId ? this.db.referrals.find((r) => r.id === order.referralId)?.referralNumber ?? null : null,
          patient: this.db.patients.find((p) => p.id === order.patientId) ?? null,
          items: this.db.orderTests.filter((ot) => ot.orderId === order.id),
          groups: orderGroups(
            this.db.orderTests.filter((ot) => ot.orderId === order.id).map((ot) => this.db.tests.find((t) => t.id === ot.testId)?.group)
          ),
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
        order.paidAmount = Math.max(0, ledgerTotal(this.db.payments.filter((p) => p.orderId === orderId)));
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
        const groups = {};
        for (const o of base) for (const g of o.groups ?? []) if (isTestGroup(g)) groups[g] = (groups[g] ?? 0) + 1;
        if (query.group) base = base.filter((o) => o.groups?.includes(query.group));
        const counts = { all: base.length, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
        for (const o of base) counts[o.status] += 1;
        const live = base.filter((o) => o.status !== "cancelled");
        const results = {
          waiting: live.filter(isWaiting).length,
          review: live.filter(isReview).length,
          ready: live.filter(isReady).length
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
          summary: { counts, results, totals: { sum, paid, debt: Math.max(0, sum - paid) }, groups }
        };
      }
      async getOrder(id) {
        const order = this.db.orders.find((o) => o.id === id);
        return order ? this.hydrate(order, true) : void 0;
      }
      async createOrder(input) {
        return this.placeOrder(input, null);
      }
      /** Shared by the desk and the doctor's lab referral, so both make the same order. */
      async placeOrder(input, referralId) {
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
          visitId: this.ensureVisit(input.patientId, todayKey(), input.createdBy ?? null).id,
          referralId,
          totalAmount: total,
          discount,
          paidAmount: 0,
          // set by syncPaid below, from the opening payment
          status: "pending",
          notes: input.notes ?? null,
          referrer: input.referrer ?? null,
          createdBy: input.createdBy ?? null,
          createdAt: now,
          updatedAt: null,
          updatedBy: null,
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
          quality: null,
          qualityNote: null,
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
            createdAt: now,
            ...UNVOIDED
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
            sampleType: t.sampleType,
            result: null,
            flag: null,
            notes: null,
            enteredBy: null,
            enteredById: null,
            completedAt: null,
            ...UNVERIFIED
          };
          this.db.orderTests.push(item);
        }
        await this.persist();
        return this.hydrate(order, true);
      }
      async updateOrder(id, input, actor) {
        const order = this.db.orders.find((o) => o.id === id);
        if (!order) return void 0;
        const touched = input.testIds !== void 0 || input.discount !== void 0 || input.notes !== void 0 || input.referrer !== void 0 || Boolean(input.status);
        if (touched) {
          order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          order.updatedBy = actor?.id ?? null;
        }
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
            sampleType: t.sampleType,
            result: null,
            flag: null,
            notes: null,
            enteredBy: null,
            enteredById: null,
            completedAt: null,
            ...UNVERIFIED
          });
          present.add(testId);
        }
      }
      async saveResults(id, results, actor) {
        const order = this.db.orders.find((o) => o.id === id);
        if (!order) return void 0;
        const patient = this.db.patients.find((p) => p.id === order.patientId);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const lines = this.db.orderTests.filter((i) => i.orderId === id);
        const changes = planResultSave(lines, results, patient?.gender);
        for (const c of changes) {
          const item = lines.find((i) => i.id === c.id);
          Object.assign(item, {
            result: c.result,
            flag: c.flag,
            notes: c.notes,
            completedAt: c.result ? now : null,
            returnedAt: null,
            returnedByName: null,
            returnReason: null
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
      async verifyResults(orderId, itemIds, actor) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order) return void 0;
        if (order.status === "cancelled") throw new StorageConflict("Buyurtma bekor qilingan");
        const target = pickForVerification(this.db.orderTests.filter((i) => i.orderId === orderId), itemIds);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const l of target) Object.assign(l, { verifiedAt: now, verifiedBy: actor.id, verifiedByName: actor.name });
        order.updatedAt = now;
        order.updatedBy = actor.id;
        await this.persist();
        return {
          order: this.hydrate(order, true),
          verified: target.length,
          selfChecked: target.filter((l) => l.enteredById && l.enteredById === actor.id).length
        };
      }
      async returnResults(orderId, itemIds, reason, actor) {
        const order = this.db.orders.find((o) => o.id === orderId);
        if (!order) return void 0;
        const target = pickForVerification(this.db.orderTests.filter((i) => i.orderId === orderId), itemIds);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const l of target) Object.assign(l, { returnedAt: now, returnedByName: actor.name, returnReason: reason });
        order.updatedAt = now;
        order.updatedBy = actor.id;
        await this.persist();
        return this.hydrate(order, true);
      }
      async amendResult(orderId, itemId, input, reason, actor) {
        const order = this.db.orders.find((o) => o.id === orderId);
        const line = this.db.orderTests.find((i) => i.id === itemId && i.orderId === orderId);
        if (!order || !line) return void 0;
        const problem = amendProblem(line, input);
        if (problem) throw new StorageConflict(problem);
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
          replaceReason: reason
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
          verifiedByName: actor.name
        });
        order.updatedAt = now;
        order.updatedBy = actor.id;
        await this.persist();
        return { order: this.hydrate(order, true), previous };
      }
      async listResultVersions(itemId) {
        return this.db.orderTestVersions.filter((v) => v.orderTestId === itemId).sort((a, b) => b.version - a.version).map((v) => ({ ...v }));
      }
      async deleteOrder(id) {
        if (!this.db.orders.some((o) => o.id === id)) return false;
        const problem = orderDeleteProblem(
          this.db.payments.filter((p) => p.orderId === id).length,
          this.db.orderTests.filter((i) => i.orderId === id && i.result).length
        );
        if (problem) throw new StorageConflict(problem);
        this.db.orders = this.db.orders.filter((o) => o.id !== id);
        this.db.orderTests = this.db.orderTests.filter((i) => i.orderId !== id);
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
        const paid = ledgerTotal(this.db.payments.filter((p) => p.orderId === orderId));
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          ...UNVOIDED
        });
        this.touchOrder(order, actor);
        this.syncPaid(orderId);
        await this.persist();
        return this.hydrate(order, true);
      }
      async voidPayment(paymentId, reason, actor) {
        const row = this.db.payments.find((p) => p.id === paymentId);
        if (!row) return void 0;
        if (row.voidedAt) throw new StorageConflict(PAYMENT_ALREADY_VOIDED);
        row.voidedAt = (/* @__PURE__ */ new Date()).toISOString();
        row.voidedBy = actor.id;
        row.voidedByName = actor.name;
        row.voidReason = reason;
        const order = this.db.orders.find((o) => o.id === row.orderId);
        if (order) this.touchOrder(order, actor);
        this.syncPaid(row.orderId);
        await this.persist();
        return order && this.hydrate(order, true);
      }
      touchOrder(order, actor) {
        order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        order.updatedBy = actor.id;
      }
      // ------------------------------------------------------------- expenses
      allExpenses() {
        return this.db.expenses.map((e) => normalizeExpense(e));
      }
      async listExpenses(query = {}) {
        const status = query.status ?? "active";
        const q = query.search?.trim().toLowerCase();
        let rows = this.allExpenses();
        if (query.from) rows = rows.filter((e) => e.spentOn >= query.from);
        if (query.to) rows = rows.filter((e) => e.spentOn <= query.to);
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
      async getExpense(id) {
        const row = this.db.expenses.find((e) => e.id === id);
        return row && normalizeExpense(row);
      }
      async createExpense(input, actor) {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        this.db.expenses.push(row);
        await this.persist();
        return { ...row };
      }
      async updateExpense(id, input, actor) {
        const i = this.db.expenses.findIndex((e) => e.id === id);
        if (i === -1) return void 0;
        const row = normalizeExpense(this.db.expenses[i]);
        if (input.category !== void 0) row.category = input.category;
        if (input.amount !== void 0) row.amount = input.amount;
        if (input.method !== void 0) row.method = input.method;
        if (input.payee !== void 0) row.payee = input.payee ?? null;
        if (input.note !== void 0) row.note = input.note ?? null;
        if (input.spentOn !== void 0) row.spentOn = input.spentOn;
        row.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        row.updatedBy = actor.id;
        this.db.expenses[i] = row;
        await this.persist();
        return { ...row };
      }
      async cancelExpense(id, reason, actor) {
        const i = this.db.expenses.findIndex((e) => e.id === id);
        if (i === -1) return void 0;
        const row = normalizeExpense(this.db.expenses[i]);
        row.status = "cancelled";
        row.cancelledAt = (/* @__PURE__ */ new Date()).toISOString();
        row.cancelledBy = actor.id;
        row.cancelledByName = actor.name;
        row.cancelReason = reason;
        this.db.expenses[i] = row;
        await this.persist();
        return { ...row };
      }
      async getExpenseSummary(from, to) {
        const inRange = this.allExpenses().filter((e) => e.spentOn >= from && e.spentOn <= to);
        const active = inRange.filter((e) => e.status === "active");
        const cancelled = inRange.filter((e) => e.status === "cancelled");
        const group = (key) => {
          const m = /* @__PURE__ */ new Map();
          for (const e of active) {
            const g = m.get(key(e)) ?? { amount: 0, count: 0 };
            g.amount += e.amount;
            g.count += 1;
            m.set(key(e), g);
          }
          return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount);
        };
        const perDay = /* @__PURE__ */ new Map();
        for (const e of active) perDay.set(e.spentOn, (perDay.get(e.spentOn) ?? 0) + e.amount);
        const total = active.reduce((s, e) => s + e.amount, 0);
        const prev = previousRange(from, to);
        const prevTotal = this.allExpenses().filter((e) => e.status === "active" && e.spentOn >= prev.from && e.spentOn <= prev.to).reduce((s, e) => s + e.amount, 0);
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
          cancelled: { count: cancelled.length, amount: cancelled.reduce((s, e) => s + e.amount, 0) }
        };
      }
      async listExpensePayees(limit = 30) {
        const counts = /* @__PURE__ */ new Map();
        for (const e of this.allExpenses()) if (e.payee) counts.set(e.payee, (counts.get(e.payee) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([p]) => p);
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
        if (query.entityId) rows = rows.filter((e) => e.entityId === query.entityId);
        if (query.action) rows = rows.filter((e) => e.action === query.action);
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
          readyTests: activeItems.filter((i) => lineState(i) === "verified").length,
          reviewTests: activeItems.filter((i) => lineState(i) === "review").length,
          todayRevenue: todayOrders.reduce((sum, o) => sum + o.paidAmount, 0),
          totalPatients: this.db.patients.length,
          unpaidAmount: this.db.orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + Math.max(0, o.totalAmount - o.paidAmount), 0)
        };
      }
      async getLabBoard(day) {
        const all = this.db.orders.map((o) => this.hydrate(o));
        const { counts, groupsToday } = summarizeLabBoard(all, day, localDay);
        const awaiting = all.filter(awaitsSample).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, LAB_BOARD_AWAITING_LIMIT);
        return { date: day, counts, groupsToday, awaiting };
      }
      async getReceptionDay(day) {
        const orders2 = this.db.orders.filter((o) => o.status !== "cancelled" && localDay(o.createdAt) === day);
        const fresh = this.db.patients.filter((p) => localDay(p.createdAt) === day).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const billed = orders2.reduce((s, o) => s + o.totalAmount, 0);
        const collected = orders2.reduce((s, o) => s + Math.min(o.paidAmount, o.totalAmount), 0);
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
              createdAt: p.createdAt
            }))
          },
          payments: {
            orders: orders2.length,
            paid: orders2.filter((o) => o.paidAmount >= o.totalAmount).length,
            partial: orders2.filter((o) => o.paidAmount > 0 && o.paidAmount < o.totalAmount).length,
            unpaid: orders2.filter((o) => o.paidAmount === 0 && o.totalAmount > 0).length,
            billed,
            collected,
            due: Math.max(0, billed - collected)
          }
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
        const spent = this.allExpenses().filter((e) => e.status === "active" && e.spentOn >= from && e.spentOn <= to);
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
      // ------------------------------------------------------------------ 2FA
      async mfaAvailable() {
        return true;
      }
      async getUserMfa(userId) {
        const row = this.db.userMfa.find((m) => m.userId === userId);
        return row ? { ...row, recoveryCodes: [...row.recoveryCodes] } : void 0;
      }
      async listMfaEnrollments() {
        return this.db.userMfa.map((m) => ({ userId: m.userId, enabledAt: m.enabledAt }));
      }
      async saveUserMfa(input, actor) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const row = {
          userId: input.userId,
          secret: input.secret,
          recoveryCodes: [...input.recoveryCodes],
          lastUsedStep: input.lastUsedStep,
          enabledAt: now,
          updatedAt: now,
          updatedBy: actor.id
        };
        this.db.userMfa = [...this.db.userMfa.filter((m) => m.userId !== input.userId), row];
        await this.persist();
        return { ...row, recoveryCodes: [...row.recoveryCodes] };
      }
      async replaceRecoveryCodes(userId, hashes, actor) {
        const row = this.db.userMfa.find((m) => m.userId === userId);
        if (!row) return false;
        row.recoveryCodes = [...hashes];
        row.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        row.updatedBy = actor.id;
        await this.persist();
        return true;
      }
      async consumeMfaStep(userId, step) {
        const row = this.db.userMfa.find((m) => m.userId === userId);
        if (!row || row.lastUsedStep >= step) return false;
        row.lastUsedStep = step;
        await this.persist();
        return true;
      }
      async consumeRecoveryCode(userId, hash) {
        const row = this.db.userMfa.find((m) => m.userId === userId);
        if (!row || !row.recoveryCodes.includes(hash)) return false;
        row.recoveryCodes = row.recoveryCodes.filter((h) => h !== hash);
        row.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await this.persist();
        return true;
      }
      async deleteUserMfa(userId) {
        const before = this.db.userMfa.length;
        this.db.userMfa = this.db.userMfa.filter((m) => m.userId !== userId);
        if (this.db.userMfa.length === before) return false;
        await this.persist();
        return true;
      }
      // ------------------------------------------------------------- security
      async getSecuritySettings() {
        return { ...DEFAULT_SECURITY_SETTINGS, ...this.db.security ?? {} };
      }
      async updateSecuritySettings(input, _actor) {
        this.db.security = { ...input };
        await this.persist();
        return { ...input };
      }
      // ------------------------------------------------------------- settings
      async getLogo() {
        return this.db.logo ?? null;
      }
      async setLogo(logo, _actor) {
        this.db.logo = logo;
        await this.persist();
      }
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
        createdBy: null,
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

// server/session-policy.ts
init_schema();
import { createHash } from "crypto";
var TOUCH_EVERY_MS = 3e4;
var POLICY_TTL_MS = 6e4;
var policy = null;
async function getSessionPolicy() {
  if (policy && Date.now() - policy.loadedAt < POLICY_TTL_MS) return policy.value;
  const value = await storage.getSecuritySettings().catch(() => ({ ...DEFAULT_SECURITY_SETTINGS }));
  policy = { value, loadedAt: Date.now() };
  return value;
}
function invalidateSessionPolicy() {
  policy = null;
}
var clientIp = (req) => req.ip ?? req.socket.remoteAddress ?? null;
var clientAgent = (req) => (req.get("user-agent") ?? "").slice(0, 300) || null;
function stampSession(req) {
  const now = Date.now();
  req.session.meta = { createdAt: now, lastSeen: now, ip: clientIp(req), userAgent: clientAgent(req) };
}
var END_MESSAGES = {
  SESSION_IDLE: "Uzoq vaqt faollik bo'lmagani uchun seans yopildi. Qaytadan kiring.",
  SESSION_MAX: "Seans muddati tugadi. Xavfsizlik uchun qaytadan kiring.",
  SESSION_REVOKED: "Seans boshqa qurilmadan yopildi."
};
function endSession(req, res, code) {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(401).json({ message: END_MESSAGES[code], code });
    });
  });
}
function enforceSessionPolicy() {
  return async (req, res, next) => {
    if (!req.isAuthenticated?.() || !req.session) return next();
    try {
      const { sessionIdleMinutes, sessionMaxHours } = await getSessionPolicy();
      const now = Date.now();
      const meta = req.session.meta;
      if (!meta) {
        const cookie = req.session.cookie;
        const legacy = legacyLastSeen({
          cookie: { expires: cookie.expires ? cookie.expires.toISOString() : null, originalMaxAge: cookie.originalMaxAge }
        });
        if (legacy !== null && now - legacy > sessionIdleMinutes * 6e4) {
          return endSession(req, res, "SESSION_IDLE");
        }
        stampSession(req);
        return next();
      }
      if (now - meta.lastSeen > sessionIdleMinutes * 6e4) return endSession(req, res, "SESSION_IDLE");
      if (now - meta.createdAt > sessionMaxHours * 36e5) return endSession(req, res, "SESSION_MAX");
      if (now - meta.lastSeen > TOUCH_EVERY_MS) {
        meta.lastSeen = now;
        meta.ip = clientIp(req);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
function legacyLastSeen(sess) {
  const expires = sess.cookie?.expires ? Date.parse(sess.cookie.expires) : NaN;
  const maxAge = sess.cookie?.originalMaxAge;
  return Number.isFinite(expires) && typeof maxAge === "number" ? expires - maxAge : null;
}
var publicSessionId = (sid) => createHash("sha256").update(sid).digest("hex").slice(0, 16);
async function rawSessionsOf(store, pool3, userId) {
  if (pool3) {
    const { rows } = await pool3.query(
      `SELECT sid, sess FROM "session" WHERE sess->'passport'->>'user' = $1 AND expire > now()`,
      [userId]
    );
    return rows;
  }
  const all = await new Promise((resolve, reject) => {
    if (!store.all) return resolve({});
    store.all((err, obj) => err ? reject(err) : resolve(obj ?? {}));
  });
  return Object.entries(all).filter(([, sess]) => sess?.passport?.user === userId).map(([sid, sess]) => ({ sid, sess }));
}
var destroy = (store, sid) => new Promise((resolve) => store.destroy(sid, () => resolve()));
async function listUserSessions(store, pool3, userId, currentSid) {
  const { sessionIdleMinutes, sessionMaxHours } = await getSessionPolicy();
  const now = Date.now();
  const live = [];
  for (const { sid, sess } of await rawSessionsOf(store, pool3, userId)) {
    const m = sess.meta;
    const legacy = m ? null : legacyLastSeen(sess);
    const stale = m ? now - m.lastSeen > sessionIdleMinutes * 6e4 || now - m.createdAt > sessionMaxHours * 36e5 : legacy !== null && now - legacy > sessionIdleMinutes * 6e4;
    if (stale && sid !== currentSid) {
      await destroy(store, sid);
      continue;
    }
    live.push({
      id: publicSessionId(sid),
      current: sid === currentSid,
      ip: m?.ip ?? null,
      userAgent: m?.userAgent ?? null,
      createdAt: m ? new Date(m.createdAt).toISOString() : null,
      lastSeen: m ? new Date(m.lastSeen).toISOString() : legacy ? new Date(legacy).toISOString() : null
    });
  }
  return live.sort((a, b) => Number(b.current) - Number(a.current) || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
}
async function revokeUserSessions(store, pool3, userId, opts = {}) {
  let n = 0;
  for (const { sid } of await rawSessionsOf(store, pool3, userId)) {
    if (opts.keepSid && sid === opts.keepSid) continue;
    if (opts.onlyId && publicSessionId(sid) !== opts.onlyId) continue;
    await destroy(store, sid);
    n++;
  }
  return n;
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
var sessionStore = createSessionStore();
var sessionPool = pool2;
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
      store: sessionStore,
      // The real limits — idle and absolute — are the session policy, checked
      // on every request by enforceSessionPolicy(). The cookie only has to
      // outlive the longest allowed session (7 days), so it is set just past
      // that and `rolling` keeps it there.
      rolling: true,
      cookie: {
        httpOnly: true,
        maxAge: 8 * 24 * 60 * 60 * 1e3,
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
  app.use("/api", enforceSessionPolicy());
  app.use("/api", requireMfaEnrollment);
}
var ENROLMENT_PATHS = [/^\/user$/, /^\/logout$/, /^\/session\//, /^\/user\/mfa(\/|$)/];
function requireMfaEnrollment(req, res, next) {
  if (!req.isAuthenticated?.() || !req.session?.mfaSetupRequired) return next();
  if (ENROLMENT_PATHS.some((re) => re.test(req.path))) return next();
  res.status(403).json({
    message: "Davom etish uchun ikki bosqichli autentifikatsiyani sozlang",
    code: "MFA_SETUP_REQUIRED"
  });
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
init_patient_identity();
init_password();
import QRCode from "qrcode";

// server/mfa.ts
import { createCipheriv, createDecipheriv, createHash as createHash2, createHmac, randomBytes as randomBytes2, randomInt, timingSafeEqual as timingSafeEqual2 } from "crypto";
var TOTP_DIGITS = 6;
var TOTP_PERIOD_S = 30;
var TOTP_WINDOW = 1;
var RECOVERY_CODE_COUNT = 10;
var MFA_ISSUER = "NEOGEN CLINIC";
var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[value << 5 - bits & 31];
  return out;
}
function base32Decode(input) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Base32 kalit noto'g'ri");
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function generateTotpSecret() {
  return base32Encode(randomBytes2(20));
}
function hotp(key, counter, digits = TOTP_DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  const bin = (mac[offset] & 127) << 24 | mac[offset + 1] << 16 | mac[offset + 2] << 8 | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}
var totpStep = (timeMs) => Math.floor(timeMs / 1e3 / TOTP_PERIOD_S);
var sameString = (a, b) => a.length === b.length && timingSafeEqual2(Buffer.from(a), Buffer.from(b));
function verifyTotp(secret, code, opts = {}) {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const key = base32Decode(secret);
  const current = totpStep(opts.now ?? Date.now());
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = current + delta;
    if (step <= (opts.lastUsedStep ?? 0)) continue;
    if (sameString(hotp(key, step), digits)) return step;
  }
  return null;
}
function otpauthUrl(account, secret, issuer = MFA_ISSUER) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_S)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
function encryptionKey() {
  const material = process.env.MFA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "medlab-dev-secret-change-in-production";
  return createHash2("sha256").update(`neogen-mfa:${material}`).digest();
}
function encryptSecret(plain) {
  const iv = randomBytes2(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}
function decryptSecret(stored) {
  const [version, iv, tag, ct] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !ct) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
var RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function normalizeRecoveryCode(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function hashRecoveryCode(code) {
  return createHash2("sha256").update(`neogen-recovery:${normalizeRecoveryCode(code)}`).digest("hex");
}
function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = [];
  while (codes.length < count) {
    let raw = "";
    for (let i = 0; i < 8; i++) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
function looksLikeTotp(code) {
  return /^\d{6}$/.test(code.replace(/\s/g, ""));
}
function checkMfaCode(record, code, now = Date.now()) {
  if (looksLikeTotp(code)) {
    const secret = decryptSecret(record.secret);
    if (!secret) return { ok: false, reason: "unreadable" };
    const step = verifyTotp(secret, code, { now, lastUsedStep: record.lastUsedStep });
    return step === null ? { ok: false, reason: "invalid" } : { ok: true, kind: "totp", step };
  }
  if (normalizeRecoveryCode(code).length !== 8) return { ok: false, reason: "invalid" };
  const hash = hashRecoveryCode(code);
  return record.recoveryCodes.some((h) => sameString(h, hash)) ? { ok: true, kind: "recovery", hash } : { ok: false, reason: "invalid" };
}

// server/routes.ts
init_storage_types();

// server/telegram.ts
init_schema();
init_lab_verification();
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
  return isOrderReleased(order);
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
  if (!isOrderReady(order)) return { sent: false, reason: "Natijalar hali to'liq tasdiqlanmagan" };
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

// server/route-helpers.ts
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
var emptyIfMissing = (err, empty) => {
  if (err?.code === "42P01") return empty;
  throw err;
};
var VIEW_LOG_EVERY_MS = 10 * 6e4;
var lastViewLogged = /* @__PURE__ */ new Map();
async function logPatientView(req, patient, what) {
  const key = `${req.user.id}:${patient.id}:${what}`;
  const now = Date.now();
  if (now - (lastViewLogged.get(key) ?? 0) < VIEW_LOG_EVERY_MS) return;
  lastViewLogged.set(key, now);
  if (lastViewLogged.size > 2e4) lastViewLogged.clear();
  await audit(req, "view", "patient", patient.id, `\u2116${patient.patientNumber} ${patient.fullName} ${what}`);
}

// server/routes-clinic.ts
init_schema();

// shared/reception.ts
var RECEPTION_LIST_LIMIT = 8;
function summarizeQueue(list, opts) {
  const limit = opts.limit ?? RECEPTION_LIST_LIMIT;
  const counts = {
    total: 0,
    scheduled: 0,
    late: 0,
    arrived: 0,
    inProgress: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0
  };
  for (const a of list) {
    if (a.status !== "cancelled") counts.total++;
    switch (a.status) {
      case "scheduled":
        counts.scheduled++;
        if (opts.isToday && a.startTime < opts.now) counts.late++;
        break;
      case "arrived":
        counts.arrived++;
        break;
      case "in_progress":
        counts.inProgress++;
        break;
      case "completed":
        counts.completed++;
        break;
      case "no_show":
        counts.noShow++;
        break;
      case "cancelled":
        counts.cancelled++;
        break;
    }
  }
  const waiting = list.filter((a) => a.status === "in_progress" || a.status === "arrived").sort((a, b) => {
    if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
    return (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? "") || a.queueNumber - b.queueNumber;
  }).slice(0, limit);
  const upcoming = list.filter((a) => a.status === "scheduled").sort((a, b) => a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber).slice(0, limit);
  return { counts, waiting, upcoming };
}

// server/routes-clinic.ts
init_referral();
init_appointment();
var money2 = (n) => `${n.toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
var patientLabel = (a) => `\u2116${a.patientNumber} ${a.patientName}`;
var when = (a) => `${a.date} ${a.startTime}`;
async function bookableDoctor(id) {
  const doctor = await storage.getDoctor(id);
  if (!doctor) return { error: "Shifokor topilmadi" };
  if (!doctor.isActive || !doctor.userActive) return { error: `${doctor.fullName} hozir qabul qilmaydi` };
  return { doctor };
}
async function pickedService(id) {
  if (!id) return { service: null };
  const service = await storage.getService(id);
  if (!service) return { error: "Xizmat topilmadi" };
  if (!service.isActive) return { error: `"${service.name}" xizmati hozir ko'rsatilmaydi` };
  return { service };
}
var toBookings = (list) => list.map((a) => ({
  id: a.id,
  startTime: a.startTime,
  durationMinutes: a.durationMinutes,
  status: a.status,
  queueNumber: a.queueNumber
}));
function bookingCheck(opts) {
  return (day) => {
    const twice = day.find(
      (a) => a.id !== opts.ignoreId && a.patientId === opts.patientId && holdsSlot(a.status) && a.status !== "completed"
    );
    if (twice) {
      return `Bemor bu kuni shu shifokorga allaqachon yozilgan (${twice.startTime}, navbat \u2116${twice.queueNumber})`;
    }
    return bookingProblem({
      date: opts.date,
      startTime: opts.startTime,
      slotMinutes: opts.doctor.slotMinutes,
      starts: slotStarts(opts.doctor.schedule, opts.doctor.slotMinutes, opts.date),
      bookings: toBookings(day),
      now: clockNow(),
      ignoreId: opts.ignoreId
    });
  };
}
var isOwnDoctor = (req, a) => hasPermission(req, "appointments.serve") && a.doctorUserId === req.user.id;
function registerClinicRoutes(app) {
  app.get(
    "/api/services",
    requireAuth,
    handle(async (req, res) => {
      res.json(await storage.listServices({ activeOnly: req.query.active === "1" }).catch((e) => emptyIfMissing(e, [])));
    })
  );
  app.get(
    "/api/price-list",
    requireAuth,
    handle(async (req, res) => {
      const activeOnly = req.query.active === "1";
      const [svc, tests2] = await Promise.all([
        storage.listServices({ activeOnly }).catch((e) => emptyIfMissing(e, [])),
        storage.listTests({ activeOnly })
      ]);
      const items = [
        ...svc.map((s) => ({
          source: "service",
          id: s.id,
          name: s.name,
          kind: s.kind,
          group: s.departmentName,
          price: s.price,
          isActive: s.isActive
        })),
        ...tests2.map((t) => ({
          source: "test",
          id: t.id,
          name: t.name,
          kind: "laboratoriya",
          group: t.category,
          price: t.price,
          isActive: t.isActive
        }))
      ];
      res.json(items);
    })
  );
  async function serviceNameTaken(name, exceptId) {
    const key = name.trim().toLowerCase();
    return (await storage.listServices()).some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === key);
  }
  async function departmentProblem(id) {
    if (!id) return null;
    const dept = await storage.getDepartment(id);
    if (!dept) return "Bo'lim topilmadi";
    if (!dept.isActive) return `"${dept.name}" bo'limi yopilgan`;
    return null;
  }
  app.post(
    "/api/services",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const input = insertServiceSchema.parse(req.body);
      if (await serviceNameTaken(input.name)) return res.status(409).json({ message: "Bunday nomli xizmat allaqachon bor" });
      const deptError = await departmentProblem(input.departmentId);
      if (deptError) return res.status(400).json({ message: deptError });
      const service = await storage.createService(input, actorOf(req));
      await audit(
        req,
        "create",
        "service",
        service.id,
        `"${service.name}" xizmati qo'shildi (${SERVICE_KIND_LABELS[service.kind]}, ${money2(service.price)})`
      );
      res.status(201).json(service);
    })
  );
  app.patch(
    "/api/services/:id",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const input = updateServiceSchema.parse(req.body);
      const before = await storage.getService(req.params.id);
      if (!before) return res.status(404).json({ message: "Xizmat topilmadi" });
      if (input.name && await serviceNameTaken(input.name, before.id)) {
        return res.status(409).json({ message: "Bunday nomli xizmat allaqachon bor" });
      }
      if (input.departmentId && input.departmentId !== before.departmentId) {
        const deptError = await departmentProblem(input.departmentId);
        if (deptError) return res.status(400).json({ message: deptError });
      }
      const service = await storage.updateService(before.id, input, actorOf(req));
      if (!service) return res.status(404).json({ message: "Xizmat topilmadi" });
      const changes = [];
      if (input.name && input.name !== before.name) changes.push(`nomi: ${before.name} \u2192 ${service.name}`);
      if (input.kind && input.kind !== before.kind) changes.push(`turi: ${SERVICE_KIND_LABELS[service.kind]}`);
      if (input.price !== void 0 && input.price !== before.price) {
        changes.push(`narx: ${money2(before.price)} \u2192 ${money2(service.price)}`);
      }
      if (input.departmentId !== void 0 && (input.departmentId ?? null) !== before.departmentId) {
        changes.push(`bo'lim: ${service.departmentName ?? "\u2014"}`);
      }
      if (input.isActive !== void 0 && input.isActive !== before.isActive) {
        changes.push(service.isActive ? "qayta yoqildi" : "to'xtatildi");
      }
      await audit(req, "update", "service", service.id, `"${service.name}" xizmati \u2014 ${changes.join(", ") || "tavsif yangilandi"}`);
      res.json(service);
    })
  );
  app.delete(
    "/api/services/:id",
    requirePermission("services.manage"),
    handle(async (req, res) => {
      const service = (await storage.listServices()).find((s) => s.id === req.params.id);
      if (!service) return res.status(404).json({ message: "Xizmat topilmadi" });
      if (service.appointmentCount > 0) {
        return res.status(409).json({
          message: `Bu xizmat ${service.appointmentCount} ta qabulda ishlatilgan. O'chirish o'rniga to'xtating (nofaol qiling)`
        });
      }
      await storage.deleteService(service.id);
      await audit(req, "delete", "service", service.id, `"${service.name}" xizmati o'chirildi`);
      res.sendStatus(204);
    })
  );
  app.get(
    "/api/appointments",
    requireAuth,
    handle(async (req, res) => {
      const patientId = stringParam(req.query.patientId);
      const canAll = hasPermission(req, "appointments.read");
      if (!canAll && !(patientId && hasPermission(req, "patients.read"))) {
        return res.status(403).json({ message: "Bu amal uchun ruxsatingiz yo'q" });
      }
      const date = stringParam(req.query.date);
      if (date && !isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      if (!date && !patientId) return res.status(400).json({ message: "Sana yoki bemor ko'rsatilishi kerak" });
      const list = await storage.listAppointments({ date, patientId, doctorId: stringParam(req.query.doctorId) }).catch((e) => emptyIfMissing(e, []));
      res.json(list);
    })
  );
  app.get(
    "/api/doctors/:id/slots",
    requirePermission("appointments.manage", "appointments.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date);
      if (!date || !isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      const doctor = await storage.getDoctor(req.params.id);
      if (!doctor) return res.status(404).json({ message: "Shifokor topilmadi" });
      const starts = doctor.isActive && doctor.userActive ? slotStarts(doctor.schedule, doctor.slotMinutes, date) : [];
      const day = await storage.listAppointments({ doctorId: doctor.id, date }).catch((e) => emptyIfMissing(e, []));
      const bookings = day.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        durationMinutes: a.durationMinutes,
        status: a.status,
        patientName: a.patientName,
        queueNumber: a.queueNumber
      }));
      const result = {
        doctorId: doctor.id,
        date,
        works: starts.length > 0,
        slotMinutes: doctor.slotMinutes,
        slots: buildSlots(starts, doctor.slotMinutes, bookings, date, clockNow())
      };
      res.json(result);
    })
  );
  app.post(
    "/api/appointments",
    requirePermission("appointments.manage"),
    handle(async (req, res) => {
      const input = createAppointmentSchema.parse(req.body);
      const patient = await storage.getPatient(input.patientId);
      if (!patient) return res.status(400).json({ message: "Bemor topilmadi" });
      const found = await bookableDoctor(input.doctorId);
      if ("error" in found) return res.status(400).json({ message: found.error });
      const picked = await pickedService(input.serviceId);
      if ("error" in picked) return res.status(400).json({ message: picked.error });
      const { doctor } = found;
      let referralNumber = null;
      if (input.referralId) {
        if (!hasPermission(req, "referrals.read")) return res.status(403).json({ message: "Yo'llanmalarni ko'rish uchun ruxsatingiz yo'q" });
        const referral = await storage.getReferral(input.referralId);
        if (!referral) return res.status(404).json({ message: "Yo'llanma topilmadi" });
        const problem = referralBookingProblem(referral, {
          patientId: patient.id,
          doctorId: doctor.id,
          doctorSpecialty: doctor.specialty,
          serviceId: input.serviceId
        });
        if (problem) return res.status(400).json({ message: problem });
        referralNumber = referral.referralNumber;
      }
      const appointment = await storage.createAppointment(
        {
          ...input,
          durationMinutes: doctor.slotMinutes,
          // A chosen service sets the price; otherwise the doctor's consultation fee.
          price: picked.service?.price ?? doctor.consultationPrice
        },
        actorOf(req),
        bookingCheck({ doctor, date: input.date, startTime: input.startTime, patientId: patient.id })
      );
      await audit(
        req,
        "create",
        "appointment",
        appointment.id,
        `${patientLabel(appointment)} \u2014 ${appointment.doctorName} qabuliga yozildi (${when(appointment)}, navbat \u2116${appointment.queueNumber})${referralNumber ? `, yo'llanma \u2116${referralNumber} bo'yicha` : ""}`
      );
      res.status(201).json(appointment);
    })
  );
  app.patch(
    "/api/appointments/:id",
    requirePermission("appointments.manage"),
    handle(async (req, res) => {
      const input = rescheduleAppointmentSchema.parse(req.body);
      const before = await storage.getAppointment(req.params.id);
      if (!before) return res.status(404).json({ message: "Qabul topilmadi" });
      if (before.status !== "scheduled") {
        return res.status(409).json({ message: `Faqat "yozildi" holatidagi qabulni ko'chirish mumkin` });
      }
      const doctorId = input.doctorId ?? before.doctorId;
      const found = await bookableDoctor(doctorId);
      if ("error" in found) return res.status(400).json({ message: found.error });
      const { doctor } = found;
      const serviceId = input.serviceId !== void 0 ? input.serviceId : before.serviceId;
      const picked = await pickedService(serviceId);
      if ("error" in picked && serviceId !== before.serviceId) return res.status(400).json({ message: picked.error });
      const service = "service" in picked ? picked.service : null;
      if (before.referralId) {
        const referral = await storage.getReferral(before.referralId);
        const problem = referral && referralBookingProblem(
          { ...referral, status: "active" },
          { patientId: before.patientId, doctorId: doctor.id, doctorSpecialty: doctor.specialty, serviceId }
        );
        if (problem) return res.status(400).json({ message: problem });
      }
      const date = input.date ?? before.date;
      const startTime = input.startTime ?? before.startTime;
      const repriced = doctorId !== before.doctorId || serviceId !== before.serviceId;
      const appointment = await storage.rescheduleAppointment(
        before.id,
        {
          doctorId,
          date,
          startTime,
          durationMinutes: doctor.slotMinutes,
          serviceId,
          price: repriced ? service?.price ?? doctor.consultationPrice : before.price,
          reason: input.reason !== void 0 ? input.reason : before.reason
        },
        actorOf(req),
        bookingCheck({ doctor, date, startTime, patientId: before.patientId, ignoreId: before.id })
      );
      const changes = [];
      if (when(before) !== when(appointment)) changes.push(`${when(before)} \u2192 ${when(appointment)}`);
      if (before.doctorId !== appointment.doctorId) changes.push(`shifokor: ${before.doctorName} \u2192 ${appointment.doctorName}`);
      if (before.queueNumber !== appointment.queueNumber || before.date !== appointment.date) {
        changes.push(`navbat \u2116${appointment.queueNumber}`);
      }
      if (before.price !== appointment.price) changes.push(`narx: ${money2(before.price)} \u2192 ${money2(appointment.price)}`);
      await audit(req, "update", "appointment", appointment.id, `${patientLabel(appointment)} \u2014 qabul ko'chirildi: ${changes.join(", ") || "izoh yangilandi"}`);
      res.json(appointment);
    })
  );
  async function changeStatus(req, res, appointment, to, reason) {
    const desk = hasPermission(req, "appointments.manage");
    const ownDoctor = isOwnDoctor(req, appointment);
    const verdict = checkTransition(appointment.status, to, { desk, ownDoctor });
    if (!verdict.ok) return res.status(verdict.status).json({ message: verdict.message });
    if (needsReason(to) && (!reason || reason.length < 3)) {
      return res.status(400).json({ message: "Bekor qilish sababini yozing" });
    }
    const today = clockNow().date;
    if (to === "arrived" && appointment.status !== "in_progress" || to === "in_progress") {
      if (appointment.date !== today) {
        return res.status(400).json({
          message: to === "arrived" ? 'Bemorni faqat qabul kuni "keldi" deb belgilash mumkin' : "Qabulni faqat belgilangan kuni boshlash mumkin"
        });
      }
    }
    if (to === "in_progress") {
      const current = (await storage.listAppointments({ doctorId: appointment.doctorId, date: today, statuses: ["in_progress"] })).find(
        (a) => a.id !== appointment.id
      );
      if (current) {
        return res.status(409).json({ message: `Avval joriy qabulni yakunlang: ${patientLabel(current)} (navbat \u2116${current.queueNumber})` });
      }
    }
    const updated = await storage.setAppointmentStatus(appointment.id, { from: appointment.status, to, reason }, actorOf(req));
    const label = APPOINTMENT_STATUS_LABELS[to].toLowerCase();
    await audit(
      req,
      "update",
      "appointment",
      updated.id,
      `${patientLabel(updated)} \u2014 ${updated.doctorName} qabuli (${when(updated)}): ${APPOINTMENT_STATUS_LABELS[appointment.status].toLowerCase()} \u2192 ${label}${to === "cancelled" && reason ? ` (sabab: ${reason})` : ""}`
    );
    return res.json(updated);
  }
  app.post(
    "/api/appointments/:id/status",
    requirePermission("appointments.manage", "appointments.serve"),
    handle(async (req, res) => {
      const { status, reason } = appointmentStatusSchema.parse(req.body);
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.status(404).json({ message: "Qabul topilmadi" });
      if (!hasPermission(req, "appointments.manage") && appointment.doctorUserId !== req.user.id) {
        return res.status(404).json({ message: "Qabul topilmadi" });
      }
      return changeStatus(req, res, appointment, status, reason);
    })
  );
  app.get(
    "/api/lab-board",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date) ?? clockNow().date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      res.json(await storage.getLabBoard(date));
    })
  );
  app.get(
    "/api/reception",
    requirePermission("appointments.read", "orders.read"),
    handle(async (req, res) => {
      const clock = clockNow();
      const date = stringParam(req.query.date) ?? clock.date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      const seesQueue = hasPermission(req, "appointments.read");
      const [day, list, waitingReferrals] = await Promise.all([
        storage.getReceptionDay(date),
        seesQueue ? storage.listAppointments({ date }).catch((e) => emptyIfMissing(e, [])) : Promise.resolve(null),
        hasPermission(req, "referrals.read") ? storage.listReferrals({ awaitingBooking: true, limit: 200 }).catch((e) => emptyIfMissing(e, [])) : Promise.resolve(null)
      ]);
      const now = fromMinutes(clock.minutes);
      const seesMoney = hasPermission(req, "finance.view");
      const board = {
        date,
        now,
        patientsToday: day.patientsToday,
        newPatients: hasPermission(req, "patients.read") ? day.newPatients : null,
        payments: hasPermission(req, "orders.read") ? seesMoney ? day.payments : { ...day.payments, billed: null, collected: null, due: null } : null,
        queue: list ? summarizeQueue(list, { isToday: date === clock.date, now }) : null,
        referrals: waitingReferrals ? { total: waitingReferrals.length, items: waitingReferrals.slice(0, RECEPTION_LIST_LIMIT) } : null
      };
      res.json(board);
    })
  );
  app.get(
    "/api/cabinet",
    requirePermission("appointments.serve", "appointments.read"),
    handle(async (req, res) => {
      const date = stringParam(req.query.date) ?? clockNow().date;
      if (!isValidDay(date)) return res.status(400).json({ message: "Sana noto'g'ri" });
      const requested = stringParam(req.query.doctorId);
      let doctor;
      if (requested && hasPermission(req, "appointments.read")) {
        doctor = await storage.getDoctor(requested);
      } else {
        doctor = await storage.getDoctorByUser(req.user.id).catch((e) => emptyIfMissing(e, void 0));
      }
      if (!doctor) {
        return res.status(404).json({
          message: "Sizga shifokor profili biriktirilmagan. Administrator Klinika \u2192 Shifokorlar bo'limida profil ochadi",
          code: "NO_DOCTOR_PROFILE"
        });
      }
      const [appointments2, unfinished] = await Promise.all([
        storage.listAppointments({ doctorId: doctor.id, date }).catch((e) => emptyIfMissing(e, [])),
        storage.listAppointments({ doctorId: doctor.id, beforeDate: clockNow().date, statuses: ["in_progress"] }).catch((e) => emptyIfMissing(e, []))
      ]);
      const [dayRecords, draftRecords] = await Promise.all([
        storage.listRecords({ appointmentIds: appointments2.map((a) => a.id) }).catch((e) => emptyIfMissing(e, [])),
        storage.listRecords({ doctorId: doctor.id, status: "draft" }).catch((e) => emptyIfMissing(e, []))
      ]);
      const cabinet = {
        doctor,
        date,
        appointments: appointments2,
        unfinished,
        recordStatus: Object.fromEntries(dayRecords.map((r) => [r.appointmentId, r.status])),
        draftRecords
      };
      res.json(cabinet);
    })
  );
  app.post(
    "/api/cabinet/call-next",
    requirePermission("appointments.serve"),
    handle(async (req, res) => {
      const doctor = await storage.getDoctorByUser(req.user.id);
      if (!doctor) return res.status(404).json({ message: "Sizga shifokor profili biriktirilmagan" });
      const today = await storage.listAppointments({ doctorId: doctor.id, date: clockNow().date });
      const next = nextInLine(today);
      if (!next) return res.status(409).json({ message: "Navbatda kutayotgan bemor yo'q" });
      return changeStatus(req, res, next, "in_progress", null);
    })
  );
}

// server/routes.ts
init_lab_verification();
init_lab_catalogue();
init_branding();

// server/result-delivery.ts
init_lab_verification();
async function notifyOrderingDoctor(order, event) {
  try {
    if (!order.referralId || !isOrderReleased(order)) return false;
    const referral = await storage.getReferral(order.referralId);
    if (!referral?.doctorUserId) return false;
    const patient = `\u2116${referral.patientNumber} ${referral.patientName}`;
    const abnormal = order.items.filter((i) => i.flag === "low" || i.flag === "high");
    const link = referral.appointmentId ? `/cabinet/visit/${referral.appointmentId}` : `/patients/${referral.patientId}`;
    const notice = event.kind === "released" ? {
      kind: "lab_result",
      title: `Tahlil natijalari tayyor: ${patient}`,
      body: [
        `Yo'llanma \u2116${referral.referralNumber} \xB7 buyurtma #${order.orderNumber}`,
        order.items.map((i) => i.testName).join(", "),
        abnormal.length ? `${abnormal.length} tasi me'yordan tashqarida: ${abnormal.map((i) => i.testName).join(", ")}` : "Hammasi me'yorda"
      ].join("\n"),
      important: abnormal.length > 0,
      dedupeKey: `lab_result:${order.id}`
    } : {
      kind: "lab_result_amended",
      title: `Natija tuzatildi: ${patient}`,
      body: `Yo'llanma \u2116${referral.referralNumber} \xB7 ${event.testName}: ${event.from ?? "\u2014"} \u2192 ${event.to}`,
      important: true,
      dedupeKey: null
    };
    return await storage.createNotification({
      userId: referral.doctorUserId,
      link,
      entityId: order.id,
      ...notice
    });
  } catch (err) {
    log(`[notify] #${order.orderNumber}: shifokorga xabar yuborilmadi \u2014 ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

// server/routes-medical.ts
init_schema();
init_referral();
init_icd10();
init_lab_verification();

// shared/medical-record.ts
init_schema();
var ALL_FIELDS = [...RECORD_FIELDS, ...RECORD_CODE_FIELDS];
var norm = (v) => (v ?? "").trim();
function signProblem(fields) {
  if (!norm(fields.complaints)) return "Shikoyatlarni kiriting";
  if (!norm(fields.preliminaryDiagnosis) && !norm(fields.finalDiagnosis) && !fields.preliminaryDiagnosisCode && !fields.finalDiagnosisCode) {
    return "Dastlabki yoki yakuniy tashxisni kiriting";
  }
  return null;
}
function changedFields(before, after) {
  return ALL_FIELDS.filter((f) => norm(before[f]) !== norm(after[f]));
}
var labelOf = (f) => RECORD_FIELD_LABELS[f] ?? RECORD_CODE_LABELS[f];
var fieldList = (fields) => fields.map(labelOf).join(", ");
function diagnosisHistory(records) {
  const out = [];
  for (const r of records) {
    if (r.status !== "signed") continue;
    const base = { recordId: r.id, date: r.date, doctorName: r.doctorName, specialty: r.specialty };
    if (norm(r.finalDiagnosis) || r.finalDiagnosisCode) {
      out.push({ ...base, kind: "final", text: norm(r.finalDiagnosis), code: r.finalDiagnosisCode ?? null });
    } else if (norm(r.preliminaryDiagnosis) || r.preliminaryDiagnosisCode) {
      out.push({ ...base, kind: "preliminary", text: norm(r.preliminaryDiagnosis), code: r.preliminaryDiagnosisCode ?? null });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
function pickFields(source) {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f, source[f] ?? null]));
}

// server/routes-medical.ts
init_patient_identity();
init_storage_types();
var WRITABLE_APPOINTMENT = /* @__PURE__ */ new Set(["in_progress", "completed"]);
var patientLabel2 = (p) => `\u2116${p.patientNumber} ${p.fullName ?? p.patientName}`;
var isAuthor = (req, x) => x.doctorUserId === req.user.id;
var DRAFT_LOG_EVERY_MS = 10 * 6e4;
var lastDraftLogged = /* @__PURE__ */ new Map();
function shouldLogDraft(req, recordId) {
  const key = `${req.user.id}:${recordId}`;
  const now = Date.now();
  if (now - (lastDraftLogged.get(key) ?? 0) < DRAFT_LOG_EVERY_MS) return false;
  lastDraftLogged.set(key, now);
  if (lastDraftLogged.size > 2e4) lastDraftLogged.clear();
  return true;
}
var visibleTo = (req) => (r) => r.status === "signed" || isAuthor(req, r);
async function icdCodeProblem(fields, before) {
  const wanted = RECORD_CODE_FIELDS.map((f) => fields[f]).filter(
    (c, i) => Boolean(c) && c !== before[RECORD_CODE_FIELDS[i]]
  );
  if (wanted.length === 0) return null;
  const found = await storage.getIcd(wanted).catch((e) => emptyIfMissing(e, []));
  const ok = new Set(found.filter((r) => r.selectable).map((r) => r.code));
  const bad = wanted.filter((c) => !ok.has(c));
  return bad.length ? `MKB-10 katalogida tanlab bo'lmaydigan kod: ${bad.join(", ")}` : null;
}
function registerMedicalRoutes(app) {
  app.get(
    "/api/icd10",
    requireAuth,
    handle(async (req, res) => {
      const q = stringParam(req.query.q) ?? "";
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      res.json(await storage.searchIcd({ q, limit, all: req.query.all === "1" }).catch((e) => emptyIfMissing(e, [])));
    })
  );
  app.get(
    "/api/icd10/lookup",
    requireAuth,
    handle(async (req, res) => {
      const codes = (stringParam(req.query.codes) ?? "").split(",").map((c) => normalizeIcdCode(c)).filter(Boolean).slice(0, 50);
      res.json(await storage.getIcd(codes).catch((e) => emptyIfMissing(e, [])));
    })
  );
  app.get(
    "/api/icd10/stats",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.icdStats().catch((e) => emptyIfMissing(e, { total: 0, selectable: 0, withUzbek: 0, source: "" })));
    })
  );
  app.patch(
    "/api/icd10/:code",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const { nameUz } = updateIcdUzSchema.parse(req.body);
      const code = normalizeIcdCode(req.params.code);
      const before = (await storage.getIcd([code]))[0];
      if (!before) return res.status(404).json({ message: "Kod katalogda yo'q" });
      const row = await storage.setIcdUzName(code, nameUz, actorOf(req));
      await audit(req, "update", "icd10", code, `MKB-10 ${code} o'zbekcha nomi: ${before.nameUz ?? "\u2014"} \u2192 ${nameUz ?? "\u2014"}`);
      res.json(row);
    })
  );
  app.post(
    "/api/icd10/import-uz",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const { csv } = importIcdUzSchema.parse(req.body);
      const { names, rejected } = parseUzNames(csv);
      if (names.size === 0) return res.status(400).json({ message: "Faylda o'qiladigan qator topilmadi (kerakli format: kod;o'zbekcha nom)" });
      const { updated, unknown } = await storage.importIcdUzNames(names, actorOf(req));
      await audit(req, "update", "icd10", null, `MKB-10 o'zbekcha nomlari import qilindi: ${updated} ta kod`);
      res.json({ updated, unknown: unknown.slice(0, 50), unknownCount: unknown.length, rejectedLines: rejected.slice(0, 50), rejectedCount: rejected.length });
    })
  );
  app.get(
    "/api/appointments/:id/examination",
    requirePermission("records.read", "appointments.serve"),
    handle(async (req, res) => {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) return res.status(404).json({ message: "Qabul topilmadi" });
      const own = isAuthor(req, appointment);
      if (!own && !hasPermission(req, "records.read")) return res.status(404).json({ message: "Qabul topilmadi" });
      const seesReferrals = own || hasPermission(req, "referrals.read");
      const [record, referrals2] = await Promise.all([
        storage.getRecordByAppointment(appointment.id).catch((e) => emptyIfMissing(e, void 0)),
        seesReferrals ? storage.listReferrals({ appointmentId: appointment.id }).catch((e) => emptyIfMissing(e, [])) : Promise.resolve([])
      ]);
      await logPatientView(req, { id: appointment.patientId, patientNumber: appointment.patientNumber, fullName: appointment.patientName }, "ko'rik yozuvi ochildi");
      const data = {
        appointment,
        record: record && visibleTo(req)(record) ? record : null,
        canWrite: own && hasPermission(req, "records.write") && WRITABLE_APPOINTMENT.has(appointment.status),
        canAmend: own && hasPermission(req, "records.amend"),
        referrals: referrals2,
        canRefer: own && hasPermission(req, "referrals.create") && WRITABLE_APPOINTMENT.has(appointment.status)
      };
      res.json(data);
    })
  );
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
      const record = existed ?? await storage.openRecord(
        {
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          doctorId: appointment.doctorId,
          visitId: appointment.visitId
        },
        { id: req.user.id, name: req.user.fullName }
      );
      if (!existed) {
        await audit(req, "create", "record", record.id, `${patientLabel2(appointment)} \u2014 ko'rik yozuvi ochildi (${appointment.date} ${appointment.startTime})`);
      }
      res.status(existed ? 200 : 201).json(record);
    })
  );
  app.patch(
    "/api/records/:id",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const { revision, ...fields } = saveRecordSchema.parse(req.body);
      const before = await storage.getRecord(req.params.id);
      if (!before || !isAuthor(req, before)) return res.status(404).json({ message: "Yozuv topilmadi" });
      const codeError = await icdCodeProblem(fields, before);
      if (codeError) return res.status(400).json({ message: codeError });
      if (before.status !== "draft") {
        return res.status(409).json({ message: `Yozuv tasdiqlangan. O'zgartirish uchun "Tuzatish kiritish"dan foydalaning` });
      }
      const record = await storage.saveRecordDraft(before.id, revision, fields, { id: req.user.id, name: req.user.fullName });
      const changed = changedFields(before, { ...pickFields(before), ...fields });
      if (changed.length && shouldLogDraft(req, record.id)) {
        await audit(req, "update", "record", record.id, `${patientLabel2(record)} \u2014 ko'rik qoralamasi tahrirlandi (${fieldList(changed)})`);
      }
      res.json(record);
    })
  );
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
      const record = await storage.signRecord(before.id, revision, { id: req.user.id, name: req.user.fullName });
      await audit(
        req,
        "update",
        "record",
        record.id,
        `${patientLabel2(record)} \u2014 ko'rik yozuvi tasdiqlandi (${record.finalDiagnosis ? "yakuniy tashxis" : "dastlabki tashxis"}: ${record.finalDiagnosis ?? record.preliminaryDiagnosis})`
      );
      res.json(record);
    })
  );
  app.post(
    "/api/records/:id/amend",
    requirePermission("records.amend"),
    handle(async (req, res) => {
      const { revision, reason, ...fields } = amendRecordSchema.parse(req.body);
      const before = await storage.getRecord(req.params.id);
      if (!before || !isAuthor(req, before)) return res.status(404).json({ message: "Yozuv topilmadi" });
      const codeError = await icdCodeProblem(fields, before);
      if (codeError) return res.status(400).json({ message: codeError });
      if (before.status !== "signed") return res.status(409).json({ message: "Qoralamani tuzatish shart emas \u2014 uni to'g'ridan-to'g'ri tahrirlang" });
      const changed = changedFields(before, fields);
      if (!changed.length) return res.status(400).json({ message: "Matnda o'zgarish yo'q" });
      const problem = signProblem(fields);
      if (problem) return res.status(400).json({ message: problem });
      const record = await storage.amendRecord(before.id, revision, fields, reason, { id: req.user.id, name: req.user.fullName });
      await audit(
        req,
        "update",
        "record",
        record.id,
        `${patientLabel2(record)} \u2014 tasdiqlangan ko'rik yozuviga tuzatish (v${before.version} \u2192 v${record.version}): ${fieldList(changed)}. Sabab: ${reason}`
      );
      res.json(record);
    })
  );
  app.get(
    "/api/records/:id/versions",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const record = await storage.getRecord(req.params.id);
      if (!record || !visibleTo(req)(record)) return res.status(404).json({ message: "Yozuv topilmadi" });
      res.json(await storage.listRecordVersions(record.id));
    })
  );
  app.get(
    "/api/records/:id/summary",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const record = await storage.getRecord(req.params.id);
      if (!record || !visibleTo(req)(record)) return res.status(404).json({ message: "Yozuv topilmadi" });
      if (record.status !== "signed") {
        return res.status(409).json({ message: "Xulosa faqat tasdiqlangan ko'rik yozuvidan chiqariladi" });
      }
      const codes = RECORD_CODE_FIELDS.map((f) => record[f]).filter((c) => Boolean(c));
      const [appointment, allergies, referrals2, clinic, icd, logo] = await Promise.all([
        storage.getAppointment(record.appointmentId),
        storage.listAllergies(record.patientId).catch((e) => emptyIfMissing(e, [])),
        storage.listReferrals({ appointmentId: record.appointmentId }).catch((e) => emptyIfMissing(e, [])),
        storage.getSettings(),
        storage.getIcd(codes).catch((e) => emptyIfMissing(e, [])),
        storage.getLogo()
      ]);
      const summary = {
        record,
        icd: icd.map((r) => ({ code: r.code, nameRu: r.nameRu, nameUz: r.nameUz })),
        appointment: appointment ?? null,
        allergies: allergies.filter((a) => a.isActive),
        // A cancelled referral is not part of what the patient was told to do.
        referrals: referrals2.filter((r) => r.status !== "cancelled"),
        clinic,
        logo: logo?.dataUrl ?? null,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        generatedBy: req.user.fullName
      };
      await audit(
        req,
        "export",
        "record",
        record.id,
        `${patientLabel2(record)} \u2014 ko'rik xulosasi chiqarildi (${record.date}, ${record.doctorName}, v${record.version})`
      );
      res.json(summary);
    })
  );
  app.get(
    "/api/patients/:id/medical",
    requirePermission("records.read"),
    handle(async (req, res) => {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      const seesLab = hasPermission(req, "orders.read");
      const seesReferrals = hasPermission(req, "referrals.read");
      const [allergies, records, orders2, referrals2] = await Promise.all([
        storage.listAllergies(patient.id, { includeInactive: true }).catch((e) => emptyIfMissing(e, [])),
        storage.listRecords({ patientId: patient.id }).catch((e) => emptyIfMissing(e, [])),
        seesLab ? storage.listOrders({ patientId: patient.id }) : Promise.resolve(null),
        seesReferrals ? storage.listReferrals({ patientId: patient.id }).catch((e) => emptyIfMissing(e, [])) : Promise.resolve(null)
      ]);
      await logPatientView(req, patient, "tibbiy kartasi ochildi");
      const visible = records.filter(visibleTo(req));
      const card = {
        patient: { ...pickPatient(patient), ageYears: patientAge(patient) },
        allergies,
        records: visible,
        diagnoses: diagnosisHistory(visible),
        labResults: orders2 ? labResults(orders2.items) : null,
        referrals: referrals2
      };
      res.json(card);
    })
  );
  app.post(
    "/api/appointments/:id/referrals",
    requirePermission("referrals.create"),
    handle(async (req, res) => {
      const input = createReferralSchema.parse(req.body);
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment || !isAuthor(req, appointment)) return res.status(404).json({ message: "Qabul topilmadi" });
      if (!WRITABLE_APPOINTMENT.has(appointment.status)) {
        return res.status(400).json({ message: "Yo'llanmani faqat qabul boshlangandan keyin berish mumkin" });
      }
      const origin = {
        patientId: appointment.patientId,
        visitId: appointment.visitId,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        note: input.note
      };
      let batch;
      if (input.kind === "lab") {
        const catalogue = new Map((await storage.listTests()).map((t) => [t.id, t]));
        const missing = input.testIds.filter((id) => !catalogue.get(id)?.isActive);
        if (missing.length) return res.status(400).json({ message: "Tanlangan tahlillardan biri katalogda yo'q yoki to'xtatilgan" });
        batch = { ...origin, kind: "lab", testIds: input.testIds, referrer: `${appointment.doctorName}, ${appointment.specialty}` };
      } else if (input.kind === "exam") {
        const services2 = new Map((await storage.listServices()).map((s) => [s.id, s]));
        for (const id of input.serviceIds) {
          const s = services2.get(id);
          if (!s || !s.isActive) return res.status(400).json({ message: "Tanlangan tekshiruvlardan biri katalogda yo'q yoki to'xtatilgan" });
          if (!isExamServiceKind(s.kind)) return res.status(400).json({ message: `"${s.name}" tekshiruv emas` });
        }
        batch = { ...origin, kind: "exam", serviceIds: input.serviceIds };
      } else {
        let specialty = input.targetSpecialty;
        if (input.targetDoctorId) {
          const target = await storage.getDoctor(input.targetDoctorId);
          if (!target || !target.isActive || !target.userActive) {
            return res.status(400).json({ message: "Tanlangan shifokor hozir qabul qilmaydi" });
          }
          specialty = target.specialty;
        }
        batch = { ...origin, kind: "consult", targetSpecialty: specialty, targetDoctorId: input.targetDoctorId };
      }
      const made = await storage.createReferrals(batch, { id: req.user.id, name: req.user.fullName });
      for (const r of made) {
        await audit(
          req,
          "create",
          "referral",
          r.id,
          `${patientLabel2(appointment)} \u2014 yo'llanma \u2116${r.referralNumber}: ${REFERRAL_KIND_LABELS[r.kind]} (${referralSubject(r)})${r.order ? `, tahlil buyurtmasi #${r.order.orderNumber}` : ""}`
        );
      }
      res.status(201).json(made);
    })
  );
  app.get(
    "/api/referrals",
    requirePermission("referrals.read"),
    handle(async (req, res) => {
      const patientId = stringParam(req.query.patientId);
      const awaiting = req.query.awaiting === "1";
      if (!patientId && !awaiting) return res.status(400).json({ message: "Bemor yoki holat ko'rsatilishi kerak" });
      const list = await storage.listReferrals({ patientId, awaitingBooking: awaiting, limit: awaiting ? 200 : void 0 }).catch((e) => emptyIfMissing(e, []));
      res.json(list);
    })
  );
  app.post(
    "/api/referrals/:id/cancel",
    requirePermission("referrals.create", "referrals.manage"),
    handle(async (req, res) => {
      const { reason } = cancelReferralSchema.parse(req.body);
      const before = await storage.getReferral(req.params.id);
      if (!before) return res.status(404).json({ message: "Yo'llanma topilmadi" });
      const issuer = before.doctorUserId === req.user.id && hasPermission(req, "referrals.create");
      if (!issuer && !hasPermission(req, "referrals.manage")) {
        return res.status(403).json({ message: "Faqat yo'llanmani bergan shifokor yoki registratura bekor qila oladi" });
      }
      if (before.stage === "done") return res.status(409).json({ message: "Yo'llanma bajarilgan, uni bekor qilib bo'lmaydi" });
      const referral = await storage.cancelReferral(before.id, reason, { id: req.user.id, name: req.user.fullName });
      if (!referral) return res.status(404).json({ message: "Yo'llanma topilmadi" });
      await audit(
        req,
        "update",
        "referral",
        referral.id,
        `${patientLabel2(referral)} \u2014 yo'llanma \u2116${referral.referralNumber} bekor qilindi (${referralSubject(referral)}). Sabab: ${reason}${referral.order ? `; tahlil buyurtmasi #${referral.order.orderNumber} ham bekor qilindi` : ""}`
      );
      res.json(referral);
    })
  );
  app.post(
    "/api/patients/:id/allergies",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const input = insertAllergySchema.parse(req.body);
      const patient = await storage.getPatient(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      const duplicate = (await storage.listAllergies(patient.id)).find(
        (a) => a.allergen.trim().toLowerCase() === input.allergen.trim().toLowerCase()
      );
      if (duplicate) return res.status(409).json({ message: `"${duplicate.allergen}" allaqachon ro'yxatda bor` });
      const allergy = await storage.addAllergy(patient.id, input, { id: req.user.id, name: req.user.fullName });
      await audit(
        req,
        "create",
        "patient",
        patient.id,
        `${patientLabel2(patient)} \u2014 allergiya qo'shildi: ${allergy.allergen}${allergy.reaction ? ` (${allergy.reaction})` : ""}`
      );
      res.status(201).json(allergy);
    })
  );
  app.post(
    "/api/allergies/:id/deactivate",
    requirePermission("records.write"),
    handle(async (req, res) => {
      const { reason } = removeAllergySchema.parse(req.body);
      const before = await storage.getAllergy(req.params.id);
      if (!before) return res.status(404).json({ message: "Yozuv topilmadi" });
      const allergy = await storage.deactivateAllergy(before.id, reason, { id: req.user.id, name: req.user.fullName });
      const patient = await storage.getPatient(before.patientId);
      await audit(
        req,
        "update",
        "patient",
        before.patientId,
        `${patient ? patientLabel2(patient) : "Bemor"} \u2014 allergiya faol emas deb belgilandi: ${before.allergen}. Sabab: ${reason}`
      );
      res.json(allergy);
    })
  );
}
function pickPatient(p) {
  return {
    id: p.id,
    patientNumber: p.patientNumber,
    fullName: p.fullName,
    phone: p.phone,
    gender: p.gender,
    birthDate: p.birthDate,
    age: p.age,
    address: p.address
  };
}
function labResults(orders2) {
  return orders2.filter((o) => o.status !== "cancelled").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).flatMap(
    (o) => releasedLines(o.items).map((i) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      date: localDay(o.createdAt),
      testName: i.testName,
      result: i.result,
      unit: i.unit,
      referenceRange: i.referenceRange,
      flag: i.flag
    }))
  );
}

// server/routes.ts
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
  const MFA_PENDING_TTL_MS = 5 * 6e4;
  const MFA_SETUP_TTL_MS = 10 * 6e4;
  const MFA_MAX_ATTEMPTS = 5;
  const MFA_NOT_MIGRATED = "Ikki bosqichli kirish uchun ma'lumotlar bazasi yangilanmagan. Administrator npm run db:mfa ni bajarishi kerak";
  const mfaRequiredFor = async (role) => (await getSessionPolicy()).mfaRequiredRoles.includes(role) && await storage.mfaAvailable();
  const mfaStatusOf = async (userId, role) => {
    const [record, available, policy2] = await Promise.all([
      storage.getUserMfa(userId),
      storage.mfaAvailable(),
      getSessionPolicy()
    ]);
    return {
      enabled: Boolean(record),
      enabledAt: record?.enabledAt ?? null,
      recoveryCodesLeft: record?.recoveryCodes.length ?? 0,
      required: policy2.mfaRequiredRoles.includes(role),
      available
    };
  };
  const verifyAndConsume = async (record, code) => {
    const check = checkMfaCode(record, code);
    if (!check.ok) return check.reason;
    const spent = check.kind === "totp" ? await storage.consumeMfaStep(record.userId, check.step) : await storage.consumeRecoveryCode(record.userId, check.hash);
    return spent ? check.kind : "invalid";
  };
  const codeAccepted = (r) => r === "totp" || r === "recovery";
  const completeLogin = (req, res, next, user, account, opts) => {
    req.logIn(user, async (loginErr) => {
      if (loginErr) return next(loginErr);
      try {
        stampSession(req);
        if (opts.mustEnrol) req.session.mfaSetupRequired = true;
        if (account && (account.failedAttempts > 0 || account.lockLevel > 0)) {
          await storage.setLockState(account.id, registerSuccess());
        }
        void audit(req, "login", "auth", user.id, `${user.fullName} tizimga kirdi${opts.how}`);
        const body = { ...user, mfaSetupRequired: opts.mustEnrol || void 0 };
        res.json(body);
      } catch (err) {
        next(err);
      }
    });
  };
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
          try {
            clearFailedLogins(request);
            if (await storage.getUserMfa(user.id)) {
              request.session.mfaPending = { userId: user.id, at: Date.now(), attempts: 0 };
              const challenge = { mfaRequired: true, fullName: user.fullName };
              return request.session.save((saveErr) => saveErr ? next(saveErr) : response.json(challenge));
            }
            completeLogin(request, response, next, user, account, {
              mustEnrol: await mfaRequiredFor(user.role),
              how: ""
            });
          } catch (e) {
            next(e);
          }
        }
      )(request, response, next);
    })(req, res, next);
  });
  app.post("/api/login/mfa", (req, res, next) => {
    handle(async (request, response) => {
      const { code } = mfaCodeSchema.parse(request.body);
      const pending = request.session.mfaPending;
      const restart = (message) => {
        delete request.session.mfaPending;
        return response.status(401).json({ message, code: "MFA_EXPIRED" });
      };
      if (!pending || Date.now() - pending.at > MFA_PENDING_TTL_MS) {
        return restart("Kirish muddati tugadi. Login va parolni qaytadan kiriting");
      }
      const account = await storage.getUser(pending.userId);
      if (!account || !account.isActive) return restart("Login yoki parol noto'g'ri");
      const remaining = lockRemainingMs(account.lockedUntil);
      if (remaining > 0) {
        delete request.session.mfaPending;
        return response.status(423).json({
          message: lockMessage(remaining, isFinalLock(account)),
          lockedUntil: account.lockedUntil
        });
      }
      const record = await storage.getUserMfa(account.id);
      if (!record) return restart("Kirish muddati tugadi. Login va parolni qaytadan kiriting");
      const result = await verifyAndConsume(record, code);
      if (result === "unreadable") {
        console.error(
          `[mfa] ${account.username}: secret cannot be decrypted (MFA_ENCRYPTION_KEY / SESSION_SECRET changed?)`
        );
        delete request.session.mfaPending;
        return response.status(500).json({
          message: "Ikki bosqichli kirish kalitini o'qib bo'lmadi. Administrator 2FA ni qayta o'rnatishi kerak"
        });
      }
      if (result === "invalid") {
        const decision = registerFailure(account);
        await storage.setLockState(account.id, decision);
        if (decision.justLocked) {
          delete request.session.mfaPending;
          await audit(
            request,
            "login",
            "auth",
            account.id,
            `${account.fullName} hisobi qulflandi \u2014 noto'g'ri 2FA kodi (${formatLockRemaining(decision.lockedForMs ?? 0)})`
          );
          return response.status(423).json({
            message: lockMessage(decision.lockedForMs ?? 0, isFinalLock(decision)),
            lockedUntil: decision.lockedUntil
          });
        }
        pending.attempts += 1;
        if (pending.attempts >= MFA_MAX_ATTEMPTS) {
          return restart("Juda ko'p noto'g'ri kod. Login va parolni qaytadan kiriting");
        }
        const left = decision.lockLevel > 0 ? 1 : ATTEMPTS_BEFORE_LOCK - decision.failedAttempts;
        return response.status(401).json({
          message: "Kod noto'g'ri yoki eskirgan",
          warning: attemptsLeftMessage(left, decision.lockLevel),
          attemptsLeft: left
        });
      }
      const { password: _password, ...pub } = account;
      const user = await toSessionUser(pub);
      const how = result === "recovery" ? ` (zaxira kod bilan; ${Math.max(0, record.recoveryCodes.length - 1)} ta qoldi)` : " (2FA)";
      completeLogin(request, response, next, user, account, { mustEnrol: false, how });
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
      await storage.updateUser(me.id, { password: input.newPassword }, actorOf(req));
      const ended = await revokeUserSessions(sessionStore, sessionPool, me.id, { keepSid: req.sessionID });
      await audit(
        req,
        "update",
        "user",
        me.id,
        `${me.fullName} parolini o'zgartirdi${ended ? ` (${ended} ta boshqa seans yopildi)` : ""}`
      );
      res.json({ endedSessions: ended });
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
    const me = { ...req.user, mfaSetupRequired: req.session.mfaSetupRequired || void 0 };
    res.json(me);
  });
  app.get(
    "/api/user/mfa",
    requireAuth,
    handle(async (req, res) => {
      res.json(await mfaStatusOf(req.user.id, req.user.role));
    })
  );
  app.post(
    "/api/user/mfa/setup",
    requireAuth,
    handle(async (req, res) => {
      const { password } = mfaPasswordSchema.parse(req.body);
      const me = req.user;
      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!await verifyPassword(password, full.password)) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }
      if (!await storage.mfaAvailable()) return res.status(503).json({ message: MFA_NOT_MIGRATED });
      if (await storage.getUserMfa(me.id)) {
        return res.status(409).json({ message: "Ikki bosqichli kirish allaqachon yoqilgan" });
      }
      const secret = generateTotpSecret();
      const url = otpauthUrl(me.username, secret);
      req.session.mfaSetup = { secret: encryptSecret(secret), at: Date.now() };
      const setup = {
        secret,
        otpauthUrl: url,
        qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      };
      res.json(setup);
    })
  );
  app.post(
    "/api/user/mfa/enable",
    requireAuth,
    handle(async (req, res) => {
      const { code } = mfaCodeSchema.parse(req.body);
      const me = req.user;
      const setup = req.session.mfaSetup;
      if (!setup || Date.now() - setup.at > MFA_SETUP_TTL_MS) {
        delete req.session.mfaSetup;
        return res.status(400).json({ message: "Sozlash muddati tugadi. Qaytadan boshlang" });
      }
      const secret = decryptSecret(setup.secret);
      const step = secret ? verifyTotp(secret, code) : null;
      if (step === null) {
        return res.status(400).json({
          message: "Kod noto'g'ri. Ilovadagi joriy kodni kiriting va telefon vaqti to'g'riligini tekshiring"
        });
      }
      if (await storage.getUserMfa(me.id)) {
        delete req.session.mfaSetup;
        return res.status(409).json({ message: "Ikki bosqichli kirish allaqachon yoqilgan" });
      }
      const { codes, hashes } = generateRecoveryCodes();
      await storage.saveUserMfa(
        { userId: me.id, secret: setup.secret, recoveryCodes: hashes, lastUsedStep: step },
        actorOf(req)
      );
      delete req.session.mfaSetup;
      delete req.session.mfaSetupRequired;
      const ended = await revokeUserSessions(sessionStore, sessionPool, me.id, { keepSid: req.sessionID });
      await audit(
        req,
        "update",
        "user",
        me.id,
        `${me.fullName} ikki bosqichli autentifikatsiyani yoqdi${ended ? ` (${ended} ta boshqa seans yopildi)` : ""}`
      );
      res.json({ recoveryCodes: codes, endedSessions: ended });
    })
  );
  app.post(
    "/api/user/mfa/disable",
    requireAuth,
    handle(async (req, res) => {
      const { password, code } = mfaDisableSchema.parse(req.body);
      const me = req.user;
      if ((await getSessionPolicy()).mfaRequiredRoles.includes(me.role)) {
        return res.status(403).json({
          message: "Rolingiz uchun ikki bosqichli kirish majburiy. Telefon almashgan bo'lsa, administrator 2FA ni qayta o'rnatadi"
        });
      }
      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!await verifyPassword(password, full.password)) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }
      const record = await storage.getUserMfa(me.id);
      if (!record) return res.status(404).json({ message: "Ikki bosqichli kirish yoqilmagan" });
      if (!codeAccepted(await verifyAndConsume(record, code))) {
        return res.status(400).json({ message: "Kod noto'g'ri yoki eskirgan" });
      }
      await storage.deleteUserMfa(me.id);
      await audit(req, "update", "user", me.id, `${me.fullName} ikki bosqichli autentifikatsiyani o'chirdi`);
      res.sendStatus(204);
    })
  );
  app.post(
    "/api/user/mfa/recovery-codes",
    requireAuth,
    handle(async (req, res) => {
      const { code } = mfaCodeSchema.parse(req.body);
      const me = req.user;
      const record = await storage.getUserMfa(me.id);
      if (!record) return res.status(404).json({ message: "Ikki bosqichli kirish yoqilmagan" });
      if (!codeAccepted(await verifyAndConsume(record, code))) {
        return res.status(400).json({ message: "Kod noto'g'ri yoki eskirgan" });
      }
      const { codes, hashes } = generateRecoveryCodes();
      await storage.replaceRecoveryCodes(me.id, hashes, actorOf(req));
      await audit(req, "update", "user", me.id, `${me.fullName} yangi zaxira kodlar yaratdi`);
      res.json({ recoveryCodes: codes });
    })
  );
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
      const patient = await storage.getPatientDetails(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      res.json(patient);
    })
  );
  const logCardView = (req, patient) => logPatientView(req, patient, "kartasi ochildi");
  app.get(
    "/api/patients/:id/card",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const card = await storage.getPatientCard(req.params.id);
      if (!card) return res.status(404).json({ message: "Bemor topilmadi" });
      await logCardView(req, card.patient);
      if (!hasPermission(req, "orders.read")) {
        card.visits = card.visits.map((v) => ({ ...v, orders: [], billed: 0, paid: 0 })).filter((v) => v.appointments.length > 0);
        card.payments = [];
      }
      if (!hasPermission(req, "finance.view") && !hasPermission(req, "payments.create")) {
        card.payments = [];
        card.totals = { ...card.totals, billed: null, paid: null, debt: null };
      }
      res.json(card);
    })
  );
  app.get(
    "/api/patients/:id/access-log",
    requirePermission("audit.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listAudit({
          entity: "patient",
          entityId: req.params.id,
          limit: numberParam(req.query.limit, 100),
          offset: numberParam(req.query.offset, 0)
        })
      );
    })
  );
  async function findDuplicates(input, excludeId) {
    const typed = {
      fullName: input.fullName ?? null,
      phoneDigits: input.phone ? nationalPhoneDigits(input.phone) : null,
      birthDate: input.birthDate ?? null,
      passport: input.passport ?? null,
      pinfl: input.pinfl ?? null
    };
    const surname = (input.fullName ?? "").trim().split(/\s+/)[0] || null;
    const candidates = await storage.findPatientCandidates({
      surname,
      nameKey: nameKey(surname),
      phoneDigits: typed.phoneDigits,
      birthDate: typed.birthDate,
      passport: typed.passport,
      pinfl: typed.pinfl,
      excludeId
    });
    const graded = [];
    for (const patient of candidates) {
      const match = compareIdentity(typed, {
        fullName: patient.fullName,
        phoneDigits: nationalPhoneDigits(patient.phone),
        birthDate: patient.birthDate,
        passport: patient.passport,
        pinfl: patient.pinfl
      });
      if (match) graded.push({ patient, ...match });
    }
    return graded.sort((a, b) => Number(b.strength === "strong") - Number(a.strength === "strong") || b.reasons.length - a.reasons.length).slice(0, 5);
  }
  app.post(
    "/api/patients/check-duplicates",
    requirePermission("patients.create", "patients.update"),
    handle(async (req, res) => {
      const input = insertPatientSchema.pick({ fullName: true, phone: true, birthDate: true, passport: true, pinfl: true }).partial().safeParse(req.body);
      const body = input.success ? input.data : {};
      const excludeId = typeof req.body?.excludeId === "string" ? req.body.excludeId : void 0;
      res.json(await findDuplicates(body, excludeId));
    })
  );
  const withAge = (input) => input.birthDate ? { ...input, age: ageFromBirthDate(input.birthDate) } : input;
  const duplicateResponse = (res, strong) => res.status(409).json({
    code: "DUPLICATE_PATIENT",
    message: `Bu bemor bazada bor bo'lishi mumkin: ${strong[0].patient.fullName} (\u2116${strong[0].patient.patientNumber}) \u2014 ${strong[0].reasons.join(", ")}`,
    candidates: strong
  });
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
      const input = withAge(insertPatientSchema.parse(req.body));
      if (!input.allowDuplicate) {
        const strong = (await findDuplicates(input)).filter((c) => c.strength === "strong");
        if (strong.length) return duplicateResponse(res, strong);
      }
      const patient = await storage.createPatient(input, actorOf(req));
      await audit(
        req,
        "create",
        "patient",
        patient.id,
        `\u2116${patient.patientNumber} ${patient.fullName}${input.allowDuplicate ? " (o'xshash bemor ogohlantirishi tasdiqlangan)" : ""}`
      );
      res.status(201).json(await claimPendingContact(patient));
    })
  );
  app.patch(
    "/api/patients/:id",
    requirePermission("patients.update"),
    handle(async (req, res) => {
      const input = withAge(insertPatientSchema.partial().parse(req.body));
      const before = await storage.getPatient(req.params.id);
      if (!before) return res.status(404).json({ message: "Bemor topilmadi" });
      const idChanged = input.pinfl !== void 0 && input.pinfl !== before.pinfl || input.passport !== void 0 && input.passport !== before.passport;
      if (idChanged && !input.allowDuplicate) {
        const clash = (await findDuplicates({ pinfl: input.pinfl, passport: input.passport }, before.id)).filter(
          (c) => c.strength === "strong"
        );
        if (clash.length) return duplicateResponse(res, clash);
      }
      const patient = await storage.updatePatient(req.params.id, input, actorOf(req));
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      const changes = [];
      const fields = [
        ["fullName", "F.I.Sh"],
        ["phone", "telefon"],
        ["birthDate", "tug'ilgan sana"],
        ["gender", "jinsi"],
        ["address", "manzil"],
        ["passport", "pasport"],
        ["pinfl", "JShShIR"]
      ];
      for (const [k, label] of fields) if ((before[k] ?? null) !== (patient[k] ?? null)) changes.push(label);
      if (input.emergencyContact !== void 0) changes.push("favqulodda aloqa");
      await audit(
        req,
        "update",
        "patient",
        patient.id,
        `\u2116${patient.patientNumber} ${patient.fullName} \u2014 ${changes.length ? changes.join(", ") + " o'zgardi" : "tahrirlandi"}`
      );
      res.json(await claimPendingContact(patient));
    })
  );
  app.post(
    "/api/patients/:id/merge",
    requirePermission("patients.delete"),
    handle(async (req, res) => {
      const intoId = typeof req.body?.intoId === "string" ? req.body.intoId : "";
      if (!intoId || intoId === req.params.id) {
        return res.status(400).json({ message: "Qaysi bemorga birlashtirishni tanlang" });
      }
      const [source, target] = await Promise.all([storage.getPatient(req.params.id), storage.getPatient(intoId)]);
      if (!source || !target) return res.status(404).json({ message: "Bemor topilmadi" });
      const moved = await storage.mergePatients(source.id, target.id, actorOf(req));
      if (!moved) return res.status(404).json({ message: "Bemor topilmadi" });
      await audit(
        req,
        "update",
        "patient",
        target.id,
        `\u2116${source.patientNumber} ${source.fullName} kartasi \u2116${target.patientNumber} ${target.fullName} bilan birlashtirildi (${moved.orders} ta buyurtma, ${moved.appointments} ta qabul, ${moved.contacts} ta aloqa ko'chirildi)`
      );
      res.json({ ...moved, patient: await storage.getPatientDetails(target.id) });
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
      const test = await storage.createTest(insertTestSchema.parse(req.body), actorOf(req));
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
      const test = await storage.updateTest(req.params.id, input, actorOf(req));
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
      const queue2 = queueParam === "waiting" || queueParam === "review" || queueParam === "ready" ? queueParam : void 0;
      const result = await storage.listOrders({
        search: typeof req.query.search === "string" ? req.query.search : void 0,
        status,
        queue: queue2,
        group: isTestGroup(req.query.group) ? req.query.group : void 0,
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
      const order = await storage.updateOrder(req.params.id, input, actorOf(req));
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
  app.get(
    "/api/notifications",
    requireAuth,
    handle(async (req, res) => {
      const limit = Math.min(50, Math.max(1, numberParam(req.query.limit, 20) ?? 20));
      res.json(await storage.listNotifications(req.user.id, limit).catch((e) => emptyIfMissing(e, { items: [], unread: 0 })));
    })
  );
  app.post(
    "/api/notifications/:id/read",
    requireAuth,
    handle(async (req, res) => {
      const changed = await storage.markNotificationRead(req.user.id, req.params.id);
      res.json({ ok: true, changed });
    })
  );
  app.post(
    "/api/notifications/read-all",
    requireAuth,
    handle(async (req, res) => {
      res.json({ ok: true, changed: await storage.markAllNotificationsRead(req.user.id) });
    })
  );
  app.post(
    "/api/orders/:id/verify",
    requirePermission("results.verify"),
    handle(async (req, res) => {
      const { itemIds } = verifyResultsSchema.parse(req.body ?? {});
      const outcome = await storage.verifyResults(req.params.id, itemIds ?? null, actorOf(req));
      if (!outcome) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const { order, verified, selfChecked } = outcome;
      const released = isOrderReleased(order);
      await audit(
        req,
        "verify",
        "order",
        order.id,
        `#${order.orderNumber}: ${verified} ta natija tasdiqlandi${selfChecked ? ` (${selfChecked} tasini o'zi kiritgan)` : ""}${released ? " \u2014 buyurtma to'liq tasdiqlandi" : ""}`
      );
      const [delivery, doctorTold] = released ? await Promise.all([notifyIfReady(order), notifyOrderingDoctor(order, { kind: "released" })]) : [void 0, false];
      res.json({ ...order, telegram: delivery, doctorNotified: doctorTold });
    })
  );
  app.post(
    "/api/orders/:id/return",
    requirePermission("results.verify"),
    handle(async (req, res) => {
      const { itemIds, reason } = returnResultsSchema.parse(req.body);
      const order = await storage.returnResults(req.params.id, itemIds, reason, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const names = order.items.filter((i) => itemIds.includes(i.id)).map((i) => i.testName);
      await audit(req, "return", "order", order.id, `#${order.orderNumber}: qayta tekshirishga qaytarildi \u2014 ${names.join(", ")}. Sabab: ${reason}`);
      res.json(order);
    })
  );
  app.post(
    "/api/orders/:id/items/:itemId/amend",
    requirePermission("results.amend"),
    handle(async (req, res) => {
      const { reason, ...input } = amendResultSchema.parse(req.body);
      const outcome = await storage.amendResult(req.params.id, req.params.itemId, input, reason, actorOf(req));
      if (!outcome) return res.status(404).json({ message: "Natija topilmadi" });
      const line = outcome.order.items.find((i) => i.id === req.params.itemId);
      await notifyOrderingDoctor(outcome.order, { kind: "amended", testName: line.testName, from: outcome.previous.result, to: line.result });
      await audit(
        req,
        "amend",
        "order",
        outcome.order.id,
        `#${outcome.order.orderNumber}: "${line.testName}" tuzatildi ${outcome.previous.result ?? "\u2014"} \u2192 ${line.result} (v${outcome.previous.version} \u2192 v${line.version}). Sabab: ${reason}`
      );
      res.json(outcome.order);
    })
  );
  app.get(
    "/api/orders/:id/items/:itemId/versions",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order || !order.items.some((i) => i.id === req.params.itemId)) {
        return res.status(404).json({ message: "Natija topilmadi" });
      }
      res.json(await storage.listResultVersions(req.params.itemId).catch((e) => emptyIfMissing(e, [])));
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
      const detail = input.status === "rad_etildi" ? `rad etildi \u2014 ${sample.rejectReason}` : input.status === "qabul_qilindi" && sample.quality ? `${SAMPLE_STATUS_LABELS[sample.status]}, sifati: ${SAMPLE_QUALITY_LABELS[sample.quality] ?? sample.quality}${sample.qualityNote ? ` (${sample.qualityNote})` : ""}` : SAMPLE_STATUS_LABELS[sample.status];
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
  app.post(
    "/api/payments/:id/void",
    requirePermission("payments.delete"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const order = await storage.voidPayment(req.params.id, reason, actorOf(req));
      if (!order) return res.status(404).json({ message: "To'lov topilmadi" });
      const row = order.payments?.find((p) => p.id === req.params.id);
      await audit(
        req,
        "void",
        "order",
        order.id,
        `#${order.orderNumber}: ${row?.amount ?? "?"} so'm to'lov bekor qilindi. Sabab: ${reason}`
      );
      res.json(order);
    })
  );
  const expenseQuery = (req) => {
    const status = stringParam(req.query.status);
    const category = stringParam(req.query.category);
    const method = stringParam(req.query.method);
    return {
      from: stringParam(req.query.from),
      to: stringParam(req.query.to),
      category: category && EXPENSE_CATEGORIES.includes(category) ? category : void 0,
      method: method && PAYMENT_METHODS.includes(method) ? method : void 0,
      search: stringParam(req.query.search),
      status: status === "cancelled" || status === "all" ? status : "active"
    };
  };
  const fmtSum = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
  app.get(
    "/api/expenses",
    requirePermission("expenses.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listExpenses({
          ...expenseQuery(req),
          limit: numberParam(req.query.limit),
          offset: numberParam(req.query.offset, 0)
        })
      );
    })
  );
  app.get(
    "/api/expenses/summary",
    requirePermission("expenses.read"),
    handle(async (req, res) => {
      const from = stringParam(req.query.from);
      const to = stringParam(req.query.to);
      const day = /^\d{4}-\d{2}-\d{2}$/;
      if (!from || !to || !day.test(from) || !day.test(to) || from > to) {
        return res.status(400).json({ message: "Davrni to'g'ri tanlang" });
      }
      res.json(await storage.getExpenseSummary(from, to));
    })
  );
  app.get(
    "/api/expenses/payees",
    requirePermission("expenses.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listExpensePayees());
    })
  );
  app.post(
    "/api/expenses",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const input = insertExpenseSchema.parse(req.body);
      const row = await storage.createExpense(input, actorOf(req));
      await audit(
        req,
        "create",
        "expense",
        row.id,
        `${row.category}: ${fmtSum(row.amount)}${row.payee ? ` \u2192 ${row.payee}` : ""} (${row.spentOn})`
      );
      res.status(201).json(row);
    })
  );
  app.patch(
    "/api/expenses/:id",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const input = updateExpenseSchema.parse(req.body);
      const before = await storage.getExpense(req.params.id);
      if (!before) return res.status(404).json({ message: "Xarajat topilmadi" });
      if (before.status === "cancelled") {
        return res.status(409).json({ message: "Bekor qilingan xarajatni tahrirlab bo'lmaydi" });
      }
      const row = await storage.updateExpense(req.params.id, input, actorOf(req));
      if (!row) return res.status(404).json({ message: "Xarajat topilmadi" });
      const changes = [];
      if (row.amount !== before.amount) changes.push(`summa ${fmtSum(before.amount)} \u2192 ${fmtSum(row.amount)}`);
      if (row.category !== before.category) changes.push(`kategoriya ${before.category} \u2192 ${row.category}`);
      if (row.spentOn !== before.spentOn) changes.push(`sana ${before.spentOn} \u2192 ${row.spentOn}`);
      if (row.method !== before.method) changes.push(`to'lov ${before.method} \u2192 ${row.method}`);
      if ((row.payee ?? "") !== (before.payee ?? "")) changes.push(`oluvchi: ${row.payee ?? "\u2014"}`);
      if ((row.note ?? "") !== (before.note ?? "")) changes.push("izoh o'zgardi");
      if (changes.length) {
        await audit(req, "update", "expense", row.id, `${row.category} xarajati \u2014 ${changes.join(", ")}`);
      }
      res.json(row);
    })
  );
  app.post(
    "/api/expenses/:id/cancel",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const { reason } = cancelExpenseSchema.parse(req.body);
      const before = await storage.getExpense(req.params.id);
      if (!before) return res.status(404).json({ message: "Xarajat topilmadi" });
      if (before.status === "cancelled") {
        return res.status(409).json({ message: "Bu xarajat allaqachon bekor qilingan" });
      }
      const row = await storage.cancelExpense(req.params.id, reason, actorOf(req));
      await audit(
        req,
        "delete",
        "expense",
        req.params.id,
        `${before.category}: ${fmtSum(before.amount)} bekor qilindi \u2014 ${reason}`
      );
      res.json(row);
    })
  );
  app.get(
    "/api/audit",
    requirePermission("audit.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listAudit({
          entity: stringParam(req.query.entity),
          action: stringParam(req.query.action),
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
          [
            "\u2116",
            "F.I.Sh",
            "Telefon",
            "Tug'ilgan sana",
            "Yosh",
            "Jinsi",
            "Manzil",
            "Pasport",
            "JShShIR",
            "Tashriflar",
            "Oxirgi tashrif",
            "Telegram",
            "Ro'yxatdan o'tgan"
          ],
          items.map((p) => [
            p.patientNumber,
            p.fullName,
            p.phone,
            p.birthDate ?? "",
            patientAge(p) ?? "",
            p.gender ?? "",
            p.address ?? "",
            p.passport ?? "",
            p.pinfl ?? "",
            p.visitCount,
            p.lastVisitAt ? localDay(p.lastVisitAt) : "",
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
      const { items } = await storage.listExpenses(expenseQuery(req));
      csvHeaders(res, `xarajatlar-${stamp()}.csv`);
      res.send(
        toCsv(
          ["Sana", "Kategoriya", "Summa", "To'lov usuli", "Oluvchi", "Izoh", "Kim kiritdi", "Holat", "Bekor qilish sababi"],
          items.map((e) => [
            e.spentOn,
            e.category,
            e.amount,
            e.method,
            e.payee ?? "",
            e.note ?? "",
            e.createdByName ?? "",
            e.status === "cancelled" ? "Bekor qilingan" : "Faol",
            e.cancelReason ?? ""
          ])
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
  app.get(
    "/api/settings/logo",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.getLogo());
    })
  );
  app.put(
    "/api/settings/logo",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const dataUrl = req.body?.dataUrl;
      const checked = checkLogo(dataUrl);
      if (!checked.ok) return res.status(400).json({ message: checked.message });
      const logo = {
        dataUrl,
        mime: checked.mime,
        bytes: checked.bytes,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedByName: req.user.fullName
      };
      await storage.setLogo(logo, actorOf(req));
      await audit(req, "update", "settings", "logo", `Klinika logotipi yangilandi (${checked.mime.replace("image/", "").toUpperCase()}, ${Math.max(1, Math.round(checked.bytes / 1024))} KB)`);
      res.json(logo);
    })
  );
  app.delete(
    "/api/settings/logo",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const had = await storage.getLogo();
      if (!had) return res.status(404).json({ message: "Logotip o'rnatilmagan" });
      await storage.setLogo(null, actorOf(req));
      await audit(req, "delete", "settings", "logo", "Klinika logotipi olib tashlandi");
      res.status(204).end();
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
      const user = await storage.createUser(input, actorOf(req));
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
      const user = await storage.updateUser(req.params.id, input, actorOf(req));
      forgetSessionUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (input.password || deactivates) {
        await revokeUserSessions(sessionStore, sessionPool, user.id, isSelf ? { keepSid: req.sessionID } : {});
      }
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
    // settings.manage: the 2FA policy is set per role.
    requirePermission("users.manage", "roles.manage", "settings.manage"),
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
  app.get(
    "/api/session/policy",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await getSessionPolicy());
    })
  );
  app.post("/api/session/ping", requireAuth, (_req, res) => res.sendStatus(204));
  app.get(
    "/api/sessions",
    requireAuth,
    handle(async (req, res) => {
      res.json(await listUserSessions(sessionStore, sessionPool, req.user.id, req.sessionID));
    })
  );
  app.delete(
    "/api/sessions/:id",
    requireAuth,
    handle(async (req, res) => {
      const mine = await listUserSessions(sessionStore, sessionPool, req.user.id, req.sessionID);
      const target = mine.find((s) => s.id === req.params.id);
      if (!target) return res.status(404).json({ message: "Seans topilmadi" });
      if (target.current) {
        return res.status(400).json({ message: 'Joriy seansni yopish uchun "Chiqish" tugmasidan foydalaning' });
      }
      await revokeUserSessions(sessionStore, sessionPool, req.user.id, { onlyId: target.id });
      await audit(req, "update", "session", req.user.id, `${req.user.fullName} \u2014 bitta seansni yopdi (${target.ip ?? "IP noma'lum"})`);
      res.sendStatus(204);
    })
  );
  app.post(
    "/api/sessions/revoke-others",
    requireAuth,
    handle(async (req, res) => {
      const ended = await revokeUserSessions(sessionStore, sessionPool, req.user.id, { keepSid: req.sessionID });
      if (ended) {
        await audit(req, "update", "session", req.user.id, `${req.user.fullName} \u2014 boshqa ${ended} ta seansni yopdi`);
      }
      res.json({ ended });
    })
  );
  app.get(
    "/api/users/mfa",
    requirePermission("users.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listMfaEnrollments());
    })
  );
  app.post(
    "/api/users/:id/mfa/reset",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (target.id === req.user.id) {
        return res.status(400).json({ message: "O'z hisobingiz uchun Sozlamalar \u2192 Xavfsizlik bo'limidan foydalaning" });
      }
      if ((target.role === SUPER_ADMIN || target.role === LEGACY_ADMIN) && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Super administrator 2FA sini faqat super administrator o'chira oladi" });
      }
      if (!await storage.deleteUserMfa(target.id)) {
        return res.status(404).json({ message: "Bu xodimda ikki bosqichli kirish yoqilmagan" });
      }
      const ended = await revokeUserSessions(sessionStore, sessionPool, target.id);
      await audit(
        req,
        "update",
        "user",
        target.id,
        `${target.fullName} \u2014 ikki bosqichli kirish administrator tomonidan o'chirildi${ended ? ` (${ended} ta seans yopildi)` : ""}`
      );
      res.json({ ended });
    })
  );
  app.post(
    "/api/users/:id/sessions/revoke",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if ((target.role === SUPER_ADMIN || target.role === LEGACY_ADMIN) && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Super administrator seanslarini faqat super administrator yopa oladi" });
      }
      const self = target.id === req.user.id;
      const ended = await revokeUserSessions(sessionStore, sessionPool, target.id, self ? { keepSid: req.sessionID } : {});
      await audit(req, "update", "session", target.id, `${target.fullName} \u2014 ${ended} ta seans majburan yopildi`);
      res.json({ ended });
    })
  );
  app.get(
    "/api/settings/security",
    requirePermission("settings.manage"),
    handle(async (_req, res) => {
      res.json(await storage.getSecuritySettings());
    })
  );
  app.put(
    "/api/settings/security",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const before = await storage.getSecuritySettings();
      const input = securitySettingsSchema.parse({
        ...before,
        ...securitySettingsSchema.partial().parse(req.body)
      });
      const added = input.mfaRequiredRoles.filter((k) => !before.mfaRequiredRoles.includes(k));
      const removed = before.mfaRequiredRoles.filter((k) => !input.mfaRequiredRoles.includes(k));
      const roleList = await storage.listRoles();
      const roleName = new Map(roleList.map((r) => [r.key, r.name]));
      const unknown = added.filter((k) => !roleName.has(k));
      if (unknown.length) return res.status(400).json({ message: `Noma'lum rol: ${unknown.join(", ")}` });
      if (added.length && !await storage.mfaAvailable()) return res.status(503).json({ message: MFA_NOT_MIGRATED });
      const saved = await storage.updateSecuritySettings(input, actorOf(req));
      invalidateSessionPolicy();
      const changes = [];
      if (before.sessionIdleMinutes !== saved.sessionIdleMinutes) {
        changes.push(`faolsizlik ${before.sessionIdleMinutes} \u2192 ${saved.sessionIdleMinutes} daq.`);
      }
      if (before.sessionMaxHours !== saved.sessionMaxHours) {
        changes.push(`maksimal ${before.sessionMaxHours} \u2192 ${saved.sessionMaxHours} soat`);
      }
      const names = (keys) => keys.map((k) => roleName.get(k) ?? k).join(", ");
      if (added.length) changes.push(`2FA majburiy: ${names(added)}`);
      if (removed.length) changes.push(`2FA ixtiyoriy: ${names(removed)}`);
      if (changes.length) {
        await audit(req, "update", "settings", "security", `Xavfsizlik siyosati: ${changes.join("; ")}`);
      }
      res.json(saved);
    })
  );
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
      if (await storage.doctorHasAppointments(before.id)) {
        return res.status(409).json({
          message: "Bu shifokorda qabullar tarixi bor. Profilni o'chirish o'rniga qabulni to'xtating (nofaol qiling)"
        });
      }
      await storage.deleteDoctor(before.id);
      await audit(req, "delete", "doctor", before.id, `${before.fullName} \u2014 shifokor profili o'chirildi`);
      res.sendStatus(204);
    })
  );
  registerClinicRoutes(app);
  registerMedicalRoutes(app);
  app.use("/api", (req, res, next) => {
    if (res.headersSent) return next();
    res.status(404).json({ message: `Bunday API yo'q: ${req.method} ${req.originalUrl.split("?")[0]}` });
  });
  app.use("/api", (err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(err).toString() });
    }
    if (err instanceof StorageConflict) {
      return res.status(409).json({ message: err.message });
    }
    if (err?.code === "42P01") {
      return res.status(503).json({
        message: "Ma'lumotlar bazasi yangilanmagan. Administrator migratsiyalarni ishga tushirishi kerak (npm run db:upgrade)."
      });
    }
    const bodyError = err?.type;
    if (bodyError === "entity.too.large") return res.status(413).json({ message: "So'rov hajmi juda katta" });
    if (bodyError === "entity.parse.failed") return res.status(400).json({ message: "So'rov ma'lumoti noto'g'ri (JSON)" });
    if (err instanceof Error) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
}

// server/app.ts
async function createApp() {
  const app = express();
  const json2 = express.json();
  const logoJson = express.json({ limit: "512kb" });
  app.use((req, res, next) => (req.path === "/api/settings/logo" ? logoJson : json2)(req, res, next));
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${Date.now() - start}ms`;
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
