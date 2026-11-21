import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import {
  apiSuccess,
  apiError,
  handleApiError,
  readJsonObject,
  serverError,
} from "@/lib/apiResponse";
import { parseId } from "@/app/api/loans/loans.utils";
import type { CreateDriverPayload } from "@/components/driversPage";
import { normalizeName } from "@/lib/normalizeName";
import { findSimilarNames } from "@/lib/similarName";

const PHONE_REGEX = /^[6-9]\d{9}$/;
const NAME_MAX_LENGTH = 200;
const PLACE_MAX_LENGTH = 200;
const DL_NUMBER_MAX_LENGTH = 50;
// Only an http(s) link is ever something to click through to — a `javascript:`
// or `data:` scheme stored here would just be script content dressed up as a
// photo URL, with nowhere safe to render it.
const PHOTO_URL_REGEX = /^https?:\/\//i;

/**
 * An optional text field from the body: a string is trimmed, null/absent is
 * "", and anything else (a number, an object) is `false` so the caller can
 * answer 400. Without this, `phone: 9876543210` sent as a number was read as
 * "" and silently cleared the stored phone with a 200.
 */
function optionalText(value: unknown): string | false {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return false;
  return value.trim();
}

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
    const authUser = await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Number(searchParams.get("pageSize")) || 50),
    );
    const search = searchParams.get("search")?.trim() ?? "";

    // Strip characters that have special meaning in PostgREST filter syntax
    // before anything else. A search term made up only of those (e.g.
    // "%_(") would otherwise strip down to "", which turns into "ilike.%%"
    // — matching every row instead of none — so an empty result after
    // stripping short-circuits to "nothing can match" rather than silently
    // becoming "no filter", and does it before any query is even built.
    const safeSearch = search ? search.replace(/[,.*()%_]/g, "") : "";
    if (search && !safeSearch) {
      return apiSuccess({ data: [], total: 0 });
    }

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

    if (safeSearch) {
      query = query.or(
        `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,place.ilike.%${safeSearch}%,dl_number.ilike.%${safeSearch}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return serverError(error);
    }

    // The driver role uses this list to pick themselves or a colleague (the
    // diesel-records driver picker, which shows phone as a disambiguator —
    // see driver_picker_sheet.dart) but has no screen that shows a licence
    // number, so dl_number is withheld from that role rather than handed out
    // to every signed-in account regardless of what they actually need.
    const rows = (data ?? []).map((row) =>
      authUser.role === "driver" ? { ...row, dl_number: null } : row,
    );

    return apiSuccess({ data: rows, total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const parsed = await readJsonObject(req);
    if (!parsed) return apiError("The request body must be a JSON object", 400);
    const body = parsed as unknown as CreateDriverPayload;

    if (typeof body.name !== "string" || body.name.trim() === "") {
      return apiError("Name is required", 400);
    }
    if (body.name.trim().length > NAME_MAX_LENGTH) {
      return apiError(`Name must be at most ${NAME_MAX_LENGTH} characters`, 400);
    }

    const phone = optionalText(body.phone);
    if (phone === false || (phone && !PHONE_REGEX.test(phone))) {
      return apiError(
        "Invalid phone number (must be 10 digits starting with 6-9)",
        400,
      );
    }

    const place = optionalText(body.place);
    if (place === false) return apiError("Place must be text", 400);
    if (place.length > PLACE_MAX_LENGTH) {
      return apiError(`Place must be at most ${PLACE_MAX_LENGTH} characters`, 400);
    }

    const dlNumberInput = optionalText(body.dl_number);
    if (dlNumberInput === false) return apiError("DL number must be text", 400);
    if (dlNumberInput.length > DL_NUMBER_MAX_LENGTH) {
      return apiError(`DL number must be at most ${DL_NUMBER_MAX_LENGTH} characters`, 400);
    }

    const photoUrl = optionalText(body.photo_url);
    if (photoUrl === false || (photoUrl && !PHOTO_URL_REGEX.test(photoUrl))) {
      return apiError("Photo URL must start with http:// or https://", 400);
    }

    const name = body.name.trim();
    const dlNumber = dlNumberInput || null;

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
      place: place || null,
      dl_number: dlNumber,
      photo_url: photoUrl || null,
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
    const body = await readJsonObject(req);
    if (!body) return apiError("The request body must be a JSON object", 400);
    const { id: rawId, ...fields } = body;

    const id = parseId(rawId);
    if (!id) {
      return apiError("Missing or invalid driver ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (fields.name !== undefined) {
      if (typeof fields.name !== "string" || fields.name.trim() === "") {
        return apiError("Name cannot be empty", 400);
      }
      if (fields.name.trim().length > NAME_MAX_LENGTH) {
        return apiError(`Name must be at most ${NAME_MAX_LENGTH} characters`, 400);
      }
      updatePayload.name = fields.name.trim();
    }

    if (fields.phone !== undefined) {
      const phone = optionalText(fields.phone);
      if (phone === false || (phone && !PHONE_REGEX.test(phone))) {
        return apiError(
          "Invalid phone number (must be 10 digits starting with 6-9)",
          400,
        );
      }
      updatePayload.phone = phone || null;
    }

    if (fields.place !== undefined) {
      const place = optionalText(fields.place);
      if (place === false) return apiError("Place must be text", 400);
      if (place.length > PLACE_MAX_LENGTH) {
        return apiError(`Place must be at most ${PLACE_MAX_LENGTH} characters`, 400);
      }
      updatePayload.place = place || null;
    }

    if (fields.dl_number !== undefined) {
      const dlNumber = optionalText(fields.dl_number);
      if (dlNumber === false) return apiError("DL number must be text", 400);
      if (dlNumber.length > DL_NUMBER_MAX_LENGTH) {
        return apiError(`DL number must be at most ${DL_NUMBER_MAX_LENGTH} characters`, 400);
      }
      updatePayload.dl_number = dlNumber || null;
    }

    if (fields.photo_url !== undefined) {
      const photoUrl = optionalText(fields.photo_url);
      if (photoUrl === false || (photoUrl && !PHOTO_URL_REGEX.test(photoUrl))) {
        return apiError("Photo URL must start with http:// or https://", 400);
      }
      updatePayload.photo_url = photoUrl || null;
    }

    if (fields.is_active !== undefined) {
      // A loose `Boolean(x)` treats the STRING "false" as truthy and silently
      // leaves the driver active — a 200 response that did nothing. Only a
      // real boolean is accepted.
      if (typeof fields.is_active !== "boolean") {
        return apiError("is_active must be true or false", 400);
      }
      updatePayload.is_active = fields.is_active;
    }

    // Renaming a driver onto an existing one splits that person's history
    // just as surely as adding a second row, so edits are checked too — the
    // driver being edited is excluded so saving their own name is fine.
    if (updatePayload.name !== undefined || updatePayload.dl_number !== undefined) {
      const { data: current } = await supabaseAdmin
        .from("drivers")
        .select("name, dl_number")
        .eq("id", id)
        .maybeSingle();

      const nextName = (updatePayload.name as string) ?? current?.name ?? "";
      const nextDl =
        updatePayload.dl_number !== undefined
          ? (updatePayload.dl_number as string | null)
          : ((current?.dl_number as string | null) ?? null);

      const duplicate = await findDuplicates(nextName, nextDl, id);
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
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      return serverError(error);
    }
    if (!updatedDriver) {
      return apiError("Driver not found", 404);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "drivers",
        recordId: id,
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
    const id = parseId(searchParams.get("id"));

    if (!id) {
      return apiError("Missing or invalid driver ID", 400);
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
        .eq("driver_id", id);

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
      .eq("id", id);

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
        recordId: id,
        details: { deleted: true },
      });
    });

    return apiSuccess(null, "Driver deleted");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
