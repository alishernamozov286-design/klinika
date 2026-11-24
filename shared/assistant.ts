/**
 * AI Hospital — the in-app assistant: staff ask how to do something in the
 * system ("bemorni qanday qo'shaman?", "to'lovni qanday qabul qilaman?") and
 * get steps for their own role and page.
 *
 * It explains; it never acts. It does not read the clinic's data, and what a
 * person types is stripped of phone numbers, document numbers, emails and ids
 * before it leaves the server — a patient's identity must not reach an
 * outside AI service.
 */

export type AssistantRole = "user" | "model";
export type AssistantMessage = { role: AssistantRole; text: string };
export type AssistantRequest = { messages: AssistantMessage[]; page: string };
export type AssistantStatus = { enabled: boolean; name: string };

export const ASSISTANT_NAME = "AI Hospital";
/** Only the latest turns travel with a question; older ones add cost, not help. */
export const MAX_TURNS = 12;
export const MAX_MESSAGE_CHARS = 2000;
/** Per person: a burst limit and a day limit (in-memory, per server instance). */
export const PER_MINUTE = 12;
export const PER_DAY = 300;

/**
 * Personal identifiers out of free text: phone numbers, passport series,
 * JShShIR (14 digits), card-like digit runs, emails, ids. Names cannot be
 * recognised reliably — the panel asks people not to type them.
 */
export function maskPersonal(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b[A-Z]{2}\s?\d{7}\b/g, "[pasport]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[raqam]");
}

/** The turns that go to the model: the last MAX_TURNS, each trimmed and masked, starting with a question. */
export function prepareTurns(messages: readonly AssistantMessage[]): AssistantMessage[] {
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, text: maskPersonal(m.text.trim().slice(0, MAX_MESSAGE_CHARS)) }));
  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}

/** Page path → its name, for "you are on …" (ids dropped). */
export const PAGE_NAMES: Record<string, string> = {
  "/home": "Bosh sahifa",
  "/patients": "Bemorlar",
  "/patients/:id": "Bemor kartasi",
  "/orders": "Buyurtmalar",
  "/results": "Natijalar",
  "/queue": "Navbat",
  "/cabinet": "Mening kabinetim",
  "/cabinet/visit/:id": "Ko'rik oynasi",
  "/inpatient": "Statsionar",
  "/inpatient/stays/:id": "Kasallik tarixi",
  "/cashier": "Kassa",
  "/inventory": "Ombor",
  "/qc": "Sifat nazorati",
  "/reports": "Hisobotlar",
  "/expenses": "Xarajatlar",
  "/doctors": "Shifokorlar",
  "/departments": "Bo'limlar",
  "/services": "Xizmatlar",
  "/devices": "Analizatorlar",
  "/staff": "Xodimlar",
  "/settings": "Sozlamalar",
};

/** True for a path the app has (an id segment allowed) — only those become clickable links. */
export function isKnownPage(path: string): boolean {
  const clean = path.split(/[?#]/)[0].replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, "/:id");
  return clean in PAGE_NAMES;
}

export function pageName(path: string): string {
  const clean = path.split("?")[0].replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:id");
  return PAGE_NAMES[clean] ?? "Tizim";
}

/** Starter questions per page (the empty chat shows them). */
export function suggestionsFor(path: string): string[] {
  const p = pageName(path);
  const common = ["Bu sahifada nima qilsa bo'ladi?"];
  const byPage: Record<string, string[]> = {
    Bemorlar: ["Yangi bemorni qanday qo'shaman?", "Takroriy kartani qanday birlashtiraman?"],
    "Bemor kartasi": ["Bemorni qabulga qanday yozaman?", "Tahlil buyurtmani qanday beraman?"],
    Navbat: ["Bemorni qabulga qanday yozaman?", "Bemor kelganini qanday belgilayman?"],
    "Mening kabinetim": ["Keyingi bemorni qanday chaqiraman?", "Ko'rikni qanday tasdiqlayman?"],
    "Ko'rik oynasi": ["Tahlilga yo'llanmani qanday beraman?", "Davolashni qanday yozaman?"],
    Buyurtmalar: ["Tahlil buyurtmani qanday yarataman?", "Buyurtmani qanday bekor qilaman?"],
    Natijalar: ["Natijani qanday kiritaman?", "Natijani qanday tasdiqlayman?"],
    Kassa: ["To'lovni qanday qabul qilaman?", "Smenani qanday yopaman?"],
    Statsionar: ["Bemorni qanday yotqizaman?", "Dozani qanday belgilayman?"],
    "Kasallik tarixi": ["Epikrizni qanday yozaman?", "Bemorni qanday chiqaraman?"],
    Ombor: ["Kirimni qanday kiritaman?", "Inventarizatsiyani qanday o'tkazaman?"],
    "Sifat nazorati": ["QC natijasini qanday kiritaman?", "Westgard ogohlantirishi nimani bildiradi?"],
    Hisobotlar: ["Oylik tushumni qanday ko'raman?", "Hisobotni Excelga qanday olaman?"],
    Xarajatlar: ["Xarajatni qanday kiritaman?"],
    Sozlamalar: ["Parolni qanday almashtiraman?", "2FA ni qanday yoqaman?"],
  };
  return [...(byPage[p] ?? ["Yangi bemorni qanday qo'shaman?", "To'lovni qanday qabul qilaman?"]), ...common].slice(0, 3);
}

/** Text pieces out of one Gemini SSE event's JSON (`data: {...}`); empty when it carries none. */
export function textOfEvent(json: unknown): string {
  const c = (json as { candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[] } | null)?.candidates?.[0];
  return (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text as string).join("");
}
