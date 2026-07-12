import { createClient } from "@/utils/supabase/server";
import { setSentryUser } from "@/lib/sentry/setUser";
import { canEdit, isAdmin, isValidRole } from "@/lib/routePermissions";

// Re-exported so existing call sites importing isAdmin from "@/lib/auth" keep working.
export { isAdmin };

export interface AuthUser {
  id: string;
  email: string;
  role: string | null;
  /** Human-readable name for display purposes (e.g. notifications). Falls
   * back to email when the user has no display_name set in user_metadata —
   * not every account has one. */
  displayName: string;
}

/**
 * Retrieves the authenticated user from the current request cookies.
 * Returns null if the user is not authenticated.
 * Use this in API routes to identify who is performing an action.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const email = user.email || "unknown";
    const role = user.app_metadata?.role || null;

    // id + role only — never email/PII — so captured errors carry safe
    // attribution without violating the logger's no-PII contract.
    setSentryUser({ id: user.id, role });

    return {
      id: user.id,
      email,
      role,
      displayName: user.user_metadata?.display_name || email,
    };
  } catch {
    return null;
  }
}

/**
 * Strongly enforces that the user must be authenticated (admin, staff, driver, or superadmin).
 */
export async function requireUserAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (!isValidRole(user.role)) {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}

/**
 * Strongly enforces that the user must be authenticated AND have the 'admin', 'staff', or 'superadmin' role.
 * Throws an error if they don't, ensuring API operations halt immediately.
 */
export async function requireAdminAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (!canEdit(user.role)) {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}

/**
 * Strongly enforces that the user must be authenticated AND have the 'admin' or 'superadmin' role.
 * Use this for admin-only features (not the superadmin-exclusive ones — see requireSuperAdminAuth).
 */
export async function requireStrictAdminAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (!isAdmin(user.role)) {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}

/**
 * Strongly enforces that the user must be authenticated AND have the 'superadmin' role only.
 * Use this for the superadmin-exclusive settings/sessions management endpoints,
 * which even a regular 'admin' cannot access.
 */
export async function requireSuperAdminAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (user.role !== "superadmin") {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}
