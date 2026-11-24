/**
 * B8.4: crashes in the browser go to the error log (Sozlamalar → Tizim holati).
 * The server masks ids and numbers; this side sends only the error's name,
 * message, top of the stack and the page's path — never what was on the page.
 * The same error is sent once a minute at most, and noise the browser makes
 * on its own (ResizeObserver, aborted fetches) is not sent.
 */
const sent = new Map<string, number>();
const NOISE = [/ResizeObserver loop/i, /AbortError/i, /Load failed/i, /NetworkError when attempting/i, /Failed to fetch/i];

export function reportClientError(err: unknown): void {
  const e = err as { name?: unknown; message?: unknown; stack?: unknown } | null;
  const name = typeof e?.name === "string" ? e.name : "Error";
  const message = typeof e?.message === "string" ? e.message : String(err);
  if (!message || NOISE.some((r) => r.test(message))) return;
  const key = `${name}|${message}|${location.pathname}`;
  const now = Date.now();
  if ((sent.get(key) ?? 0) > now - 60_000) return;
  sent.set(key, now);
  if (sent.size > 200) sent.clear();
  void fetch("/api/client-errors", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: name.slice(0, 80),
      message: message.slice(0, 1000),
      stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 6).join("\n").slice(0, 4000) : null,
      path: location.pathname,
    }),
  }).catch(() => {
    // Reporting must never become another error.
  });
}

let installed = false;
/** Unhandled errors and rejected promises anywhere on the page. */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (ev) => reportClientError(ev.error ?? ev.message));
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason as { status?: unknown } | null;
    // An API refusal (4xx) is the app working as designed, not a crash.
    if (typeof reason?.status === "number" && reason.status < 500) return;
    reportClientError(ev.reason);
  });
}
