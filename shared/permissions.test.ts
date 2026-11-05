import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  LEGACY_ADMIN,
  PERMISSIONS,
  PERMISSION_GROUPS,
  SUPER_ADMIN,
  SYSTEM_ROLES,
  canonicalRoleKey,
  holdsAll,
  isPermission,
  resolvePermissions,
} from "./permissions";
import { insertRoleSchema } from "./schema";

describe("permission catalogue", () => {
  it("puts every permission in a known group", () => {
    const groups = new Set<string>(PERMISSION_GROUPS.map((g) => g.key));
    for (const p of ALL_PERMISSIONS) expect(groups.has(PERMISSIONS[p].group)).toBe(true);
  });

  it("uses module.action keys", () => {
    for (const p of ALL_PERMISSIONS) expect(p).toMatch(/^[a-z]+\.[a-z]+$/);
  });
});

describe("system roles", () => {
  it("are exactly the eleven roles of TZ §3, each once", () => {
    const keys = SYSTEM_ROLES.map((r) => r.key);
    expect(keys).toEqual([
      "super_admin",
      "rahbar",
      "registrator",
      "shifokor",
      "laborant",
      "lab_mudiri",
      "omborchi",
      "hamshira",
      "kassir",
      "buxgalter",
      "auditor",
    ]);
  });

  it("only reference permissions that exist", () => {
    for (const r of SYSTEM_ROLES) for (const p of r.permissions) expect(isPermission(p)).toBe(true);
  });

  it("reserve refunds for authorised people (TZ §9.2)", () => {
    const refunders = SYSTEM_ROLES.filter((r) => r.permissions.includes("payments.refund")).map((r) => r.key);
    expect(refunders.sort()).toEqual(["rahbar", "super_admin"]);
  });

  it("keep the auditor read-only", () => {
    const auditor = SYSTEM_ROLES.find((r) => r.key === "auditor")!;
    const writes = auditor.permissions.filter((p) => !/\.(read|view)$/.test(p));
    expect(writes).toEqual([]);
  });

  it("give role and staff management to the super administrator alone", () => {
    for (const r of SYSTEM_ROLES) {
      if (r.key === SUPER_ADMIN) continue;
      expect(r.permissions).not.toContain("roles.manage");
      expect(r.permissions).not.toContain("users.manage");
    }
  });
});

describe("resolvePermissions", () => {
  it("gives the super administrator everything regardless of the stored row", () => {
    expect(resolvePermissions(SUPER_ADMIN, [])).toEqual(ALL_PERMISSIONS);
    expect(resolvePermissions(LEGACY_ADMIN, null)).toEqual(ALL_PERMISSIONS);
  });

  it("drops unknown and duplicate entries", () => {
    expect(resolvePermissions("kassir", ["payments.create", "payments.create", "nope.gone"])).toEqual([
      "payments.create",
    ]);
  });

  it("gives an unknown role nothing", () => {
    expect(resolvePermissions("ghost", undefined)).toEqual([]);
  });
});

describe("helpers", () => {
  it("canonicalRoleKey folds the legacy admin key", () => {
    expect(canonicalRoleKey("admin")).toBe(SUPER_ADMIN);
    expect(canonicalRoleKey("laborant")).toBe("laborant");
    expect(canonicalRoleKey(null)).toBe("");
  });

  it("holdsAll", () => {
    expect(holdsAll(["a", "b"], ["a"])).toBe(true);
    expect(holdsAll(["a"], ["a", "b"])).toBe(false);
    expect(holdsAll([], [])).toBe(true);
  });
});

describe("insertRoleSchema", () => {
  it("rejects permissions that do not exist", () => {
    const r = insertRoleSchema.safeParse({ name: "Test", permissions: ["patients.read", "root.all"] });
    expect(r.success).toBe(false);
  });

  it("deduplicates and trims", () => {
    const r = insertRoleSchema.parse({ name: "  UZI shifokori ", permissions: ["patients.read", "patients.read"] });
    expect(r.name).toBe("UZI shifokori");
    expect(r.permissions).toEqual(["patients.read"]);
  });
});
