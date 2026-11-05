/**
 * Two-factor sign-in core (TZ §12): TOTP codes (RFC 6238, the scheme Google
 * Authenticator, Microsoft Authenticator and every other authenticator app
 * speak), the encryption of the stored secret, and one-time recovery codes.
 *
 * Written on node:crypto rather than pulled from a package: the algorithm is
 * forty lines, and this is the code that decides who gets into a medical
 * system — better to own every line of it than to audit someone else's.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_S = 30;
/** Codes one step either side are accepted: phone clocks drift. */
export const TOTP_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 10;
export const MFA_ISSUER = "NEOGEN CLINIC";

// ------------------------------------------------------------------ base32

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Base32 kalit noto'g'ri");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// -------------------------------------------------------------------- TOTP

/** A fresh 160-bit secret (the size RFC 4226 recommends), base32 for the apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** RFC 4226 HOTP. */
export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_PERIOD_S);

export function totpAt(secret: string, timeMs: number, digits = TOTP_DIGITS): string {
  return hotp(base32Decode(secret), totpStep(timeMs), digits);
}

const sameString = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The step the code belongs to, or null. Steps at or before `lastUsedStep`
 * are refused, so an accepted code cannot be used a second time.
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: { now?: number; lastUsedStep?: number } = {},
): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const key = base32Decode(secret);
  const current = totpStep(opts.now ?? Date.now());
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = current + delta;
    if (step <= (opts.lastUsedStep ?? 0)) continue;
    if (sameString(hotp(key, step), digits)) return step;
  }
  return null;
}

/** The otpauth:// link an authenticator app reads from the QR code. */
export function otpauthUrl(account: string, secret: string, issuer = MFA_ISSUER): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_S),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// -------------------------------------------------------------- encryption

/**
 * The key that encrypts stored secrets. MFA_ENCRYPTION_KEY when set; else
 * derived from SESSION_SECRET, which every deployment already has to keep
 * secret. Changing it makes stored secrets unreadable — everyone then
 * re-enrols (an admin resets 2FA from the staff list).
 */
function encryptionKey(): Buffer {
  const material =
    process.env.MFA_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "medlab-dev-secret-change-in-production";
  return createHash("sha256").update(`neogen-mfa:${material}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>", base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Null when the value was encrypted with another key or tampered with. */
export function decryptSecret(stored: string): string | null {
  const [version, iv, tag, ct] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !ct) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------- recovery codes

/** No 0/O, 1/I/L: these get read off paper. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`neogen-recovery:${normalizeRecoveryCode(code)}`).digest("hex");
}

/** "ABCD-EFGH" ×10 — shown once; only the hashes are stored. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  while (codes.length < count) {
    let raw = "";
    for (let i = 0; i < 8; i++) raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

/** Six digits → an app code; anything else is treated as a recovery code. */
export function looksLikeTotp(code: string): boolean {
  return /^\d{6}$/.test(code.replace(/\s/g, ""));
}

export type MfaCheck =
  | { ok: true; kind: "totp"; step: number }
  | { ok: true; kind: "recovery"; hash: string }
  | { ok: false; reason: "invalid" | "unreadable" };

/**
 * Checks a code against a stored enrolment without consuming it — the caller
 * then consumes the step or the recovery code atomically in storage, which is
 * what actually stops two parallel requests using the same code.
 */
export function checkMfaCode(
  record: { secret: string; lastUsedStep: number; recoveryCodes: string[] },
  code: string,
  now = Date.now(),
): MfaCheck {
  if (looksLikeTotp(code)) {
    const secret = decryptSecret(record.secret);
    if (!secret) return { ok: false, reason: "unreadable" };
    const step = verifyTotp(secret, code, { now, lastUsedStep: record.lastUsedStep });
    return step === null ? { ok: false, reason: "invalid" } : { ok: true, kind: "totp", step };
  }
  if (normalizeRecoveryCode(code).length !== 8) return { ok: false, reason: "invalid" };
  const hash = hashRecoveryCode(code);
  return record.recoveryCodes.some((h) => sameString(h, hash))
    ? { ok: true, kind: "recovery", hash }
    : { ok: false, reason: "invalid" };
}
