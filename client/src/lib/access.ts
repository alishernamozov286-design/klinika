import type { Permission } from "@shared/permissions";

/**
 * Which permissions open which screen — any one of the listed is enough.
 *
 * One table for the router guard, the sidebar and the command palette, so the
 * three can never disagree about what a role may reach. A route missing from
 * here is open to every signed-in user (the dashboard, and Sozlamalar, whose
 * tabs are filtered individually because every user needs the password one).
 */
export const ROUTE_ACCESS: Record<string, Permission[]> = {
  "/patients": ["patients.read"],
  "/queue": ["appointments.read", "appointments.manage"],
  "/cabinet": ["appointments.serve"],
  "/cabinet/visit": ["appointments.serve", "records.read"],
  "/services": ["services.manage", "appointments.manage", "appointments.read"],
  "/orders": ["orders.read"],
  "/results": ["orders.read"],
  "/reports": ["reports.view"],
  "/expenses": ["expenses.read"],
  "/staff": ["users.manage", "roles.manage"],
  "/doctors": ["doctors.manage"],
  "/departments": ["departments.manage"],
  "/devices": ["devices.read"],
  "/qc": ["qc.read"],
  "/inventory": ["inventory.read"],
};
