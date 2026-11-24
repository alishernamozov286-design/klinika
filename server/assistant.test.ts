import { describe, expect, it } from "vitest";
import { PER_MINUTE } from "@shared/assistant";
import { assistantLimit, coolDown, modelOrder, pipeSse, systemPrompt } from "./assistant";

const sse = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
const ev = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

describe("AI Hospital server", () => {
  it("passes streamed text on as it arrives, even split across network chunks", async () => {
    const whole = ev("1. \"Yangi bemor\" ") + ev("tugmasini bosing.");
    const parts: string[] = [];
    const n = await pipeSse(sse([whole.slice(0, 17), whole.slice(17, 60), whole.slice(60)]), (t) => parts.push(t), new AbortController().signal);
    expect(parts.join("")).toBe('1. "Yangi bemor" tugmasini bosing.');
    expect(n).toBe(parts.join("").length);
  });

  it("limits each person to a burst per minute", () => {
    const t = Date.UTC(2026, 10, 24, 10, 0, 5);
    for (let i = 0; i < PER_MINUTE; i++) expect(assistantLimit("u-limit", t)).toBeNull();
    expect(assistantLimit("u-limit", t)).toMatch(/daqiqadan keyin/);
    expect(assistantLimit("u-limit", t + 60_000)).toBeNull();
    expect(assistantLimit("someone-else", t)).toBeNull();
  });

  it("skips a busy model for a minute, but never runs out of models", () => {
    const now = Date.now();
    const first = modelOrder(now)[0];
    coolDown(first, now);
    expect(modelOrder(now)[0]).not.toBe(first);
    expect(modelOrder(now)).toContain(first);
    expect(modelOrder(now + 61_000)[0]).toBe(first);
  });

  it("tells the model who is asking, where, and to answer from the guide only", () => {
    const p = systemPrompt({ fullName: "Ismoilova Madina", roleName: "Kassa xodimi", permissions: ["payments.create"] }, "/cashier");
    expect(p).toContain("Kassa xodimi");
    expect(p).toContain('"Kassa" sahifasida');
    expect(p).toContain("payments.create");
    expect(p).toContain("FAQAT quyidagi qo'llanmaga");
    expect(p).toContain("To'lov qabul qilish");
  });
});
