/**
 * Write-side rules for result verification (B4.5), shared by both storage
 * backends so they refuse the same things in the same words.
 */
import { LINE_STATE_LABELS, lineState } from "@shared/lab-verification";
import { StorageConflict } from "./storage-types";

type Line = {
  id: string;
  testName: string;
  result: string | null;
  flag: string | null;
  notes: string | null;
  verifiedAt: string | null;
  returnedAt: string | null;
  enteredById?: string | null;
};

/**
 * The lines a verify or return acts on. With no ids: every line waiting for
 * review. With ids: exactly those, each of which must be waiting for review —
 * a line someone else verified or returned a moment ago is a conflict, not a
 * silent no-op.
 */
export function pickForVerification<T extends Line>(lines: T[], itemIds: string[] | null): T[] {
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

/** Why this amendment cannot be made, or null. */
export function amendProblem(
  line: Pick<Line, "verifiedAt" | "result" | "flag" | "notes">,
  input: { result: string; flag: string | null; notes: string | null },
): string | null {
  if (!line.verifiedAt) return "Faqat tasdiqlangan natija tuzatiladi. Tasdiqlanmagan natijani laborant o'zgartiradi";
  if (input.result === (line.result ?? "") && input.flag === (line.flag ?? null) && input.notes === (line.notes || null)) {
    return "Natija o'zgarmagan";
  }
  return null;
}
