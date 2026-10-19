import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/apiResponse";
import { csvValue } from "@/lib/csv";
import { todayInIndia } from "@/lib/dateOnly";
import { isValidMonth } from "../../driver-attendance/driver-attendance.utils";
import { loadSalarySheet } from "../driver-salaries.data";

// ─── GET ?month=YYYY-MM ───
// The month's salary sheet as a CSV: one row per driver in the same order and
// with the same figures as the page, then a totals row. A driver with no
// salary set has blank money cells rather than zeros, so the gap is visible.

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const month = new URL(req.url).searchParams.get("month");
    if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);
    if (month > todayInIndia().slice(0, 7)) {
      return apiError("A salary sheet can't be drawn up for a month that hasn't started", 400);
    }

    const sheet = await loadSalarySheet(month);

    const header = [
      "Driver",
      "Place",
      "Pay type",
      "Monthly salary",
      "Rate per trip",
      "Trips",
      "Days in month",
      "Days present",
      "Absent",
      "Leave",
      "Holiday",
      "Not marked",
      "Unpaid days",
      "Attendance cut",
      "Advances",
      "Other deductions",
      "Net pay",
    ];
    const rows = sheet.drivers.map((row) => [
      row.name,
      row.place ?? "",
      row.pay_type === "PER_TRIP" ? "Per trip" : "Monthly",
      row.monthly_salary ?? "",
      row.rate_per_trip ?? "",
      row.trip_count ?? "",
      sheet.days_in_month,
      row.days_present,
      row.absent_days,
      row.leave_days,
      row.holiday_days,
      row.unmarked_days,
      row.unpaid_days,
      // Blank, not zero, when there's nothing to cut from (no salary set, or
      // a PER_TRIP driver who has no per-day cut at all).
      row.monthly_salary == null ? "" : row.attendance_cut,
      row.advances,
      row.deductions,
      row.net_pay ?? "",
    ]);
    const totals = [
      "TOTAL",
      "",
      "",
      sheet.totals.monthly_salary,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      sheet.totals.attendance_cut,
      sheet.totals.advances,
      sheet.totals.deductions,
      sheet.totals.net_pay,
    ];

    // The BOM makes Excel read the file as UTF-8 instead of mangling names.
    const csv =
      "﻿" +
      [header, ...rows, totals].map((row) => row.map(csvValue).join(",")).join("\r\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="driver_salaries_${month}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
