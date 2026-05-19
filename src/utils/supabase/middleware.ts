import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";

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

  if ((isAdminRoute || isApiRoute) && !isPublicAuthRoute) {
    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
