import type { ClinicLogo } from "@shared/branding";
import type {
  StockIssue,
  StockCount,
  StockCountLineRow,
  InventoryBatch,
  StockMovement,
  StockReceipt,
  InventoryItem,
  Calibration,
  DeviceMaintenanceEntry,
  EqaResult,
  LabDevice,
  LabDeviceError,
  QcMaterial,
  QcResult,
  QcTarget,
} from "@shared/schema";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import type {
  AuditEntry,
  Department,
  Doctor,
  Expense,
  LabSettings,
  Order,
  OrderTest,
  Patient,
  PatientContact,
  Payment,
  RoleRecord,
  SecuritySettings,
  Sample,
  TelegramContact,
  Test,
  User,
  UserMfa,
  Visit,
  Service,
  Appointment,
  MedicalRecord,
  MedicalRecordVersion,
  PatientAllergy,
  Referral,
  OrderTestVersion,
  AppNotification,
} from "@shared/schema";

export type DbShape = {
  users: User[];
  userMfa: UserMfa[];
  roles: RoleRecord[];
  departments: Department[];
  doctors: Doctor[];
  services: Service[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  medicalRecordVersions: Omit<MedicalRecordVersion, "replacedByName">[];
  patientAllergies: Omit<PatientAllergy, "createdByName">[];
  referrals: Referral[];
  notifications: (AppNotification & { dedupeKey: string | null })[];
  labDevices: LabDevice[];
  labDeviceErrors: LabDeviceError[];
  qcMaterials: QcMaterial[];
  qcTargets: QcTarget[];
  qcResults: QcResult[];
  calibrations: Calibration[];
  deviceMaintenance: DeviceMaintenanceEntry[];
  eqaResults: EqaResult[];
  inventoryItems: InventoryItem[];
  stockReceipts: StockReceipt[];
  inventoryBatches: InventoryBatch[];
  stockMovements: StockMovement[];
  stockIssues: StockIssue[];
  stockCounts: StockCount[];
  stockCountLines: StockCountLineRow[];
  /** The clinic's Uzbek MKB-10 names by code; the catalogue itself is read from data/icd10. */
  icdUzNames: Record<string, string>;
  security: SecuritySettings | null;
  /** B4.7: the clinic's logo, as on Postgres's app_settings "logo". */
  logo?: ClinicLogo | null;
  patients: Patient[];
  patientContacts: PatientContact[];
  visits: Visit[];
  tests: Test[];
  orders: Order[];
  orderTests: OrderTest[];
  orderTestVersions: OrderTestVersion[];
  samples: Sample[];
  payments: Payment[];
  expenses: Expense[];
  auditLog: AuditEntry[];
  telegramContacts: TelegramContact[];
  settings: LabSettings;
  /** Last number handed out for each human-facing sequence; next = value + 1. */
  counters: { orderNumber: number; patientNumber: number; referralNumber: number; receiptNumber: number; issueNumber: number; countNumber: number };
};

/**
 * MEDLAB_TEST_DIR lets the test suite point the JSON store at a temp directory.
 * Without it the tests would read and write the developer's real .data/db.json,
 * which is the sort of thing you only notice after it has eaten your data.
 */
const DATA_DIR = process.env.MEDLAB_TEST_DIR
  ? path.resolve(process.env.MEDLAB_TEST_DIR)
  : path.resolve(import.meta.dirname, "..", ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const TMP_FILE = path.join(DATA_DIR, "db.tmp.json");

export const emptyDb = (): DbShape => ({
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
  labDevices: [],
  labDeviceErrors: [],
  qcMaterials: [],
  qcTargets: [],
  qcResults: [],
  calibrations: [],
  deviceMaintenance: [],
  eqaResults: [],
  inventoryItems: [],
  stockReceipts: [],
  inventoryBatches: [],
  stockMovements: [],
  stockIssues: [],
  stockCounts: [],
  stockCountLines: [],
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
    licenseNumber: null,
  },
  counters: { orderNumber: 1000, patientNumber: 0, referralNumber: 0, receiptNumber: 0, issueNumber: 0, countNumber: 0 },
});

export function readDbSync(): DbShape {
  try {
    const raw = fsSync.readFileSync(DB_FILE, "utf8");
    // Spread over the empty shape so a file written by an older version
    // (missing a collection) still loads instead of crashing on boot.
    // `counters` is merged key by key rather than replaced, otherwise a file
    // written before a counter existed would load it back as undefined.
    const base = emptyDb();
    const saved = JSON.parse(raw) as Partial<DbShape>;
    return { ...base, ...saved, counters: { ...base.counters, ...saved.counters } };
  } catch {
    return emptyDb();
  }
}

/**
 * Writes go through a temp file + rename so a crash mid-write cannot leave a
 * truncated db.json behind. Calls are serialised through `queue` because
 * Express handlers can overlap.
 */
let queue: Promise<void> = Promise.resolve();

export function writeDb(db: DbShape): Promise<void> {
  queue = queue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(TMP_FILE, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(TMP_FILE, DB_FILE);
  });
  return queue;
}
