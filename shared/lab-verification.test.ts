import { describe, expect, it } from "vitest";
import { isOrderReleased, labProgress, lineState, needsEntry, needsReview, releasedLines } from "./lab-verification";

const line = (result: string | null, extra: { verifiedAt?: string | null; returnedAt?: string | null } = {}) => ({
  result,
  verifiedAt: null,
  returnedAt: null,
  ...extra,
});

describe("lab line states (B4.5)", () => {
  it("names each state", () => {
    expect(lineState(line(null))).toBe("empty");
    expect(lineState(line("  "))).toBe("empty");
    expect(lineState(line("5"))).toBe("review");
    expect(lineState(line("5", { returnedAt: "t" }))).toBe("returned");
    expect(lineState(line("5", { verifiedAt: "t" }))).toBe("verified");
    // Verification wins over a stale return mark.
    expect(lineState(line("5", { verifiedAt: "t", returnedAt: "t" }))).toBe("verified");
  });

  it("an order is released only when every line is verified", () => {
    expect(isOrderReleased({ items: [] })).toBe(false);
    expect(isOrderReleased({ items: [line("1", { verifiedAt: "t" }), line("2")] })).toBe(false);
    expect(isOrderReleased({ items: [line("1", { verifiedAt: "t" }), line("2", { verifiedAt: "t" })] })).toBe(true);
  });

  it("splits the work queues; an order can be in both", () => {
    const items = [line(null), line("5"), line("6", { returnedAt: "t" }), line("7", { verifiedAt: "t" })];
    expect(labProgress(items)).toEqual({ total: 4, empty: 1, review: 1, returned: 1, verified: 1, released: false });
    expect(needsEntry(items)).toBe(true);
    expect(needsReview(items)).toBe(true);
    expect(needsEntry([line("5")])).toBe(false);
    expect(needsReview([line("5", { verifiedAt: "t" })])).toBe(false);
    expect(releasedLines(items).map((i) => i.result)).toEqual(["7"]);
  });
});
