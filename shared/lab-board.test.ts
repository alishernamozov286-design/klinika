import { describe, expect, it } from "vitest";
import { awaitsSample, summarizeLabBoard, type BoardOrder } from "./lab-board";

const DAY = "2026-11-07";
const dayOf = (iso: string) => iso.slice(0, 10);
const T = `${DAY}T09:00:00.000Z`;
const Y = "2026-11-06T09:00:00.000Z";

const line = (over: Partial<{ result: string | null; verifiedAt: string | null; returnedAt: string | null }> = {}) => ({
  result: null,
  verifiedAt: null,
  returnedAt: null,
  ...over,
});
const order = (over: Partial<BoardOrder> = {}): BoardOrder => ({
  status: "pending",
  createdAt: T,
  updatedAt: null,
  sample: { status: "qabul_qilindi" },
  items: [line()],
  groups: ["biokimyo"],
  ...over,
});

describe("summarizeLabBoard (TZ §6.1.1)", () => {
  it("splits live work by where it is stuck, across days", () => {
    const { counts } = summarizeLabBoard(
      [
        order({ sample: { status: "kutilmoqda" } }), // to draw
        order({ sample: { status: "olindi" }, createdAt: Y }), // drawn yesterday, not received
        order({ sample: { status: "rad_etildi" } }), // to redraw
        order(), // accepted, nothing entered
        order({ sample: null, createdAt: Y }), // pre-sample order: never "awaiting"
        order({ items: [line({ result: "5" })] }), // for the lab head
        order({ items: [line({ result: "5", returnedAt: T })] }), // sent back: laborant again
        order({ items: [line(), line({ result: "5" })] }), // both queues
      ],
      DAY,
      dayOf,
    );
    expect(counts).toMatchObject({ awaitingSample: 3, rejected: 1, inProgress: 4, review: 2 });
  });

  it("ready means fully verified, with the last check today", () => {
    const { counts } = summarizeLabBoard(
      [
        order({ items: [line({ result: "1", verifiedAt: T })] }),
        order({ items: [line({ result: "1", verifiedAt: Y }), line({ result: "2", verifiedAt: T })], createdAt: Y }),
        order({ items: [line({ result: "1", verifiedAt: Y })], createdAt: Y }), // released yesterday
        order({ items: [line({ result: "1", verifiedAt: T }), line({ result: "2" })] }), // partly
        order({ items: [] }),
      ],
      DAY,
      dayOf,
    );
    expect(counts.readyToday).toBe(2);
  });

  it("counts today's orders by group and cancellations by the day they happened", () => {
    const { counts, groupsToday } = summarizeLabBoard(
      [
        order({ groups: ["gematologiya", "biokimyo"] }),
        order({ groups: ["biokimyo"] }),
        order({ groups: ["siydik"], createdAt: Y }), // not today
        order({ status: "cancelled", createdAt: Y, updatedAt: T, sample: { status: "kutilmoqda" } }),
        order({ status: "cancelled", createdAt: Y, updatedAt: Y }),
        order({ status: "cancelled", groups: ["gormonlar"] }), // placed and cancelled today
      ],
      DAY,
      dayOf,
    );
    expect(counts.today).toBe(2);
    expect(counts.cancelledToday).toBe(2);
    // A cancelled order is no one's work.
    expect(counts.awaitingSample).toBe(0);
    expect(groupsToday).toEqual({ gematologiya: 1, biokimyo: 2 });
  });

  it("awaitsSample ignores cancelled and untracked orders", () => {
    expect(awaitsSample({ status: "pending", sample: { status: "olindi" } })).toBe(true);
    expect(awaitsSample({ status: "cancelled", sample: { status: "olindi" } })).toBe(false);
    expect(awaitsSample({ status: "pending", sample: null })).toBe(false);
  });
});
