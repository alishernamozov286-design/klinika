/**
 * B8.1: the browser side of the change feed (rules: shared/realtime.ts).
 *
 * One loop per tab asks GET /api/changes every few seconds while the tab is
 * visible — quicker while the person is working, slower when they step away,
 * not at all while the tab is hidden (it asks the moment it is shown again).
 * A topic whose version moved has its cached lists fetched again; the lists
 * on screen refresh by themselves, the rest are fetched when next opened.
 *
 * The first answer is only a baseline. Versions are kept across a hidden tab
 * or a lost connection, so whatever changed meanwhile is caught on return.
 */
import { useSyncExternalStore } from "react";
import { changedTopics, fallbackInterval, nextPollDelay, readsFor, type ChangesResponse, type TopicVersions } from "@shared/realtime";
import { ApiError, getJson, invalidateApi } from "./queryClient";
import { idleFor } from "./activity";

export type LiveStatus = "connecting" | "live" | "offline" | "unavailable" | "paused";
export type LiveState = { status: LiveStatus; lastChangeAt: number | null; lastCheckAt: number | null };

let state: LiveState = { status: "connecting", lastChangeAt: null, lastCheckAt: null };
const listeners = new Set<() => void>();

function set(patch: Partial<LiveState>) {
  const next = { ...state, ...patch };
  if (next.status === state.status && next.lastChangeAt === state.lastChangeAt && next.lastCheckAt === state.lastCheckAt) return;
  state = next;
  listeners.forEach((l) => l());
}

export function useLiveState(): LiveState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** True while changes arrive through the feed. */
export const isLive = () => state.status === "live";

/**
 * A page's own refresh timer, for useQuery's refetchInterval: as written when
 * the feed is down, slowed to a catch-up pace while it is live.
 */
export const liveInterval = (baseMs: number) => () => fallbackInterval(baseMs, isLive());

let running = 0;

/** Starts the loop; the returned function stops it. Safe to call twice (one loop runs). */
export function startLiveUpdates(): () => void {
  if (running++ > 0) return () => void running--;

  let baseline: TopicVersions | null = null;
  let failures = 0;
  let available = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = false;
  const abort = new AbortController();

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (stopped) return;
    const visible = document.visibilityState === "visible";
    const delay = nextPollDelay({ visible, idleMs: idleFor(), failures, available });
    if (delay === null) {
      set({ status: "paused" });
      return;
    }
    timer = setTimeout(() => void poll(), delay);
  };

  const poll = async () => {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const r = await getJson<ChangesResponse>("/api/changes", { signal: abort.signal });
      failures = 0;
      available = r.live;
      if (!r.live) {
        baseline = null;
        set({ status: "unavailable", lastCheckAt: Date.now() });
      } else {
        const moved = changedTopics(baseline, r.versions);
        baseline = r.versions;
        if (moved.length) void invalidateApi(...readsFor(moved));
        set({ status: "live", lastCheckAt: Date.now(), ...(moved.length ? { lastChangeAt: Date.now() } : {}) });
      }
    } catch (err) {
      if (stopped) return;
      // The session ended: the app signs the tab out (queryClient's event); nothing left to watch.
      if (err instanceof ApiError && err.status === 401) {
        stopped = true;
        return;
      }
      failures++;
      set({ status: "offline" });
    } finally {
      inFlight = false;
      schedule();
    }
  };

  const now = () => {
    if (document.visibilityState === "visible") void poll();
    else schedule();
  };

  document.addEventListener("visibilitychange", now);
  window.addEventListener("focus", now);
  window.addEventListener("online", now);
  void poll();

  return () => {
    if (--running > 0) return;
    stopped = true;
    abort.abort();
    if (timer) clearTimeout(timer);
    document.removeEventListener("visibilitychange", now);
    window.removeEventListener("focus", now);
    window.removeEventListener("online", now);
    state = { status: "connecting", lastChangeAt: null, lastCheckAt: null };
  };
}
