/**
 * Turns a User-Agent string into something a person recognises on the
 * "Faol seanslar" list: "Chrome · Windows", "Safari · iPhone".
 *
 * Deliberately small: it only has to tell a user's own devices apart, not
 * fingerprint them, so a handful of ordered checks beats a parser dependency.
 * Order matters — Edge, Opera and Yandex all also say "Chrome", and Chrome on
 * iOS says "Safari".
 */
export type DeviceInfo = { browser: string; os: string; mobile: boolean };

export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const browser =
    /YaBrowser\//.test(s) ? "Yandex Browser"
    : /Edg(e|A|iOS)?\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
    : /Firefox\/|FxiOS\//.test(s) ? "Firefox"
    : /CriOS\//.test(s) ? "Chrome"
    : /Chrome\//.test(s) ? "Chrome"
    : /Safari\//.test(s) && /Version\//.test(s) ? "Safari"
    : s ? "Brauzer" : "Noma'lum";

  const os =
    /iPhone/.test(s) ? "iPhone"
    : /iPad/.test(s) ? "iPad"
    : /Android/.test(s) ? "Android"
    : /Windows/.test(s) ? "Windows"
    : /Mac OS X|Macintosh/.test(s) ? "macOS"
    : /CrOS/.test(s) ? "ChromeOS"
    : /Linux/.test(s) ? "Linux"
    : "Noma'lum tizim";

  return { browser, os, mobile: /Mobi|iPhone|Android(?!.*Tablet)/.test(s) && !/iPad/.test(s) };
}
