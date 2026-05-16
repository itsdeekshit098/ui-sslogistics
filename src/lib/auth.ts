import { createClient } from "@/utils/supabase/server";

export interface AuthUser {
  id: string;
  email: string;
  role: string | null;
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

    return {
      id: user.id,
      email: user.email || "unknown",
      role: user.app_metadata?.role || null,
    };
  } catch {
    return null;
  }
}

/**
 * Strongly enforces that the user must be authenticated (admin, staff, or driver).
 */
export async function requireUserAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (user.role !== "admin" && user.role !== "staff" && user.role !== "driver") {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}

/**
 * Strongly enforces that the user must be authenticated AND have the 'admin' or 'staff' role.
 * Throws an error if they don't, ensuring API operations halt immediately.
 */
export async function requireAdminAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (user.role !== "admin" && user.role !== "staff") {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}

/**
 * Strongly enforces that the user must be authenticated AND have the 'admin' role only.
 * Use this for sensitive operations like session management, banning users, etc.
 */
export async function requireStrictAdminAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Missing authentication instance");
  }
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN: Insufficient role privileges");
  }
  return user;
}
