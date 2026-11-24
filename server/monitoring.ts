/**
 * B8.4: the in-process side of monitoring (rules: shared/monitoring.ts).
 *
 * Request timings are added up in memory per hour and route pattern and
 * written once a minute — never a write per request. Unexpected failures are
 * written at once (they are rare, and on a serverless instance a later write
 * may never come). Old rows are pruned now and then. A failure to write is
 * logged and dropped: monitoring never breaks the request it watches.
 */
import type { Request } from "express";
import { HISTOGRAM_SIZE, MONITORING_RETENTION_DAYS, bucketOf, errorFingerprint, hourOf, maskMessage, maskPath, trimStack, type ErrorSource, type RequestStatRow } from "@shared/monitoring";
import { storage } from "./storage";
import type { ErrorEvent } from "./storage-types";

const FLUSH_EVERY_MS = 60_000;
const PRUNE_EVERY_MS = 6 * 3_600_000;

const pending = new Map<string, RequestStatRow>();
let lastFlush = Date.now();
let lastPrune = 0;
let flushing: Promise<void> | null = null;
export const startedAt = Date.now();

/** Paths not worth a line: the health probe, the keep-alive and the change feed (B8.1) — each tab asks every few seconds. */
const QUIET = new Set(["/api/health", "/api/session/ping", "/api/changes"]);

/** The route pattern a request matched ("/api/admissions/:id"), or its masked path. */
export function routeOf(req: Request): string {
  const pattern = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof pattern === "string") return `${req.baseUrl ?? ""}${pattern}`;
  return maskPath(req.originalUrl ?? req.path);
}

export function recordRequest(req: Request, status: number, ms: number): void {
  const path = req.path;
  if (!path.startsWith("/api") || QUIET.has(path)) return;
  const route = routeOf(req);
  const hour = hourOf(new Date());
  const key = `${hour}|${req.method}|${route}`;
  const row = pending.get(key) ?? { hour, method: req.method, route, count: 0, totalMs: 0, maxMs: 0, errors: 0, histogram: Array(HISTOGRAM_SIZE).fill(0) };
  row.count++;
  row.totalMs += Math.round(ms);
  row.maxMs = Math.max(row.maxMs, Math.round(ms));
  if (status >= 500) row.errors++;
  row.histogram[bucketOf(ms)]++;
  pending.set(key, row);
  if (Date.now() - lastFlush >= FLUSH_EVERY_MS) void flushMonitoring();
}

export async function flushMonitoring(): Promise<void> {
  if (flushing) return flushing;
  const rows = [...pending.values()];
  pending.clear();
  lastFlush = Date.now();
  flushing = (async () => {
    try {
      if (rows.length) await storage.saveRequestStats(rows);
      if (Date.now() - lastPrune >= PRUNE_EVERY_MS) {
        lastPrune = Date.now();
        await storage.pruneMonitoring(new Date(Date.now() - MONITORING_RETENTION_DAYS * 86_400_000).toISOString());
      }
    } catch (err) {
      console.error("[monitoring] statistikani yozib bo'lmadi:", (err as Error).message);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** An unexpected failure, masked and grouped, written now (a short wait at most). */
export async function recordError(input: { source: ErrorSource; where: string; err: unknown; status?: number | null; role?: string | null }): Promise<void> {
  const e = input.err as { name?: unknown; message?: unknown; stack?: unknown } | null;
  const name = typeof e?.name === "string" ? e.name : "Error";
  const raw = typeof e?.message === "string" ? e.message : String(input.err);
  const message = maskMessage(raw);
  const event: ErrorEvent = {
    fingerprint: errorFingerprint(input.source, input.where, name, raw),
    source: input.source,
    where: input.where,
    name: name.slice(0, 80),
    message,
    stack: input.source === "server" ? trimStack(typeof e?.stack === "string" ? e.stack : undefined) : typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 6).join("\n").slice(0, 1200) : null,
    status: input.status ?? null,
    role: input.role ?? null,
    at: new Date().toISOString(),
    count: 1,
  };
  try {
    await Promise.race([storage.recordErrors([event]), new Promise((resolve) => setTimeout(resolve, 1500))]);
  } catch (err) {
    console.error("[monitoring] xatoni yozib bo'lmadi:", (err as Error).message);
  }
}

/** Per user, how many browser reports in the last minute — a page in a crash loop must not flood the log. */
const clientBudget = new Map<string, { since: number; n: number }>();
export function clientReportAllowed(userId: string): boolean {
  const now = Date.now();
  const b = clientBudget.get(userId);
  if (!b || now - b.since > 60_000) {
    clientBudget.set(userId, { since: now, n: 1 });
    if (clientBudget.size > 5000) clientBudget.clear();
    return true;
  }
  b.n++;
  return b.n <= 20;
}
