/**
 * When the person last touched the app — in any of its tabs. SessionGuard
 * writes it (at most every few seconds); the idle sign-out, the live-update
 * pacing and the "background request" header (B8.1) read it.
 */
import { ACTIVE_WINDOW_MS } from "@shared/realtime";

export const ACTIVITY_KEY = "medlab.lastActivity";

/** Set by this tab directly, so it works where localStorage does not (private mode). */
let ownLast = Date.now();

export function readSharedActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function writeSharedActivity(at: number): void {
  ownLast = Math.max(ownLast, at);
  try {
    localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    /* private mode: this tab still tracks itself */
  }
}

/** The latest activity seen, this tab's or another's. */
export function lastActivity(): number {
  return Math.max(ownLast, readSharedActivity());
}

/** How long nobody has touched the app. */
export const idleFor = (now = Date.now()) => Math.max(0, now - lastActivity());

/** True when a request now would be the page refreshing itself, not the person working. */
export const isBackground = () => idleFor() > ACTIVE_WINDOW_MS;
