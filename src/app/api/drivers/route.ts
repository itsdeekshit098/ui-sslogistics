import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import type { CreateDriverPayload } from "@/components/driversPage";
import { normalizeName } from "@/lib/normalizeName";
import { findSimilarNames } from "@/lib/similarName";

const PHONE_REGEX = /^[6-9]\d{9}$/;

interface DriverNameRow {
  id: number;
  name: string;
  place: string | null;
  phone: string | null;
  dl_number: string | null;
  is_active: boolean;
}

/**
 * Splitting one person across two rows is the failure this guards against:
 * their attendance, salary and advances would each land on a different
 * driver, and the wages would quietly be wrong for both.
 *
 * Three outcomes, deliberately different:
 *
 *   exact    — the same name once case and spacing are ignored ("Mehaboob" /
 *              "MEHABOOB"). Refused: there is no legitimate reason to hold
 *              two drivers under one name.
 *   dl       — the same driving licence number. Refused: a DL belongs to one
 *              person, whatever the name on the row says.
 *   similar  — a different spelling that might be the same person
 *              ("MEHABOOB" / "MAHABOOB"). Only reported. Two brothers really
 *              can be Ramesh and Rameshu, so the person adding decides.
 */
async function findDuplicates(
  name: string,
  dlNumber: string | null,
  excludeId: number | null,
): Promise<
  | { kind: "exact" | "dl"; row: DriverNameRow }
  | { kind: "similar"; rows: DriverNameRow[] }
  | null
> {
  const { data, error } = await supabaseAdmin
    .from("drivers")
    .select("id, name, place, phone, dl_number, is_active");
  if (error) throw error;

  // Inactive drivers count: re-adding someone who left is exactly how a
  // second row for one person gets created.
  const rows = ((data ?? []) as DriverNameRow[]).filter((row) => row.id !== excludeId);

  const target = normalizeName(name);
  const exact = rows.find((row) => normalizeName(row.name) === target);
  if (exact) return { kind: "exact", row: exact };

  if (dlNumber) {
    const dl = dlNumber.toLowerCase().replace(/[^a-z0-9]/g, "");
    const clash = rows.find(
      (row) => row.dl_number && row.dl_number.toLowerCase().replace(/[^a-z0-9]/g, "") === dl,
    );
    if (clash) return { kind: "dl", row: clash };
  }

  const similar = findSimilarNames(name, rows);
  return similar.length > 0 ? { kind: "similar", rows: similar } : null;
}

/** "MEHABOOB (Nellore, 98765 43210)" — enough to recognise who is meant. */
function describeDriver(row: DriverNameRow): string {
  const details = [row.place, row.phone].filter(Boolean).join(", ");
  const suffix = row.is_active ? "" : ", inactive";
  return details || suffix ? `${row.name} (${details}${suffix})` : row.name;
}

