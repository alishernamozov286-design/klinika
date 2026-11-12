/**
 * Reagent sarfi (TZ §11 "Laboratoriya → Ombor: reagent sarfi", B5.6).
 *
 * Verifying a result line means the test was done: the approved norms then
 * in force are consumed from the warehouse. This runs after the verification
 * and never throws — the warehouse must never hold back a patient's result.
 * Anything missed here (an error, a deploy before the migration) is picked
 * up by "Qayta hisoblash" (POST /api/consumption/reconcile): every verified
 * line is consumed exactly once, whichever path gets there first.
 */
import type { LabConsumptionView } from "@shared/schema";
import { clockNow } from "@shared/appointment";
import { storage } from "./storage";
import type { Actor } from "./storage-types";
import { log } from "./logger";

export async function consumeForOrder(orderId: string, orderNumber: number, actor: Actor): Promise<LabConsumptionView[]> {
  try {
    return await storage.consumeVerified({ orderId }, clockNow().date, actor);
  } catch (err) {
    log(`[sarf] #${orderNumber}: reagent sarfi yozilmadi, "Qayta hisoblash" yozadi — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
