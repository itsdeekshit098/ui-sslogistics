import { NextRequest } from "next/server";
import {
  apiError,
  apiSuccess,
  handleApiError,
  serverError,
} from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireSuperAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

/**
 * Nothing more recent than this may ever be purged, whatever cutoff the caller
 * asks for. Recent history is what an investigation actually reaches for, so a
 * mistyped date must not be able to wipe it.
 */
const MIN_RETENTION_DAYS = 60;

/**
 * GET — Fetch activity logs with pagination.
 * Query params: ?page=1&limit=30
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAuth();
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
    const offset = (page - 1) * limit;

    // Fetch total count
    const { count, error: countErr } = await supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true });

    if (countErr) {
      return serverError(countErr);
    }

    // Fetch paginated data
    const { data, error } = await supabaseAdmin
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return serverError(error);
    }

    return apiSuccess({
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

/**
 * DELETE — Purge activity log entries older than a cutoff date. Superadmin only.
 *
 * Query params:
 *   ?before=YYYY-MM-DD   required; entries strictly older than this go
 *   ?dryRun=true         count what would be deleted, delete nothing
 *
 * This is the one place activity_log rows are ever removed. Deleting here does
 * not lose money-trail attribution: loan_payments, funding_entries and
 * client_ledger_entries each carry their own created_by, and reversals stay on
 * the ledger permanently.
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireSuperAdminAuth();

    const beforeParam = req.nextUrl.searchParams.get("before");
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";

    if (!beforeParam) {
      return apiError("A 'before' cutoff date is required.", 400);
    }

    const cutoff = new Date(beforeParam);
    if (isNaN(cutoff.getTime())) {
      return apiError("The 'before' cutoff date is not a valid date.", 400);
    }

    const floor = new Date();
    floor.setDate(floor.getDate() - MIN_RETENTION_DAYS);
    if (cutoff.getTime() > floor.getTime()) {
      return apiError(
        `Entries from the last ${MIN_RETENTION_DAYS} days cannot be deleted. Choose an older cutoff date.`,
        400,
      );
    }

    const cutoffIso = cutoff.toISOString();

    // Always count first: the dry run needs it, and the real delete reports it
    // back so the confirmation and the audit entry agree on a number.
    const { count, error: countErr } = await supabaseAdmin
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .lt("created_at", cutoffIso);

    if (countErr) {
      return serverError(countErr);
    }

    const matched = count || 0;

    if (dryRun) {
      return apiSuccess({ cutoff: cutoffIso, count: matched, dryRun: true });
    }

    if (matched === 0) {
      return apiSuccess(
        { cutoff: cutoffIso, deleted: 0 },
        "No entries older than that date.",
      );
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("activity_log")
      .delete()
      .lt("created_at", cutoffIso);

    if (deleteErr) {
      return serverError(deleteErr);
    }

    // Logged after the delete, so the record of the purge is never caught by
    // the purge itself.
    await logActivity({
      action: "PURGE_ACTIVITY_LOG",
      userId: user.id,
      userEmail: user.email,
      userDisplayName: user.displayName,
      tableName: "activity_log",
      recordId: null,
      details: { cutoff: cutoffIso, deleted: matched },
    });

    return apiSuccess(
      { cutoff: cutoffIso, deleted: matched },
      `Deleted ${matched} activity log ${matched === 1 ? "entry" : "entries"}.`,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
