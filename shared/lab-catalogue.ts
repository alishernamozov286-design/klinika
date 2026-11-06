/**
 * The lab catalogue's classification (TZ §6.2; B4.6) and specimens (TZ
 * §6.1.3; B4.3): which of the eight TZ groups a test belongs to, what it is
 * drawn into, and so which tubes an order needs.
 *
 * `category` stays the clinic's own finer heading ("Qalqonsimon bez
 * gormonlari"); `group` is the TZ's fixed eight, used for filters, reports
 * and the blank.
 */

/** TZ §6.2, in its order, plus "boshqa" for what the eight do not cover (stool tests). */
export const TEST_GROUPS = [
  "gematologiya",
  "biokimyo",
  "gormonlar",
  "immunologiya",
  "koagulologiya",
  "diabet",
  "infeksiyalar",
  "siydik",
  "boshqa",
] as const;
export type TestGroup = (typeof TEST_GROUPS)[number];

export const TEST_GROUP_LABELS: Record<TestGroup, string> = {
  gematologiya: "Gematologiya",
  biokimyo: "Biokimyo",
  gormonlar: "Gormonlar",
  immunologiya: "Immunologiya",
  koagulologiya: "Koagulologiya",
  diabet: "Diabet diagnostikasi",
  infeksiyalar: "Infeksiyalar",
  siydik: "Siydik tahlili",
  boshqa: "Boshqa",
};

/** What the specimen is — and so the container it goes into. */
export const SAMPLE_TYPES = ["qon_edta", "qon_zardob", "qon_sitrat", "siydik", "najas", "surtma", "boshqa"] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];

export type TubeSpec = {
  /** "Qon (EDTA)" — the specimen. */
  label: string;
  /** "Binafsha qopqoqli probirka" — what the nurse reaches for. */
  container: string;
  /** Cap colour, for the dot on screens and the band on the label. */
  color: string;
};

/** Standard cap colours (EN ISO 6710 practice): lavender EDTA, gold serum, light-blue citrate. */
export const TUBES: Record<SampleType, TubeSpec> = {
  qon_edta: { label: "Qon (EDTA)", container: "Binafsha qopqoqli probirka", color: "#8b5cf6" },
  qon_zardob: { label: "Qon zardobi", container: "Sariq qopqoqli probirka", color: "#eab308" },
  qon_sitrat: { label: "Qon (sitrat)", container: "Havorang qopqoqli probirka", color: "#38bdf8" },
  siydik: { label: "Siydik", container: "Siydik uchun idish", color: "#f59e0b" },
  najas: { label: "Najas", container: "Najas uchun idish", color: "#92400e" },
  surtma: { label: "Surtma", container: "Transport muhitli probirka", color: "#10b981" },
  boshqa: { label: "Boshqa", container: "Boshqa idish", color: "#94a3b8" },
};

/** Specimen quality on reception (TZ §6.1.3 "namuna sifati"). */
export const SAMPLE_QUALITIES = ["yaxshi", "gemoliz", "lipemiya", "ikterik", "laxta", "kam_hajm"] as const;
export type SampleQuality = (typeof SAMPLE_QUALITIES)[number];

export const SAMPLE_QUALITY_LABELS: Record<SampleQuality, string> = {
  yaxshi: "Yaxshi",
  gemoliz: "Gemoliz",
  lipemiya: "Lipemiya",
  ikterik: "Ikterik",
  laxta: "Laxtalangan",
  kam_hajm: "Hajm yetarli emas",
};

const has = (text: string, ...needles: string[]) => needles.some((n) => text.includes(n));

/**
 * The group and specimen for a test, from its name and the clinic's heading.
 * Used to classify the seed catalogue and, once, the clinic's existing tests
 * in the migration; afterwards both are edited in the catalogue screen.
 * Specific analytes first (TZ §6.2 names them), then the heading.
 */
export function classifyTest(input: { name: string; category: string }): { group: TestGroup; sampleType: SampleType } {
  const name = input.name.toLowerCase();
  const cat = input.category.toLowerCase();

  // --- group
  let group: TestGroup;
  if (has(name, "glikgemoglobin", "hba1c", "insulin", "s-peptid", "c-peptid")) group = "diabet";
  else if (has(name, "at-tpo", "anti-tpo", "at-tg", "anti-tg")) group = "immunologiya";
  else if (has(name, "d-dimer", "qon ivish", "protrombin", "fibrinogen", "trombo-test", "mno", "achtv")) group = "koagulologiya";
  else if (has(cat, "gematolog")) group = "gematologiya";
  else if (has(cat, "koagul", "qon ivish")) group = "koagulologiya";
  else if (has(cat, "umumiy klinika") || (has(name, "siydik") && !has(cat, "biokim"))) group = "siydik";
  else if (has(cat, "kaprolog", "koprolog") || has(name, "ahlat", "najas")) group = "boshqa";
  else if (has(cat, "gormon", "reproduktiv", "ixla")) group = "gormonlar";
  else if (has(cat, "allergiya", "onkomarker", "yallig", "immun")) group = "immunologiya";
  else if (has(cat, "infeksiya", "gepatolog", "gelmint", "ptsr", "pcr", "covid", "ekspress", "jinsiy", "zoonoz", "pulmanolog", "ovqat hazm")) {
    group = "infeksiyalar";
  } else if (has(cat, "biokim", "kardiolog", "suv-tuz", "elektrolit")) group = "biokimyo";
  else group = "boshqa";

  // --- specimen
  let sampleType: SampleType;
  if (has(name, "surtma", "mazok")) sampleType = "surtma";
  else if (group === "siydik" || has(name, "siydik")) sampleType = "siydik";
  else if (group === "boshqa" && has(cat, "kaprolog", "koprolog") || has(name, "ahlat", "najas")) sampleType = "najas";
  else if (group === "koagulologiya") sampleType = "qon_sitrat";
  else if (group === "gematologiya" || has(name, "glikgemoglobin", "hba1c") || has(cat, "ptsr", "pcr")) sampleType = "qon_edta";
  else sampleType = "qon_zardob";

  return { group, sampleType };
}

/**
 * The containers an order needs: one per specimen type, with the tests it
 * serves. Order follows SAMPLE_TYPES, so labels always print in the same order.
 */
export function tubesFor<T extends { testName: string; sampleType: string | null }>(
  items: T[],
): { sampleType: SampleType; tests: string[] }[] {
  const by = new Map<SampleType, string[]>();
  for (const i of items) {
    const t = (SAMPLE_TYPES as readonly string[]).includes(i.sampleType ?? "") ? (i.sampleType as SampleType) : "boshqa";
    by.set(t, [...(by.get(t) ?? []), i.testName]);
  }
  return SAMPLE_TYPES.filter((t) => by.has(t)).map((t) => ({ sampleType: t, tests: by.get(t)! }));
}
