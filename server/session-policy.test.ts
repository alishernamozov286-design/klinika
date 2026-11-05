/**
 * The server half of TZ §12 "faol bo'lmagan seanslarni yopish". The limits are
 * counted in minutes and hours, so the clock is faked rather than waited out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storage: { getSecuritySettings: async () => ({ sessionIdleMinutes: 30, sessionMaxHours: 12 }) },
}));

const { enforceSessionPolicy, invalidateSessionPolicy, publicSessionId } = await import("./session-policy");

const MIN = 60_000;
const START = new Date("2026-11-05T08:00:00Z").getTime();

function fakeRequest(
  meta?: { createdAt: number; lastSeen: number },
  cookie: { expires?: Date; originalMaxAge?: number } = {},
) {
  const session: Record<string, unknown> = {
    meta: meta ? { ...meta, ip: null, userAgent: null } : undefined,
    cookie,
  };
  session.destroy = (cb: () => void) => cb();
  const req = {
    isAuthenticated: () => true,
    session,
    ip: "10.0.0.5",
    socket: {},
    get: () => "test-agent",
    logout: (cb: () => void) => cb(),
  };
  const res = {
    statusCode: 200,
    body: null as unknown,
    clearCookie: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return { req, res, session };
}

async function run(
  meta?: { createdAt: number; lastSeen: number },
  cookie?: { expires?: Date; originalMaxAge?: number },
) {
  const { req, res, session } = fakeRequest(meta, cookie);
  const next = vi.fn();
  await enforceSessionPolicy()(req as never, res as never, next);
  return { res, next, session };
}

describe("enforceSessionPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    invalidateSessionPolicy();
  });
  afterEach(() => vi.useRealTimers());

  it("lets an active session through", async () => {
    const { next, res } = await run({ createdAt: START - 60 * MIN, lastSeen: START - 5 * MIN });
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("ends a session idle past the limit, saying why", async () => {
    const { next, res } = await run({ createdAt: START - 60 * MIN, lastSeen: START - 31 * MIN });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: "SESSION_IDLE" });
  });

  it("ends a session older than the absolute limit, however active", async () => {
    const { res } = await run({ createdAt: START - 13 * 60 * MIN, lastSeen: START - 1 * MIN });
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ code: "SESSION_MAX" });
  });

  it("starts a clock for a session from before this release instead of ending it", async () => {
    const { next, session } = await run(undefined);
    expect(next).toHaveBeenCalled();
    expect(session.meta).toMatchObject({ createdAt: START, lastSeen: START, ip: "10.0.0.5" });
  });

  it("lets a pre-release session used recently carry on, judged by its cookie", async () => {
    const YEAR = 365 * 24 * 60 * MIN;
    const { next } = await run(undefined, { expires: new Date(START - 5 * MIN + YEAR), originalMaxAge: YEAR });
    expect(next).toHaveBeenCalled();
  });

  it("ends a pre-release session left idle for weeks instead of reviving it", async () => {
    const YEAR = 365 * 24 * 60 * MIN;
    const { next, res } = await run(undefined, {
      expires: new Date(START - 30 * 24 * 60 * MIN + YEAR),
      originalMaxAge: YEAR,
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ code: "SESSION_IDLE" });
  });

  it("refreshes lastSeen, but not on every request", async () => {
    const recent = await run({ createdAt: START - 10 * MIN, lastSeen: START - 10_000 });
    expect((recent.session.meta as { lastSeen: number }).lastSeen).toBe(START - 10_000);
    const older = await run({ createdAt: START - 10 * MIN, lastSeen: START - 2 * MIN });
    expect((older.session.meta as { lastSeen: number }).lastSeen).toBe(START);
  });
});

describe("publicSessionId", () => {
  it("is stable and does not reveal the session id", () => {
    expect(publicSessionId("abc")).toBe(publicSessionId("abc"));
    expect(publicSessionId("abc")).not.toContain("abc");
    expect(publicSessionId("abc")).toHaveLength(16);
  });
});
