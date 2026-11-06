/**
 * Natija shifokorga (TZ §11 "Laboratoriya → Shifokorlar: tasdiqlangan
 * natija", acceptance 16.4; B3.9).
 *
 * When the lab head releases an order that came from a doctor's referral,
 * that doctor is told — once — and the values already sit in their
 * examination window and the patient's medical card. A correction after
 * release is a new, separate notice: the doctor may have acted on the old value.
 *
 * Never throws: telling the doctor is a consequence of the verification, not
 * part of it, and must not undo it.
 */
import type { OrderWithDetails } from "@shared/schema";
import { isOrderReleased } from "@shared/lab-verification";
import { storage } from "./storage";
import { log } from "./logger";

export async function notifyOrderingDoctor(
  order: OrderWithDetails,
  event: { kind: "released" } | { kind: "amended"; testName: string; from: string | null; to: string },
): Promise<boolean> {
  try {
    if (!order.referralId || !isOrderReleased(order)) return false;
    const referral = await storage.getReferral(order.referralId);
    if (!referral?.doctorUserId) return false;

    const patient = `№${referral.patientNumber} ${referral.patientName}`;
    const abnormal = order.items.filter((i) => i.flag === "low" || i.flag === "high");
    const link = referral.appointmentId ? `/cabinet/visit/${referral.appointmentId}` : `/patients/${referral.patientId}`;

    const notice =
      event.kind === "released"
        ? {
            kind: "lab_result" as const,
            title: `Tahlil natijalari tayyor: ${patient}`,
            body: [
              `Yo'llanma №${referral.referralNumber} · buyurtma #${order.orderNumber}`,
              order.items.map((i) => i.testName).join(", "),
              abnormal.length ? `${abnormal.length} tasi me'yordan tashqarida: ${abnormal.map((i) => i.testName).join(", ")}` : "Hammasi me'yorda",
            ].join("\n"),
            important: abnormal.length > 0,
            dedupeKey: `lab_result:${order.id}`,
          }
        : {
            kind: "lab_result_amended" as const,
            title: `Natija tuzatildi: ${patient}`,
            body: `Yo'llanma №${referral.referralNumber} · ${event.testName}: ${event.from ?? "—"} → ${event.to}`,
            important: true,
            dedupeKey: null,
          };

    return await storage.createNotification({
      userId: referral.doctorUserId,
      link,
      entityId: order.id,
      ...notice,
    });
  } catch (err) {
    log(`[notify] #${order.orderNumber}: shifokorga xabar yuborilmadi — ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
