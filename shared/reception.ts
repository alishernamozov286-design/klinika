/**
 * The desk's view of the day's appointments (TZ §4.1.1): "navbatdagi
 * bemorlar" and "qabulga kelganlar". Pure, so the route and the tests agree
 * on what counts as waiting, upcoming and late.
 */
import type { AppointmentWithDetails, ReceptionBoard, ReceptionQueueCounts } from "./schema";

/** How many of each list the board carries; the queue page has the rest. */
export const RECEPTION_LIST_LIMIT = 8;

export function summarizeQueue(
  list: AppointmentWithDetails[],
  opts: { isToday: boolean; now: string; limit?: number },
): NonNullable<ReceptionBoard["queue"]> {
  const limit = opts.limit ?? RECEPTION_LIST_LIMIT;
  const counts: ReceptionQueueCounts = {
    total: 0,
    scheduled: 0,
    late: 0,
    arrived: 0,
    inProgress: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
  };

  for (const a of list) {
    if (a.status !== "cancelled") counts.total++;
    switch (a.status) {
      case "scheduled":
        counts.scheduled++;
        // Only today can be late: a future day has not started, a past one
        // is over and its leftovers are no-shows for the desk to mark.
        if (opts.isToday && a.startTime < opts.now) counts.late++;
        break;
      case "arrived":
        counts.arrived++;
        break;
      case "in_progress":
        counts.inProgress++;
        break;
      case "completed":
        counts.completed++;
        break;
      case "no_show":
        counts.noShow++;
        break;
      case "cancelled":
        counts.cancelled++;
        break;
    }
  }

  // In the chair first (the desk needs to know the room is busy), then the
  // waiting room in arrival order — the order they will be called in.
  const waiting = list
    .filter((a) => a.status === "in_progress" || a.status === "arrived")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
      return (a.arrivedAt ?? "").localeCompare(b.arrivedAt ?? "") || a.queueNumber - b.queueNumber;
    })
    .slice(0, limit);

  const upcoming = list
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.queueNumber - b.queueNumber)
    .slice(0, limit);

  return { counts, waiting, upcoming };
}
