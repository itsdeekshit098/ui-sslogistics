import { logger } from "@/lib/logger";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import type {
  CreateExternalTripPayload,
  CostItem,
  TripType,
} from "@/components/externalTripsPage/externalTripsPage.types";

// ─── Helpers ───

const VALID_TRIP_TYPES: TripType[] = ["company_oncall", "external_user"];
const PHONE_REGEX = /^[6-9]\d{9}$/;
const REQUIRED_COST_LABELS = ["Diesel", "Driver"];

function sumCostItems(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0);
}

function validateCostItems(
  items: unknown,
): { valid: true; parsed: CostItem[] } | { valid: false; error: string } {
  if (!Array.isArray(items)) {
    return { valid: false, error: "cost_items must be an array" };
  }

  const parsed: CostItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { valid: false, error: "Each cost item must be an object" };
    }

    const label = String(item.label || "").trim();
    if (!label) {
      return { valid: false, error: "Each cost item must have a label" };
    }

    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return {
        valid: false,
        error: `Invalid amount for "${label}" — must be a non-negative number`,
      };
    }

    parsed.push({ label, amount });
  }

  // Ensure required preset labels are present
  for (const required of REQUIRED_COST_LABELS) {
    if (!parsed.some((item) => item.label === required)) {
      return {
        valid: false,
        error: `"${required}" cost item is required`,
      };
    }
  }

  return { valid: true, parsed };
}

