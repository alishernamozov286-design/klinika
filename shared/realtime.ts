/**
 * Real-time yangilanish (B8.1, TZ §14): what one person saves, everyone else's
 * screen shows within seconds, without reloading the page.
 *
 * The deployment is serverless (Vercel), so there is no long-lived socket to
 * push over. Instead every successful write bumps a version number per topic
 * ("lab", "cash", …) and each open tab asks for the versions every few seconds
 * — a tiny request, answered from one small table. A topic whose version moved
 * tells the tab which of its cached lists to fetch again; nothing else is
 * reloaded.
 *
 * The feed says *that* something changed, never *what*: no ids, no names, no
 * counts. Who may see the data is still decided by the data's own routes.
 */

export const CHANGE_TOPICS = [
  "appointments",
  "patients",
  "lab",
  "inventory",
  "inpatient",
  "cash",
  "referrals",
  "notifications",
  "settings",
] as const;
export type ChangeTopic = (typeof CHANGE_TOPICS)[number];
export type TopicVersions = Partial<Record<ChangeTopic, number>>;

/** GET /api/changes. `live: false` — the feed is not available (its table is not migrated yet); the tab falls back to plain polling. */
export type ChangesResponse = { live: boolean; versions: TopicVersions };

/**
 * Which topics a successful write under an API prefix touches. A payment moves
 * the bill and also the visit's, order's or stay's "paid" badge, so it bumps
 * those too. Sign-in, the session, the error log and the like touch nothing
 * anyone else is looking at.
 */
const WRITE_TOPICS: readonly (readonly [string, readonly ChangeTopic[]])[] = [
  ["/api/appointments", ["appointments", "cash"]],
  ["/api/cabinet", ["appointments"]],
  ["/api/records", ["appointments", "patients"]],
  ["/api/doctors", ["appointments", "settings"]],
  ["/api/services", ["appointments", "cash", "settings"]],
  ["/api/patients", ["patients", "appointments", "lab"]],
  ["/api/allergies", ["patients"]],
  ["/api/referrals", ["referrals", "patients"]],
  // Verifying or amending a result notifies the ordering doctor (B3.9).
  ["/api/orders", ["lab", "cash", "patients", "notifications"]],
  ["/api/tests", ["lab", "settings"]],
  ["/api/qc", ["lab"]],
  ["/api/devices", ["lab"]],
  ["/api/device-errors", ["lab"]],
  ["/api/consumption", ["lab", "inventory"]],
  ["/api/inventory", ["inventory"]],
  ["/api/admissions", ["inpatient", "cash", "lab"]],
  ["/api/beds", ["inpatient"]],
  ["/api/wards", ["inpatient"]],
  ["/api/departments", ["inpatient", "settings"]],
  ["/api/observations", ["inpatient"]],
  ["/api/procedure-tasks", ["inpatient", "inventory"]],
  ["/api/inpatient-orders", ["inpatient"]],
  ["/api/bills", ["cash", "appointments", "lab", "inpatient"]],
  ["/api/payments", ["cash", "appointments", "lab", "inpatient"]],
  // A refund request or decision notifies the cashier or the head (B5.5).
  ["/api/refunds", ["cash", "appointments", "lab", "notifications"]],
  ["/api/receipts", ["cash"]],
  ["/api/cash-shifts", ["cash"]],
  ["/api/expenses", ["cash"]],
  ["/api/notifications", ["notifications"]],
  ["/api/icd10", ["settings"]],
  ["/api/settings", ["settings"]],
  ["/api/users", ["settings"]],
  ["/api/roles", ["settings"]],
  // Telegram: a patient linking their chat changes the patient's card.
  ["/api/telegram", ["patients"]],
];

