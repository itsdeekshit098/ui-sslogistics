import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import type { CostItem, TripType } from "@/components/externalTripsPage/externalTripsPage.types";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const VALID_TRIP_TYPES: TripType[] = ["company_oncall", "external_user"];
const REQUIRED_COST_LABELS = ["Diesel", "Driver"];

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
    const label = String((item as CostItem).label || "").trim();
    const amount = Number((item as CostItem).amount);
    if (!label || !Number.isFinite(amount) || amount < 0) {
      return { valid: false, error: "Each cost item needs a label and non-negative amount" };
    }
    parsed.push({ label, amount });
  }

  for (const label of REQUIRED_COST_LABELS) {
    if (!parsed.some((item) => item.label === label)) {
      return { valid: false, error: `"${label}" cost item is required` };
    }
  }
  return { valid: true, parsed };
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const bookingId = body.booking_id == null ? null : Number(body.booking_id);
    if (bookingId != null && (!Number.isFinite(bookingId) || bookingId <= 0)) {
      return apiError("Valid booking_id is required", 400);
    }

    let booking: { id: number; status: string; vehicle_id: number | null } | null = null;
    if (bookingId != null) {
      const { data, error } = await supabaseAdmin
        .from("trip_bookings")
        .select("id, status, vehicle_id")
        .eq("id", bookingId)
        .single();
      if (error || !data) return apiError("Trip booking not found", 404);
      if (data.status !== "confirmed") {
        return apiError("Only confirmed trip bookings can be completed", 400);
      }
      booking = data;
    }

    if (!VALID_TRIP_TYPES.includes(body.trip_type)) {
      return apiError("A valid trip_type is required", 400);
    }
    const costs = validateCostItems(body.cost_items);
    if (!costs.valid) return apiError(costs.error, 400);

    const amountReceived = Number(body.amount_received);
    if (!Number.isFinite(amountReceived) || amountReceived < 0) {
      return apiError("Amount received must be a non-negative number", 400);
    }

    const vehicleId = Number(body.vehicle_id ?? booking?.vehicle_id);
    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      return apiError("A vehicle is required to complete a trip", 400);
    }
    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from("vehicles")
      .select("id, vehicle_type")
      .eq("id", vehicleId)
      .single();
    if (vehicleError || !vehicle) return apiError("Vehicle not found", 400);

    const driverId = body.driver_id ? Number(body.driver_id) : null;
    if (driverId) {
      const { data: driver, error: driverError } = await supabaseAdmin
        .from("drivers")
        .select("id, is_active")
        .eq("id", driverId)
        .single();
      if (driverError || !driver) return apiError("Driver not found", 400);
      if (!driver.is_active) return apiError("Selected driver is inactive", 400);
    }

    const customerPhone = body.customer_phone?.trim();
    if (customerPhone && !PHONE_REGEX.test(customerPhone)) {
      return apiError("Invalid customer phone number (must be 10 digits starting with 6-9)", 400);
    }
    if (body.start_date && body.end_date && new Date(body.end_date) < new Date(body.start_date)) {
      return apiError("End date cannot be before start date", 400);
    }
    const notes = body.notes?.trim() || null;
    if (notes && notes.length > 500) {
      return apiError("Notes must be 500 characters or fewer", 400);
    }

    const totalCost = costs.parsed.reduce((total, item) => total + item.amount, 0);
    const customerName = body.customer_name?.trim();
    const fromLocation = body.from_location?.trim();
    const toLocation = body.to_location?.trim();
    if (!booking && (!customerName || !fromLocation || !toLocation || !body.start_date)) {
      return apiError("Customer, route, and start date are required for a direct completed trip", 400);
    }
    const updatePayload = {
      status: "completed",
      trip_type: body.trip_type,
      vehicle_id: vehicleId,
      driver_id: driverId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      from_location: fromLocation || null,
      to_location: toLocation || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      notes,
      cost_items: costs.parsed,
      total_cost: totalCost,
      amount_received: amountReceived,
      completed_at: new Date().toISOString(),
      updated_by: authUser.id,
    };

    let completed;
    if (booking) {
      const { data, error } = await supabaseAdmin
        .from("trip_bookings")
        .update(updatePayload)
        .eq("id", booking.id)
        .eq("status", "confirmed")
        .select("*")
        .single();
      if (error) return serverError(error);
      completed = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("trip_bookings")
        .insert({
          ...updatePayload,
          customer_name: customerName,
          from_location: fromLocation,
          to_location: toLocation,
          start_date: body.start_date,
          vehicle_type: vehicle.vehicle_type,
          seating_capacity: null,
          advance_amount: 0,
          created_by: authUser.id,
        })
        .select("*")
        .single();
      if (error) return serverError(error);
      completed = data;
    }

    after(async () => {
      await logActivity({
        action: "COMPLETE_TRIP_BOOKING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "trip_bookings",
        recordId: completed.id,
        details: { total_cost: totalCost, amount_received: amountReceived },
      });
    });

    return apiSuccess({ booking: completed }, "Trip completed");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}