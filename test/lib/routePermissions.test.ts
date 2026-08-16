import { describe, it, expect } from "vitest";
import {
  canRoleAccessPage,
  isValidRole,
  isAdmin,
  canEdit,
  isSuperAdmin,
  ALL_ROLES,
} from "@/lib/routePermissions";

describe("canRoleAccessPage", () => {
  it("allows a listed role on an exact-match restricted page", () => {
    expect(canRoleAccessPage("/admin/loans", "admin")).toBe(true);
  });

  it("blocks staff from the money pages that lock them out", () => {
    expect(canRoleAccessPage("/admin/loans", "staff")).toBe(false);
    expect(canRoleAccessPage("/admin/fundings", "staff")).toBe(false);
    expect(canRoleAccessPage("/admin/clients", "staff")).toBe(false);
  });

  it("locks admin out of the two superadmin-exclusive pages", () => {
    expect(canRoleAccessPage("/admin/sessions", "admin")).toBe(false);
    expect(canRoleAccessPage("/admin/settings", "admin")).toBe(false);
    expect(canRoleAccessPage("/admin/sessions", "superadmin")).toBe(true);
  });

  it("inherits the parent restriction on a sub-route via longest-prefix match", () => {
    expect(canRoleAccessPage("/admin/loans/123", "staff")).toBe(false);
    expect(canRoleAccessPage("/admin/loans/123", "admin")).toBe(true);
  });

  it("does not let a page with a matching prefix but no separator borrow the restriction", () => {
    // "/admin/loansomething" starts with "/admin/loans" as a raw string but
    // is not actually a sub-route of it, so it must not inherit the rule.
    expect(canRoleAccessPage("/admin/loansomething", "driver")).toBe(true);
  });

  it("treats an unlisted page as unrestricted for every valid role", () => {
    expect(canRoleAccessPage("/admin/diesel-records", "driver")).toBe(true);
    expect(canRoleAccessPage("/admin", "driver")).toBe(true);
  });

  it("picks the longer, more specific prefix when two rules could match", () => {
    // "/admin/vehicles" is broader (admin/staff/superadmin); nothing narrower
    // is registered under it today, but the matcher must still prefer the
    // longest matching key rather than an arbitrary one.
    expect(canRoleAccessPage("/admin/vehicles/42", "staff")).toBe(true);
    expect(canRoleAccessPage("/admin/vehicles/42", "driver")).toBe(false);
  });
});

describe("isValidRole", () => {
  it("accepts every role in ALL_ROLES", () => {
    for (const role of ALL_ROLES) {
      expect(isValidRole(role)).toBe(true);
    }
  });

  it("rejects null, undefined, and an unknown string", () => {
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole("owner")).toBe(false);
  });
});

describe("isAdmin / canEdit / isSuperAdmin", () => {
  it("isAdmin is true for admin and superadmin only", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("superadmin")).toBe(true);
    expect(isAdmin("staff")).toBe(false);
    expect(isAdmin("driver")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("canEdit additionally allows staff", () => {
    expect(canEdit("staff")).toBe(true);
    expect(canEdit("admin")).toBe(true);
    expect(canEdit("driver")).toBe(false);
  });

  it("isSuperAdmin is true for superadmin only, not plain admin", () => {
    expect(isSuperAdmin("superadmin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
  });
});
