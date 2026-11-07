/**
 * Analizatorlar (B4.9, TZ §6.4): the lab's instruments and their error log.
 *
 * What a device is connected by is recorded per device because TZ §6.4 says
 * the protocol is checked device by device, and "qo'lda" (manual entry) is a
 * legitimate answer until it is (D-4). The log is a record of what happened:
 * an entry is never deleted or edited, only closed with what was done.
 */

export const DEVICE_DIRECTIONS = [
  "biokimyo",
  "gematologiya",
  "immunologiya",
  "ixla",
  "ifa",
  "koagulologiya",
  "siydik",
  "boshqa",
] as const;
export type DeviceDirection = (typeof DEVICE_DIRECTIONS)[number];
export const DEVICE_DIRECTION_LABELS: Record<DeviceDirection, string> = {
  biokimyo: "Biokimyo",
  gematologiya: "Gematologiya",
  immunologiya: "Immunologiya",
  ixla: "Immunoferment / immunoxemilyuminessensiya",
  ifa: "IFA",
  koagulologiya: "Koagulologiya",
  siydik: "Siydik tahlili",
  boshqa: "Boshqa",
};

/** TZ §6.4: "RS-232, TCP/IP, HL7 yoki ishlab chiqaruvchi protokoli … aks holda qo'lda". */
export const DEVICE_CONNECTIONS = ["manual", "rs232", "tcp", "hl7", "vendor"] as const;
export type DeviceConnection = (typeof DEVICE_CONNECTIONS)[number];
export const DEVICE_CONNECTION_LABELS: Record<DeviceConnection, string> = {
  manual: "Qo'lda kiritish",
  rs232: "RS-232",
  tcp: "TCP/IP",
  hl7: "HL7",
  vendor: "Ishlab chiqaruvchi protokoli",
};

export const DEVICE_STATUSES = ["active", "maintenance", "out_of_service"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  active: "Ishlamoqda",
  maintenance: "Texnik xizmatda",
  out_of_service: "Ishdan chiqqan",
};

export const ERROR_SEVERITIES = ["warning", "error", "critical"] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];
export const ERROR_SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  warning: "Ogohlantirish",
  error: "Xato",
  critical: "Jiddiy",
};

/** The instruments TZ §6.4 lists for future integration, as a starting set. */
export const TZ_ANALYZERS: { name: string; manufacturer: string; model: string; direction: DeviceDirection }[] = [
  { name: "MAGLUMI X3", manufacturer: "Snibe", model: "MAGLUMI X3", direction: "ixla" },
  { name: "MAGLUMI 600", manufacturer: "Snibe", model: "MAGLUMI 600", direction: "immunologiya" },
  { name: "BA-88A", manufacturer: "Mindray", model: "BA-88A", direction: "biokimyo" },
  { name: "BS-240 Pro", manufacturer: "Mindray", model: "BS-240 Pro", direction: "biokimyo" },
  { name: "DH26", manufacturer: "Dymind", model: "DH26", direction: "gematologiya" },
  { name: "EIAQUANT", manufacturer: "Merilyzer", model: "EIAQUANT", direction: "ifa" },
];

/** Names are compared without case or surrounding space. */
export const deviceNameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** A log entry may not claim to have happened in the future (a minute of clock skew is allowed). */
export function occurredAtProblem(occurredAt: string, now = Date.now()): string | null {
  const t = Date.parse(occurredAt);
  if (Number.isNaN(t)) return "Vaqt noto'g'ri";
  if (t > now + 60_000) return "Xato vaqti kelajakda bo'lishi mumkin emas";
  return null;
}

export const DEVICE_HAS_LOG =
  "Bu qurilmaning xatolar jurnali bor, shuning uchun o'chirilmaydi. Uni \"Ishdan chiqqan\" deb belgilang.";
export const DEVICE_ERROR_ALREADY_RESOLVED = "Bu yozuv allaqachon hal qilingan deb belgilangan";
