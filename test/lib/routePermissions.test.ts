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
  it("allows a listed role on an exact restricted path", () => {
    expect(canRoleAccessPage("/admin/loans", "admin")).toBe(true);
  });

  it("denies a role not listed for a restricted path", () => {
    expect(canRoleAccessPage("/admin/loans", "staff")).toBe(false);
    expect(canRoleAccessPage("/admin/loans", "driver")).toBe(false);
  });

  it("allows access to an unrestricted page for any role", () => {
    expect(canRoleAccessPage("/admin", "driver")).toBe(true);
    expect(canRoleAccessPage("/admin/diesel-records", "driver")).toBe(true);
  });

  it("governs a sub-route by its parent's restriction", () => {
    expect(canRoleAccessPage("/admin/loans/123", "staff")).toBe(false);
    expect(canRoleAccessPage("/admin/loans/123", "admin")).toBe(true);
  });

  it("does not match a page whose name merely starts with a restricted prefix", () => {
    // "/admin/loansomething" must not be governed by the "/admin/loans" rule.
    expect(canRoleAccessPage("/admin/loansomething", "staff")).toBe(true);
  });

  it("picks the longest matching prefix, not the first one found", () => {
    // "/admin/sessions" (superadmin-only) must win over the unrestricted "/admin".
    expect(canRoleAccessPage("/admin/sessions", "admin")).toBe(false);
    expect(canRoleAccessPage("/admin/sessions", "superadmin")).toBe(true);
  });

  it("locks even a plain admin out of the superadmin-exclusive settings page", () => {
    expect(canRoleAccessPage("/admin/settings", "admin")).toBe(false);
    expect(canRoleAccessPage("/admin/settings", "superadmin")).toBe(true);
  });

  it("allows every role, including driver, on the attendance page", () => {
    for (const role of ALL_ROLES) {
      expect(canRoleAccessPage("/admin/attendance", role)).toBe(true);
    }
  });

  it("allows superadmin everywhere an admin is allowed", () => {
    const adminOnlyPaths = ["/admin/loans", "/admin/fundings", "/admin/clients", "/admin/bank-accounts", "/admin/salaries"];
    for (const path of adminOnlyPaths) {
      expect(canRoleAccessPage(path, "superadmin")).toBe(true);
    }
  });
});

describe("isValidRole", () => {
  it("accepts each of the four known roles", () => {
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("staff")).toBe(true);
    expect(isValidRole("driver")).toBe(true);
    expect(isValidRole("superadmin")).toBe(true);
  });

  it("rejects an unknown role string", () => {
    expect(isValidRole("owner")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is true for admin and superadmin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("superadmin")).toBe(true);
  });

  it("is false for staff, driver, null", () => {
    expect(isAdmin("staff")).toBe(false);
    expect(isAdmin("driver")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("canEdit", () => {
  it("is true for admin, superadmin, and staff", () => {
    expect(canEdit("admin")).toBe(true);
    expect(canEdit("superadmin")).toBe(true);
    expect(canEdit("staff")).toBe(true);
  });

  it("is false for driver and null", () => {
    expect(canEdit("driver")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("is true only for superadmin", () => {
    expect(isSuperAdmin("superadmin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});
