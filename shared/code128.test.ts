import { describe, expect, it } from "vitest";
import { CODE128_PATTERNS, code128Modules, code128Symbols, isCode128B } from "./code128";

// Golden strings produced by an independent encoder (python-barcode 0.15, code set B).
const GOLDEN: [string, string][] = [
  ["LAB-1-Z", "1101001000010001101110101000110001000101100010011011100100111001101001101110011101100010110010001001100011101011"],
  ["Hello World!", "11010010000110001010001011001000011001010000110010100001000111101011011001100111010001101000111101010010011110110010100001000010011011001101100111010001101100011101011"],
];

describe("Code 128 B (B4.3, TZ §2)", () => {
  it("matches an independent encoder", () => {
    for (const [text, modules] of GOLDEN) expect(code128Modules(text)).toBe(modules);
  });

  it("has 107 well-formed symbols", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
    for (const p of CODE128_PATTERNS.slice(0, 106)) expect([...p].reduce((s, d) => s + Number(d), 0)).toBe(11);
    expect([...CODE128_PATTERNS[106]].reduce((s, d) => s + Number(d), 0)).toBe(13);
  });

  it("frames the data with start B, a mod-103 check and stop", () => {
    const s = code128Symbols("LAB-1042-E");
    expect(s[0]).toBe(104);
    expect(s.at(-1)).toBe(106);
    const data = s.slice(1, -2);
    expect(s.at(-2)).toBe((104 + data.reduce((sum, v, i) => sum + v * (i + 1), 0)) % 103);
  });

  it("refuses what set B cannot write", () => {
    expect(isCode128B("LAB-1042-E")).toBe(true);
    expect(isCode128B("Лаб")).toBe(false);
    expect(() => code128Symbols("")).toThrow();
  });
});
