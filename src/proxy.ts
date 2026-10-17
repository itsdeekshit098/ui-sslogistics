import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export default async function proxy(request: NextRequest) {
  // Vercel sets VERCEL=1 on every build and runtime it manages, preview or
  // production, regardless of NODE_ENV — this is a second, independent gate
  // so the bypass can't fire on a Vercel deployment even if NODE_ENV were
  // ever misconfigured there. Local dev and CI never set this var.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.E2E_MOCK_AUTH === "true" &&
    !process.env.VERCEL
  ) {
    return NextResponse.next();
  }

  // Update session and protect routes
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
