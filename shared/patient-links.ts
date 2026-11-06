/**
 * The single patient identity (TZ §4.2 "Yagona bemor ID", acceptance §16.1).
 *
 * Every module reaches a patient through `patients.id` — a `patient_id`
 * column — and nothing else: not a name, not a phone, not a copied number.
 * The human-facing `patientNumber` is shown everywhere but never joined on.
 *
 * This registry is the contract a new module signs. A table with a
 * `patient_id` column must be listed here, saying what happens to its rows
 * when two duplicate cards are merged and when a card is deleted;
 * `patient-links.test.ts` fails the build for a table that is not. That is
 * what keeps a merge from leaving half a patient behind on the old card.
 */

export type PatientLinkRule = {
  /** What a merge of duplicate cards does to the rows. */
  merge: "move" | "move-keep-target-emergency" | "combine-same-day";
  /** What deleting the card does: refuse while rows exist, or remove them with it. */
  delete: "block" | "cascade";
  /** Shown when `delete` is "block". */
  label?: string;
};

export const PATIENT_LINKS = {
  patient_contacts: { merge: "move-keep-target-emergency", delete: "cascade" },
  /** A visit is only the day's envelope; without orders or appointments it holds nothing. */
  visits: { merge: "combine-same-day", delete: "cascade" },
  orders: { merge: "move", delete: "block", label: "laboratoriya buyurtmalari" },
  appointments: { merge: "move", delete: "block", label: "qabullar" },
  medical_records: { merge: "move", delete: "block", label: "ko'rik yozuvlari" },
  patient_allergies: { merge: "move", delete: "block", label: "allergiyalar" },
  referrals: { merge: "move", delete: "block", label: "yo'llanmalar" },
} as const satisfies Record<string, PatientLinkRule>;

export type PatientLinkedTable = keyof typeof PATIENT_LINKS;

export type BlockingTable = {
  [K in PatientLinkedTable]: (typeof PATIENT_LINKS)[K]["delete"] extends "block" ? K : never;
}[PatientLinkedTable];

/** The tables whose rows keep a card from being deleted. */
export const BLOCKING_TABLES = (Object.keys(PATIENT_LINKS) as PatientLinkedTable[]).filter(
  (t) => PATIENT_LINKS[t].delete === "block",
) as BlockingTable[];

/**
 * Why a card cannot be deleted, or null when it holds no history. A card with
 * history is merged into the right one instead (B2.2), never deleted.
 */
export function patientHistoryProblem(counts: Partial<Record<BlockingTable, number>>): string | null {
  const held = BLOCKING_TABLES.filter((t) => (counts[t] ?? 0) > 0).map((t) => PATIENT_LINKS[t].label);
  if (held.length === 0) return null;
  return `Bemor kartasida ${held.join(", ")} bor, uni o'chirib bo'lmaydi. Takroriy karta bo'lsa, uni asosiy kartaga birlashtiring.`;
}
