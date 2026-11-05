/**
 * Telling whether a patient being registered is someone already on file
 * (TZ §4.2 "takroriy bemorlarni aniqlash").
 *
 * One person with two cards is the classic registry failure: results land on
 * one card, the doctor opens the other, the history looks empty. So matches are
 * graded. A *strong* match (same national ID, same passport, same name with the
 * same phone or birth date) stops the save until the registrar confirms it is
 * really someone else. A *weak* one (same phone only — families share one —
 * or same name only) is shown but does not block.
 */

/** Uzbek Cyrillic to the official Latin alphabet, enough to compare names. */
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g'", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", ў: "o'", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "x", ҳ: "h", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * A comparable form of a full name: lower case, Latin, apostrophe variants
 * dropped, spacing collapsed. "Алиев  Вали" and "aliyev vali" do not become
 * equal (that would need fuzzy matching), but "G‘ofurov" and "Gʻofurov" do,
 * and so do the Cyrillic and Latin spellings of the same letters.
 */
export function nameKey(name: string | null | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .split("")
    .map((c) => CYR[c] ?? c)
    .join("")
    .replace(/[‘’ʻʼ'`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Surname plus given name — the part people do not write differently. */
export function shortNameKey(name: string | null | undefined): string {
  return nameKey(name).split(" ").slice(0, 2).join(" ");
}

/** "aa 1234567" / "AA-1234567" → "AA1234567". */
export function normalizePassport(value: string | null | undefined): string | null {
  const v = (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return v || null;
}

/** JShShIR (PINFL): exactly 14 digits. */
export function normalizePinfl(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\D/g, "");
  return v || null;
}

export type IdentityInput = {
  fullName?: string | null;
  phoneDigits?: string | null;
  birthDate?: string | null;
  passport?: string | null;
  pinfl?: string | null;
};

export type IdentityRecord = {
  fullName: string;
  phoneDigits: string;
  birthDate: string | null;
  passport: string | null;
  pinfl: string | null;
};

export type MatchStrength = "strong" | "weak";

export type IdentityMatch = { strength: MatchStrength; reasons: string[] };

/**
 * How `candidate` relates to what is being typed, or null when it does not.
 * Reasons are written for the registrar, in the order they matter.
 */
export function compareIdentity(input: IdentityInput, candidate: IdentityRecord): IdentityMatch | null {
  const strong: string[] = [];
  const weak: string[] = [];

  const pinfl = normalizePinfl(input.pinfl);
  const passport = normalizePassport(input.passport);
  const sameName = Boolean(input.fullName) && shortNameKey(input.fullName) === shortNameKey(candidate.fullName);
  const samePhone =
    (input.phoneDigits ?? "").length === 9 && input.phoneDigits === candidate.phoneDigits;
  const sameBirth = Boolean(input.birthDate) && input.birthDate === candidate.birthDate;

  if (pinfl && pinfl === normalizePinfl(candidate.pinfl)) strong.push("JShShIR bir xil");
  if (passport && passport === normalizePassport(candidate.passport)) strong.push("Pasport bir xil");
  if (sameName && samePhone) strong.push("Ism va telefon bir xil");
  if (sameName && sameBirth) strong.push("Ism va tug'ilgan sana bir xil");

  if (strong.length) return { strength: "strong", reasons: strong };

  if (samePhone) weak.push("Telefon raqami bir xil");
  if (sameName) weak.push(sameBirth === false && input.birthDate && candidate.birthDate ? "Ismi bir xil, tug'ilgan sanasi boshqa" : "Ismi bir xil");
  return weak.length ? { strength: "weak", reasons: weak } : null;
}

/** Age in full years on `today` (local calendar), or null without a birth date. */
export function ageFromBirthDate(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** The age to show: from the birth date when known, else the age typed in at registration. */
export function patientAge(p: { birthDate?: string | null; age?: number | null } | null | undefined): number | null {
  return ageFromBirthDate(p?.birthDate) ?? p?.age ?? null;
}
