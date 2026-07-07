import { after } from "next/server";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";

const PHONE_REGEX = /^[6-9]\d{9}$/;

// ─── GET — List/search vendors (for typeahead) ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 50),
    );
    const search = searchParams.get("search")?.trim() ?? "";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("vendors")
      .select("id, name, phone, location, created_at", { count: "exact" })
      .order("name", { ascending: true });

    if (search) {
      const safe = search.replace(/[,.*()%_]/g, "");
      query = query.or(
        `name.ilike.%${safe}%,phone.ilike.%${safe}%,location.ilike.%${safe}%`,
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return serverError(error);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — Create new vendor ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return apiError("Vendor name is required", 400);
    }

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (phone && !PHONE_REGEX.test(phone)) {
      return apiError("Invalid phone number (must be 10 digits)", 400);
    }

    const location =
      typeof body.location === "string" ? body.location.trim() : "";

    const insertPayload = {
      name,
      phone: phone || null,
      location: location || null,
      created_by: authUser.id,
    };

    const { data: vendor, error } = await supabaseAdmin
      .from("vendors")
      .insert([insertPayload])
      .select("id, name, phone, location, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("A vendor with this name already exists", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_VENDOR",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vendors",
        recordId: vendor.id,
        details: insertPayload,
      });
    });

    return apiSuccess({ vendor }, "Vendor created", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
