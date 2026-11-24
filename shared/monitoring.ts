/**
 * Monitoring va xatolar jurnali (B8.4, TZ §14): what the system does and where
 * it fails, for whoever runs it — without a patient's data.
 *
 *   - Request stats: per hour, per API route pattern ("/api/admissions/:id"),
 *     the count, total and longest time, a latency histogram (for p95) and the
 *     number of failures. Aggregated in memory and written once a minute.
 *   - Error groups: unexpected failures (5xx on the server, crashes in the
 *     browser) grouped by where and what — the message with numbers and ids
 *     masked — with how often, first and last seen. Marking one resolved hides
 *     it until it happens again.
 *
 * Nothing that identifies a patient is stored: paths are route patterns, ids in
 * messages are masked, request bodies are never read.
 */

/** Upper bounds (ms) of the latency histogram; the last bucket is everything slower. */
export const LATENCY_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000] as const;
export const HISTOGRAM_SIZE = LATENCY_BUCKETS.length + 1;
/** A route whose p95 passes this is "slow". */
export const SLOW_P95_MS = 1000;
/** Kept this long, then pruned. */
export const MONITORING_RETENTION_DAYS = 30;

export const ERROR_SOURCES = ["server", "client"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];
export const ERROR_SOURCE_LABELS: Record<ErrorSource, string> = { server: "Server", client: "Brauzer" };

export function bucketOf(ms: number): number {
  const i = LATENCY_BUCKETS.findIndex((b) => ms <= b);
  return i === -1 ? LATENCY_BUCKETS.length : i;
}

/**
 * The value under which `p` of the requests fell, from a histogram — the upper
 * bound of the bucket where that share is reached (the slowest bucket reports
 * the longest time seen). An estimate, honest about its resolution.
 */
export function percentileFromHistogram(hist: readonly number[], p: number, maxMs: number): number | null {
  const total = hist.reduce((s, n) => s + n, 0);
  if (!total) return null;
  const need = Math.ceil(total * p);
  let seen = 0;
  for (let i = 0; i < hist.length; i++) {
    seen += hist[i];
    if (seen >= need) return i < LATENCY_BUCKETS.length ? Math.min(LATENCY_BUCKETS[i], maxMs) : maxMs;
  }
  return maxMs;
}

/** Ids, numbers, emails and phone numbers out of a message, so one fault is one group and nothing personal stays. */
export function maskMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ":email")
    .replace(/\+?\d[\d\s-]{6,}\d/g, ":phone")
    .replace(/\b\d+(\.\d+)?\b/g, ":n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** A raw path with its ids replaced — used when no route matched. */
export function maskPath(path: string): string {
  return path
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n")
    .slice(0, 160);
}

/** One group per source, place and masked message. */
export function errorFingerprint(source: ErrorSource, where: string, name: string, message: string): string {
  return `${source}|${where}|${name}|${maskMessage(message)}`.slice(0, 500);
}

export type RequestStatRow = { hour: string; method: string; route: string; count: number; totalMs: number; maxMs: number; errors: number; histogram: number[] };
export type RouteSummary = { method: string; route: string; count: number; avgMs: number; p95Ms: number | null; maxMs: number; errors: number; errorRate: number; slow: boolean };
export type HourSummary = { hour: string; count: number; errors: number; avgMs: number };

/** Per route over the rows given (several hours), slowest p95 first. */
export function summarizeRoutes(rows: readonly RequestStatRow[]): RouteSummary[] {
  const acc = new Map<string, { method: string; route: string; count: number; totalMs: number; maxMs: number; errors: number; hist: number[] }>();
  for (const r of rows) {
    const k = `${r.method} ${r.route}`;
    const a = acc.get(k) ?? { method: r.method, route: r.route, count: 0, totalMs: 0, maxMs: 0, errors: 0, hist: Array(HISTOGRAM_SIZE).fill(0) };
    a.count += r.count;
    a.totalMs += r.totalMs;
    a.maxMs = Math.max(a.maxMs, r.maxMs);
    a.errors += r.errors;
    r.histogram.forEach((n, i) => (a.hist[i] = (a.hist[i] ?? 0) + n));
    acc.set(k, a);
  }
  return [...acc.values()]
    .map((a) => {
      const p95 = percentileFromHistogram(a.hist, 0.95, a.maxMs);
      return {
        method: a.method,
        route: a.route,
        count: a.count,
        avgMs: a.count ? Math.round(a.totalMs / a.count) : 0,
        p95Ms: p95,
        maxMs: a.maxMs,
        errors: a.errors,
        errorRate: a.count ? Math.round((a.errors / a.count) * 1000) / 10 : 0,
        slow: p95 !== null && p95 > SLOW_P95_MS,
      };
    })
    .sort((x, y) => (y.p95Ms ?? 0) - (x.p95Ms ?? 0) || y.count - x.count);
}

/** Every hour of the last `hours`, oldest first, zeros where nothing ran. */
export function summarizeHours(rows: readonly RequestStatRow[], now: Date, hours = 24): HourSummary[] {
  const byHour = new Map<string, { count: number; errors: number; totalMs: number }>();
  for (const r of rows) {
    const a = byHour.get(r.hour) ?? { count: 0, errors: 0, totalMs: 0 };
    a.count += r.count;
    a.errors += r.errors;
    a.totalMs += r.totalMs;
    byHour.set(r.hour, a);
  }
  const out: HourSummary[] = [];
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let i = hours - 1; i >= 0; i--) {
    const hour = new Date(start.getTime() - i * 3_600_000).toISOString();
    const a = byHour.get(hour);
    out.push({ hour, count: a?.count ?? 0, errors: a?.errors ?? 0, avgMs: a && a.count ? Math.round(a.totalMs / a.count) : 0 });
  }
  return out;
}

/** The hour a moment belongs to, as stored (UTC, on the hour). */
export function hourOf(at: Date): string {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export type ErrorGroupView = {
  id: string;
  source: ErrorSource;
  where: string;
  name: string;
  message: string;
  /** Top frames (file:line), server only — never arguments or data. */
  stack: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  lastStatus: number | null;
  lastRole: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
};

export type SystemStatus = {
  generatedAt: string;
  version: string;
  uptimeSeconds: number;
  storage: "postgres" | "file";
  database: { ok: boolean; latencyMs: number | null; error: string | null };
  backup: { health: string; hoursSince: number | null } | null;
  last24h: { requests: number; errors: number; errorRate: number; avgMs: number; slowRoutes: number };
  hours: HourSummary[];
  routes: RouteSummary[];
  errors: ErrorGroupView[];
  openErrors: number;
};

/** Stack frames as file:line only — no values. */
export function trimStack(stack: string | undefined, frames = 6): string | null {
  if (!stack) return null;
  const lines = stack
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at ") && !l.includes("node_modules") && !l.includes("node:internal"))
    .map((l) => l.replace(/\(.*[\\/](server|shared|client)[\\/]/, "($1/").replace(/file:\/\/\/?/, ""))
    .slice(0, frames);
  return lines.length ? lines.join("\n") : null;
}
