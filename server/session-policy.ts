import { createHash } from "crypto";
import type { NextFunction, Request, Response } from "express";
import type { Store } from "express-session";
import {
  DEFAULT_SECURITY_SETTINGS,
  type ActiveSession,
  type SecuritySettings,
  type SessionEndCode,
} from "@shared/schema";
import { storage } from "./storage";

/**
 * TZ §12 "faol bo'lmagan seanslarni yopish": idle and absolute session limits,
 * and the list of a user's signed-in devices.
 *
 * Enforced on the server, on every API request. The client's idle warning is
 * a courtesy on top: a tab that is closed, frozen or tampered with cannot keep
 * a session alive, because the server compares against its own clock.
 */

declare module "express-session" {
  interface SessionData {
    meta?: {
      /** When the user signed in on this device. */
      createdAt: number;
      /** Last API request; refreshed at most every TOUCH_EVERY_MS. */
      lastSeen: number;
      ip: string | null;
      userAgent: string | null;
    };
  }
}

/**
 * Writing lastSeen on every request would mean a session-store write for each
 * one. Half a minute of slack is invisible against a limit counted in minutes.
 */
const TOUCH_EVERY_MS = 30_000;
const POLICY_TTL_MS = 60_000;

let policy: { value: SecuritySettings; loadedAt: number } | null = null;

export async function getSessionPolicy(): Promise<SecuritySettings> {
  if (policy && Date.now() - policy.loadedAt < POLICY_TTL_MS) return policy.value;
  const value = await storage.getSecuritySettings().catch(() => ({ ...DEFAULT_SECURITY_SETTINGS }));
  policy = { value, loadedAt: Date.now() };
  return value;
}

export function invalidateSessionPolicy(): void {
  policy = null;
}

const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? null;
const clientAgent = (req: Request) => (req.get("user-agent") ?? "").slice(0, 300) || null;

/** Stamps a fresh session right after sign-in, so its clock starts at login. */
export function stampSession(req: Request): void {
  const now = Date.now();
  req.session.meta = { createdAt: now, lastSeen: now, ip: clientIp(req), userAgent: clientAgent(req) };
}

const END_MESSAGES: Record<SessionEndCode, string> = {
  SESSION_IDLE: "Uzoq vaqt faollik bo'lmagani uchun seans yopildi. Qaytadan kiring.",
  SESSION_MAX: "Seans muddati tugadi. Xavfsizlik uchun qaytadan kiring.",
  SESSION_REVOKED: "Seans boshqa qurilmadan yopildi.",
};

/** Answers with a 401 the client recognises (see queryClient's session-expired event). */
export function endSession(req: Request, res: Response, code: SessionEndCode): void {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(401).json({ message: END_MESSAGES[code], code });
    });
  });
}

/**
 * Mounted on /api after passport.session(). Unauthenticated requests pass
 * straight through; requireAuth and friends deal with them.
 */
export function enforceSessionPolicy() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.() || !req.session) return next();
    try {
      const { sessionIdleMinutes, sessionMaxHours } = await getSessionPolicy();
      const now = Date.now();
      const meta = req.session.meta;

      // A session from before this release has no clock yet; start one now
      // rather than throwing everyone out on deploy.
      if (!meta) {
        stampSession(req);
        return next();
      }
      if (now - meta.lastSeen > sessionIdleMinutes * 60_000) return endSession(req, res, "SESSION_IDLE");
      if (now - meta.createdAt > sessionMaxHours * 3_600_000) return endSession(req, res, "SESSION_MAX");

      if (now - meta.lastSeen > TOUCH_EVERY_MS) {
        meta.lastSeen = now;
        meta.ip = clientIp(req);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ------------------------------------------------------------ device list

type RawSession = { passport?: { user?: string }; meta?: NonNullable<Express.Request["session"]["meta"]> };

/** The id shown to the client. The real session id is a bearer secret and stays here. */
export const publicSessionId = (sid: string) => createHash("sha256").update(sid).digest("hex").slice(0, 16);

/**
 * Every stored session of one user. Postgres is queried directly, because
 * connect-pg-simple has no way to enumerate; the in-memory store can.
 */
async function rawSessionsOf(
  store: Store,
  pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: { sid: string; sess: RawSession }[] }> } | null,
  userId: string,
): Promise<{ sid: string; sess: RawSession }[]> {
  if (pool) {
    const { rows } = await pool.query(
      `SELECT sid, sess FROM "session" WHERE sess->'passport'->>'user' = $1 AND expire > now()`,
      [userId],
    );
    return rows;
  }
  const all = await new Promise<Record<string, RawSession>>((resolve, reject) => {
    if (!store.all) return resolve({});
    store.all((err, obj) => (err ? reject(err) : resolve((obj ?? {}) as Record<string, RawSession>)));
  });
  return Object.entries(all)
    .filter(([, sess]) => sess?.passport?.user === userId)
    .map(([sid, sess]) => ({ sid, sess }));
}

const destroy = (store: Store, sid: string) =>
  new Promise<void>((resolve) => store.destroy(sid, () => resolve()));

/**
 * The user's live sessions, newest activity first. Sessions already past the
 * policy limits are destroyed on the way rather than listed: they could not be
 * used anyway, and showing them would only confuse.
 */
export async function listUserSessions(
  store: Store,
  pool: Parameters<typeof rawSessionsOf>[1],
  userId: string,
  currentSid: string | undefined,
): Promise<ActiveSession[]> {
  const { sessionIdleMinutes, sessionMaxHours } = await getSessionPolicy();
  const now = Date.now();
  const live: ActiveSession[] = [];
  for (const { sid, sess } of await rawSessionsOf(store, pool, userId)) {
    const m = sess.meta;
    const stale =
      m && (now - m.lastSeen > sessionIdleMinutes * 60_000 || now - m.createdAt > sessionMaxHours * 3_600_000);
    if (stale && sid !== currentSid) {
      await destroy(store, sid);
      continue;
    }
    live.push({
      id: publicSessionId(sid),
      current: sid === currentSid,
      ip: m?.ip ?? null,
      userAgent: m?.userAgent ?? null,
      createdAt: m ? new Date(m.createdAt).toISOString() : null,
      lastSeen: m ? new Date(m.lastSeen).toISOString() : null,
    });
  }
  return live.sort((a, b) => Number(b.current) - Number(a.current) || (b.lastSeen ?? "").localeCompare(a.lastSeen ?? ""));
}

/**
 * Ends sessions of one user: the one with `onlyId` (a public id), or all of
 * them except `keepSid`. Returns how many were ended.
 */
export async function revokeUserSessions(
  store: Store,
  pool: Parameters<typeof rawSessionsOf>[1],
  userId: string,
  opts: { onlyId?: string; keepSid?: string } = {},
): Promise<number> {
  let n = 0;
  for (const { sid } of await rawSessionsOf(store, pool, userId)) {
    if (opts.keepSid && sid === opts.keepSid) continue;
    if (opts.onlyId && publicSessionId(sid) !== opts.onlyId) continue;
    await destroy(store, sid);
    n++;
  }
  return n;
}
