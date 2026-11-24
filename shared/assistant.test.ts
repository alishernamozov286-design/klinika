import { describe, expect, it } from "vitest";
import { MAX_TURNS, isKnownPage, maskPersonal, pageName, prepareTurns, suggestionsFor, textOfEvent, typewriterStep } from "./assistant";

describe("AI Hospital rules", () => {
  it("masks phones, passports, emails and ids before anything leaves the server", () => {
    const t = maskPersonal("Bemor +998 90 123 45 67, pasport AA1234567, JShShIR 31234567890123, a.b@x.uz, id 3f2a8b1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c");
    expect(t).toBe("Bemor [raqam], pasport [pasport], JShShIR [raqam], [email], id [id]");
    // Ordinary numbers in a question stay.
    expect(maskPersonal("10% chegirma 2 kunga")).toBe("10% chegirma 2 kunga");
  });

  it("sends only the latest turns, trimmed and masked, starting with a question", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? "model" : "user") as "user" | "model", text: `xabar ${i}` }));
    const turns = prepareTurns(many);
    expect(turns.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(turns[0].role).toBe("user");
    expect(prepareTurns([{ role: "model", text: "salom" }, { role: "user", text: "  tel +998901234567  " }])).toEqual([{ role: "user", text: "tel [raqam]" }]);
    expect(prepareTurns([{ role: "user", text: "   " }])).toEqual([]);
  });

  it("names the page without ids and suggests questions for it", () => {
    expect(pageName("/patients/3f2a8b1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c")).toBe("Bemor kartasi");
    expect(pageName("/cashier?tab=bills")).toBe("Kassa");
    expect(pageName("/nowhere")).toBe("Tizim");
    expect(suggestionsFor("/cashier")[0]).toMatch(/To'lov/);
    expect(suggestionsFor("/unknown")).toHaveLength(3);
    // Only real pages become links.
    expect(isKnownPage("/cashier")).toBe(true);
    expect(isKnownPage("/patients/3f2a8b1c-1d2e-4f5a-9b8c-7d6e5f4a3b2c")).toBe(true);
    expect(isKnownPage("/cassa")).toBe(false);
  });

  it("reads the text out of a Gemini stream event, skipping thoughts", () => {
    expect(textOfEvent({ candidates: [{ content: { parts: [{ text: "Sa" }, { text: "lom" }] } }] })).toBe("Salom");
    expect(textOfEvent({ candidates: [{ content: { parts: [{ text: "o'ylash", thought: true }, { text: "javob" }] } }] })).toBe("javob");
    expect(textOfEvent({ usageMetadata: {} })).toBe("");
    expect(textOfEvent(null)).toBe("");
  });

  it("types out answers: one character a frame when trickling, faster for a big block, never past the end", () => {
    expect(typewriterStep(0)).toBe(0);
    expect(typewriterStep(1)).toBe(1);
    expect(typewriterStep(20)).toBe(1);
    expect(typewriterStep(90)).toBe(3);
    expect(typewriterStep(2000)).toBe(8);
    // A 1000-character answer that lands at once takes a couple of seconds at 60 frames a second.
    let left = 1000;
    let frames = 0;
    while (left > 0) {
      left -= typewriterStep(left);
      frames++;
    }
    expect(frames / 60).toBeGreaterThan(1.5);
    expect(frames / 60).toBeLessThan(5);
  });
});
