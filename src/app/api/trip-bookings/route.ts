import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { VEHICLE_TYPES, SEATING_CAPACITY_TYPES } from "@/app/admin/vehicles/vehicles.types";
import type { VehicleType } from "@/app/admin/vehicles/vehicles.types";
import type {
  CreateTripBookingPayload,
  TripBookingStatus,
} from "@/components/tripBookingsPage/tripBookingsPage.types";

// ─── Helpers ───

const VALID_VEHICLE_TYPES: VehicleType[] = VEHICLE_TYPES.map((t) => t.value);
const VALID_STATUSES: TripBookingStatus[] = ["confirmed", "completed", "cancelled"];
const PHONE_REGEX = /^[6-9]\d{9}$/;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── GET ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const onDate = searchParams.get("on_date");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const search = searchParams.get("search")?.trim();
    const upcoming = searchParams.get("upcoming") === "true";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get("page_size") || "10")),
    );

    const includeSummary = searchParams.get("include_summary") === "true";

    let summary;
    if (includeSummary) {
      const today = todayStr();

      const [upcomingRes, overdueRes, completedRes, cancelledRes, completedFinanceRes] = await Promise.all([
        supabaseAdmin
          .from("trip_bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed")
          .gte("start_date", today),
        supabaseAdmin
          .from("trip_bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed")
          .lt("start_date", today),
        supabaseAdmin
          .from("trip_bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabaseAdmin
          .from("trip_bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "cancelled"),
        supabaseAdmin
          .from("trip_bookings")
          .select("total_cost, amount_received")
          .eq("status", "completed"),
      ]);

      for (const res of [upcomingRes, overdueRes, completedRes, cancelledRes, completedFinanceRes]) {
        if (res.error) {
          return serverError(res.error);
        }
      }

      const totalCost = (completedFinanceRes.data ?? []).reduce(
        (sum, trip) => sum + Number(trip.total_cost ?? 0),
        0,
      );
      const totalReceived = (completedFinanceRes.data ?? []).reduce(
        (sum, trip) => sum + Number(trip.amount_received ?? 0),
        0,
      );
      summary = {
        upcomingCount: upcomingRes.count ?? 0,
        overdueCount: overdueRes.count ?? 0,
        completedCount: completedRes.count ?? 0,
        cancelledCount: cancelledRes.count ?? 0,
        totalCost,
        totalReceived,
        totalProfit: totalReceived - totalCost,
      };
    }

    const offset = (page - 1) * pageSize;

    let dataQuery = supabaseAdmin
      .from("trip_bookings")
      .select(
        `
        *,
        vehicles (vehicle_number, company, model),
        drivers (id, name, phone)
      `,
        { count: "exact" },
      )
      .range(offset, offset + pageSize - 1);

    // Completed/cancelled are history views — most recent first. Everything
    // else (confirmed, including overdue/upcoming) is soonest-first so the
    // most urgent booking surfaces at the top.
    const sortAscending = !(status === "completed" || status === "cancelled");

    if (upcoming) {
      dataQuery = dataQuery
        .eq("status", "confirmed")
        .gte("start_date", todayStr())
        .order("start_date", { ascending: true })
        .order("id", { ascending: true });
    } else {
      dataQuery = dataQuery
        .order("start_date", { ascending: sortAscending })
        .order("id", { ascending: sortAscending });
    }

    if (status && VALID_STATUSES.includes(status as TripBookingStatus)) {
      dataQuery = dataQuery.eq("status", status);
    }
    if (onDate) {
      // Exact-date match takes precedence over the from/to range — the two
      // are alternative ways to narrow by date, not meant to be combined.
      dataQuery = dataQuery.eq("start_date", onDate);
    } else {
      if (fromDate) {
        dataQuery = dataQuery.gte("start_date", fromDate);
      }
      if (toDate) {
        dataQuery = dataQuery.lte("start_date", toDate);
      }
    }
    if (search) {
      dataQuery = dataQuery.or(
        `customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await dataQuery;

    if (error) {
      return serverError(error);
    }

    return apiSuccess({
      data: data || [],
      total: count ?? 0,
      summary,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body: CreateTripBookingPayload = await req.json();

    const customerName = body.customer_name?.trim();
    if (!customerName) {
      return apiError("Customer name is required", 400);
    }

    const fromLocation = body.from_location?.trim();
    const toLocation = body.to_location?.trim();
    if (!fromLocation || !toLocation) {
      return apiError("From and to locations are required", 400);
    }

    if (!body.start_date) {
      return apiError("Start date is required", 400);
    }

    if (!body.vehicle_type || !VALID_VEHICLE_TYPES.includes(body.vehicle_type)) {
      return apiError("A valid vehicle_type is required", 400);
    }

    if (body.end_date && new Date(body.end_date) < new Date(body.start_date)) {
      return apiError("End date cannot be before start date", 400);
    }

    let seatingCapacity: number | null = null;
    if (body.seating_capacity !== undefined && body.seating_capacity !== null) {
      if (!SEATING_CAPACITY_TYPES.includes(body.vehicle_type)) {
        return apiError(
          "seating_capacity only applies to Car, Bus, or Tempo Traveller",
          400,
        );
      }
      seatingCapacity = Number(body.seating_capacity);
      if (!Number.isFinite(seatingCapacity) || seatingCapacity <= 0) {
        return apiError("seating_capacity must be a positive number", 400);
      }
    }

    if (body.vehicle_id) {
      const { data: vehicle, error: vErr } = await supabaseAdmin
        .from("vehicles")
        .select("id")
        .eq("id", Number(body.vehicle_id))
        .single();

      if (vErr || !vehicle) {
        return apiError("Vehicle not found", 400);
      }
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

    const customerPhone = body.customer_phone?.trim();
    if (customerPhone && !PHONE_REGEX.test(customerPhone)) {
      return apiError(
        "Invalid customer phone number (must be 10 digits starting with 6-9)",
        400,
      );
    }

    if (body.quoted_amount !== undefined && body.quoted_amount !== null) {
      const quoted = Number(body.quoted_amount);
      if (!Number.isFinite(quoted) || quoted < 0) {
        return apiError("Quoted amount must be a non-negative number", 400);
      }
    }

    const advanceAmount = Number(body.advance_amount ?? 0);
    if (!Number.isFinite(advanceAmount) || advanceAmount < 0) {
      return apiError("Advance amount must be a non-negative number", 400);
    }

    const notes = body.notes?.trim() || null;
    if (notes && notes.length > 500) {
      return apiError("Notes must be 500 characters or fewer", 400);
    }

    const insertPayload = {
      customer_name: customerName,
      customer_phone: customerPhone || null,
      from_location: fromLocation,
      to_location: toLocation,
      start_date: body.start_date,
      end_date: body.end_date || null,
      vehicle_type: body.vehicle_type,
      seating_capacity: seatingCapacity,
      vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
      driver_id: body.driver_id ? Number(body.driver_id) : null,
      status: "confirmed" as const,
      quoted_amount:
        body.quoted_amount !== undefined && body.quoted_amount !== null
          ? Number(body.quoted_amount)
          : null,
      advance_amount: advanceAmount,
      notes,
      created_by: authUser.id,
      updated_by: authUser.id,
    };

    const { data: newBooking, error } = await supabaseAdmin
      .from("trip_bookings")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_TRIP_BOOKING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "trip_bookings",
        recordId: newBooking.id,
        details: {
          vehicle_type: insertPayload.vehicle_type,
          start_date: insertPayload.start_date,
        },
      });
    });

    return apiSuccess({ booking: newBooking }, "Booking created", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing booking ID", 400);
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("trip_bookings")
      .select("id, status, vehicle_type")
      .eq("id", Number(id))
      .single();

    if (existingErr || !existing) {
      return apiError("Booking not found", 404);
    }

    if (existing.status === "completed") {
      return apiError("Completed bookings cannot be edited", 400);
    }

    const updatePayload: Record<string, unknown> = {
      updated_by: authUser.id,
    };

    if (fields.status !== undefined) {
      if (fields.status !== "cancelled") {
        return apiError(
          "status can only be set to 'cancelled' here — completion happens via trip creation",
          400,
        );
      }
      updatePayload.status = "cancelled";
    }

    if (fields.customer_name !== undefined) {
      const name = fields.customer_name?.trim();
      if (!name) {
        return apiError("Customer name cannot be empty", 400);
      }
      updatePayload.customer_name = name;
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
      const loc = fields.from_location?.trim();
      if (!loc) {
        return apiError("From location cannot be empty", 400);
      }
      updatePayload.from_location = loc;
    }

    if (fields.to_location !== undefined) {
      const loc = fields.to_location?.trim();
      if (!loc) {
        return apiError("To location cannot be empty", 400);
      }
      updatePayload.to_location = loc;
    }

    if (fields.start_date !== undefined) {
      if (!fields.start_date) {
        return apiError("Start date cannot be empty", 400);
      }
      updatePayload.start_date = fields.start_date;
    }

    if (fields.end_date !== undefined) {
      updatePayload.end_date = fields.end_date || null;
    }

    const effectiveVehicleType =
      (updatePayload.vehicle_type as VehicleType | undefined) ??
      fields.vehicle_type ??
      existing.vehicle_type;

    if (fields.vehicle_type !== undefined) {
      if (!VALID_VEHICLE_TYPES.includes(fields.vehicle_type)) {
        return apiError("A valid vehicle_type is required", 400);
      }
      updatePayload.vehicle_type = fields.vehicle_type;
    }

    if (fields.seating_capacity !== undefined) {
      if (fields.seating_capacity === null) {
        updatePayload.seating_capacity = null;
      } else {
        if (!SEATING_CAPACITY_TYPES.includes(effectiveVehicleType)) {
          return apiError(
            "seating_capacity only applies to Car, Bus, or Tempo Traveller",
            400,
          );
        }
        const seating = Number(fields.seating_capacity);
        if (!Number.isFinite(seating) || seating <= 0) {
          return apiError("seating_capacity must be a positive number", 400);
        }
        updatePayload.seating_capacity = seating;
      }
    }

    if (fields.vehicle_id !== undefined) {
      if (fields.vehicle_id) {
        const { data: vehicle, error: vErr } = await supabaseAdmin
          .from("vehicles")
          .select("id")
          .eq("id", Number(fields.vehicle_id))
          .single();

        if (vErr || !vehicle) {
          return apiError("Vehicle not found", 400);
        }
      }
      updatePayload.vehicle_id = fields.vehicle_id ? Number(fields.vehicle_id) : null;
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
      updatePayload.driver_id = fields.driver_id ? Number(fields.driver_id) : null;
    }

    if (fields.quoted_amount !== undefined) {
      if (fields.quoted_amount === null) {
        updatePayload.quoted_amount = null;
      } else {
        const quoted = Number(fields.quoted_amount);
        if (!Number.isFinite(quoted) || quoted < 0) {
          return apiError("Quoted amount must be a non-negative number", 400);
        }
        updatePayload.quoted_amount = quoted;
      }
    }

    if (fields.advance_amount !== undefined) {
      const advance = Number(fields.advance_amount);
      if (!Number.isFinite(advance) || advance < 0) {
        return apiError("Advance amount must be a non-negative number", 400);
      }
      updatePayload.advance_amount = advance;
    }

    if (fields.notes !== undefined) {
      const notes = fields.notes?.trim() || null;
      if (notes && notes.length > 500) {
        return apiError("Notes must be 500 characters or fewer", 400);
      }
      updatePayload.notes = notes;
    }

    const startDate = updatePayload.start_date;
    const endDate = updatePayload.end_date ?? fields.end_date;
    if (startDate && endDate) {
      if (new Date(endDate as string) < new Date(startDate as string)) {
        return apiError("End date cannot be before start date", 400);
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from("trip_bookings")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_TRIP_BOOKING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "trip_bookings",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ booking: updated }, "Booking updated");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing booking ID", 400);
    }

    const { error } = await supabaseAdmin
      .from("trip_bookings")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_TRIP_BOOKING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "trip_bookings",
        recordId: Number(id),
        details: { deleted: true },
      });
    });

    return apiSuccess(null, "Booking deleted");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
