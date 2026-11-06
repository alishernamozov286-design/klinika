import { describe, expect, it } from "vitest";
import { defaultTests } from "./tests-data";
import { classifyTest, tubesFor, TEST_GROUPS } from "./lab-catalogue";

const by = new Map(defaultTests.map((t) => [t.id, classifyTest(t)]));
const groupOf = (id: string) => by.get(id)!.group;
const tubeOf = (id: string) => by.get(id)!.sampleType;

describe("lab catalogue classification (B4.6, TZ §6.2)", () => {
  it("puts TZ's own examples in TZ's groups", () => {
    expect(["1", "3", "4"].map(groupOf)).toEqual(["gematologiya", "gematologiya", "gematologiya"]); // UQT, Hb, SOE
    expect(["17", "18", "22", "24", "23"].map(groupOf)).toEqual(Array(5).fill("biokimyo")); // ALT, AST, glyukoza, kreatinin, mochevina
    expect(["51", "52", "53", "49", "50", "66"].map(groupOf)).toEqual(Array(6).fill("gormonlar")); // TSH, FT3, FT4, T3, T4, kortizol
    expect(["54", "55"].map(groupOf)).toEqual(["immunologiya", "immunologiya"]); // Anti-TPO, Anti-TG
    expect(["45", "47", "96"].map(groupOf)).toEqual(["koagulologiya", "koagulologiya", "koagulologiya"]); // PT, fibrinogen, D-dimer
    expect(["44", "67", "68"].map(groupOf)).toEqual(["diabet", "diabet", "diabet"]); // HbA1c, insulin, C-peptid
    expect(["70", "71"].map(groupOf)).toEqual(["infeksiyalar", "infeksiyalar"]); // HBsAg, Anti-HCV
    expect(groupOf("6")).toBe("siydik"); // umumiy siydik tahlili
  });

  it("classifies the whole seed catalogue, every group used", () => {
    const groups = new Set(defaultTests.map((t) => classifyTest(t).group));
    expect([...groups].sort()).toEqual([...TEST_GROUPS].sort());
    expect(groupOf("12")).toBe("boshqa"); // stool: no TZ group
    expect(groupOf("5")).toBe("koagulologiya"); // qon ivish vaqti
  });

  it("picks the specimen and so the tube", () => {
    expect(tubeOf("1")).toBe("qon_edta");
    expect(tubeOf("44")).toBe("qon_edta"); // HbA1c is whole blood
    expect(tubeOf("108")).toBe("qon_edta"); // PCR plasma
    expect(tubeOf("22")).toBe("qon_zardob");
    expect(tubeOf("45")).toBe("qon_sitrat");
    expect(tubeOf("6")).toBe("siydik");
    expect(tubeOf("31")).toBe("siydik"); // uric acid in urine, though a biochemistry test
    expect(groupOf("31")).toBe("biokimyo");
    expect(tubeOf("12")).toBe("najas");
    expect(tubeOf("105")).toBe("surtma");
  });

  it("lists one container per specimen, in a fixed order", () => {
    const tubes = tubesFor([
      { testName: "Glyukoza", sampleType: "qon_zardob" },
      { testName: "UQT", sampleType: "qon_edta" },
      { testName: "ALT", sampleType: "qon_zardob" },
      { testName: "Siydik", sampleType: "siydik" },
      { testName: "Eski", sampleType: null },
    ]);
    expect(tubes).toEqual([
      { sampleType: "qon_edta", tests: ["UQT"] },
      { sampleType: "qon_zardob", tests: ["Glyukoza", "ALT"] },
      { sampleType: "siydik", tests: ["Siydik"] },
      { sampleType: "boshqa", tests: ["Eski"] },
    ]);
  });
});
