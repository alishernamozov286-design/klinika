/**
 * Code 128 (ISO/IEC 15417), code set B — the tube barcode (TZ §2 "Shtrix-kod:
 * QR / Code 128"; B4.3). Set B covers printable ASCII, which is all a tube
 * code ("LAB-1042-E") needs, and every handheld and analyser reader decodes it.
 *
 * Pure: returns bar/space widths in modules, so the screen (SVG), the printer
 * and the tests share one encoding.
 */

/** Symbol patterns 0–106: alternating bar and space widths in modules (each sums to 11; stop is 13). */
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

export const CODE128_PATTERNS: readonly string[] = PATTERNS;
const START_B = 104;
const STOP = 106;

/** True when every character can be written in code set B. */
export const isCode128B = (text: string) => /^[\x20-\x7f]+$/.test(text);

/** Symbol values: start B, the data, the mod-103 check symbol, stop. */
export function code128Symbols(text: string): number[] {
  if (!text || !isCode128B(text)) throw new Error("Code 128 B: faqat lotin harflari, raqamlar va belgilar");
  const data = [...text].map((ch) => ch.charCodeAt(0) - 32);
  const check = (START_B + data.reduce((sum, v, i) => sum + v * (i + 1), 0)) % 103;
  return [START_B, ...data, check, STOP];
}

/** Bar and space widths in modules, starting with a bar; quiet zones are the caller's. */
export function code128Widths(text: string): number[] {
  return code128Symbols(text).flatMap((s) => [...PATTERNS[s]].map(Number));
}

/** The same as a 1/0 module string — what scanners and comparison tools speak. */
export function code128Modules(text: string): string {
  return code128Widths(text)
    .map((w, i) => (i % 2 === 0 ? "1" : "0").repeat(w))
    .join("");
}
