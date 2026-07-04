import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { notifyRoles } from "@/lib/notifications";
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
  "owner_type",
  "owner_name",
  "insurance_start_date",
  "insurance_end_date",
  "fc_start_date",
  "fc_end_date",
] as const;

const SEATING_CAPACITY_VEHICLE_TYPES = ["CAR", "BUS", "TEMPO_TRAVELLER"] as const;
const VALID_FUEL_TYPES = ["DIESEL", "PETROL", "CNG", "LPG", "ELECTRIC", "HYBRID", "LNG"] as const;
const VALID_OWNER_TYPES = ["OWN", "EXTERNAL"] as const;

/**
 * Owner fields are optional at the API level so older mobile builds and
 * legacy vehicle rows (NULL owner columns) keep working; the web/mobile forms
 * enforce them as required. When an owner_name IS supplied it must exist in
 * vehicle_owners, and owner_type is derived from that row so the pair can
 * never be persisted inconsistently. Returns an error response or null,
 * normalizing body.owner_type / body.owner_name in place.
 */
async function validateOwnerFields(body: Record<string, unknown>): Promise<Response | null> {
  if (body.owner_name !== undefined && body.owner_name !== null) {
    const ownerName = String(body.owner_name).trim();
    if (ownerName === "") {
      return apiError("Owner Name cannot be empty", 400);
    }
    const { data: owner, error } = await supabaseAdmin
      .from("vehicle_owners")
      .select("owner_type")
      .eq("name", ownerName)
      .maybeSingle();
    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }
    if (!owner) {
      return apiError("Unknown Owner Name — add the owner first", 400);
    }
    if (body.owner_type != null && body.owner_type !== owner.owner_type) {
      return apiError("Owner Type does not match the selected owner", 400);
    }
    body.owner_name = ownerName;
    body.owner_type = owner.owner_type;
  } else if (
    body.owner_type != null &&
    !(VALID_OWNER_TYPES as readonly string[]).includes(String(body.owner_type))
  ) {
    return apiError(`Invalid owner type. Allowed values: ${VALID_OWNER_TYPES.join(", ")}`, 400);
  }
  return null;
}

/**
 * Validates that each start/end document date pair is a well-formed date
 * and that end >= start when both are supplied. Returns an error response
 * or null.
 */
function validateDocumentDates(body: Record<string, unknown>): Response | null {
  const pairs: [string, string, string][] = [
    ["insurance_start_date", "insurance_end_date", "Insurance"],
    ["fc_start_date", "fc_end_date", "FC"],
  ];

  for (const [startKey, endKey, label] of pairs) {
    const startValue = body[startKey];
    const endValue = body[endKey];

    for (const [key, value] of [[startKey, startValue], [endKey, endValue]] as const) {
      if (value === null || value === undefined || value === "") continue;
      if (isNaN(new Date(String(value)).getTime())) {
        return apiError(`Invalid date for ${key}`, 400);
      }
    }

    if (
      startValue !== null && startValue !== undefined && startValue !== "" &&
      endValue !== null && endValue !== undefined && endValue !== ""
    ) {
      if (new Date(String(endValue)).getTime() < new Date(String(startValue)).getTime()) {
        return apiError(`${label} end date must be on or after the start date`, 400);
      }
    }
  }

  return null;
}

/**
 * Insurance/FC validity dates are meaningless without the document itself —
 * blocks setting insurance_start_date/insurance_end_date or fc_start_date/
 * fc_end_date unless the corresponding *_url is present either in this same
 * request body or already saved on the vehicle. `vehicleId` is null on
 * create, where the document can never already exist in the DB.
 */
async function validateDateRequiresDocument(
  body: Record<string, unknown>,
  vehicleId: number | null,
): Promise<Response | null> {
  const checks: [string, string, string, string][] = [
    ["insurance_start_date", "insurance_end_date", "insurance_url", "Insurance"],
    ["fc_start_date", "fc_end_date", "fc_url", "FC"],
  ];

  const hasValue = (v: unknown) => v !== null && v !== undefined && v !== "";

  for (const [startKey, endKey, urlKey, label] of checks) {
    if (!hasValue(body[startKey]) && !hasValue(body[endKey])) continue;

    let hasDoc = hasValue(body[urlKey]);
    if (!hasDoc && !(urlKey in body) && vehicleId !== null) {
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .select(urlKey)
        .eq("id", vehicleId)
        .maybeSingle();
      if (error) {
        logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
        return apiError("Internal server error", 500);
      }
      hasDoc = hasValue((data as Record<string, unknown> | null)?.[urlKey]);
    }

    if (!hasDoc) {
      return apiError(
        `Upload the ${label} document before setting its validity dates`,
        400,
      );
    }
  }

  return null;
}

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
      } else if (key === "vehicle_number" && typeof value === "string") {
        // Trim so "AP02AB1234 " and "AP02AB1234" can't coexist as
        // near-duplicate rows that a uniqueness check would otherwise miss.
        picked[key] = value.trim();
      } else {
        picked[key] = value;
      }
    }
  }
  return picked;
}

