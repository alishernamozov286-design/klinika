/**
 * MKB-10 (ICD-10) catalogue rules (TZ §5.1.3 "MKB-10 kodi"; B3.4, D-5).
 *
 * The catalogue is the Russian Ministry of Health NSI reference (OID
 * 1.2.643.5.1.13.13.11.1005) — Russian names. Uzbek names live in their own
 * column, filled by the clinic (no open official Uzbek ICD-10 exists to load).
 * Parsing is pure so the migration, the file store and the tests read the
 * file the same way.
 */

export type IcdKind = "chapter" | "block" | "category" | "subcategory";

/** Where the Russian names come from — shown on the catalogue screen. */
export const ICD_SOURCE = "Rossiya SSV NSI, OID 1.2.643.5.1.13.13.11.1005, v2.27";

export type IcdRow = {
  code: string;
  kind: IcdKind;
  nameRu: string;
  /** The chapter's roman numeral and the block's range, for the hierarchy hint. */
  chapter: string;
  block: string | null;
  parentCode: string | null;
  /** Retired codes stay for history but cannot be chosen. */
  isActual: boolean;
  /** A diagnosis can be coded with a category or a subcategory, never a heading. */
  selectable: boolean;
  /** File order — the classification's own order. */
  sortOrder: number;
};

/** "I10", "E11.9", "C50.91": a 3-character category, optionally with a subdivision. */
export const ICD_CODE_RE = /^[A-Z]\d\d(\.\d{1,2})?$/;

/** Upper-cases, trims, accepts a comma for the dot and Cyrillic look-alikes typed by mistake. */
export function normalizeIcdCode(input: string): string {
  const map: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X" };
  return input
    .trim()
    .toUpperCase()
    .replace(/[АВЕКМНОРСТХ]/g, (c) => map[c] ?? c)
    .replace(",", ".");
}

export const isIcdCode = (code: string) => ICD_CODE_RE.test(code);

function kindOf(code: string, hasParent: boolean): IcdKind {
  if (!hasParent) return "chapter";
  if (code.includes("-")) return "block";
  return code.includes(".") ? "subcategory" : "category";
}

/** A semicolon CSV line with quoted fields ("" escapes a quote). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Reads the NSI file (ID;REC_CODE;MKB_CODE;MKB_NAME;ID_PARENT;ADDL_CODE;ACTUAL;DATE). */
export function parseNsiIcd10(text: string): IcdRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = splitCsvLine(lines[0], ";").map((h) => h.trim().toUpperCase());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`MKB-10 faylida "${name}" ustuni yo'q`);
    return i;
  };
  const [iId, iCode, iName, iParent, iActual] = ["ID", "MKB_CODE", "MKB_NAME", "ID_PARENT", "ACTUAL"].map(col);

  const raw = lines.slice(1).map((l) => splitCsvLine(l, ";"));
  const byId = new Map(raw.map((r) => [r[iId], r]));

  // A chapter is written as a roman numeral in the file; walk up to it.
  const chapterOf = (r: string[]): string[] => {
    let cur = r;
    for (let guard = 0; cur[iParent] && guard < 8; guard++) cur = byId.get(cur[iParent]) ?? cur;
    return cur;
  };

  return raw.map((r, index) => {
    const code = r[iCode].trim();
    const parent = r[iParent] ? byId.get(r[iParent]) : undefined;
    const kind = kindOf(code, Boolean(r[iParent]));
    const chapterRow = chapterOf(r);
    let blockCode: string | null = null;
    if (kind === "block") blockCode = code;
    else if (kind !== "chapter") {
      let cur: string[] | undefined = parent;
      for (let guard = 0; cur && guard < 6; guard++) {
        if (cur[iCode].includes("-")) {
          blockCode = cur[iCode].trim();
          break;
        }
        cur = cur[iParent] ? byId.get(cur[iParent]) : undefined;
      }
    }
    const isActual = r[iActual].trim() === "1";
    return {
      code,
      kind,
      nameRu: r[iName].trim(),
      chapter: chapterRow[iCode].trim(),
      block: blockCode,
      parentCode: parent ? parent[iCode].trim() : null,
      isActual,
      selectable: isActual && (kind === "category" || kind === "subcategory"),
      sortOrder: index + 1,
    };
  });
}

/**
 * The clinic's Uzbek names: `code;name_uz` (or comma separated), header row
 * optional. Returns the pairs and the lines it could not read.
 */
export function parseUzNames(text: string): { names: Map<string, string>; rejected: number[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const names = new Map<string, string>();
  const rejected: number[] = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const sep = line.includes(";") ? ";" : ",";
    const [rawCode, ...rest] = splitCsvLine(line, sep);
    const code = normalizeIcdCode(rawCode ?? "");
    const name = rest.join(sep).trim();
    if (i === 0 && !isIcdCode(code) && !code.includes("-")) return; // header
    if ((!isIcdCode(code) && !/^[A-Z]\d\d-[A-Z]\d\d$/.test(code) && !/^[IVXL]+$/.test(code)) || !name) {
      rejected.push(i + 1);
      return;
    }
    names.set(code, name.slice(0, 400));
  });
  return { names, rejected };
}

/** What a picker and a printout show: Uzbek when the clinic has it, Russian otherwise. */
export function icdDisplayName(row: { nameUz: string | null; nameRu: string }): string {
  return row.nameUz?.trim() || row.nameRu;
}