// ─── GET ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const vehicleId = searchParams.get("vehicle_id");
    const tripType = searchParams.get("trip_type");
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(searchParams.get("page_size") || "10")),
    );

    const includeSummary = searchParams.get("include_summary") !== "false";

    let totalCount = 0;
    let totalCost = 0;
    let totalReceived = 0;

    if (includeSummary) {
      // ── Summary: let the DB compute aggregates (no row transfer) ──
      const { data: summaryRow, error: summaryError } = await supabaseAdmin.rpc(
        "get_external_trips_summary",
        {
          p_from_date: fromDate || null,
          p_to_date: toDate || null,
          p_vehicle_id:
            vehicleId && Number.isFinite(Number(vehicleId))
              ? Number(vehicleId)
              : null,
          p_trip_type:
            tripType && VALID_TRIP_TYPES.includes(tripType as TripType)
              ? tripType
              : null,
        },
      );

      if (summaryError) {
        logger.error("Database error", { error: summaryError.message, code: summaryError?.code, hint: summaryError?.hint });
        return apiError("Internal server error", 500);
      }

      totalCount = Number(summaryRow?.[0]?.total_count ?? 0);
      totalCost = Number(summaryRow?.[0]?.total_cost ?? 0);
      totalReceived = Number(summaryRow?.[0]?.total_received ?? 0);
    }

    // ── Build paginated data query ──
    const offset = (page - 1) * pageSize;

    let dataQuery = supabaseAdmin
      .from("external_trips")
      .select(
        `
        *,
        vehicles (vehicle_number, company, model),
        drivers (id, name, phone)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fromDate) {
      dataQuery = dataQuery.gte("start_date", fromDate);
    }
    if (toDate) {
      dataQuery = dataQuery.lte("start_date", toDate);
    }
    if (vehicleId && Number.isFinite(Number(vehicleId))) {
      dataQuery = dataQuery.eq("vehicle_id", Number(vehicleId));
    }
    if (tripType && VALID_TRIP_TYPES.includes(tripType as TripType)) {
      dataQuery = dataQuery.eq("trip_type", tripType);
    }

    const { data, error, count: pageCount } = await dataQuery;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    // Use summary count if available, otherwise fall back to paginated count
    const finalTotal = includeSummary ? totalCount : (pageCount ?? 0);

    return apiSuccess({
      data: data || [],
      total: finalTotal,
      summary: includeSummary
        ? {
            totalCost,
            totalReceived,
            totalProfit: totalReceived - totalCost,
            count: totalCount,
          }
        : undefined,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body: CreateExternalTripPayload = await req.json();

    if (!body.vehicle_id || !Number.isFinite(Number(body.vehicle_id))) {
      return apiError("Valid vehicle_id is required", 400);
    }

    const { data: vehicle, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("id", Number(body.vehicle_id))
      .single();

    if (vErr || !vehicle) {
      return apiError("Vehicle not found", 400);
    }

    if (!body.trip_type || !VALID_TRIP_TYPES.includes(body.trip_type)) {
      return apiError(
        "trip_type must be 'company_oncall' or 'external_user'",
        400,
      );
    }

    const costValidation = validateCostItems(body.cost_items);
    if (!costValidation.valid) {
      return apiError(costValidation.error, 400);
    }

    const amountReceived = Number(body.amount_received);
    if (!Number.isFinite(amountReceived) || amountReceived < 0) {
      return apiError(
        "Amount received is required and must be a non-negative number",
        400,
      );
    }

    const customerPhone = body.customer_phone?.trim();
    if (customerPhone && !PHONE_REGEX.test(customerPhone)) {
      return apiError(
        "Invalid customer phone number (must be 10 digits starting with 6-9)",
        400,
      );
    }

    if (body.driver_id) {
      const { data: driver, error: dErr } = await supabaseAdmin
        .from("drivers")
        .select("id, is_active")
        .eq("id", Number(body.driver_id))
        .single();

      if (dErr || !driver) {
        return apiError("Driver not found", 400);
      }
      if (!driver.is_active) {
        return apiError("Selected driver is inactive", 400);
      }
    }

    if (body.start_date && body.end_date) {
      if (new Date(body.end_date) < new Date(body.start_date)) {
        return apiError("End date cannot be before start date", 400);
      }
    }

    const notes = body.notes?.trim() || null;
    if (notes && notes.length > 500) {
      return apiError("Notes must be 500 characters or fewer", 400);
    }

    const totalCost = sumCostItems(costValidation.parsed);

    const insertPayload = {
      vehicle_id: Number(body.vehicle_id),
      trip_type: body.trip_type,
      customer_name: body.customer_name?.trim() || null,
      customer_phone: customerPhone || null,
      from_location: body.from_location?.trim() || null,
      to_location: body.to_location?.trim() || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      driver_id: body.driver_id ? Number(body.driver_id) : null,
      notes,
      cost_items: costValidation.parsed,
      total_cost: totalCost,
      amount_received: amountReceived,
      created_by: authUser.id,
      updated_by: authUser.id,
    };

    const { data: newTrip, error } = await supabaseAdmin
      .from("external_trips")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_EXTERNAL_TRIP",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "external_trips",
        recordId: newTrip.id,
        details: {
          vehicle_id: insertPayload.vehicle_id,
          trip_type: insertPayload.trip_type,
          total_cost: totalCost,
          amount_received: amountReceived,
        },
      });
    });

    return apiSuccess({ trip: newTrip }, "Trip created", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing trip ID", 400);
    }

    const updatePayload: Record<string, unknown> = {
      updated_by: authUser.id,
    };

    if (fields.customer_name !== undefined) {
      updatePayload.customer_name = fields.customer_name?.trim() || null;
    }

    if (fields.customer_phone !== undefined) {
      const phone = fields.customer_phone?.trim();
      if (phone && !PHONE_REGEX.test(phone)) {
        return apiError(
          "Invalid customer phone (must be 10 digits starting with 6-9)",
          400,
        );
      }
      updatePayload.customer_phone = phone || null;
    }

    if (fields.from_location !== undefined) {
      updatePayload.from_location = fields.from_location?.trim() || null;
    }

    if (fields.to_location !== undefined) {
      updatePayload.to_location = fields.to_location?.trim() || null;
    }

    if (fields.start_date !== undefined) {
      updatePayload.start_date = fields.start_date || null;
    }

    if (fields.end_date !== undefined) {
      updatePayload.end_date = fields.end_date || null;
    }

    if (fields.driver_id !== undefined) {
      if (fields.driver_id) {
        const { data: driver, error: dErr } = await supabaseAdmin
          .from("drivers")
          .select("id, is_active")
          .eq("id", Number(fields.driver_id))
          .single();

        if (dErr || !driver) {
          return apiError("Driver not found", 400);
        }
        if (!driver.is_active) {
          return apiError("Selected driver is inactive", 400);
        }
      }
      updatePayload.driver_id = fields.driver_id
        ? Number(fields.driver_id)
        : null;
    }

    if (fields.notes !== undefined) {
      const notes = fields.notes?.trim() || null;
      if (notes && notes.length > 500) {
        return apiError("Notes must be 500 characters or fewer", 400);
      }
      updatePayload.notes = notes;
    }

    if (fields.cost_items !== undefined) {
      const costValidation = validateCostItems(fields.cost_items);
      if (!costValidation.valid) {
        return apiError(costValidation.error, 400);
      }
      updatePayload.cost_items = costValidation.parsed;
      updatePayload.total_cost = sumCostItems(costValidation.parsed);
    }

    if (fields.amount_received !== undefined) {
      const amountReceived = Number(fields.amount_received);
      if (!Number.isFinite(amountReceived) || amountReceived < 0) {
        return apiError("Amount received must be a non-negative number", 400);
      }
      updatePayload.amount_received = amountReceived;
    }

    const startDate = updatePayload.start_date ?? fields.start_date;
    const endDate = updatePayload.end_date ?? fields.end_date;
    if (startDate && endDate) {
      if (new Date(endDate as string) < new Date(startDate as string)) {
        return apiError("End date cannot be before start date", 400);
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from("external_trips")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_EXTERNAL_TRIP",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "external_trips",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ trip: updated }, "Trip updated");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    if (authUser.role !== "admin") {
      return apiError("Only admins can delete external_trips", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing trip ID", 400);
    }

    const { error } = await supabaseAdmin
      .from("external_trips")
      .delete()
      .eq("id", Number(id));

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_EXTERNAL_TRIP",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "external_trips",
        recordId: Number(id),
        details: { deleted: true },
      });
    });

    return apiSuccess(null, "Trip deleted");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
