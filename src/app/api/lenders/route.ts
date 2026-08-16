import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { escapeLike } from "@/lib/escapeLike";

// Everyone we borrow from: financiers giving EMI loans (INSTITUTION) and
// private individuals lending at an agreed ROI (PRIVATE). One master so the
// same party used both ways isn't duplicated — see sql/30_add_lenders.sql.
//
// Like the loans routes themselves, every method here is admin/superadmin only:
// the list of who we owe money to is sensitive on its own.

const VALID_LENDER_KINDS = ["INSTITUTION", "PRIVATE"] as const;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

const SELECT_COLUMNS =
  "id, name, lender_kind, phone, contact_person, notes, is_active, created_at";

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const lenderKind = searchParams.get("lender_kind")?.trim() ?? "";
    const search = searchParams.get("search")?.trim() ?? "";
    const includeInactive = searchParams.get("include_inactive") === "true";

    let query = supabaseAdmin
      .from("lenders")
      .select(SELECT_COLUMNS)
      .order("name", { ascending: true })
      .limit(1000);

    if (lenderKind) query = query.eq("lender_kind", lenderKind);
    if (!includeInactive) query = query.eq("is_active", true);
    if (search) {
      const escaped = escapeLike(search);
      query = query.ilike("name", `%${escaped}%`);
    }

    const { data, error } = await query;

    if (error) {
      return serverError(error);
    }

    return apiSuccess({ data: data ?? [] });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return apiError("Lender name is required", 400);
    }

    const lenderKind = String(body.lender_kind ?? "");
    if (!(VALID_LENDER_KINDS as readonly string[]).includes(lenderKind)) {
      return apiError(
        `Invalid lender type. Allowed values: ${VALID_LENDER_KINDS.join(", ")}`,
        400,
      );
    }

    const phone = body.phone ? String(body.phone).trim() : "";
    if (phone && !PHONE_PATTERN.test(phone)) {
      return apiError("Enter a valid 10-digit mobile number", 400);
    }

    const insertPayload = {
      name,
      lender_kind: lenderKind,
      phone: phone || null,
      contact_person: body.contact_person ? String(body.contact_person).trim() : null,
      notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
      created_by: authUser.id,
    };

    const { data, error } = await supabaseAdmin
      .from("lenders")
      .insert([insertPayload])
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("A lender with this name already exists", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_LENDER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lenders",
        recordId: data.id,
        details: { name, lender_kind: lenderKind },
      });
    });

    return apiSuccess({ lender: data }, "Lender added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    const id = Number(body.id);
    if (!body.id || !Number.isFinite(id)) {
      return apiError("Missing lender ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return apiError("Lender name cannot be empty", 400);
      updatePayload.name = name;
    }

    if (body.lender_kind !== undefined) {
      const lenderKind = String(body.lender_kind);
      if (!(VALID_LENDER_KINDS as readonly string[]).includes(lenderKind)) {
        return apiError(
          `Invalid lender type. Allowed values: ${VALID_LENDER_KINDS.join(", ")}`,
          400,
        );
      }
      updatePayload.lender_kind = lenderKind;
    }

    if (body.phone !== undefined) {
      const phone = body.phone === null ? "" : String(body.phone).trim();
      if (phone && !PHONE_PATTERN.test(phone)) {
        return apiError("Enter a valid 10-digit mobile number", 400);
      }
      updatePayload.phone = phone || null;
    }

    if (body.contact_person !== undefined) {
      const contact =
        body.contact_person === null ? "" : String(body.contact_person).trim();
      updatePayload.contact_person = contact || null;
    }

    if (body.notes !== undefined) {
      const notes = body.notes === null ? "" : String(body.notes).trim();
      if (notes.length > 500) {
        return apiError("Notes must be 500 characters or less", 400);
      }
      updatePayload.notes = notes || null;
    }

    if (body.is_active !== undefined) {
      updatePayload.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updatePayload).length === 0) {
      return apiError("No fields to update", 400);
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("lenders")
      .update(updatePayload)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return apiError("A lender with this name already exists", 409);
      }
      return serverError(error);
    }
    if (!data) {
      return apiError("Lender not found", 404);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_LENDER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lenders",
        recordId: id,
        details: { changes: updatePayload },
      });
    });

    return apiSuccess({ lender: data }, "Lender updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing lender ID", 400);
    }

    const { data: lender, error: fetchErr } = await supabaseAdmin
      .from("lenders")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!lender) return apiError("Lender not found", 404);

    // A lender may be referenced from either side of the business, so both are
    // checked before it can go.
    const [{ count: loanCount, error: loanErr }, { count: fundingCount, error: fundErr }] =
      await Promise.all([
        supabaseAdmin
          .from("loans")
          .select("id", { count: "exact", head: true })
          .eq("lender_id", id),
        supabaseAdmin
          .from("fundings")
          .select("id", { count: "exact", head: true })
          .eq("funder_id", id),
      ]);

    if (loanErr) return serverError(loanErr);
    if (fundErr) return serverError(fundErr);

    if ((loanCount ?? 0) > 0 || (fundingCount ?? 0) > 0) {
      const parts: string[] = [];
      if (loanCount) parts.push(`${loanCount} loan(s)`);
      if (fundingCount) parts.push(`${fundingCount} funding(s)`);
      return apiError(
        `Cannot delete "${lender.name}" because ${parts.join(" and ")} reference it. Turn it off instead to hide it from new records.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("lenders").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_LENDER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lenders",
        recordId: id,
        details: { name: lender.name },
      });
    });

    return apiSuccess(null, "Lender deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
