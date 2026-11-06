import type { NextFunction, Request, Response } from "express";
import {
  SUPER_ADMIN,
  SYSTEM_ROLES,
  canonicalRoleKey,
  resolvePermissions,
  type Permission,
} from "@shared/permissions";
import type { PublicUser, RoleRecord, SessionUser } from "@shared/schema";
import { storage } from "./storage";

/**
 * Role lookups for every authenticated request.
 *
 * The whole roles table is a dozen rows, so it is held in memory and refreshed
 * every ROLE_TTL_MS. Without this each request would pay a round trip to the
 * (remote) database just to learn what its user may do. Edits made through the
 * API call invalidateRoles(), so on this instance they apply immediately; other
 * serverless instances pick them up within the TTL.
 */
const ROLE_TTL_MS = 60_000;

let cache: { roles: Map<string, RoleRecord>; loadedAt: number } | null = null;
let inflight: Promise<Map<string, RoleRecord>> | null = null;

/** Built-in defaults, used only when the roles table does not exist yet. */
function fallbackRoles(): Map<string, RoleRecord> {
  const now = new Date(0).toISOString();
  return new Map(
    SYSTEM_ROLES.map((r) => [
      r.key,
      {
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: [...r.permissions],
        isSystem: true,
        createdAt: now,
        createdBy: null,
        updatedAt: null,
        updatedBy: null,
      },
    ]),
  );
}

async function fetchRoles(): Promise<Map<string, RoleRecord>> {
  try {
    const list = await storage.listRoles();
    return new Map(list.map(({ userCount: _count, ...role }) => [role.key, role]));
  } catch (err) {
    // Postgres before `npm run db:roles`: keep the app usable on the defaults
    // rather than answering every request with a 500.
    if ((err as { code?: string } | null)?.code === "42P01") return fallbackRoles();
    throw err;
  }
}

export async function getRoles(): Promise<Map<string, RoleRecord>> {
  if (cache && Date.now() - cache.loadedAt < ROLE_TTL_MS) return cache.roles;
  inflight ??= fetchRoles()
    .then((roles) => {
      cache = { roles, loadedAt: Date.now() };
      return roles;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateRoles(): void {
  cache = null;
}

/**
 * The account plus its resolved role. A role key with no row (a role deleted
 * from under its holders, or a typo in an import) resolves to no permissions:
 * the user can still sign in and change their password, and nothing else.
 */
export async function toSessionUser(user: PublicUser): Promise<SessionUser> {
  const key = canonicalRoleKey(user.role);
  const role = (await getRoles()).get(key);
  return {
    ...user,
    role: key,
    roleName: role?.name ?? (key === SUPER_ADMIN ? "Super administrator" : "Rol belgilanmagan"),
    permissions: resolvePermissions(key, role?.permissions),
  };
}

export function hasPermission(req: Request, permission: Permission): boolean {
  return Boolean(req.user?.permissions?.includes(permission));
}

export function isSuperAdmin(req: Request): boolean {
  return req.user?.role === SUPER_ADMIN;
}

/**
 * Route guard: the user must hold at least one of the listed permissions.
 *
 * "Any of" rather than "all of" because that is how the screens are shared:
 * the sample panel, for example, is worked by the registrar who draws the
 * tube and by the laborant who receives it, each under their own grant.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated?.() || !req.user) {
      return res.status(401).json({ message: "Avval tizimga kiring" });
    }
    if (!permissions.some((p) => hasPermission(req, p))) {
      return res.status(403).json({ message: "Bu amal uchun ruxsatingiz yo'q" });
    }
    next();
  };
}
