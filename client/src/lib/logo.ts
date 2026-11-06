/**
 * Turns whatever image the clinic picks into a logo the server accepts
 * (B4.7, shared/branding.ts): decoded by the browser, scaled to fit
 * LOGO_TARGET without enlarging, and re-encoded. Re-encoding also strips
 * whatever else the file carried (EXIF, colour profiles, trailing data).
 *
 * PNG first, since logos are mostly flat colour with transparency; a photo
 * that comes out too large as PNG is retried as JPEG on white.
 */
import { LOGO_MAX_BYTES, LOGO_TARGET, checkLogo } from "@shared/branding";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_ACCEPT = ACCEPTED.join(",");

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareLogo(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("PNG, JPEG yoki WebP rasm tanlang");
  // A sane ceiling on what we even try to decode.
  if (file.size > 10 * 1024 * 1024) throw new Error("Fayl juda katta (10 MB dan oshmasin)");

  let img: HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    throw new Error("Rasmni o'qib bo'lmadi");
  }
  if (!img.naturalWidth || !img.naturalHeight) throw new Error("Rasmni o'qib bo'lmadi");

  const scale = Math.min(1, LOGO_TARGET.width / img.naturalWidth, LOGO_TARGET.height / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brauzer rasmni qayta ishlay olmadi");
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, 0, 0, w, h);
  const png = canvas.toDataURL("image/png");
  if (checkLogo(png).ok) return png;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL("image/jpeg", 0.88);
  const checked = checkLogo(jpeg);
  if (checked.ok) return jpeg;
  throw new Error(`Rasmni ${LOGO_MAX_BYTES / 1024} KB gacha kichraytirib bo'lmadi`);
}

