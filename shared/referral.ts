/**
 * Referral rules (TZ §5.1.4, B3.5), shared by the server and the screens.
 *
 * A referral stores only whether it is active or cancelled. Where it stands
 * beyond that is read from what fulfils it: the lab order for a lab
 * referral, the live booking for an examination or consultation.
 */
import type {
  ReferralBooking,
  ReferralKind,
  ReferralOrder,
  ReferralStage,
  ReferralStatus,
  ServiceKind,
} from "./schema";
import { REFERRAL_EXAM_SERVICE_KINDS } from "./schema";

export function referralStage(r: {
  kind: ReferralKind;
  status: ReferralStatus;
  order: Pick<ReferralOrder, "status"> | null;
  booking: Pick<ReferralBooking, "status"> | null;
}): ReferralStage {
  if (r.status === "cancelled") return "cancelled";
  if (r.kind === "lab") {
    if (!r.order || r.order.status === "cancelled") return "cancelled";
    return r.order.status === "completed" ? "done" : "in_lab";
  }
  if (!r.booking) return "awaiting_booking";
  return r.booking.status === "completed" ? "done" : "scheduled";
}

/** Still something for someone to act on. */
export const isOpenStage = (stage: ReferralStage) => stage !== "done" && stage !== "cancelled";

export const isExamServiceKind = (kind: ServiceKind) =>
  (REFERRAL_EXAM_SERVICE_KINDS as readonly string[]).includes(kind);

/**
 * Why this booking cannot fulfil the referral, or null. Checked when the desk
 * books it and when the booking is moved: an examination referral is booked
 * for exactly its service; a consultation with the doctor asked for, or —
 * when none was — any doctor of the specialty.
 */
export function referralBookingProblem(
  referral: {
    kind: ReferralKind;
    status: ReferralStatus;
    patientId: string;
    serviceId: string | null;
    targetDoctorId: string | null;
    targetSpecialty: string | null;
    serviceName?: string | null;
    targetDoctorName?: string | null;
  },
  booking: { patientId: string; doctorId: string; doctorSpecialty: string; serviceId: string | null },
): string | null {
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

/** One line naming what the referral is for: "UZI: Qorin bo'shlig'i", "Kardiolog", "3 ta tahlil". */
export function referralSubject(r: {
  kind: ReferralKind;
  serviceName: string | null;
  targetSpecialty: string | null;
  targetDoctorName: string | null;
  order: Pick<ReferralOrder, "testNames"> | null;
}): string {
  if (r.kind === "lab") {
    const names = r.order?.testNames ?? [];
    if (names.length === 0) return "Laboratoriya tahlillari";
    return names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} va yana ${names.length - 3} ta`;
  }
  if (r.kind === "exam") return r.serviceName ?? "Tekshiruv";
  return r.targetDoctorName ? `${r.targetSpecialty} · ${r.targetDoctorName}` : (r.targetSpecialty ?? "Konsultatsiya");
}
