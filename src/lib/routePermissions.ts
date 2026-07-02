export type UserRole = "admin" | "staff" | "driver";

/**
 * Defines which roles can access each /admin/* page.
 * If a page path is not listed here, all authenticated roles can access it.
 *
 * Matching logic: longest prefix match wins.
 * e.g. "/admin/sessions" matches before "/admin".
 */
export const PAGE_ROLE_MAP: Record<string, UserRole[]> = {
  "/admin/sessions": ["admin"],
  "/admin/warranty": ["admin"],
  "/admin/vehicles": ["admin", "staff"],
  "/admin/activity-log": ["admin", "staff"],
  "/admin/repair-records": ["admin", "staff"],
  "/admin/technicians": ["admin", "staff"],
  "/admin/drivers": ["admin", "staff"],
  "/admin/vehicle-owners": ["admin", "staff"],
  "/admin/external-trips": ["admin", "staff"],
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
