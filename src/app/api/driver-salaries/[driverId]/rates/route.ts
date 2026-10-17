import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { isNonNegativeNumber } from "../../../loans/loans.utils";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { isMonthSettled } from "../../driver-salaries.data";

// Sets a driver's monthly salary from a given month onward. A raise is a new
// row rather than an edit, so earlier months keep the salary they were paid
// at. Saving again for the *same* starting month corrects that row instead —
// a typo in the amount has to be fixable — and the old and new figures both
// go to the activity log.
//
// Only the starting month itself is checked against being settled: a rate
// takes effect going forward, so blocking every change while any past month
// is settled would be too heavy. What actually has to stay fixed is the
// month the settlement receipt was computed from.

const NOTE_MAX_LENGTH = 200;

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

    if (!isNonNegativeNumber(body.monthly_salary)) {
      return apiError("Monthly salary is required", 400);
    }
    const monthlySalary = body.monthly_salary;

    if (!isValidMonth(body.effective_month)) {
      return apiError("The month the salary starts from is required (YYYY-MM)", 400);
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

    if (await isMonthSettled(driverId, body.effective_month)) {
      return apiError(
        "This month is already settled — undo the settlement first if you need to change the salary it was paid against",
        409,
      );
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("driver_salary_rates")
      .select("id, monthly_salary")
      .eq("driver_id", driverId)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();
    if (existingErr) return serverError(existingErr);

    const write = existing
      ? supabaseAdmin
          .from("driver_salary_rates")
          .update({
            monthly_salary: monthlySalary,
            note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      : supabaseAdmin.from("driver_salary_rates").insert([
          {
            driver_id: driverId,
            monthly_salary: monthlySalary,
            effective_from: effectiveFrom,
            note,
            created_by: authUser.id,
          },
        ]);

    const { data: rate, error } = await write.select("*").single();
    if (error) {
      // Two saves for the same month racing each other: the loser retries as
      // a correction rather than failing.
      if (error.code === "23505") {
        return apiError("That salary was just changed by someone else — try again", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "SET_DRIVER_SALARY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_salary_rates",
        recordId: rate.id,
        details: {
          driver_id: driverId,
          monthly_salary: monthlySalary,
          effective_from: effectiveFrom,
          previous_monthly_salary: existing ? Number(existing.monthly_salary) : null,
        },
      });
    });

    return apiSuccess({ rate }, existing ? "Salary corrected" : "Salary set", existing ? 200 : 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
