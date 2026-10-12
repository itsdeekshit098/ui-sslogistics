import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { todayInIndia } from "@/lib/dateOnly";
import { isValidMonth } from "../driver-attendance/driver-attendance.utils";
import { loadSalarySheet } from "./driver-salaries.data";

// Driver salaries. Every method — GET included — is admin/superadmin only:
// what each driver is paid is as sensitive as the loans, unlike attendance
// itself, which every role may read.
//
// No salary figure is stored. The sheet is worked out on each request from
// the salary rates, the attendance marks and the advance/deduction entries
// (see driver-salaries.utils.ts for the rule), so web and mobile can't
// disagree and a corrected mark changes the sheet at once.

// ─── GET ?month=YYYY-MM — the salary sheet for a month (defaults to this month) ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const currentMonth = todayInIndia().slice(0, 7);
    const month = new URL(req.url).searchParams.get("month") ?? currentMonth;
    if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);
    if (month > currentMonth) {
      return apiError("A salary sheet can't be drawn up for a month that hasn't started", 400);
    }

    return apiSuccess(await loadSalarySheet(month));
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
