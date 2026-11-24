/**
 * AI Hospital (rules: shared/assistant.ts) — the server side.
 *
 *   (signed in)  GET  /api/assistant/status  — is it switched on (GEMINI_API_KEY set)
 *   (signed in)  POST /api/assistant/chat    — a question; the answer streams back as plain text
 *
 * The key stays here; the browser never sees it. What goes to Gemini: the
 * guide, the person's role and page, and the conversation with personal
 * identifiers masked — never the clinic's records. Nothing of the
 * conversation is stored or logged on the server.
 *
 * Models are tried in order: a busy (503), rate-limited (429) or retired (404)
 * one, or one that does not start answering in time, hands over to the next.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { ASSISTANT_NAME, MAX_MESSAGE_CHARS, PER_DAY, PER_MINUTE, pageName, prepareTurns, textOfEvent, type AssistantStatus } from "@shared/assistant";
import { requireAuth } from "./auth";
import { SYSTEM_GUIDE } from "./assistant-guide";

const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.6-flash"];
/** A model that was busy or gone is skipped for a minute, so the next question does not wait on it again. */
const COOLDOWN_MS = 60_000;
const cooling = new Map<string, number>();
const FIRST_TOKEN_MS = 20_000;
const TOTAL_MS = 60_000;
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const apiKey = () => process.env.GEMINI_API_KEY?.trim() || null;
export function modelOrder(now = Date.now()): string[] {
  const all = (process.env.GEMINI_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean).concat(DEFAULT_MODELS).filter((m, i, a) => a.indexOf(m) === i);
  const ready = all.filter((m) => (cooling.get(m) ?? 0) <= now);
  // All cooling: try them anyway, in order — better a slow answer than none.
  return ready.length ? [...ready, ...all.filter((m) => !ready.includes(m))] : all;
}
export function coolDown(model: string, now = Date.now()): void {
  cooling.set(model, now + COOLDOWN_MS);
}

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(MAX_MESSAGE_CHARS * 2) }))
    .min(1)
    .max(60),
  page: z.string().max(200).default("/home"),
});

// ------------------------------------------------------------ limits

const usage = new Map<string, { minute: number; minuteCount: number; day: string; dayCount: number }>();
/** Null when allowed; otherwise the refusal. */
export function assistantLimit(userId: string, now = Date.now()): string | null {
  const minute = Math.floor(now / 60_000);
  const day = new Date(now).toISOString().slice(0, 10);
  const u = usage.get(userId) ?? { minute, minuteCount: 0, day, dayCount: 0 };
  if (u.minute !== minute) Object.assign(u, { minute, minuteCount: 0 });
  if (u.day !== day) Object.assign(u, { day, dayCount: 0 });
  if (u.minuteCount >= PER_MINUTE) return "Juda ko'p savol — bir daqiqadan keyin qayta urinib ko'ring.";
  if (u.dayCount >= PER_DAY) return "Bugungi savollar chegarasiga yetdingiz. Ertaga davom etamiz.";
  u.minuteCount++;
  u.dayCount++;
  usage.set(userId, u);
  if (usage.size > 5000) usage.clear();
  return null;
}

// ------------------------------------------------------------ the prompt

export function systemPrompt(user: { fullName: string; roleName: string; permissions: readonly string[] }, page: string): string {
  return `Siz "${ASSISTANT_NAME}" — NEOGEN CLINIC klinikasi boshqaruv tizimining ichki yordamchisisiz.
Vazifangiz: xodimlarga tizimdan qanday foydalanishni tushuntirish (qaysi sahifa, qaysi tugma, qanday tartibda), shuningdek ularning ishiga oid umumiy savollarga qisqa javob berish.

Suhbatdosh: ${user.fullName}, roli — ${user.roleName}. Uning huquqlari (texnik nomlar): ${user.permissions.join(", ") || "yo'q"}.
U hozir "${pageName(page)}" sahifasida.

Qoidalar:
1. Faqat o'zbek tilida (lotin yozuvida) javob bering, agar foydalanuvchi boshqa tilda yozmasa.
2. Tizim haqidagi javoblarni FAQAT quyidagi qo'llanmaga asoslang. Qo'llanmada yo'q tugma, sahifa yoki imkoniyatni o'ylab topmang; bilmasangiz shunday deng va administrator yoki rahbarga murojaat qilishni maslahat bering.
3. Qisqa va amaliy bo'ling: ko'pincha 3–7 qadamli raqamlangan ro'yxat. Tugma va tab nomlarini qo'shtirnoqda, aynan qo'llanmadagidek yozing.
4. Foydalanuvchining roli bu ishni qila olmasa, buni ochiq ayting va kim qilishini ko'rsating.
5. Sahifaga havola berish mumkin: [Bemorlar](/patients) ko'rinishida (faqat qo'llanmadagi yo'llar).
6. Siz tizimda hech narsa qila olmaysiz va bemorlar ma'lumotini ko'rmaysiz — buni so'rashsa, qanday qilishni o'rgating.
7. Faqat foydalanuvchi bemorning shaxsiy ma'lumotini (ism, telefon, hujjat) yozgan bo'lsa, bir gap bilan uni yozmaslikni eslating va takrorlamang; aks holda bu haqda gapirmang.
8. Tashxis qo'yish yoki davolash tayinlash bo'yicha qaror bermang — klinik qaror shifokorniki; umumiy ma'lumot berish mumkin.
9. O'zingizni faqat "sen kimsan" kabi savolga tanishtiring: "${ASSISTANT_NAME} — klinika tizimi bo'yicha yordamchi". Boshqa javoblarni salomlashish yoki tanishtirishsiz, to'g'ridan-to'g'ri mazmundan boshlang.

=== QO'LLANMA ===
${SYSTEM_GUIDE}`;
}

