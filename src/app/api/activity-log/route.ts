import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";

/**
 * GET — Fetch activity logs with pagination.
 * Query params: ?page=1&limit=30
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
    const offset = (page - 1) * limit;

    // Fetch total count
    const { count } = await supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true });

    // Fetch paginated data
    const { data, error } = await supabaseAdmin
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED")) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof Error && err.message.startsWith("FORBIDDEN")) return NextResponse.json({ error: err.message }, { status: 403 });
    
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
