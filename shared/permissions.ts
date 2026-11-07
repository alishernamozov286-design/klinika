/**
 * Role-based access control: the permission catalogue and the default roles.
 *
 * Permissions are defined in code, not in the database, because the code is
 * what checks them — a permission row nobody's route consults would be a
 * checkbox that does nothing. Roles, on the other hand, live in the database
 * (`roles` table) so the clinic can tune what each role may do, and add roles
 * of its own, without a release.
 *
 * Each module adds its permissions here as it is built (TZ §15). A permission
 * is only listed once some route actually enforces it.
 */

export const PERMISSION_GROUPS = [
  { key: "patients", label: "Bemorlar", description: "Bemorlar bazasi va shaxsiy kartalar" },
  { key: "appointments", label: "Navbat va qabul", description: "Shifokor qabuliga yozish, navbat va shifokor kabineti" },
  { key: "medical", label: "Tibbiy karta", description: "Ko'rik yozuvlari, tashxislar, allergiyalar va yo'llanmalar (TZ §5)" },
  { key: "orders", label: "Buyurtmalar", description: "Tahlil buyurtmalari" },
  { key: "lab", label: "Laboratoriya", description: "Namunalar, natijalar va tahlillar katalogi" },
  { key: "finance", label: "Kassa va moliya", description: "To'lovlar, qaytarishlar va xarajatlar" },
  { key: "reports", label: "Hisobotlar", description: "Statistika va ma'lumotlarni yuklab olish" },
  { key: "clinic", label: "Klinika tuzilmasi", description: "Bo'limlar, shifokorlar va xizmatlar" },
  { key: "system", label: "Tizim", description: "Sozlamalar, xodimlar, rollar va xavfsizlik" },
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number]["key"];

export const PERMISSION_GROUP_LABEL = Object.fromEntries(
  PERMISSION_GROUPS.map((g) => [g.key, g.label]),
) as Record<PermissionGroup, string>;

type PermissionDef = {
  group: PermissionGroup;
  label: string;
  description: string;
  /**
   * Grants that let the holder change who can do what. Shown with a warning
   * in the role editor, since handing one out is handing out the keys.
   */
  sensitive?: boolean;
};

