import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";
import { getMaintenanceStatus } from "@/lib/systemSettings";

// Routes that must stay reachable even while maintenance mode is on, so
// admins can still log in and turn it back off, and clients can still find
// out maintenance mode changed.
const MAINTENANCE_EXEMPT_PATHS = new Set([
  "/login",
  "/maintenance",
  "/api/auth/login",
  "/api/auth/session",
  "/api/auth/signout",
  "/api/system/maintenance-stream",
  // Sentry's tunnel route (next.config.ts tunnelRoute) — must stay reachable
  // so client-side error reports aren't redirected to /maintenance.
  "/monitoring",
]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables! Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Automatically refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If hitting a protected route
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  // Only the login endpoint needs to be publicly reachable without a session
  const isPublicAuthRoute = request.nextUrl.pathname === "/api/auth/login";

  // ── Maintenance mode ──────────────────────────────────────
  // Blocks everyone except admins the moment it's turned on. This runs
  // ahead of the normal auth/role gate below so it also blocks logged-in
  // non-admin users, not just anonymous ones. Already-open sessions are
  // pushed to the maintenance screen near-instantly via the SSE stream at
  // /api/system/maintenance-stream; this check is what catches every
  // *new* request (page load, API call) in the meantime.
  if (!MAINTENANCE_EXEMPT_PATHS.has(request.nextUrl.pathname)) {
    const { maintenanceMode, message } = await getMaintenanceStatus();
    const role = user?.app_metadata?.role;
    if (maintenanceMode && role !== "admin") {
      if (isApiRoute) {
        return NextResponse.json(
          {
            success: false,
            error: message || "The app is under maintenance. Please try again shortly.",
            code: "MAINTENANCE_MODE",
          },
          { status: 503 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }
  }

  if ((isAdminRoute || isApiRoute) && !isPublicAuthRoute) {
    if (!user) {
      if (isApiRoute) {
        // code SESSION_INVALID lets clients (mobile app) distinguish a
        // revoked/expired session from other errors and force a re-login
        return NextResponse.json(
          { success: false, error: "Unauthorized", code: "SESSION_INVALID" },
          { status: 401 },
        );
      }
      // Not logged in -> Redirect to /login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Role check logic — MUST use app_metadata (server-only, tamper-proof)
    // Never use user_metadata for RBAC — users can modify it themselves via SDK
    const role = user.app_metadata?.role;
    if (role !== "admin" && role !== "staff" && role !== "driver") {
      if (isApiRoute) {
        return NextResponse.json(
          { error: "Forbidden - Insufficient permissions" },
          { status: 403 },
        );
      }
      // Logged in but not the right role -> Redirect to /unauthorized
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("email", user.email || "");
      return NextResponse.redirect(url);
    }

    // ── Page-level RBAC for /admin/* routes ──────────────────
    // Even though the user has a valid role, they may not be
    // allowed to view this specific page. Redirect to dashboard.
    if (
      isAdminRoute &&
      !canRoleAccessPage(request.nextUrl.pathname, role as UserRole)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  // If they are logged in and trying to hit the login page, redirect to admin
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