// ------------------------------------------------------------ the call

type Attempt = { ok: true; body: ReadableStream<Uint8Array>; model: string; abort: AbortController } | { ok: false; retry: boolean; message: string };

async function open(model: string, key: string, payload: unknown): Promise<Attempt> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FIRST_TOKEN_MS);
  try {
    const r = await fetch(`${API}/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!r.ok || !r.body) {
      const err = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, retry: [404, 429, 500, 503].includes(r.status), message: `${model}: ${r.status} ${err?.error?.message?.slice(0, 160) ?? ""}` };
    }
    clearTimeout(timer);
    return { ok: true, body: r.body, model, abort };
  } catch (e) {
    return { ok: false, retry: true, message: `${model}: ${(e as Error).name === "AbortError" ? "javob kelmadi" : (e as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads Gemini's SSE stream and hands each piece of text on. Returns the characters written. */
export async function pipeSse(body: ReadableStream<Uint8Array>, write: (text: string) => void, signal: AbortSignal): Promise<number> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let written = 0;
  const flush = (block: string) => {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const t = textOfEvent(JSON.parse(line.slice(5).trim()));
        if (t) {
          write(t);
          written += t.length;
        }
      } catch {
        // a partial or keep-alive line
      }
    }
  };
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      flush(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
  }
  if (buf.trim()) flush(buf);
  return written;
}

export function registerAssistantRoutes(app: Express) {
  app.get("/api/assistant/status", requireAuth, (_req, res) => {
    const status: AssistantStatus = { enabled: Boolean(apiKey()), name: ASSISTANT_NAME };
    res.json(status);
  });

  app.post("/api/assistant/chat", requireAuth, async (req: Request, res: Response) => {
    const key = apiKey();
    if (!key) return res.status(503).json({ message: "AI yordamchi hali sozlanmagan (GEMINI_API_KEY yo'q). Administratorga murojaat qiling." });
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Savol noto'g'ri yuborildi" });
    const turns = prepareTurns(parsed.data.messages);
    if (!turns.length || turns[turns.length - 1].role !== "user") return res.status(400).json({ message: "Savolni yozing" });
    const limited = assistantLimit(req.user!.id);
    if (limited) return res.status(429).json({ message: limited });

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt({ fullName: req.user!.fullName, roleName: req.user!.roleName ?? req.user!.role, permissions: req.user!.permissions ?? [] }, parsed.data.page) }] },
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    // The person may close the panel mid-answer: stop paying for it.
    const gone = new AbortController();
    res.on("close", () => gone.abort());
    const failures: string[] = [];
    for (const model of modelOrder()) {
      if (gone.signal.aborted) return;
      const a = await open(model, key, payload);
      if (!a.ok) {
        failures.push(a.message);
        if (a.retry) {
          coolDown(model);
          continue;
        }
        break;
      }
      gone.signal.addEventListener("abort", () => a.abort.abort());
      const hardStop = setTimeout(() => a.abort.abort(), TOTAL_MS);
      let started = false;
      try {
        const n = await pipeSse(
          a.body,
          (text) => {
            if (!started) {
              started = true;
              res.status(200);
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.setHeader("X-Accel-Buffering", "no");
              res.setHeader("X-Assistant-Model", a.model);
            }
            res.write(text);
          },
          a.abort.signal,
        );
        if (n > 0) return void res.end();
        failures.push(`${model}: bo'sh javob`);
      } catch (e) {
        if (started) return void res.end("\n\n_(Javob uzildi — qayta so'rab ko'ring.)_");
        failures.push(`${model}: ${(e as Error).message}`);
      } finally {
        clearTimeout(hardStop);
      }
    }
    // Only which models refused and why (no question text) — for whoever runs the system.
    console.warn("[assistant] javob olinmadi:", failures.join(" | "));
    if (!res.headersSent) res.status(503).json({ message: "AI xizmati hozir band. Birozdan keyin qayta urinib ko'ring." });
  });
}
