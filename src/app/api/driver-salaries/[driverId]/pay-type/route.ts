import { after } from "next/server";
import { requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { isPositiveNumber } from "../../../loans/loans.utils";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { hasSettlementOnOrAfter } from "../../driver-salaries.data";
import { PAY_TYPES, type DriverPayType } from "@/components/salariesPage/salariesPage.types";

// How a driver is paid: MONTHLY (today's only rule — a fixed salary, cut for
// Absent/Leave) or PER_TRIP (a rate × a trip count entered by hand each
// month). Dated like a salary rate or shift count — a change applies from a
// given month onward, so switching a driver's pay type never rewrites how
// past months were paid. See sql/51_add_holiday_status_and_pay_type.sql.

const NOTE_MAX_LENGTH = 200;

/** Every role may read — the attendance/salary screens need to know which
 *  controls to show (a PER_TRIP driver gets no shift buttons). */
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
      .from("driver_pay_types")
      .select("id, driver_id, pay_type, rate_per_trip, effective_from, note, created_at")
      .eq("driver_id", driverId)
      .order("effective_from", { ascending: false });
    // Until sql/51 is applied, every driver is MONTHLY.
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        return apiSuccess({ payTypes: [] });
      }
      return serverError(error);
    }

    const payTypes = (data ?? []).map((row) => ({
      ...row,
      rate_per_trip: row.rate_per_trip == null ? null : Number(row.rate_per_trip),
    })) as DriverPayType[];

    return apiSuccess({ payTypes });
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

    const payType = body.pay_type;
    if (!(PAY_TYPES as readonly unknown[]).includes(payType)) {
      return apiError(`Pay type must be one of: ${PAY_TYPES.join(", ")}`, 400);
    }

    let ratePerTrip: number | null = null;
    if (payType === "PER_TRIP") {
      if (!isPositiveNumber(body.rate_per_trip)) {
        return apiError("Rate per trip is required and must be greater than zero", 400);
      }
      ratePerTrip = body.rate_per_trip;
    }

    if (!isValidMonth(body.effective_month)) {
      return apiError("The month the pay type starts from is required (YYYY-MM)", 400);
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

    // Same reasoning as the salary-rate route: a pay type applies from its
    // starting month forward, so a change backdated before a settled month
    // would otherwise silently change what that month was paid against —
    // switching someone to PER_TRIP would zero out an already-settled
    // MONTHLY figure's basis.
    if (await hasSettlementOnOrAfter(driverId, body.effective_month)) {
      return apiError(
        "A later month is already settled — undo that settlement first if you need to change this driver's pay type",
        409,
      );
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("driver_pay_types")
      .select("id, pay_type, rate_per_trip")
      .eq("driver_id", driverId)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();
    if (existingErr) {
      if (existingErr.code === "PGRST205" || existingErr.code === "42P01") {
        return apiError(
          "Pay type isn't set up in this database yet — run sql/51_add_holiday_status_and_pay_type.sql",
          503,
        );
      }
      return serverError(existingErr);
    }

    const write = existing
      ? supabaseAdmin
          .from("driver_pay_types")
          .update({
            pay_type: payType,
            rate_per_trip: ratePerTrip,
            note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      : supabaseAdmin.from("driver_pay_types").insert([
          {
            driver_id: driverId,
            pay_type: payType,
            rate_per_trip: ratePerTrip,
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
        action: "SET_DRIVER_PAY_TYPE",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_pay_types",
        recordId: row.id,
        details: {
          driver_id: driverId,
          pay_type: payType,
          rate_per_trip: ratePerTrip,
          effective_from: effectiveFrom,
          previous_pay_type: existing?.pay_type ?? null,
        },
      });
    });

    return apiSuccess(
      { payType: row as DriverPayType },
      existing ? "Pay type corrected" : "Pay type set",
      existing ? 200 : 201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
