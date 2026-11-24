/**
 * B8.1: the server side of the change feed (rules: shared/realtime.ts).
 *
 * A successful write bumps its topics *before* its response goes out: on a
 * serverless instance work left after the response may never run, and a tab
 * told "saved" must find the version already moved. The bump waits 1.5 s at
 * most and never fails the write — a missed bump only delays the others' view
 * until their next timer refresh.
 *
 * Reading the versions is cached for a second per instance, so many open tabs
 * cost one query a second, not one each.
 */
import type { NextFunction, Request, Response } from "express";
import { topicsForWrite, type ChangeTopic, type ChangesResponse } from "@shared/realtime";
import { storage } from "./storage";

const BUMP_WAIT_MS = 1_500;
const READ_CACHE_MS = 1_000;

let cached: { at: number; value: Promise<ChangesResponse> } | null = null;
let warnedMissing = false;

const missingTable = (err: unknown) => (err as { code?: string } | null)?.code === "42P01";

async function bump(topics: ChangeTopic[]): Promise<void> {
  try {
    await Promise.race([storage.bumpTopics(topics), new Promise((resolve) => setTimeout(resolve, BUMP_WAIT_MS))]);
  } catch (err) {
    if (missingTable(err)) {
      if (!warnedMissing) console.warn("[realtime] change_topics jadvali yo'q — npm run db:realtime");
      warnedMissing = true;
    } else {
      console.error("[realtime] versiyani oshirib bo'lmadi:", (err as Error).message);
    }
  } finally {
    // This instance's next read sees its own write at once.
    cached = null;
  }
}

/** Mounted before the routes: holds a successful write's response until its topics are bumped. */
export function bumpTopicsOnWrite() {
  return (req: Request, res: Response, next: NextFunction) => {
    const topics = topicsForWrite(req.method, req.path);
    if (topics.length === 0) return next();
    const end = res.end.bind(res) as (...args: unknown[]) => Response;
    let held = false;
    res.end = ((...args: unknown[]) => {
      if (held || res.statusCode >= 400) return end(...args);
      held = true;
      void bump(topics).finally(() => end(...args));
      return res;
    }) as Response["end"];
    next();
  };
}

/** The current versions; `live: false` while the feed's table does not exist yet. */
export function currentChanges(): Promise<ChangesResponse> {
  if (cached && Date.now() - cached.at < READ_CACHE_MS) return cached.value;
  const value = storage
    .getTopicVersions()
    .then((versions): ChangesResponse => ({ live: true, versions }))
    .catch((err): ChangesResponse => {
      if (missingTable(err)) return { live: false, versions: {} };
      throw err;
    });
  cached = { at: Date.now(), value };
  // A failed read is not kept: the next tab asks again.
  value.catch(() => {
    if (cached?.value === value) cached = null;
  });
  return value;
}
