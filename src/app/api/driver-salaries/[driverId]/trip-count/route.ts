import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, readJsonObject, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { todayInIndia } from "@/lib/dateOnly";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { isMonthSettled, payTypeFor } from "../../driver-salaries.data";
import { MAX_TRIP_COUNT } from "../../driver-salaries.utils";
import type { DriverTripCount } from "@/components/salariesPage/salariesPage.types";

// How many trips a PER_TRIP driver ran in a month — a single editable figure
// per driver per month, corrected in place (like a salary rate), not an
// append-only ledger. GET/POST are strict-admin, like every other salary
// route, GET included: a driver's trip count determines their pay exactly as
// a salary figure does.

const NOTE_MAX_LENGTH = 200;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { driverId: driverIdParam } = await params;
    const driverId = Number(driverIdParam);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return apiError("Invalid driver ID", 400);
    }

    const month = new URL(req.url).searchParams.get("month");
    if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);

    const { data, error } = await supabaseAdmin
      .from("driver_trip_counts")
      .select("id, driver_id, period_month, trip_count, note, created_at")
      .eq("driver_id", driverId)
      .eq("period_month", `${month}-01`)
      .maybeSingle();
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        return apiSuccess({ tripCount: null });
      }
      return serverError(error);
    }

    return apiSuccess({ tripCount: data as DriverTripCount | null });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { driverId: driverIdParam } = await params;
    const driverId = Number(driverIdParam);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return apiError("Invalid driver ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("The request body must be a JSON object", 400);

    if (!isValidMonth(body.period_month)) {
      return apiError("Invalid month (expected YYYY-MM)", 400);
    }
    const periodMonth = body.period_month as string;
    if (periodMonth > todayInIndia().slice(0, 7)) {
      return apiError("A trip count can't be entered for a month that hasn't started", 400);
    }

    const tripCount = body.trip_count;
    if (
      typeof tripCount !== "number" ||
      !Number.isFinite(tripCount) ||
      !Number.isInteger(tripCount) ||
      tripCount < 0
    ) {
      return apiError("Trip count must be a whole number of zero or more", 400);
    }
    if (tripCount > MAX_TRIP_COUNT) {
      return apiError(`A month can't have more than ${MAX_TRIP_COUNT} trips`, 400);
    }

    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, NOTE_MAX_LENGTH)
        : null;

    const { data: driver, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .maybeSingle();
    if (driverErr) return serverError(driverErr);
    if (!driver) return apiError("Driver not found", 404);

    // A trip count only means anything for a PER_TRIP driver — entering one
    // for a MONTHLY driver would sit in the table unused and confuse anyone
    // who later switches them to PER_TRIP expecting this month to be blank.
    const { payType } = await payTypeFor(driverId, periodMonth);
    if (payType !== "PER_TRIP") {
      return apiError(
        "This driver is paid monthly, not per trip — set their pay type to per-trip first",
        400,
      );
    }

    if (await isMonthSettled(driverId, periodMonth)) {
      return apiError(
        "This month is settled — undo the settlement first to change the trip count",
        409,
      );
    }

    const periodMonthDate = `${periodMonth}-01`;

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("driver_trip_counts")
      .select("id, trip_count")
      .eq("driver_id", driverId)
      .eq("period_month", periodMonthDate)
      .maybeSingle();
    if (existingErr) {
      if (existingErr.code === "PGRST205" || existingErr.code === "42P01") {
        return apiError(
          "Trip counts aren't set up in this database yet — run sql/51_add_holiday_status_and_pay_type.sql",
          503,
        );
      }
      return serverError(existingErr);
    }

    const write = existing
      ? supabaseAdmin
          .from("driver_trip_counts")
          .update({ trip_count: tripCount, note, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
      : supabaseAdmin.from("driver_trip_counts").insert([
          {
            driver_id: driverId,
            period_month: periodMonthDate,
            trip_count: tripCount,
            note,
            created_by: authUser.id,
          },
        ]);

    const { data: row, error } = await write.select("*").single();
    if (error) {
      if (error.code === "23505") {
        return apiError("That was just changed by someone else — try again", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "SET_DRIVER_TRIP_COUNT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_trip_counts",
        recordId: row.id,
        details: {
          driver_id: driverId,
          period_month: periodMonthDate,
          trip_count: tripCount,
          previous_trip_count: existing ? Number(existing.trip_count) : null,
        },
      });
    });

    return apiSuccess(
      { tripCount: row as DriverTripCount },
      existing ? "Trip count corrected" : "Trip count set",
      existing ? 200 : 201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
