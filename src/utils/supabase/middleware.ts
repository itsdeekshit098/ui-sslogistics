import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Automatically refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If hitting a protected route
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      // Not logged in -> Redirect to /login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Role check logic
    const role = user.user_metadata?.role;
    if (role !== "admin" && role !== "staff") {
      // Logged in but not the right role -> Redirect to /unauthorized
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      url.searchParams.set("email", user.email || "");
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
