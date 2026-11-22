import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  apiError,
  apiSuccess,
  handleApiError,
  readJsonObject,
  serverError,
} from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import {
  isValidDateString,
  moneyMessage,
  moneyProblem,
  optionalText,
  parseFlag,
  parseId,
} from "../../../loans/loans.utils";

// A monthly rate per vehicle is a small recurring figure, nothing like a loan
// principal — ₹10 lakh/month already covers any real deployment with room to
// spare, so anything above it is a mistyped extra digit, same reasoning as
// MAX_LOAN_AMOUNT.
const MAX_MONTHLY_RATE = 1_000_000;

// A bus seats about 60; a mistyped extra digit ("430") is the case to catch.
// A declared bucket is "4 buses", not a fleet of thousands.
const MAX_SEATING_CAPACITY = 200;
const MAX_QUANTITY = 1000;
const MAX_NOTES_LENGTH = 500;

// What runs for a client. A deployment is either a LINKED vehicle — one of ours,
// picked from the fleet — or a DECLARED bucket describing units we don't track
// individually ("4 buses, 43-seater"). Both carry the same spec fields, using
// the same enums as the vehicles table, so the fleet mix reads the same either
// way (sql/33_add_clients.sql).

const VEHICLE_TYPES = ["CAR", "BUS", "TEMPO_TRAVELLER", "TRUCK", "CONTAINER"] as const;
const TRUCK_TYPES = [
  "MINI_TRUCK",
  "PICKUP_TRUCK",
  "LCV",
  "MCV",
  "HCV",
  "TIPPER_TRUCK",
  "TANKER",
  "TRAILER_TRUCK",
] as const;
const CONTAINER_LENGTHS = ["19_FT", "20_FT", "22_FT", "24_FT", "32_FT", "40_FT"] as const;
const AXLE_TYPES = ["SINGLE_AXLE", "MULTI_AXLE", "TRAILER"] as const;
const CONTAINER_BODY_TYPES = ["CLOSED", "FLATBED_OPEN"] as const;
const SEATING_TYPES = ["CAR", "BUS", "TEMPO_TRAVELLER"] as const;

/**
 * Validates the spec fields, mirroring the conditional rules the vehicles form
 * uses — a truck needs a truck type, a container needs its length/axle/body,
 * and only passenger types carry a seating capacity.
 */
function validateSpec(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
): string | null {
  const vehicleType = String(body.vehicle_type ?? "");
  if (!(VEHICLE_TYPES as readonly string[]).includes(vehicleType)) {
    return `Vehicle type must be one of: ${VEHICLE_TYPES.join(", ")}`;
  }
  payload.vehicle_type = vehicleType;

  if ((SEATING_TYPES as readonly string[]).includes(vehicleType)) {
    if (body.seating_capacity != null && body.seating_capacity !== "") {
      const seats = body.seating_capacity;
      if (typeof seats !== "number" || !Number.isInteger(seats) || seats <= 0 || seats > MAX_SEATING_CAPACITY) {
        return `Seating capacity must be a whole number from 1 to ${MAX_SEATING_CAPACITY}`;
      }
      payload.seating_capacity = seats;
    } else {
      payload.seating_capacity = null;
    }
  } else {
    payload.seating_capacity = null;
  }

  if (vehicleType === "TRUCK") {
    const truckType = String(body.truck_type ?? "");
    if (!(TRUCK_TYPES as readonly string[]).includes(truckType)) {
      return "Choose a truck type";
    }
    payload.truck_type = truckType;
  } else {
    payload.truck_type = null;
  }

  if (vehicleType === "CONTAINER") {
    const length = String(body.container_length ?? "");
    const axle = String(body.axle_type ?? "");
    const bodyType = String(body.container_body_type ?? "");

    if (!(CONTAINER_LENGTHS as readonly string[]).includes(length)) {
      return "Choose a container length";
    }
    if (!(AXLE_TYPES as readonly string[]).includes(axle)) {
      return "Choose an axle type";
    }
    if (!(CONTAINER_BODY_TYPES as readonly string[]).includes(bodyType)) {
      return "Choose a container body type";
    }

    payload.container_length = length;
    payload.axle_type = axle;
    payload.container_body_type = bodyType;
  } else {
    payload.container_length = null;
    payload.axle_type = null;
    payload.container_body_type = null;
  }

  return null;
}

