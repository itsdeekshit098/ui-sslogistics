import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/apiResponse";
import { loadMonth } from "../driver-attendance.data";
import { csvValue } from "@/lib/csv";
import { isValidMonth, markCode, monthRange } from "../driver-attendance.utils";

// ─── GET ?month=YYYY-MM ───
// The month register as a CSV for working out wages: one row per driver with
// the totals first, then every day so a figure can be checked against the
// register. Admin-only, like marking itself.

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const month = new URL(req.url).searchParams.get("month");
    if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);

    const data = await loadMonth(month);
    const dayCount = Number(monthRange(month).to.slice(8));
    const dates = Array.from(
      { length: dayCount },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    );

    const header = [
      "Driver",
      "Place",
      "Days present",
      "Full days",
      "Shifts",
      "Absent",
      "Leave",
      ...dates.map((date) => Number(date.slice(8))),
    ];
    const rows = data.drivers.map((driver) => [
      driver.name,
      driver.place ?? "",
      driver.totals.days_present,
      driver.totals.full_days,
      driver.totals.shifts,
      driver.totals.absent,
      driver.totals.leave,
      ...dates.map((date) => markCode(driver.days[date])),
    ]);

    // The BOM makes Excel read the file as UTF-8 instead of mangling names.
    const csv =
      "\uFEFF" + [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="driver_attendance_${month}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
