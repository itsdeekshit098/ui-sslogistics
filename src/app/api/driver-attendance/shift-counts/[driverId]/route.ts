import { after } from "next/server";
import { requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import type { DriverShiftCount } from "@/components/attendancePage/attendancePage.types";
import { isValidMonth } from "../../driver-attendance.utils";

// How many shifts one driver runs in a day (sql/48). A change takes effect
// from a month, so the months before it keep the count they were marked and
// paid against — the same rule as a salary rate.

const NOTE_MAX_LENGTH = 200;

/** Every role may read a driver's history; the marking screen needs the count. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    await requireUserAuth();

    const { driverId: driverIdParam } = await params;
    const driverId = Number(driverIdParam);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return apiError("Invalid driver ID", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("driver_shift_counts")
      .select("id, driver_id, shift_count, effective_from, note, created_at")
      .eq("driver_id", driverId)
      .order("effective_from", { ascending: false });
    // Until sql/48 is applied, every driver works three shifts.
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return apiSuccess({ counts: [] });
      return serverError(error);
    }

    return apiSuccess({ counts: (data ?? []) as DriverShiftCount[] });
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

    const body = (await req.json()) as Record<string, unknown>;

    const shiftCount = Number(body.shift_count);
    if (![1, 2, 3].includes(shiftCount)) {
      return apiError("Shifts per day must be 1, 2 or 3", 400);
    }

    if (!isValidMonth(body.effective_month)) {
      return apiError("The month the change starts from is required (YYYY-MM)", 400);
    }
    const effectiveFrom = `${body.effective_month}-01`;
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

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("driver_shift_counts")
      .select("id, shift_count")
      .eq("driver_id", driverId)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();
    if (existingErr) {
      if (existingErr.code === "PGRST205" || existingErr.code === "42P01") {
        return apiError(
          "Shifts per day isn't set up in this database yet — run sql/48_add_driver_shift_counts.sql",
          503,
        );
      }
      return serverError(existingErr);
    }

    // Saving again for the same starting month corrects that row rather than
    // stacking a second one on the same date.
    const write = existing
      ? supabaseAdmin
          .from("driver_shift_counts")
          .update({ shift_count: shiftCount, note, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
      : supabaseAdmin.from("driver_shift_counts").insert([
          {
            driver_id: driverId,
            shift_count: shiftCount,
            effective_from: effectiveFrom,
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
        action: "SET_DRIVER_SHIFT_COUNT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_shift_counts",
        recordId: row.id,
        details: {
          driver_id: driverId,
          shift_count: shiftCount,
          effective_from: effectiveFrom,
          previous_shift_count: existing ? Number(existing.shift_count) : null,
        },
      });
    });

    return apiSuccess(
      { count: row as DriverShiftCount },
      existing ? "Shifts per day corrected" : "Shifts per day set",
      existing ? 200 : 201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