async function buildPayload(
  body: Record<string, unknown>,
): Promise<{ payload: Record<string, unknown> } | { error: string }> {
  const payload: Record<string, unknown> = {};

  const hasVehicle = body.vehicle_id != null && body.vehicle_id !== "";

  if (hasVehicle) {
    const vehicleId = parseId(body.vehicle_id);
    if (vehicleId === null) return { error: "Invalid vehicle" };

    const { data: vehicle } = await supabaseAdmin
      .from("vehicles")
      .select(
        "id, vehicle_type, seating_capacity, truck_type, container_length, axle_type, container_body_type",
      )
      .eq("id", vehicleId)
      .maybeSingle();

    if (!vehicle) return { error: "Selected vehicle no longer exists" };

    // The spec is copied from the vehicle rather than trusted from the client,
    // so a linked deployment can never describe something the vehicle isn't.
    payload.vehicle_id = vehicleId;
    payload.quantity = 1;
    payload.vehicle_type = vehicle.vehicle_type;
    payload.seating_capacity = vehicle.seating_capacity;
    payload.truck_type = vehicle.truck_type;
    payload.container_length = vehicle.container_length;
    payload.axle_type = vehicle.axle_type;
    payload.container_body_type = vehicle.container_body_type;
  } else {
    payload.vehicle_id = null;

    const quantity = body.quantity ?? 1;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: `Quantity must be a whole number from 1 to ${MAX_QUANTITY}` };
    }
    payload.quantity = quantity;

    const specError = validateSpec(body, payload);
    if (specError) return { error: specError };
  }

  if (body.monthly_rate != null && body.monthly_rate !== "") {
    const rateProblem = moneyProblem(body.monthly_rate, { allowZero: true, max: MAX_MONTHLY_RATE });
    if (rateProblem) {
      return { error: moneyMessage(rateProblem, "Monthly rate must be a positive number") };
    }
    payload.monthly_rate = body.monthly_rate as number;
  } else {
    payload.monthly_rate = null;
  }

  for (const key of ["start_date", "end_date"] as const) {
    if (body[key] != null && body[key] !== "") {
      if (!isValidDateString(body[key])) return { error: `Invalid ${key.replace("_", " ")}` };
      payload[key] = body[key];
    } else {
      payload[key] = null;
    }
  }

  if (
    payload.start_date &&
    payload.end_date &&
    (payload.end_date as string) < (payload.start_date as string)
  ) {
    return { error: "End date cannot be before the start date" };
  }

  if (body.notes !== undefined) {
    const notes = optionalText(body.notes, MAX_NOTES_LENGTH);
    if ("error" in notes) {
      return {
        error:
          notes.error === "too_long"
            ? `Notes must be ${MAX_NOTES_LENGTH} characters or less`
            : "Notes must be text",
      };
    }
    payload.notes = notes.value;
  }

  if (body.is_active !== undefined) {
    const flag = parseFlag(body.is_active);
    if (flag === null) return { error: "is_active must be true or false" };
    payload.is_active = flag;
  }

  return { payload };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("client_deployments")
      .select("*, vehicles:vehicle_id (id, vehicle_number, company, model)")
      .eq("client_id", clientId)
      .order("is_active", { ascending: false })
      .order("vehicle_type", { ascending: true });

    if (error) return serverError(error);

    return apiSuccess({ data: data ?? [] });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return apiError("Client not found", 404);

    const result = await buildPayload(body);
    if ("error" in result) return apiError(result.error, 400);

    const insertPayload = {
      ...result.payload,
      client_id: clientId,
      created_by: authUser.id,
    };

    const { data, error } = await supabaseAdmin
      .from("client_deployments")
      .insert([insertPayload])
      .select("*, vehicles:vehicle_id (id, vehicle_number, company, model)")
      .single();

    if (error) {
      // uq_active_vehicle_one_client — a vehicle can only be actively deployed
      // to one client at a time.
      if (error.code === "23505") {
        return apiError(
          "That vehicle is already deployed to another client. End that deployment first.",
          409,
        );
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_CLIENT_DEPLOYMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_deployments",
        recordId: data.id,
        details: {
          client_id: clientId,
          vehicle_id: data.vehicle_id,
          vehicle_type: data.vehicle_type,
          quantity: data.quantity,
        },
      });
    });

    return apiSuccess({ deployment: data }, "Vehicle added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);
    const deploymentId = parseId(body.id);
    if (deploymentId === null) {
      return apiError("Missing deployment ID", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("client_deployments")
      .select("id, client_id")
      .eq("id", deploymentId)
      .maybeSingle();

    if (!existing) return apiError("Deployment not found", 404);
    if (existing.client_id !== clientId) {
      return apiError("That deployment belongs to a different client", 400);
    }

    const result = await buildPayload(body);
    if ("error" in result) return apiError(result.error, 400);

    const updatePayload = {
      ...result.payload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("client_deployments")
      .update(updatePayload)
      .eq("id", deploymentId)
      .select("*, vehicles:vehicle_id (id, vehicle_number, company, model)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(
          "That vehicle is already deployed to another client. End that deployment first.",
          409,
        );
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_CLIENT_DEPLOYMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_deployments",
        recordId: deploymentId,
        details: { client_id: clientId, changes: updatePayload },
      });
    });

    return apiSuccess({ deployment: data }, "Vehicle updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);

    const { searchParams } = new URL(req.url);
    const deploymentId = parseId(searchParams.get("deployment_id"));

    if (clientId === null || deploymentId === null) {
      return apiError("Invalid client or deployment ID", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("client_deployments")
      .select("id, client_id")
      .eq("id", deploymentId)
      .maybeSingle();

    if (!existing) return apiError("Deployment not found", 404);
    if (existing.client_id !== clientId) {
      return apiError("That deployment belongs to a different client", 400);
    }

    const { error } = await supabaseAdmin
      .from("client_deployments")
      .delete()
      .eq("id", deploymentId);

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_CLIENT_DEPLOYMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_deployments",
        recordId: deploymentId,
        details: { client_id: clientId },
      });
    });

    return apiSuccess(null, "Vehicle removed", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
