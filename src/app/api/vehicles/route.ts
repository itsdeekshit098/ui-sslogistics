import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { notifyRoles } from "@/lib/notifications";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { computeExpiryStatus, getStatusDates, type ExpiryStatus } from "@/utils/expiryStatus";

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
  "owner_entity_id",
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
 * enforce them as required.
 *
 * Owners live in `entities` now (sql/28_add_entities.sql). The real link is
 * owner_entity_id — owner_name / owner_type remain only as mirrors kept in
 * step by the trg_vehicles_owner_mirror trigger, so callers may keep sending
 * a name (the mobile app does) and we resolve it to the id here. Setting
 * owner_type from the entity means the pair can never be persisted
 * inconsistently. Returns an error response or null, normalizing
 * body.owner_entity_id / owner_name / owner_type in place.
 */
async function validateOwnerFields(body: Record<string, unknown>): Promise<Response | null> {
  const hasEntityId = body.owner_entity_id !== undefined && body.owner_entity_id !== null;
  const hasName = body.owner_name !== undefined && body.owner_name !== null;

  if (hasEntityId || hasName) {
    let ownerName = "";
    if (hasName) {
      ownerName = String(body.owner_name).trim();
      if (ownerName === "" && !hasEntityId) {
        return apiError("Owner Name cannot be empty", 400);
      }
    }

    // Prefer the id when supplied; fall back to a name lookup for callers that
    // only know the name (older mobile builds, the legacy owner dropdowns).
    let ownerQuery = supabaseAdmin.from("entities").select("id, name, relationship");
    if (hasEntityId) {
      const entityId = Number(body.owner_entity_id);
      if (!Number.isFinite(entityId)) {
        return apiError("Invalid owner", 400);
      }
      ownerQuery = ownerQuery.eq("id", entityId);
    } else {
      ownerQuery = ownerQuery.eq("name", ownerName);
    }

    const { data: owner, error } = await ownerQuery.maybeSingle();
    if (error) {
      return serverError(error);
    }
    if (!owner) {
      return apiError("Unknown Owner — add the owner first", 400);
    }

    const derivedOwnerType = owner.relationship === "INTERNAL" ? "OWN" : "EXTERNAL";
    if (body.owner_type != null && body.owner_type !== derivedOwnerType) {
      return apiError("Owner Type does not match the selected owner", 400);
    }

    body.owner_entity_id = owner.id;
    body.owner_name = owner.name;
    body.owner_type = derivedOwnerType;
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
        return serverError(error);
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
      200,
      Math.max(1, Number(searchParams.get("pageSize")) || 50),
    );
    const search = searchParams.get("search")?.trim() ?? "";
    const type = searchParams.get("type")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const ownerType = searchParams.get("ownerType")?.trim() ?? "";
    const ownerName = searchParams.get("ownerName")?.trim() ?? "";
    const fuelType = searchParams.get("fuelType")?.trim() ?? "";
    const fcStatus = searchParams.get("fcStatus") as ExpiryStatus | null;
    const insuranceStatus = searchParams.get("insuranceStatus") as ExpiryStatus | null;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { today, cutoff } = getStatusDates();

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
    if (fcStatus === "expired") {
      query = query.lt("fc_end_date", today);
    } else if (fcStatus === "expiring_soon") {
      query = query.gte("fc_end_date", today).lte("fc_end_date", cutoff);
    } else if (fcStatus === "active") {
      query = query.gt("fc_end_date", cutoff);
    }
    if (insuranceStatus === "expired") {
      query = query.lt("insurance_end_date", today);
    } else if (insuranceStatus === "expiring_soon") {
      query = query.gte("insurance_end_date", today).lte("insurance_end_date", cutoff);
    } else if (insuranceStatus === "active") {
      query = query.gt("insurance_end_date", cutoff);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return serverError(error);
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
      // Capture-only: the list already succeeded, so we degrade to zeroed
      // tiles rather than return 500 — but a broken/unapplied stats RPC is a
      // real defect worth seeing in Sentry, not just the logs.
      logger.error("Database error fetching vehicle stats", { error: statsError.message, code: statsError?.code, hint: statsError?.hint });
      Sentry.captureException(new Error(statsError.message), {
        extra: { error: statsError.message, code: statsError?.code, hint: statsError?.hint },
      });
    } else if (statsData && statsData.length > 0) {
      const row = statsData[0];
      stats.total = Number(row.total_count || 0);
      stats.active = Number(row.active_count || 0);
      stats.maintenance = Number(row.maintenance_count || 0);
      stats.idle = Number(row.idle_count || 0);
    }

    const rows = (data ?? []).map((row) => ({
      ...row,
      fc_status: computeExpiryStatus(row.fc_end_date, today, cutoff),
      insurance_status: computeExpiryStatus(row.insurance_end_date, today, cutoff),
    }));

    return apiSuccess({ data: rows, total: count ?? 0, stats });
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
      return serverError(error);
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
    const authUser = await requireStrictAdminAuth();
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
      return serverError(error);
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
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing vehicle ID", 400);
    }

    // Fetch vehicle details before deleting (for the audit log, and the
    // document columns so their storage objects can be cleaned up below).
    const { data: vehicle, error: fetchErr } = await supabaseAdmin
      .from("vehicles")
      .select(
        "vehicle_number, vehicle_type, company, model, rc_url, fc_url, insurance_url, permit_url, pollution_url, tax_url",
      )
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
      ["trip_bookings", "trip booking(s)"],
    ];

    for (const [table, label] of dependentChecks) {
      const { count, error: countErr } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("vehicle_id", id);

      if (countErr) {
        return serverError(countErr, { table });
      }

      if ((count ?? 0) > 0) {
        return apiError(
          `Cannot delete "${vehicle.vehicle_number}" because it has ${count} ${label} on file. Remove those first.`,
          400,
        );
      }
    }

    // Deleting the row cascades the `attachments` rows via their FK, but the
    // storage objects themselves are not touched by a cascade — they must be
    // removed explicitly, in both buckets, or they orphan in storage forever.
    const documentPaths = [
      vehicle.rc_url,
      vehicle.fc_url,
      vehicle.insurance_url,
      vehicle.permit_url,
      vehicle.pollution_url,
      vehicle.tax_url,
    ].filter((path): path is string => !!path);

    const { data: images } = await supabaseAdmin
      .from("attachments")
      .select("storage_path")
      .eq("vehicle_id", id);
    const imagePaths = (images ?? []).map((row) => row.storage_path as string);

    if (documentPaths.length > 0) {
      await supabaseAdmin.storage.from("vehicle-documents").remove(documentPaths);
    }
    if (imagePaths.length > 0) {
      await supabaseAdmin.storage.from("attachments").remove(imagePaths);
    }

    const { error } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .eq("id", id);

    if (error) {
      return serverError(error);
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