export const PERMISSIONS = {
  "patients.read": {
    group: "patients",
    label: "Ko'rish",
    description: "Bemorlar ro'yxati va ma'lumotlarini ko'rish",
  },
  "patients.create": {
    group: "patients",
    label: "Ro'yxatga olish",
    description: "Yangi bemor qo'shish",
  },
  "patients.update": {
    group: "patients",
    label: "Tahrirlash",
    description: "Bemor ma'lumotlarini o'zgartirish",
  },
  "patients.delete": {
    group: "patients",
    label: "O'chirish",
    description: "Bemorni bazadan butunlay o'chirish",
    sensitive: true,
  },

  "appointments.read": {
    group: "appointments",
    label: "Ko'rish",
    description: "Barcha shifokorlar navbati va qabullar jadvalini ko'rish",
  },
  "appointments.manage": {
    group: "appointments",
    label: "Qabulga yozish",
    description: "Qabulga yozish, \"keldi\" deb belgilash, ko'chirish va bekor qilish",
  },
  "appointments.serve": {
    group: "appointments",
    label: "Qabul o'tkazish",
    description: "Shifokor kabineti: o'z navbatidagi bemorni chaqirish va qabulni yakunlash",
  },

  "records.read": {
    group: "medical",
    label: "Ko'rish",
    description: "Elektron tibbiy karta: ko'riklar, tashxislar, allergiyalar",
  },
  "records.write": {
    group: "medical",
    label: "Ko'rik yozish",
    description: "O'z qabulidagi bemorga ko'rik yozuvi va allergiya kiritish",
  },
  "records.sign": {
    group: "medical",
    label: "Tasdiqlash",
    description: "O'z ko'rik yozuvini tasdiqlash (tasdiqlangach qulflanadi)",
  },
  "records.amend": {
    group: "medical",
    label: "Tuzatish",
    description: "Tasdiqlangan yozuvga sababli tuzatish kiritish; eski nusxa saqlanadi",
    sensitive: true,
  },
  "referrals.read": {
    group: "medical",
    label: "Yo'llanmalarni ko'rish",
    description: "Shifokor yo'llanmalari: tahlil, UZI va tekshiruvlar, konsultatsiyalar",
  },
  "referrals.create": {
    group: "medical",
    label: "Yo'llanma berish",
    description: "O'z qabulidan laboratoriya, tekshiruv va mutaxassis konsultatsiyasiga yo'llanma berish",
  },
  "referrals.manage": {
    group: "medical",
    label: "Yo'llanmalarni boshqarish",
    description: "Bemor foydalanmaydigan yo'llanmani sabab bilan bekor qilish",
  },

  "orders.read": {
    group: "orders",
    label: "Ko'rish",
    description: "Buyurtmalar, tahlillar va natijalarni ko'rish",
  },
  "orders.create": {
    group: "orders",
    label: "Yaratish",
    description: "Bemorga tahlil buyurtma qilish",
  },
  "orders.update": {
    group: "orders",
    label: "Tahrirlash",
    description: "Tahlillar ro'yxati, chegirma va yo'naltiruvchini o'zgartirish",
  },
  "orders.cancel": {
    group: "orders",
    label: "Bekor qilish",
    description: "Buyurtmani bekor qilingan holatga o'tkazish",
  },
  "orders.delete": {
    group: "orders",
    label: "O'chirish",
    description: "Xato kiritilgan buyurtmani o'chirish (faqat to'lovi va natijasi bo'lmasa)",
    sensitive: true,
  },

  "samples.manage": {
    group: "lab",
    label: "Namunalar",
    description: "Namuna olish, qabul qilish, rad etish va shtrix-kod skanerlash",
  },
  "results.enter": {
    group: "lab",
    label: "Natija kiritish",
    description: "Tahlil natijalarini kiritish va tuzatish",
  },
  "results.verify": {
    group: "lab",
    label: "Natijani tasdiqlash",
    description: "Laborant kiritgan natijani tekshirish, tasdiqlash yoki sabab bilan qaytarish (TZ §6.1.5)",
  },
  "results.amend": {
    group: "lab",
    label: "Tasdiqlangan natijani tuzatish",
    description: "Tasdiqlangan natijaga sababli tuzatish kiritish; eski qiymat versiya sifatida saqlanadi",
    sensitive: true,
  },
  "results.send": {
    group: "lab",
    label: "Natija yuborish",
    description: "Tayyor natijani bemorga Telegram orqali yuborish",
  },
  "tests.manage": {
    group: "lab",
    label: "Tahlillar katalogi",
    description: "Tahlil qo'shish, narx va referens oraliqlarni o'zgartirish",
  },
  "devices.read": {
    group: "lab",
    label: "Analizatorlar",
    description: "Analizatorlar ro'yxati va qurilma xatolari jurnalini ko'rish (TZ §6.4)",
  },
  "devices.log": {
    group: "lab",
    label: "Qurilma xatosini qayd etish",
    description: "Analizator xatosini jurnalga yozish, hal qilinganini belgilash, nosoz qurilmani ishdan chiqqan deb belgilash",
  },
  "devices.manage": {
    group: "lab",
    label: "Analizatorlarni boshqarish",
    description: "Qurilma qo'shish, tahrirlash, holatini o'zgartirish va jurnali bo'lmagan qurilmani o'chirish",
  },

  "finance.view": {
    group: "finance",
    label: "Moliyaviy ko'rsatkichlar",
    description: "Bosh sahifada bugungi tushum va qarzdorlikni ko'rish",
  },
  "payments.create": {
    group: "finance",
    label: "To'lov qabul qilish",
    description: "Buyurtma uchun to'lov qabul qilish",
  },
  "payments.refund": {
    group: "finance",
    label: "To'lovni qaytarish",
    description: "Bemorga pulni qaytarish (TZ §9.2: faqat vakolatli shaxs)",
    sensitive: true,
  },
  "payments.delete": {
    group: "finance",
    label: "To'lov yozuvini bekor qilish",
    description: "Xato kiritilgan to'lovni sabab bilan bekor qilish (yozuv tarixda qoladi)",
    sensitive: true,
  },
  "expenses.read": {
    group: "finance",
    label: "Xarajatlarni ko'rish",
    description: "Xarajatlar ro'yxatini ko'rish",
  },
  "expenses.manage": {
    group: "finance",
    label: "Xarajatlarni boshqarish",
    description: "Xarajat qo'shish va o'chirish",
  },

  "reports.view": {
    group: "reports",
    label: "Hisobotlar",
    description: "Tushum, foyda, tahlillar va yo'naltiruvchilar hisobotlari",
  },
  "data.export": {
    group: "reports",
    label: "Bazani yuklab olish",
    description: "Bemorlar, buyurtmalar va xarajatlarni CSV ko'rinishida to'liq yuklab olish",
    sensitive: true,
  },

  "departments.manage": {
    group: "clinic",
    label: "Bo'limlar",
    description: "Klinika bo'limlarini qo'shish, tahrirlash va yopish",
  },
  "doctors.manage": {
    group: "clinic",
    label: "Shifokorlar",
    description: "Shifokor profili: mutaxassislik, kabinet, qabul narxi va ish jadvali",
  },
  "services.manage": {
    group: "clinic",
    label: "Xizmatlar katalogi",
    description: "Xizmatlar (ko'rik, UZI, muolaja) va ularning narxlarini boshqarish",
  },

  "settings.manage": {
    group: "system",
    label: "Klinika sozlamalari",
    description: "Klinika nomi, manzili, rekvizitlari va Telegram sozlamalari",
  },
  "users.manage": {
    group: "system",
    label: "Xodimlar",
    description: "Xodim qo'shish, tahrirlash, bloklash va qulfni ochish",
    sensitive: true,
  },
  "roles.manage": {
    group: "system",
    label: "Rollar va ruxsatlar",
    description: "Rollarni yaratish va ularning ruxsatlarini o'zgartirish",
    sensitive: true,
  },
  "audit.read": {
    group: "system",
    label: "Audit jurnali",
    description: "Kim, qachon, nima qilganini ko'rish",
  },
  "backup.download": {
    group: "system",
    label: "Zaxira nusxa",
    description: "Butun bazaning zaxira nusxasini yuklab olish",
    sensitive: true,
  },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export function permissionsInGroup(group: PermissionGroup): Permission[] {
  return ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].group === group);
}

