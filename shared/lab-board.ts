/**
 * Laboratoriya bosh sahifasi (TZ §6.1.1): what the lab has on its hands.
 *
 * The rules live here, in one place. The file store and the tests call
 * `summarizeLabBoard`; the Postgres store does the same counting in one SQL
 * statement, and `storage-pg` points back here for what each number means.
 *
 *  - today          orders placed today, not cancelled
 *  - awaitingSample live orders whose tube has not been accepted yet
 *                   (to draw, drawn but not received, or rejected and to redraw);
 *                   orders from before sample tracking have no tube and never wait
 *  - rejected       the part of awaitingSample that was rejected
 *  - inProgress     tube accepted (or none tracked) and a value still to enter or fix
 *  - review         a value entered and waiting for the lab head (B4.5)
 *  - readyToday     fully verified, the last line verified today
 *  - cancelledToday cancelled today (the cancel is the order's last change)
 *
 * The work queues are not limited to today: yesterday's unfinished tube is
 * still today's work. An order with some values to enter and others to check
 * counts in both queues, as on the results page.
 */
import type { OrderWithDetails, SampleStatus } from "./schema";
import { isOrderReleased, needsEntry, needsReview } from "./lab-verification";
import { orderGroups, type TestGroup } from "./lab-catalogue";

export type LabBoardCounts = {
  today: number;
  awaitingSample: number;
  rejected: number;
  inProgress: number;
  review: number;
  readyToday: number;
  cancelledToday: number;
};

type BoardLine = Parameters<typeof needsEntry>[0][number] & { verifiedAt?: string | null };

/** GET /api/lab-board. */
export type LabBoard = {
  date: string;
  counts: LabBoardCounts;
  /** Today's live orders per test group (B4.2), for the "what came in" strip. */
  groupsToday: Partial<Record<TestGroup, number>>;
  /** The oldest orders still waiting for their tube: the next thing to do. */
  awaiting: OrderWithDetails[];
};

/** How many waiting orders the board lists. */
export const LAB_BOARD_AWAITING_LIMIT = 6;

export type BoardOrder = {
  status: string;
  createdAt: string;
  updatedAt: string | null;
  sample?: { status: SampleStatus } | null;
  items: BoardLine[];
  groups?: TestGroup[];
};

/** The tube is not in the lab yet, so nothing can be run. */
export const awaitsSample = (o: Pick<BoardOrder, "status" | "sample">) =>
  o.status !== "cancelled" && !!o.sample && o.sample.status !== "qabul_qilindi";

export function summarizeLabBoard(
  orders: BoardOrder[],
  day: string,
  dayOf: (iso: string) => string,
): { counts: LabBoardCounts; groupsToday: Partial<Record<TestGroup, number>> } {
  const counts: LabBoardCounts = {
    today: 0,
    awaitingSample: 0,
    rejected: 0,
    inProgress: 0,
    review: 0,
    readyToday: 0,
    cancelledToday: 0,
  };
  const groupsToday: Partial<Record<TestGroup, number>> = {};

  for (const o of orders) {
    if (o.status === "cancelled") {
      if (dayOf(o.updatedAt ?? o.createdAt) === day) counts.cancelledToday += 1;
      continue;
    }
    if (dayOf(o.createdAt) === day) {
      counts.today += 1;
      for (const g of orderGroups(o.groups ?? [])) groupsToday[g] = (groupsToday[g] ?? 0) + 1;
    }
    if (awaitsSample(o)) {
      counts.awaitingSample += 1;
      if (o.sample!.status === "rad_etildi") counts.rejected += 1;
    } else if (needsEntry(o.items)) {
      counts.inProgress += 1;
    }
    if (needsReview(o.items)) counts.review += 1;
    if (o.items.length > 0 && isOrderReleased(o)) {
      const last = o.items.reduce<string>((m, i) => (i.verifiedAt && i.verifiedAt > m ? i.verifiedAt : m), "");
      if (last && dayOf(last) === day) counts.readyToday += 1;
    }
  }
  return { counts, groupsToday };
}
