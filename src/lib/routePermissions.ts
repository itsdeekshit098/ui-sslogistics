export type UserRole = "admin" | "staff" | "driver" | "superadmin";

/**
 * Defines which roles can access each /admin/* page.
 * If a page path is not listed here, all authenticated roles can access it.
 *
 * Matching logic: longest prefix match wins.
 * e.g. "/admin/sessions" matches before "/admin".
 *
 * "/admin/sessions" and "/admin/settings" are superadmin-exclusive — even
 * "admin" is locked out of those two, unlike every other admin-restricted page.
 */
export const PAGE_ROLE_MAP: Record<string, UserRole[]> = {
  "/admin/sessions": ["superadmin"],
  "/admin/settings": ["superadmin"],
  "/admin/warranty": ["admin", "superadmin"],
  "/admin/vehicles": ["admin", "staff", "superadmin"],
  "/admin/activity-log": ["admin", "staff", "superadmin"],
  "/admin/repair-records": ["admin", "staff", "superadmin"],
  "/admin/technicians": ["admin", "staff", "superadmin"],
  "/admin/drivers": ["admin", "staff", "superadmin"],
  "/admin/vehicle-owners": ["admin", "staff", "superadmin"],
  "/admin/external-trips": ["admin", "staff", "superadmin"],
  // Pages accessible to ALL authenticated roles (including driver):
  // /admin              → Dashboard
  // /admin/diesel-records
};

/**
 * Returns whether a given role is permitted to view the specified page.
 * Uses longest-prefix matching so sub-routes inherit the parent restriction
 * (e.g. "/admin/vehicles/123" is governed by the "/admin/vehicles" rule).
 *
 * If no matching rule exists the page is considered unrestricted.
 */
export function canRoleAccessPage(pathname: string, role: UserRole): boolean {
  const matchedKey = Object.keys(PAGE_ROLE_MAP)
    .filter((key) => pathname === key || pathname.startsWith(key + "/"))
    .sort((a, b) => b.length - a.length)[0]; // longest match first

  if (!matchedKey) return true; // not restricted
  return PAGE_ROLE_MAP[matchedKey].includes(role);
}

export const ALL_ROLES: UserRole[] = ["admin", "staff", "driver", "superadmin"];

/**
 * Single source of truth for role predicates — used by both server guards
 * (src/lib/auth.ts, middleware) and client components (via AuthContext), so
 * a new role only ever needs to be wired up in one place.
 */
export function isValidRole(role: string | null | undefined): role is UserRole {
  return ALL_ROLES.includes(role as UserRole);
}

/** Admin-equivalent: "admin" or "superadmin". Superadmin is admin-equivalent
 * everywhere except the superadmin-exclusive settings/sessions pages. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

/** Can create/edit records: elevated admin or staff. */
export function canEdit(role: string | null | undefined): boolean {
  return isAdmin(role) || role === "staff";
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}
