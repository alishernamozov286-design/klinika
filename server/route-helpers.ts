/**
 * Small helpers every route module shares: async error forwarding, the
 * acting user, query-string parsing and the audit trail.
 */
import type { NextFunction, Request, Response } from "express";
import { storage } from "./storage";
import type { Actor } from "./storage-types";

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const numberParam = (value: unknown, fallback?: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const stringParam = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/** Who is doing this, in the shape the storage layer stamps onto rows. */
export function actorOf(req: Request): Actor {
  return { id: req.user?.id ?? null, name: req.user?.fullName ?? "Tizim" };
}

/**
 * Appends to the audit log.
 *
 * Never rejects: the log is a record of the work, not part of it, so a logging
 * failure must not roll back a payment the cashier already took. Failures go to
 * the server console where they can be noticed.
 */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
): Promise<void> {
  try {
    await storage.writeAudit({ actor: actorOf(req), action, entity, entityId, summary });
  } catch (err) {
    console.error("[audit] yozib bo'lmadi:", err);
  }
}

/** Lists answer empty before the migration that creates their table has run. */
export const emptyIfMissing = <T>(err: unknown, empty: T): T => {
  if ((err as { code?: string } | null)?.code === "42P01") return empty;
  throw err;
};
