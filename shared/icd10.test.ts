import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { icdDisplayName, isIcdCode, normalizeIcdCode, parseNsiIcd10, parseUzNames } from "./icd10";

const rows = parseNsiIcd10(readFileSync(join(import.meta.dirname, "..", "data", "icd10", "mkb10-nsi-2.27.csv"), "utf8"));
const byCode = new Map(rows.map((r) => [r.code, r]));

describe("MKB-10 catalogue (B3.4)", () => {
  it("reads the whole NSI file with its hierarchy", () => {
    expect(rows).toHaveLength(15038);
    const count = (k: string) => rows.filter((r) => r.kind === k).length;
    expect([count("chapter"), count("block"), count("category"), count("subcategory")]).toEqual([22, 274, 2058, 12684]);
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
  });

  it("places a code in its chapter and block", () => {
    expect(byCode.get("I10")).toMatchObject({ kind: "category", chapter: "IX", block: "I10-I15", nameRu: "Эссенциальная [первичная] гипертензия", selectable: true });
    expect(byCode.get("E11.9")).toMatchObject({ kind: "subcategory", parentCode: "E11", chapter: "IV", block: "E10-E14" });
    expect(byCode.get("A00-A09")).toMatchObject({ kind: "block", chapter: "I", selectable: false });
    expect(byCode.get("I")?.kind).toBe("chapter");
  });

  it("keeps retired codes but never offers them", () => {
    const retired = byCode.get("I84")!;
    expect(retired.isActual).toBe(false);
    expect(retired.selectable).toBe(false);
    expect(rows.filter((r) => !r.isActual)).toHaveLength(101);
  });

  it("normalises what a doctor types", () => {
    expect(normalizeIcdCode(" i10 ")).toBe("I10");
    expect(normalizeIcdCode("е11,9")).toBe("E11.9"); // Cyrillic е and a comma
    expect(isIcdCode("E11.9")).toBe(true);
    expect(isIcdCode("E11-E14")).toBe(false);
    expect(isIcdCode("I1")).toBe(false);
  });

  it("reads the clinic's Uzbek names and reports bad lines", () => {
    const { names, rejected } = parseUzNames("code;name_uz\nI10;Essensial (birlamchi) gipertenziya\ne11.9;2-tip qandli diabet, asoratsiz\nXYZ;yomon\nJ06.9;\n");
    expect([...names.entries()]).toEqual([
      ["I10", "Essensial (birlamchi) gipertenziya"],
      ["E11.9", "2-tip qandli diabet, asoratsiz"],
    ]);
    expect(rejected).toEqual([4, 5]);
  });

  it("shows Uzbek when it exists, Russian otherwise", () => {
    expect(icdDisplayName({ nameUz: "Gipertenziya", nameRu: "Гипертензия" })).toBe("Gipertenziya");
    expect(icdDisplayName({ nameUz: "  ", nameRu: "Гипертензия" })).toBe("Гипертензия");
  });
});
