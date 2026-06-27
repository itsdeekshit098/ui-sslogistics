import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";

/** Allowed columns for vehicle insert/update — prevents mass assignment */
const ALLOWED_VEHICLE_FIELDS = [
  "vehicle_number",
  "vehicle_type",
  "seating_capacity",
  "company",
  "model",
  "status",
  "last_service_date",
  "expected_kml",
  "tank_capacity",
  "fuel_type",
  "truck_type",
  "container_length",
  "axle_type",
  "container_body_type",
] as const;

const SEATING_CAPACITY_VEHICLE_TYPES = ["CAR", "BUS", "TEMPO_TRAVELLER"] as const;
const VALID_FUEL_TYPES = ["DIESEL", "PETROL", "CNG", "LPG", "ELECTRIC", "HYBRID", "LNG"] as const;

function pickAllowedFields(body: Record<string, unknown>) {
  const picked: Record<string, unknown> = {};
  for (const key of ALLOWED_VEHICLE_FIELDS) {
    if (key in body) {
      const value = body[key];
      if (value === "" || value === undefined) {
        picked[key] = null;
      } else if (key === "seating_capacity" && value !== null) {
        // Coerce to integer — DB column is INTEGER
        const parsed = parseInt(String(value), 10);
        picked[key] = isNaN(parsed) ? null : parsed;
      } else {
        picked[key] = value;
      }
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
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
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
      logger.error("Database error", { error: statsError.message, code: statsError?.code, hint: statsError?.hint });
      return apiError("Internal server error", 500);
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

    // Server-side validation for conditional required sub-fields
    if (body.vehicle_type === "TRUCK" && !body.truck_type) {
      return apiError("Truck Type is required for TRUCK vehicle type", 400);
    }
    if (body.vehicle_type === "CONTAINER") {
      if (!body.container_length) {
        return apiError("Container Length is required for CONTAINER vehicle type", 400);
      }
      if (!body.axle_type) {
        return apiError("Axle Type is required for CONTAINER vehicle type", 400);
      }
      if (!body.container_body_type) {
        return apiError("Body Type is required for CONTAINER vehicle type", 400);
      }
    }
    if (
      (SEATING_CAPACITY_VEHICLE_TYPES as readonly string[]).includes(body.vehicle_type) &&
      (body.seating_capacity === null || body.seating_capacity === undefined || body.seating_capacity === "")
    ) {
      return apiError("Seating Capacity is required for this vehicle type", 400);
    }
    if (body.fuel_type && !(VALID_FUEL_TYPES as readonly string[]).includes(body.fuel_type)) {
      return apiError(`Invalid fuel type. Allowed values: ${VALID_FUEL_TYPES.join(", ")}`, 400);
    }

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
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
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

    // Server-side validation for conditional required sub-fields
    if (body.vehicle_type === "TRUCK" && !body.truck_type) {
      return apiError("Truck Type is required for TRUCK vehicle type", 400);
    }
    if (body.vehicle_type === "CONTAINER") {
      if (!body.container_length) {
        return apiError("Container Length is required for CONTAINER vehicle type", 400);
      }
      if (!body.axle_type) {
        return apiError("Axle Type is required for CONTAINER vehicle type", 400);
      }
      if (!body.container_body_type) {
        return apiError("Body Type is required for CONTAINER vehicle type", 400);
      }
    }
    if (
      (SEATING_CAPACITY_VEHICLE_TYPES as readonly string[]).includes(body.vehicle_type) &&
      (body.seating_capacity === null || body.seating_capacity === undefined || body.seating_capacity === "")
    ) {
      return apiError("Seating Capacity is required for this vehicle type", 400);
    }
    if (body.fuel_type && !(VALID_FUEL_TYPES as readonly string[]).includes(body.fuel_type)) {
      return apiError(`Invalid fuel type. Allowed values: ${VALID_FUEL_TYPES.join(", ")}`, 400);
    }

    const updatePayload = pickAllowedFields(body);
    updatePayload.updated_by = authUser.id;

    const { error } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
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
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
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
