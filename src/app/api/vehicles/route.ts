import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

/** Allowed columns for vehicle insert/update — prevents mass assignment */
const ALLOWED_VEHICLE_FIELDS = [
  "vehicle_number",
  "vehicle_type",
  "capacity",
  "company",
  "model",
  "status",
  "last_service_date",
  "expected_kml",
  "tank_capacity",
  "fuel_type",
] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const key of ALLOWED_VEHICLE_FIELDS) {
    if (key in body) {
      const value = body[key];
      picked[key] = value === "" ? null : value;
    }
  }
  return picked;
}

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
    const type = searchParams.get("type")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("vehicles")
      .select("*", { count: "exact" })
      .order("id", { ascending: false });

    if (search) {
      // Escape Postgres LIKE wildcards to prevent pattern injection
      const escaped = search.replace(/[%_]/g, "\\$&");
      query = query.ilike("vehicle_number", `%${escaped}%`);
    }
    if (type) {
      query = query.eq("vehicle_type", type);
    }
    if (status) {
      query = query.eq("status", status);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return apiError(error.message, 500);
    }

    // Stats — get aggregated counts via RPC for optimization
    const { data: statsData, error: statsError } = await supabaseAdmin.rpc(
      "get_vehicles_summary",
      {
        p_search: search || null,
        p_type: type || null,
        p_status: status || null,
      }
    );

    if (statsError) {
      return apiError(statsError.message, 500);
    }

    const stats = { total: 0, active: 0, maintenance: 0, idle: 0 };
    if (statsData && statsData.length > 0) {
      const row = statsData[0];
      stats.total = Number(row.total_count || 0);
      stats.active = Number(row.active_count || 0);
      stats.maintenance = Number(row.maintenance_count || 0);
      stats.idle = Number(row.idle_count || 0);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0, stats });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    const payload = pickAllowedFields(body);

    // Attach who created this record
    payload.created_by = authUser.id;
    payload.updated_by = authUser.id;

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      return apiError(error.message, 500);
    }

    after(() =>
      logActivity({
        action: "CREATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: data?.id || null,
        details: {
          vehicle_number: payload.vehicle_number,
          vehicle_type: payload.vehicle_type,
          company: payload.company,
          model: payload.model,
        },
      }),
    );

    return apiSuccess({ id: data?.id }, "Vehicle created successfully", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return apiError("Missing vehicle ID", 400);
    }

    const updatePayload = pickAllowedFields(body);
    updatePayload.updated_by = authUser.id;

    const { error } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return apiError(error.message, 500);
    }

    after(() =>
      logActivity({
        action: "UPDATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: id,
        details: {
          changes: updatePayload,
        },
      }),
    );

    return apiSuccess(null, "Vehicle updated successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    if (authUser.role !== "admin") {
      return apiError("Only admins can delete vehicles", 403);
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing vehicle ID", 400);
    }

    // Fetch vehicle details before deleting (for the audit log)
    const { data: vehicle, error: fetchErr } = await supabaseAdmin
      .from("vehicles")
      .select("vehicle_number, vehicle_type, company, model")
      .eq("id", id)
      .single();

    if (fetchErr || !vehicle) {
      return apiError("Vehicle not found", 404);
    }

    const { error } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .eq("id", id);

    if (error) {
      return apiError(error.message, 500);
    }

    after(() =>
      logActivity({
        action: "DELETE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "vehicles",
        recordId: Number(id),
        details: {
          vehicle_number: vehicle.vehicle_number,
          vehicle_type: vehicle.vehicle_type,
          company: vehicle.company,
          model: vehicle.model,
        },
      }),
    );

    return apiSuccess(null, "Vehicle deleted successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
