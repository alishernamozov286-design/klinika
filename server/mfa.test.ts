import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  checkMfaCode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  hotp,
  otpauthUrl,
  totpAt,
  totpStep,
  verifyTotp,
} from "./mfa";

// RFC 6238 Appendix B: SHA-1 key "12345678901234567890". The RFC lists
// 8-digit codes; a 6-digit code is the same value's last six digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC test vectors", () => {
    for (const [t, code] of RFC_VECTORS) {
      expect(totpAt(RFC_SECRET, t * 1000, 8)).toBe(code);
      expect(totpAt(RFC_SECRET, t * 1000)).toBe(code.slice(-6));
    }
  });

  it("matches RFC 4226 HOTP vectors", () => {
    const key = Buffer.from("12345678901234567890");
    expect(hotp(key, 0)).toBe("755224");
    expect(hotp(key, 9)).toBe("520489");
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 64]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts one step of clock drift and no more", () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = (s: number) => hotp(base32Decode(RFC_SECRET), s);
    expect(verifyTotp(RFC_SECRET, code(step), { now })).toBe(step);
    expect(verifyTotp(RFC_SECRET, code(step - 1), { now })).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, code(step + 1), { now })).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, code(step - 2), { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", { now })).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", { now })).toBeNull();
  });

  it("refuses a code from a step already used (replay)", () => {
    const now = 1_700_000_000_000;
    const step = totpStep(now);
    const code = hotp(base32Decode(RFC_SECRET), step);
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step })).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, { now, lastUsedStep: step - 1 })).toBe(step);
  });

  it("builds an otpauth link the apps understand", () => {
    const url = otpauthUrl("admin", "ABC");
    expect(url).toMatch(/^otpauth:\/\/totp\/NEOGEN%20CLINIC%3Aadmin\?/);
    expect(url).toContain("secret=ABC");
    expect(url).toContain("digits=6");
  });
});

describe("secret encryption", () => {
  it("round-trips and never stores the plain secret", () => {
    const secret = generateTotpSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(decryptSecret(stored)).toBe(secret);
    // Fresh IV each time.
    expect(encryptSecret(secret)).not.toBe(stored);
  });

  it("rejects tampered or foreign values", () => {
    const stored = encryptSecret("SECRET");
    const parts = stored.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decryptSecret(parts.join("."))).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
  });
});

describe("recovery codes", () => {
  it("are unique, readable and stored only as hashes", () => {
    const { codes, hashes } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(hashes[0]).toBe(hashRecoveryCode(codes[0]));
    expect(hashes[0]).not.toContain(codes[0]);
  });

  it("forgive case, spaces and dashes", () => {
    expect(hashRecoveryCode("abcd efgh")).toBe(hashRecoveryCode("ABCD-EFGH"));
  });
});

describe("checkMfaCode", () => {
  const secret = generateTotpSecret();
  const { codes, hashes } = generateRecoveryCodes();
  const record = { secret: encryptSecret(secret), lastUsedStep: 0, recoveryCodes: hashes };

  it("accepts the current app code", () => {
    const now = Date.now();
    const res = checkMfaCode(record, totpAt(secret, now), now);
    expect(res).toEqual({ ok: true, kind: "totp", step: totpStep(now) });
  });

  it("accepts a recovery code and reports which one", () => {
    expect(checkMfaCode(record, codes[3].toLowerCase())).toEqual({ ok: true, kind: "recovery", hash: hashes[3] });
  });

  it("rejects wrong codes", () => {
    expect(checkMfaCode(record, "ZZZZ-ZZZZ").ok).toBe(false);
    expect(checkMfaCode(record, "000000", 0).ok).toBe(false);
    expect(checkMfaCode(record, "x").ok).toBe(false);
  });

  it("reports a secret it cannot decrypt instead of throwing", () => {
    expect(checkMfaCode({ ...record, secret: "v1.a.b.c" }, "123456")).toEqual({ ok: false, reason: "unreadable" });
  });
});
