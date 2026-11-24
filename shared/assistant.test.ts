import { describe, expect, it } from "vitest";
import { MAX_TURNS, isKnownPage, maskPersonal, pageName, prepareTurns, suggestionsFor, textOfEvent } from "./assistant";

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
});