// ─── GET ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get("pageSize")) || 50),
    );
    const search = searchParams.get("search")?.trim() ?? "";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("drivers")
      .select("*", { count: "exact" })
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (search) {
      // Escape characters that have special meaning in PostgREST filter syntax
      const safe = search.replace(/[,.*()%_]/g, "");
      query = query.or(
        `name.ilike.%${safe}%,phone.ilike.%${safe}%,place.ilike.%${safe}%,dl_number.ilike.%${safe}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return serverError(error);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body: CreateDriverPayload = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Name is required", 400);
    }

    const phone = body.phone?.trim();
    if (phone && !PHONE_REGEX.test(phone)) {
      return apiError(
        "Invalid phone number (must be 10 digits starting with 6-9)",
        400,
      );
    }

    const name = body.name.trim();
    const dlNumber = body.dl_number?.trim() || null;

    // `confirm_similar: true` is the user answering "yes, different person"
    // to the warning below. It never waives the exact-name or DL checks.
    const confirmSimilar = (body as { confirm_similar?: boolean }).confirm_similar === true;

    const duplicate = await findDuplicates(name, dlNumber, null);
    if (duplicate?.kind === "exact") {
      return apiError(
        `A driver named ${describeDriver(duplicate.row)} already exists.`,
        409,
      );
    }
    if (duplicate?.kind === "dl") {
      return apiError(
        `That DL number already belongs to ${describeDriver(duplicate.row)}.`,
        409,
      );
    }
    if (duplicate?.kind === "similar" && !confirmSimilar) {
      // 409 with the matches attached: the client shows them and offers to
      // send the same request again with confirm_similar.
      return NextResponse.json(
        {
          success: false,
          error:
            duplicate.rows.length === 1
              ? `${describeDriver(duplicate.rows[0])} already exists — is this the same person?`
              : `${duplicate.rows.length} drivers with similar names already exist — is this the same person?`,
          code: "SIMILAR_DRIVER_EXISTS",
          similar: duplicate.rows.map((row) => ({
            id: row.id,
            name: row.name,
            place: row.place,
            phone: row.phone,
            is_active: row.is_active,
          })),
        },
        { status: 409 },
      );
    }

    const insertPayload = {
      name,
      phone: phone || null,
      place: body.place?.trim() || null,
      dl_number: dlNumber,
      photo_url: body.photo_url?.trim() || null,
      is_active: true,
    };

    const { data: newDriver, error } = await supabaseAdmin
      .from("drivers")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "drivers",
        recordId: newDriver.id,
        details: insertPayload,
      });
    });

    return apiSuccess({ driver: newDriver }, "Driver created", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing driver ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (fields.name !== undefined) {
      if (!fields.name || fields.name.trim() === "") {
        return apiError("Name cannot be empty", 400);
      }
      updatePayload.name = fields.name.trim();
    }

    if (fields.phone !== undefined) {
      const phone = fields.phone?.trim();
      if (phone && !PHONE_REGEX.test(phone)) {
        return apiError(
          "Invalid phone number (must be 10 digits starting with 6-9)",
          400,
        );
      }
      updatePayload.phone = phone || null;
    }

    if (fields.place !== undefined) {
      updatePayload.place = fields.place?.trim() || null;
    }

    if (fields.dl_number !== undefined) {
      updatePayload.dl_number = fields.dl_number?.trim() || null;
    }

    if (fields.photo_url !== undefined) {
      updatePayload.photo_url = fields.photo_url?.trim() || null;
    }

    if (fields.is_active !== undefined) {
      updatePayload.is_active = Boolean(fields.is_active);
    }

    // Renaming a driver onto an existing one splits that person's history
    // just as surely as adding a second row, so edits are checked too — the
    // driver being edited is excluded so saving their own name is fine.
    if (updatePayload.name !== undefined || updatePayload.dl_number !== undefined) {
      const { data: current } = await supabaseAdmin
        .from("drivers")
        .select("name, dl_number")
        .eq("id", Number(id))
        .maybeSingle();

      const nextName = (updatePayload.name as string) ?? current?.name ?? "";
      const nextDl =
        updatePayload.dl_number !== undefined
          ? (updatePayload.dl_number as string | null)
          : ((current?.dl_number as string | null) ?? null);

      const duplicate = await findDuplicates(nextName, nextDl, Number(id));
      if (duplicate?.kind === "exact") {
        return apiError(
          `A driver named ${describeDriver(duplicate.row)} already exists.`,
          409,
        );
      }
      if (duplicate?.kind === "dl") {
        return apiError(
          `That DL number already belongs to ${describeDriver(duplicate.row)}.`,
          409,
        );
      }
      // A similar name on an edit is not worth interrupting: the row already
      // exists, and the exact-name and DL checks above cover the real risk.
    }

    const { data: updatedDriver, error } = await supabaseAdmin
      .from("drivers")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "drivers",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ driver: updatedDriver }, "Driver updated");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing driver ID", 400);
    }

    const dependentChecks: [string, string][] = [
      ["external_trips", "external trip(s)"],
      ["trip_bookings", "trip booking(s)"],
      ["driver_attendance", "attendance record(s)"],
      ["driver_salary_rates", "salary record(s)"],
      ["driver_salary_entries", "salary advance(s) or deduction(s)"],
      ["driver_salary_settlements", "salary settlement(s)"],
      ["driver_shift_counts", "shift-count record(s)"],
      ["driver_pay_types", "pay-type record(s)"],
      ["driver_trip_counts", "trip-count record(s)"],
    ];

    for (const [table, label] of dependentChecks) {
      const { count, error: countErr } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("driver_id", Number(id));

      if (countErr) {
        // A table that isn't there yet (sql/ files are applied by hand) or
        // has been retired can't be holding rows — skip it, as the vehicle
        // delete does, rather than failing every driver delete.
        if (countErr.code === "PGRST205" || countErr.code === "42P01") continue;
        return serverError(countErr, { table });
      }

      if ((count ?? 0) > 0) {
        return apiError(
          `Cannot delete driver because they are linked to ${count} ${label}. Deactivate them instead.`,
          400,
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("drivers")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "drivers",
        recordId: Number(id),
        details: { deleted: true },
      });
    });

    return apiSuccess(null, "Driver deleted");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
