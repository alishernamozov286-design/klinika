/**
 * Tizim holati (B8.4, TZ §14).
 *
 *   (anyone)        GET  /api/health — up or down, for an uptime monitor; nothing more
 *   system.monitor  GET  /api/system/status — database, backup, 24h load, slow routes, error groups
 *   system.monitor  POST /api/system/errors/:id/resolve
 *   (signed in)     POST /api/client-errors — a crash in the browser, rate-limited per user
 *   (signed in)     GET  /api/changes — B8.1: each topic's version, for the live updates
 */
import type { Express } from "express";
import { z } from "zod";
import { backupHealth } from "@shared/backup";
import { SLOW_P95_MS, hourOf, maskPath, summarizeHours, summarizeRoutes, type SystemStatus } from "@shared/monitoring";
import { requireAuth } from "./auth";
import { requirePermission } from "./rbac";
import { audit, actorOf, emptyIfMissing, handle } from "./route-helpers";
import { clientReportAllowed, flushMonitoring, recordError, startedAt } from "./monitoring";
import { currentChanges } from "./realtime";
import { storage, usingPostgres } from "./storage";

const clientErrorSchema = z.object({
  name: z.string().max(80).default("Error"),
  message: z.string().max(1000),
  stack: z.string().max(4000).nullish(),
  path: z.string().max(300),
});

async function databaseCheck(): Promise<SystemStatus["database"]> {
  const t = Date.now();
  try {
    await Promise.race([storage.ping(), new Promise((_, reject) => setTimeout(() => reject(new Error("javob yo'q (5 s)")), 5000))]);
    return { ok: true, latencyMs: Date.now() - t, error: null };
  } catch (err) {
    return { ok: false, latencyMs: null, error: (err as Error).message.includes("javob yo'q") ? "Javob yo'q (5 s)" : "Ulanib bo'lmadi" };
  }
}

export function registerSystemRoutes(app: Express) {
  /** For an uptime monitor: up or down. Says nothing else to a stranger. */
  app.get("/api/health", async (_req, res) => {
    const db = await databaseCheck();
    res.setHeader("Cache-Control", "no-store");
    res.status(db.ok ? 200 : 503).json({ ok: db.ok });
  });

  /** B8.1: which topics moved — never what moved; each topic's own routes still decide who sees its data. */
  app.get(
    "/api/changes",
    requireAuth,
    handle(async (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await currentChanges());
    }),
  );

  app.get(
    "/api/system/status",
    requirePermission("system.monitor"),
    handle(async (_req, res) => {
      await flushMonitoring();
      const now = new Date();
      const since = hourOf(new Date(now.getTime() - 23 * 3_600_000));
      const [database, stats, errors, runs] = await Promise.all([
        databaseCheck(),
        storage.listRequestStats(since).catch((e) => emptyIfMissing(e, [])),
        storage.listErrorGroups({ limit: 50, includeResolved: true }).catch((e) => emptyIfMissing(e, [])),
        usingPostgres ? storage.listBackupRuns(20).catch((e) => emptyIfMissing(e, [])) : Promise.resolve(null),
      ]);
      const routes = summarizeRoutes(stats);
      const requests = routes.reduce((s, r) => s + r.count, 0);
      const failed = routes.reduce((s, r) => s + r.errors, 0);
      const totalMs = stats.reduce((s, r) => s + r.totalMs, 0);
      const health = runs ? backupHealth(runs, now) : null;
      const status: SystemStatus = {
        generatedAt: now.toISOString(),
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? "dev",
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        storage: usingPostgres ? "postgres" : "file",
        database,
        backup: health ? { health: health.health, hoursSince: health.hoursSince } : null,
        last24h: {
          requests,
          errors: failed,
          errorRate: requests ? Math.round((failed / requests) * 1000) / 10 : 0,
          avgMs: requests ? Math.round(totalMs / requests) : 0,
          slowRoutes: routes.filter((r) => (r.p95Ms ?? 0) > SLOW_P95_MS).length,
        },
        hours: summarizeHours(stats, now),
        routes: routes.slice(0, 40),
        errors,
        openErrors: errors.filter((e) => !e.resolvedAt).length,
      };
      res.json(status);
    }),
  );

  app.post(
    "/api/system/errors/:id/resolve",
    requirePermission("system.monitor"),
    handle(async (req, res) => {
      const g = await storage.resolveErrorGroup(req.params.id, actorOf(req));
      if (!g) return res.status(404).json({ message: "Xato topilmadi" });
      await audit(req, "update", "system", g.id, `Xato hal qilindi deb belgilandi: ${g.where} — ${g.message.slice(0, 120)}`);
      res.json(g);
    }),
  );

  /** A crash in the browser (the error boundary, an unhandled error). Masked like a server one. */
  app.post(
    "/api/client-errors",
    requireAuth,
    handle(async (req, res) => {
      if (!clientReportAllowed(req.user!.id)) return res.status(429).json({ message: "Juda ko'p xabar" });
      const input = clientErrorSchema.parse(req.body);
      await recordError({ source: "client", where: maskPath(input.path), err: { name: input.name, message: input.message, stack: input.stack ?? undefined }, status: null, role: req.user?.role ?? null });
      res.sendStatus(204);
    }),
  );
}