// ------------------------------------------------------------------ roles

/**
 * Holds every permission, present and future, and cannot be edited or
 * deleted: there must always be one role that can repair a broken setup.
 */
export const SUPER_ADMIN = "super_admin";

/** The role key used before RBAC; treated as SUPER_ADMIN until migrated. */
export const LEGACY_ADMIN = "admin";

export type SystemRoleDef = {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
};

/**
 * The eleven roles of TZ §3, with the permissions each starts with.
 *
 * These are defaults, applied when a role row is first created. After that
 * the clinic owns them: an administrator may widen or narrow any of them, and
 * a later release will not overwrite those edits.
 *
 * Roles whose module is not built yet (omborchi, hamshira's ward work…) start
 * with only what already exists for them and gain permissions as their module
 * lands.
 */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    key: SUPER_ADMIN,
    name: "Super administrator",
    description: "Butun tizimga to'liq kirish. Tahrirlab bo'lmaydi.",
    permissions: ALL_PERMISSIONS,
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
      "audit.read",
      "devices.read",
    ],
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
      "payments.create",
    ],
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
      "referrals.create",
    ],
  },
  {
    key: "laborant",
    name: "Laborant",
    description: "Namunalarni qabul qilish va tahlil natijalarini kiritish",
    permissions: ["patients.read", "orders.read", "samples.manage", "results.enter", "results.send", "devices.read", "devices.log"],
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
      "devices.read",
      "devices.log",
      "devices.manage",
      "reports.view",
    ],
  },
  {
    key: "omborchi",
    name: "Omborchi",
    description: "Ombor: kirim, chiqim va qoldiq",
    permissions: [],
  },
  {
    key: "hamshira",
    name: "Statsionar hamshirasi",
    description: "Bemor parvarishi, muolajalar va namuna olish",
    permissions: ["patients.read", "orders.read", "samples.manage"],
  },
  {
    key: "kassir",
    name: "Kassa xodimi",
    description: "To'lovlarni qabul qilish",
    permissions: ["patients.read", "appointments.read", "orders.read", "finance.view", "payments.create"],
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
      "data.export",
    ],
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
      "audit.read",
      "devices.read",
    ],
  },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);

/** Folds the pre-RBAC "admin" key into SUPER_ADMIN. */
export function canonicalRoleKey(key: string | null | undefined): string {
  if (!key) return "";
  return key === LEGACY_ADMIN ? SUPER_ADMIN : key;
}

/**
 * The effective permission set for a role.
 *
 * SUPER_ADMIN is answered from the catalogue rather than from its row, so a
 * permission added in a later release reaches it without a migration, and a
 * hand-edited row cannot lock the last administrator out.
 * Unknown strings in a stored row (a permission since removed) are dropped.
 */
export function resolvePermissions(
  roleKey: string,
  stored: readonly string[] | null | undefined,
): Permission[] {
  if (canonicalRoleKey(roleKey) === SUPER_ADMIN) return [...ALL_PERMISSIONS];
  return Array.from(new Set((stored ?? []).filter(isPermission)));
}

/** Every permission in `wanted` is held in `held`. */
export function holdsAll(held: readonly string[], wanted: readonly string[]): boolean {
  const set = new Set(held);
  return wanted.every((p) => set.has(p));
}
