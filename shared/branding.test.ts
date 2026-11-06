import { describe, expect, it } from "vitest";
import { LOGO_MAX_BYTES, checkLogo } from "./branding";

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49];

describe("checkLogo", () => {
  it("accepts PNG and JPEG whose bytes match the declared type", () => {
    expect(checkLogo(`data:image/png;base64,${b64(PNG)}`)).toEqual({ ok: true, mime: "image/png", bytes: PNG.length });
    expect(checkLogo(`data:image/jpeg;base64,${b64(JPEG)}`)).toMatchObject({ ok: true, mime: "image/jpeg", bytes: JPEG.length });
  });

  it("refuses other types, SVG included, and broken payloads", () => {
    expect(checkLogo(`data:image/svg+xml;base64,${btoa("<svg/>")}`).ok).toBe(false);
    expect(checkLogo(`data:image/gif;base64,${b64([0x47, 0x49, 0x46, 0x38])}`).ok).toBe(false);
    expect(checkLogo("https://example.com/logo.png").ok).toBe(false);
    expect(checkLogo(`data:image/png;base64,${b64(PNG)}x`).ok).toBe(false);
    expect(checkLogo(null).ok).toBe(false);
  });

  it("refuses a file whose bytes do not match its label", () => {
    expect(checkLogo(`data:image/png;base64,${b64(JPEG)}`)).toEqual({ ok: false, message: "Fayl mazmuni rasm turiga mos emas" });
  });

  it("refuses anything over the size limit", () => {
    const big = new Array(LOGO_MAX_BYTES + 3).fill(0);
    PNG.forEach((b, i) => (big[i] = b));
    let s = "";
    for (let i = 0; i < big.length; i += 3000) s += String.fromCharCode(...big.slice(i, i + 3000));
    const r = checkLogo(`data:image/png;base64,${btoa(s)}`);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/juda katta/);
  });
});
