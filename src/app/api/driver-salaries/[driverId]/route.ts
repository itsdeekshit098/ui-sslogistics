import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { todayInIndia } from "@/lib/dateOnly";
import { isValidMonth } from "../../driver-attendance/driver-attendance.utils";
import { loadDriverSalary } from "../driver-salaries.data";

// ─── GET ?month=YYYY-MM — one driver's month: sheet line, salary history, entries ───

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

    const currentMonth = todayInIndia().slice(0, 7);
    const month = new URL(req.url).searchParams.get("month") ?? currentMonth;
    if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);
    if (month > currentMonth) {
      return apiError("A salary sheet can't be drawn up for a month that hasn't started", 400);
    }

    const detail = await loadDriverSalary(driverId, month);
    if (!detail) return apiError("Driver not found", 404);

    return apiSuccess(detail);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
