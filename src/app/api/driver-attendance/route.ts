import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import type {
  AttendanceMark,
  SaveAttendancePayload,
} from "@/components/attendancePage/attendancePage.types";
import { loadDay, loadMonth } from "./driver-attendance.data";
import { isValidDate, isValidMonth, parseMark, todayInIndia } from "./driver-attendance.utils";

const MAX_ENTRIES = 500;

// ─── GET ───
// ?date=YYYY-MM-DD → one day, every driver (defaults to today in IST)
// ?month=YYYY-MM   → the month register with per-driver totals
// Every role may read; only admins may change anything (see PUT).

export async function GET(req: Request) {
  try {
    const user = await requireUserAuth();
    const { searchParams } = new URL(req.url);

    const month = searchParams.get("month");
    if (month !== null) {
      if (!isValidMonth(month)) return apiError("Invalid month (expected YYYY-MM)", 400);
      return apiSuccess(await loadMonth(month));
    }

    const date = searchParams.get("date") ?? todayInIndia();
    if (!isValidDate(date)) return apiError("Invalid date (expected YYYY-MM-DD)", 400);
    return apiSuccess(await loadDay(user, date));
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT ───
// Saves the changed drivers for one date in a single request. Returns the
// day as it now stands so the client rebases on what was actually stored.

export async function PUT(req: Request) {
  try {
    const user = await requireStrictAdminAuth();
    const body: SaveAttendancePayload = await req.json();

    if (!isValidDate(body?.date)) return apiError("Invalid date (expected YYYY-MM-DD)", 400);
    const date = body.date;
    const today = todayInIndia();

    if (date > today) return apiError("Attendance cannot be marked for a future date", 400);

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return apiError("No changes to save", 400);
    }
    if (body.entries.length > MAX_ENTRIES) {
      return apiError(`Too many entries (max ${MAX_ENTRIES})`, 400);
    }

    const marks = new Map<number, AttendanceMark>();
    for (const entry of body.entries) {
      const driverId = Number(entry?.driver_id);
      if (!Number.isInteger(driverId) || driverId <= 0) {
        return apiError("Invalid driver ID", 400);
      }
      if (marks.has(driverId)) return apiError("A driver appears twice in this save", 400);
      const mark = parseMark(entry.shifts, entry.status);
      if (typeof mark === "string") return apiError(mark, 400);
      marks.set(driverId, mark);
    }

    const driverIds = [...marks.keys()];
    const { data: known, error: knownErr } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .in("id", driverIds);
    if (knownErr) return serverError(knownErr);
    if ((known ?? []).length !== driverIds.length) {
      return apiError("One or more drivers no longer exist", 400);
    }

    const now = new Date().toISOString();
    const upserts = driverIds
      .filter((id) => marks.get(id)!.shifts.length > 0 || marks.get(id)!.status)
      .map((id) => {
        const mark = marks.get(id)!;
        return {
          driver_id: id,
          attendance_date: date,
          status: mark.status ?? "PRESENT",
          shift_a: mark.shifts.includes("A"),
          shift_b: mark.shifts.includes("B"),
          shift_c: mark.shifts.includes("C"),
          marked_by: user.id,
          updated_at: now,
        };
      });
    const clears = driverIds.filter((id) => !upserts.some((row) => row.driver_id === id));

    if (upserts.length > 0) {
      const { error } = await supabaseAdmin
        .from("driver_attendance")
        .upsert(upserts, { onConflict: "driver_id,attendance_date" });
      if (error) return serverError(error);
    }
    if (clears.length > 0) {
      const { error } = await supabaseAdmin
        .from("driver_attendance")
        .delete()
        .eq("attendance_date", date)
        .in("driver_id", clears);
      if (error) return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "MARK_DRIVER_ATTENDANCE",
        userId: user.id,
        userEmail: user.email,
        userDisplayName: user.displayName,
        tableName: "driver_attendance",
        recordId: null,
        details: { date, marked: upserts.length, cleared: clears.length },
      });
    });

    return apiSuccess(await loadDay(user, date), "Attendance saved");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
