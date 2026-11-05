import { describe, expect, it } from "vitest";
import {
  ageFromBirthDate,
  compareIdentity,
  nameKey,
  normalizePassport,
  normalizePinfl,
  patientAge,
  shortNameKey,
} from "./patient-identity";
import { insertPatientSchema } from "./schema";

const rec = (over: Partial<Parameters<typeof compareIdentity>[1]> = {}) => ({
  fullName: "Aliyev Vali Akramovich",
  phoneDigits: "901234567",
  birthDate: "1990-05-12",
  passport: "AA1234567",
  pinfl: "31205901234567",
  ...over,
});

describe("nameKey", () => {
  it("ignores case, spacing and apostrophe variants", () => {
    expect(nameKey("  G‘ofurov   Ulug'bek ")).toBe(nameKey("gʻofurov ulugbek"));
  });

  it("matches a name typed in Cyrillic with its Latin spelling", () => {
    expect(nameKey("Каримов Шерзод")).toBe(nameKey("Karimov Sherzod"));
    expect(nameKey("Ўринов Ғайрат")).toBe(nameKey("O'rinov G'ayrat"));
  });

  it("shortNameKey keeps surname and given name only", () => {
    expect(shortNameKey("Aliyev Vali Akramovich")).toBe("aliyev vali");
  });
});

describe("document normalisation", () => {
  it("passport: upper case, no separators", () => {
    expect(normalizePassport(" aa 123-45 67 ")).toBe("AA1234567");
    expect(normalizePassport("")).toBeNull();
  });

  it("pinfl: digits only", () => {
    expect(normalizePinfl("312 0590 1234 567")).toBe("31205901234567");
    expect(normalizePinfl(null)).toBeNull();
  });
});

describe("compareIdentity", () => {
  it("is strong on the same JShShIR or passport, whatever the name", () => {
    expect(compareIdentity({ fullName: "Boshqa Ism", pinfl: "31205901234567" }, rec())?.strength).toBe("strong");
    expect(compareIdentity({ passport: "aa 1234567" }, rec())).toEqual({ strength: "strong", reasons: ["Pasport bir xil"] });
  });

  it("is strong on the same name with the same phone or birth date", () => {
    expect(compareIdentity({ fullName: "ALIYEV VALI", phoneDigits: "901234567" }, rec())?.reasons).toEqual([
      "Ism va telefon bir xil",
    ]);
    expect(compareIdentity({ fullName: "Алиев Вали", birthDate: "1990-05-12" }, rec({ fullName: "Aliev Vali" }))?.strength).toBe(
      "strong",
    );
  });

  it("is only weak on a shared phone — families share one", () => {
    expect(compareIdentity({ fullName: "Aliyeva Malika", phoneDigits: "901234567" }, rec())).toEqual({
      strength: "weak",
      reasons: ["Telefon raqami bir xil"],
    });
  });

  it("says so when the name matches but the birth date does not", () => {
    expect(compareIdentity({ fullName: "Aliyev Vali", birthDate: "2001-01-01" }, rec())?.reasons).toEqual([
      "Ismi bir xil, tug'ilgan sanasi boshqa",
    ]);
  });

  it("is null for an unrelated person", () => {
    expect(compareIdentity({ fullName: "Karimov Sherzod", phoneDigits: "933334455" }, rec())).toBeNull();
  });
});

describe("age", () => {
  const today = new Date(2026, 10, 5); // 5 Nov 2026

  it("counts full years, turning on the birthday", () => {
    expect(ageFromBirthDate("1990-11-05", today)).toBe(36);
    expect(ageFromBirthDate("1990-11-06", today)).toBe(35);
    expect(ageFromBirthDate(null, today)).toBeNull();
  });

  it("patientAge prefers the birth date over a typed age", () => {
    expect(patientAge({ birthDate: "2000-01-01", age: 99 })).toBe(ageFromBirthDate("2000-01-01"));
    expect(patientAge({ birthDate: null, age: 40 })).toBe(40);
  });
});

describe("insertPatientSchema", () => {
  const base = { fullName: "Aliyev Vali", phone: "+998901234567" };

  it("normalises documents and accepts an emergency contact", () => {
    const p = insertPatientSchema.parse({
      ...base,
      passport: "aa 1234567",
      pinfl: "3120 5901 2345 67",
      emergencyContact: { name: "Aliyeva Malika", relation: "Onasi", phone: "901112233" },
    });
    expect(p.passport).toBe("AA1234567");
    expect(p.pinfl).toBe("31205901234567");
    expect(p.emergencyContact?.phone).toBe("+998 90 111 22 33");
  });

  it("refuses a short JShShIR and a birth date in the future", () => {
    expect(insertPatientSchema.safeParse({ ...base, pinfl: "123" }).success).toBe(false);
    expect(insertPatientSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success).toBe(false);
  });

  it("treats empty optional fields as absent", () => {
    const p = insertPatientSchema.parse({ ...base, birthDate: "", passport: "", pinfl: "" });
    expect(p).toMatchObject({ birthDate: null, passport: null, pinfl: null });
  });
});
