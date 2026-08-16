import type { AuthUser } from "@/lib/auth";

/** A staff-role user — enough auth to read most feature routes, not the money modules. */
export const STAFF_USER: AuthUser = {
  id: "user-staff",
  email: "staff@sslogistics.test",
  role: "staff",
  displayName: "Staff User",
};

/** Passes `requireAdminAuth` / `requireStrictAdminAuth` (money modules require this or higher). */
export const ADMIN_USER: AuthUser = {
  id: "user-admin",
  email: "admin@sslogistics.test",
  role: "admin",
  displayName: "Admin User",
};

/** Passes every auth gate, including `requireSuperAdminAuth`. */
export const SUPERADMIN_USER: AuthUser = {
  id: "user-superadmin",
  email: "boss@sslogistics.test",
  role: "superadmin",
  displayName: "Boss",
};

export function unauthorizedError(): Error {
  return new Error("UNAUTHORIZED: Missing authentication instance");
}

export function forbiddenError(): Error {
  return new Error("FORBIDDEN: Insufficient role privileges");
}
