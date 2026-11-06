/**
 * The clinic's logo on its documents (B4.7, TZ §6.3 "Klinika logotipi").
 *
 * Kept as a data URL in app_settings ("logo"), not in a file store: it is one
 * small image, every blank needs it, and the clinic has not chosen an object
 * store yet (D-3). The browser scales the upload down before sending, so what
 * arrives is a few dozen kilobytes; the server still checks it as if it came
 * from anywhere.
 *
 * Only PNG and JPEG: the two formats both the browser and jsPDF draw. SVG is
 * refused on purpose, since it can carry script.
 */

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg"] as const;
export type LogoMime = (typeof LOGO_MIME_TYPES)[number];

/** What the browser aims for when it scales an upload down. */
export const LOGO_TARGET = { width: 640, height: 240 } as const;

export type ClinicLogo = {
  dataUrl: string;
  mime: LogoMime;
  bytes: number;
  updatedAt: string;
  updatedByName: string | null;
};

const DATA_URL = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;

const MAGIC: Record<LogoMime, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

/** Decoded size of a base64 payload without decoding all of it. */
function decodedLength(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/**
 * Accepts a logo or says, in Uzbek, why not. The declared type must match the
 * file's own first bytes: a renamed file is not a PNG because it says so.
 */
export function checkLogo(dataUrl: unknown): { ok: true; mime: LogoMime; bytes: number } | { ok: false; message: string } {
  if (typeof dataUrl !== "string" || !dataUrl) return { ok: false, message: "Rasm yuborilmadi" };
  const m = DATA_URL.exec(dataUrl);
  if (!m || m[2].length % 4 !== 0) return { ok: false, message: "Faqat PNG yoki JPEG rasm yuklash mumkin" };
  const mime = m[1] as LogoMime;
  const bytes = decodedLength(m[2]);
  if (bytes > LOGO_MAX_BYTES) {
    return { ok: false, message: `Rasm juda katta: ${Math.round(bytes / 1024)} KB (ko'pi bilan ${LOGO_MAX_BYTES / 1024} KB)` };
  }
  const head = atob(m[2].slice(0, 16));
  const magic = MAGIC[mime];
  if (head.length < magic.length || magic.some((b, i) => head.charCodeAt(i) !== b)) {
    return { ok: false, message: "Fayl mazmuni rasm turiga mos emas" };
  }
  return { ok: true, mime, bytes };
}
