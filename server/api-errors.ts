/**
 * What an API failure tells the client (B8.7). Validation and the app's own
 * refusals are written for the user, in Uzbek, and pass through; a database's
 * own error never does — it names tables, constraints and columns — nor does a
 * driver's connection failure. Those are logged, and the client gets a plain
 * message with the right status.
 */
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { StorageConflict } from "./storage-types";

export type ApiErrorResponse = { status: number; message: string; log?: boolean };

export const INTERNAL_ERROR = "Ichki xatolik. Keyinroq urinib ko'ring";

export function apiErrorResponse(err: unknown): ApiErrorResponse | null {
  if (err instanceof ZodError) return { status: 400, message: fromZodError(err).toString() };
  if (err instanceof StorageConflict) return { status: 409, message: err.message };
  const e = err as { code?: unknown; type?: unknown; name?: unknown; message?: unknown } | null;
  // A table from a newer release that this database has not been migrated to.
  if (e?.code === "42P01") {
    return { status: 503, message: "Ma'lumotlar bazasi yangilanmagan. Administrator migratsiyalarni ishga tushirishi kerak (npm run db:upgrade).", log: true };
  }
  // The JSON body parser's own refusals keep their status, in Uzbek.
  if (e?.type === "entity.too.large") return { status: 413, message: "So'rov hajmi juda katta" };
  if (e?.type === "entity.parse.failed") return { status: 400, message: "So'rov ma'lumoti noto'g'ri (JSON)" };
  // A database's own error: an SQLSTATE code.
  if (typeof e?.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) {
    switch (e.code) {
      case "23505":
        return { status: 409, message: "Bunday yozuv allaqachon bor", log: true };
      case "23503":
        return { status: 409, message: "Bog'liq yozuv topilmadi yoki u boshqa yozuvlarda ishlatilmoqda", log: true };
      case "23514":
      case "23502":
      case "22P02":
      case "22001":
        return { status: 400, message: "Ma'lumot talablarga mos emas", log: true };
      case "40001":
      case "40P01":
        return { status: 409, message: "Bir vaqtda boshqa o'zgarish bo'ldi — qayta urinib ko'ring", log: true };
      default:
        return { status: 500, message: INTERNAL_ERROR, log: true };
    }
  }
  if (err instanceof Error) {
    // The database driver could not be reached.
    if (/neon|fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection terminated/i.test(`${err.name} ${err.message}`)) {
      return { status: 503, message: "Ma'lumotlar bazasi bilan aloqa yo'q. Keyinroq urinib ko'ring", log: true };
    }
    // The app's own refusals (storage rules), written for the user.
    return { status: 400, message: err.message };
  }
  return null;
}
