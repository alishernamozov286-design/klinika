import { describe, expect, it } from "vitest";
import {
  CHANGE_TOPICS,
  POLL_ACTIVE_MS,
  POLL_IDLE_MS,
  POLL_UNAVAILABLE_MS,
  TOPIC_READS,
  changedTopics,
  fallbackInterval,
  nextPollDelay,
  readsFor,
  topicsForWrite,
} from "./realtime";

describe("real-time change feed (B8.1)", () => {
  it("maps a successful write to the topics it touches, and reads to none", () => {
    expect(topicsForWrite("POST", "/api/payments")).toEqual(["cash", "appointments", "lab", "inpatient"]);
    expect(topicsForWrite("patch", "/api/orders/42/results?x=1")).toEqual(["lab", "cash", "patients", "notifications"]);
    expect(topicsForWrite("POST", "/api/procedure-tasks/abc/mark")).toEqual(["inpatient", "inventory"]);
    expect(topicsForWrite("GET", "/api/orders")).toEqual([]);
    // A prefix is a whole segment: /api/ordersX is not /api/orders.
    expect(topicsForWrite("POST", "/api/ordersX")).toEqual([]);
    // Sign-in, the session and the error log touch nothing others watch.
    for (const p of ["/api/login", "/api/logout", "/api/session/ping", "/api/client-errors", "/api/user/password", "/api/sessions/revoke"]) {
      expect(topicsForWrite("POST", p)).toEqual([]);
    }
  });

  it("treats the first answer as a baseline and reports only moved topics after", () => {
    expect(changedTopics(null, { lab: 5 })).toEqual([]);
    expect(changedTopics({ lab: 5, cash: 2 }, { lab: 6, cash: 2 })).toEqual(["lab"]);
    // A topic seen for the first time, and one that went down (store restarted).
    expect(changedTopics({ lab: 5 }, { lab: 1, inpatient: 1 })).toEqual(["lab", "inpatient"]);
    expect(changedTopics({ lab: 5 }, { lab: 5 })).toEqual([]);
  });

  it("names every topic's lists and dedupes them", () => {
    for (const t of CHANGE_TOPICS) expect(TOPIC_READS[t].length).toBeGreaterThan(0);
    const reads = readsFor(["lab", "appointments"]);
    expect(reads.filter((r) => r === "/api/stats")).toHaveLength(1);
    expect(reads).toContain("/api/lab-board");
    expect(reads).toContain("/api/reception");
  });

  it("paces polling by visibility, activity and failures", () => {
    const base = { visible: true, idleMs: 0, failures: 0, available: true };
    expect(nextPollDelay(base)).toBe(POLL_ACTIVE_MS);
    expect(nextPollDelay({ ...base, idleMs: 3 * 60_000 })).toBe(POLL_IDLE_MS);
    expect(nextPollDelay({ ...base, visible: false })).toBeNull();
    expect(nextPollDelay({ ...base, available: false })).toBe(POLL_UNAVAILABLE_MS);
    expect([1, 2, 3, 10].map((f) => nextPollDelay({ ...base, failures: f }))).toEqual([8_000, 16_000, 32_000, 60_000]);
  });

  it("slows a page's own timer while the feed is live", () => {
    expect(fallbackInterval(30_000, false)).toBe(30_000);
    expect(fallbackInterval(30_000, true)).toBe(120_000);
    expect(fallbackInterval(60_000, true)).toBe(240_000);
  });
});
