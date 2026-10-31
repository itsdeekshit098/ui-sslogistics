import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, readJsonObject, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { todayInIndia } from "@/lib/dateOnly";
import {
  SALARY_DESCRIPTION_MAX_LENGTH,
  SALARY_ENTRY_TYPES,
  type SalaryEntryType,
} from "@/components/salariesPage/salariesPage.types";
import { isValidDateString } from "../../../loans/loans.utils";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { isMonthSettled } from "../../driver-salaries.data";
import { moneyMessage, moneyProblem } from "../../driver-salaries.utils";

// Records an advance or a deduction against a driver's salary for a month.
// Entries are never edited or deleted: a mistake is undone through the
// reverse route, which leaves both rows on record.

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

    const entryType = body.entry_type;
    if (!(SALARY_ENTRY_TYPES as readonly unknown[]).includes(entryType)) {
      return apiError(`Invalid entry type. Allowed values: ${SALARY_ENTRY_TYPES.join(", ")}`, 400);
    }

    const amountProblem = moneyProblem(body.amount);
    if (amountProblem) {
      return apiError(moneyMessage(amountProblem, "Enter an amount greater than zero"), 400);
    }

    const today = todayInIndia();
    const entryDate = body.entry_date ?? today;
    if (!isValidDateString(entryDate)) {
      return apiError("Invalid date (expected YYYY-MM-DD)", 400);
    }
    if (entryDate > today) {
      return apiError("The date can't be in the future", 400);
    }

    // Which month's salary it comes out of. Defaults to the month it was
    // given in, but can be the month before (an advance paid on the 2nd
    // against last month's pay).
    const periodMonth = body.period_month ?? entryDate.slice(0, 7);
    if (!isValidMonth(periodMonth)) {
      return apiError("Invalid salary month (expected YYYY-MM)", 400);
    }
    if (periodMonth > today.slice(0, 7)) {
      return apiError("The salary month can't be in the future", 400);
    }

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, SALARY_DESCRIPTION_MAX_LENGTH)
        : null;

    const { data: driver, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .maybeSingle();
    if (driverErr) return serverError(driverErr);
    if (!driver) return apiError("Driver not found", 404);

    if (await isMonthSettled(driverId, periodMonth)) {
      return apiError(
        "This month is already settled — undo the settlement first if you need to change it",
        409,
      );
    }

    const { data: entry, error } = await supabaseAdmin
      .from("driver_salary_entries")
      .insert([
        {
          driver_id: driverId,
          entry_type: entryType as SalaryEntryType,
          amount: body.amount,
          entry_date: entryDate,
          period_month: `${periodMonth}-01`,
          description,
          created_by: authUser.id,
        },
      ])
      .select("*")
      .single();
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "CREATE_DRIVER_SALARY_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_salary_entries",
        recordId: entry.id,
        details: {
          driver_id: driverId,
          entry_type: entryType,
          amount: body.amount,
          period_month: periodMonth,
        },
      });
    });

    return apiSuccess({ entry }, entryType === "ADVANCE" ? "Advance recorded" : "Deduction recorded", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