/** The cached API lists a topic covers — what a tab fetches again when the topic moves. */
export const TOPIC_READS: Record<ChangeTopic, readonly string[]> = {
  appointments: ["/api/appointments", "/api/reception", "/api/cabinet", "/api/records", "/api/doctors", "/api/stats"],
  patients: ["/api/patients", "/api/records", "/api/referrals"],
  lab: ["/api/orders", "/api/lab-board", "/api/samples", "/api/qc", "/api/devices", "/api/device-errors", "/api/tests", "/api/stats"],
  inventory: ["/api/inventory", "/api/consumption"],
  inpatient: ["/api/admissions", "/api/inpatient", "/api/wards", "/api/departments", "/api/procedure-tasks"],
  cash: ["/api/bills", "/api/cashier", "/api/cash-shifts", "/api/debtors", "/api/refunds", "/api/receipts", "/api/expenses"],
  referrals: ["/api/referrals"],
  notifications: ["/api/notifications"],
  settings: ["/api/settings", "/api/services", "/api/price-list", "/api/tests", "/api/doctors", "/api/departments", "/api/users", "/api/roles"],
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** True when `path` is `prefix` itself or below it ("/api/orders/5", not "/api/ordersX"). */
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** The topics a successful request touches (none for reads and for writes nobody else watches). */
export function topicsForWrite(method: string, path: string): ChangeTopic[] {
  if (!WRITE_METHODS.has(method.toUpperCase())) return [];
  const clean = path.split("?")[0];
  const hit = WRITE_TOPICS.find(([prefix]) => under(clean, prefix));
  return hit ? [...hit[1]] : [];
}

/**
 * Topics whose version differs from the last one seen. The first answer is
 * only a baseline (null before): a tab that just opened already has fresh
 * data. A version going *down* (the file store restarted) counts as a change.
 */
export function changedTopics(before: TopicVersions | null, after: TopicVersions): ChangeTopic[] {
  if (!before) return [];
  return CHANGE_TOPICS.filter((t) => (before[t] ?? 0) !== (after[t] ?? 0));
}

/** The API prefixes to fetch again for these topics, each once. */
export function readsFor(topics: readonly ChangeTopic[]): string[] {
  return [...new Set(topics.flatMap((t) => TOPIC_READS[t]))];
}

// ------------------------------------------------------------ pacing

/** Someone who touched the page this recently is "working": the feed is quick for them and their requests keep the session alive. */
export const ACTIVE_WINDOW_MS = 60_000;
/** Request header: "0" — this request was made by the page on its own (a background refresh), not by the person. */
export const USER_ACTIVE_HEADER = "x-user-active";

export const POLL_ACTIVE_MS = 4_000;
export const POLL_IDLE_MS = 15_000;
/** Before the feed's table exists: look again now and then. */
export const POLL_UNAVAILABLE_MS = 60_000;
const BACKOFF_MAX_MS = 60_000;
/** Idle for longer than this: the slower pace. */
const IDLE_AFTER_MS = 2 * 60_000;

/**
 * How long until the next look. Null — do not poll (the tab is hidden; it
 * looks again the moment it is shown). Failures back off to a minute.
 */
export function nextPollDelay(s: { visible: boolean; idleMs: number; failures: number; available: boolean }): number | null {
  if (!s.visible) return null;
  if (s.failures > 0) return Math.min(BACKOFF_MAX_MS, POLL_ACTIVE_MS * 2 ** s.failures);
  if (!s.available) return POLL_UNAVAILABLE_MS;
  return s.idleMs > IDLE_AFTER_MS ? POLL_IDLE_MS : POLL_ACTIVE_MS;
}

/**
 * A page's own refresh timer while the feed is live: the feed brings changes,
 * so the timer only has to catch what passes with time alone (a dose turning
 * overdue, a wait growing) — at a quarter of the pace, two minutes at the
 * least. Without the feed the timer runs as written.
 */
export function fallbackInterval(baseMs: number, live: boolean): number {
  return live ? Math.max(baseMs * 4, 120_000) : baseMs;
}
