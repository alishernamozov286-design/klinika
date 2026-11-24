/**
 * B8.1: a successful write's response waits for its topics' bump; a refused
 * write, a read and a failing bump do not hold anything up or break anything.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  versions: {} as Record<string, number>,
  fail: null as null | { code?: string; message: string },
  reads: 0,
}));

vi.mock("./storage", () => ({
  storage: {
    async bumpTopics(topics: string[]) {
      if (store.fail) throw Object.assign(new Error(store.fail.message), store.fail);
      for (const t of topics) store.versions[t] = (store.versions[t] ?? 0) + 1;
    },
    async getTopicVersions() {
      store.reads++;
      if (store.fail) throw Object.assign(new Error(store.fail.message), store.fail);
      return { ...store.versions };
    },
  },
}));

const { bumpTopicsOnWrite, currentChanges } = await import("./realtime");

function exchange(method: string, path: string, status: number) {
  const calls: string[] = [];
  const res = {
    statusCode: status,
    end: vi.fn(() => {
      calls.push(`end with lab=${store.versions.lab ?? 0}`);
      return res;
    }),
  };
  const next = vi.fn();
  bumpTopicsOnWrite()({ method, path } as never, res as never, next);
  return { res, next, calls };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("change feed on the server (B8.1)", () => {
  beforeEach(() => {
    store.versions = {};
    store.fail = null;
    store.reads = 0;
  });

  it("bumps a successful write's topics before its response ends", async () => {
    const { res, next, calls } = exchange("POST", "/api/orders/7/verify", 200);
    expect(next).toHaveBeenCalled();
    (res.end as unknown as () => void)();
    await settle();
    expect(calls).toEqual(["end with lab=1"]);
    expect(store.versions).toMatchObject({ lab: 1, cash: 1, patients: 1, notifications: 1 });
  });

  it("leaves refused writes and reads alone", async () => {
    const refused = exchange("POST", "/api/orders", 409);
    (refused.res.end as unknown as () => void)();
    const read = exchange("GET", "/api/orders", 200);
    (read.res.end as unknown as () => void)();
    await settle();
    expect(refused.calls).toEqual(["end with lab=0"]);
    expect(read.calls).toEqual(["end with lab=0"]);
    expect(store.versions).toEqual({});
  });

  it("still answers when the bump fails (table not migrated, database down)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    store.fail = { code: "42P01", message: 'relation "change_topics" does not exist' };
    const a = exchange("POST", "/api/payments", 201);
    (a.res.end as unknown as () => void)();
    store.fail = { message: "connection refused" };
    const b = exchange("POST", "/api/payments", 201);
    (b.res.end as unknown as () => void)();
    await settle();
    // The original end still ran, once each.
    expect(a.calls).toEqual(["end with lab=0"]);
    expect(b.calls).toEqual(["end with lab=0"]);
    warn.mockRestore();
    error.mockRestore();
  });

  it("says the feed is not available before the migration, and caches reads for a second", async () => {
    store.fail = { code: "42P01", message: "missing" };
    expect(await currentChanges()).toEqual({ live: false, versions: {} });
    store.fail = null;
    // A bump clears this instance's cache, so its own write shows at once.
    const w = exchange("POST", "/api/inventory/receipts", 201);
    (w.res.end as unknown as () => void)();
    await settle();
    const reads = store.reads;
    expect(await currentChanges()).toEqual({ live: true, versions: { inventory: 1 } });
    expect(await currentChanges()).toEqual({ live: true, versions: { inventory: 1 } });
    expect(store.reads).toBe(reads + 1);
  });
});