/** Postgres unique_violation */
const PG_UNIQUE_VIOLATION = "23505";

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
    const ownerType = searchParams.get("ownerType")?.trim() ?? "";
    const ownerName = searchParams.get("ownerName")?.trim() ?? "";
    const fuelType = searchParams.get("fuelType")?.trim() ?? "";

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
    if (ownerType) {
      query = query.eq("owner_type", ownerType);
    }
    if (ownerName) {
      query = query.eq("owner_name", ownerName);
    }
    if (fuelType) {
      query = query.eq("fuel_type", fuelType);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    // Stats — get aggregated counts via RPC for optimization. Requires
    // sql/18_extend_get_vehicles_summary_filters.sql applied in
    // Supabase (adds p_owner_type/p_owner_name/p_fuel_type, all optional)
    // so the tiles reflect every active filter, not just search/type/status.
    const { data: statsData, error: statsError } = await supabaseAdmin.rpc(
      "get_vehicles_summary",
      {
        p_search: search || null,
        p_type: type || null,
        p_status: status || null,
        p_owner_type: ownerType || null,
        p_owner_name: ownerName || null,
        p_fuel_type: fuelType || null,
      }
    );

    // The list query above already succeeded — don't fail the whole request
    // over a broken/unapplied stats RPC. Degrade to zeroed stat tiles instead
    // of a hard error so the vehicle list itself stays usable.
    const stats = { total: 0, active: 0, maintenance: 0, idle: 0 };
    if (statsError) {
      logger.error("Database error fetching vehicle stats", { error: statsError.message, code: statsError?.code, hint: statsError?.hint });
    } else if (statsData && statsData.length > 0) {
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
    const dateError = validateDocumentDates(body);
    if (dateError) return dateError;
    const docPrereqError = await validateDateRequiresDocument(body, null);
    if (docPrereqError) return docPrereqError;
    const ownerError = await validateOwnerFields(body);
    if (ownerError) return ownerError;

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
      if (error.code === PG_UNIQUE_VIOLATION) {
        return apiError("A vehicle with this number already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(() =>
      logActivity({
        action: "CREATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
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

    after(() =>
      notifyRoles({
        roles: ["admin", "staff"],
        type: "vehicle_created",
        title: "New vehicle added",
        body: `${authUser.displayName} added vehicle ${payload.vehicle_number}`,
        linkPath: `/admin/vehicles?vehicle_id=${data?.id}`,
        metadata: { vehicle_id: data?.id },
        excludeUserId: authUser.id,
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
    const dateError = validateDocumentDates(body);
    if (dateError) return dateError;
    const docPrereqError = await validateDateRequiresDocument(body, Number(id));
    if (docPrereqError) return docPrereqError;
    const ownerError = await validateOwnerFields(body);
    if (ownerError) return ownerError;

    const updatePayload = pickAllowedFields(body);
    updatePayload.updated_by = authUser.id;

    const { data: updated, error } = await supabaseAdmin
      .from("vehicles")
      .update(updatePayload)
      .eq("id", id)
      .select("vehicle_number")
      .single();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        return apiError("A vehicle with this number already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(() =>
      logActivity({
        action: "UPDATE_VEHICLE",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicles",
        recordId: id,
        details: {
          changes: updatePayload,
        },
      }),
    );

    after(() =>
      notifyRoles({
        roles: ["admin", "staff"],
        type: "vehicle_updated",
        title: "Vehicle updated",
        body: `${authUser.displayName} updated vehicle ${updated?.vehicle_number ?? id}`,
        linkPath: `/admin/vehicles?vehicle_id=${id}`,
        metadata: { vehicle_id: id, changes: updatePayload },
        excludeUserId: authUser.id,
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

    // Block hard-deletion while other records still reference this vehicle —
    // mirrors the in-use check in vehicle-owners/route.ts and drivers/route.ts.
    // Without this, deleting a vehicle either orphans rows (if there's no FK)
    // or surfaces as an opaque FK-violation 500 (if there is one).
    const dependentChecks: [string, string][] = [
      ["repair_records", "repair record(s)"],
      ["warranty", "warranty claim(s)"],
      ["external_trips", "external trip(s)"],
      ["diesel_records", "diesel record(s)"],
    ];

    for (const [table, label] of dependentChecks) {
      const { count, error: countErr } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("vehicle_id", id);

      if (countErr) {
        logger.error("Database error", { error: countErr.message, code: countErr?.code, hint: countErr?.hint, table });
        return apiError("Internal server error", 500);
      }

      if ((count ?? 0) > 0) {
        return apiError(
          `Cannot delete "${vehicle.vehicle_number}" because it has ${count} ${label} on file. Remove those first.`,
          400,
        );
      }
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
        userDisplayName: authUser.displayName,
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

    after(() =>
      notifyRoles({
        roles: ["admin", "staff"],
        type: "vehicle_deleted",
        title: "Vehicle deleted",
        body: `${authUser.displayName} deleted vehicle ${vehicle.vehicle_number}`,
        metadata: { vehicle_id: Number(id) },
        excludeUserId: authUser.id,
      }),
    );

    return apiSuccess(null, "Vehicle deleted successfully");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
