import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";

// Backs every configurable dropdown list in the app (loan types, client types,
// contact roles, payment methods — see sql/29_add_lookup_options.sql). One
// table, one route, one <LookupSelect> component, so a new option is added at
// runtime from the dropdown's own "+ Add new" footer rather than through an
// enum migration plus a deploy.

const VALUE_MAX_LENGTH = 60;
const LABEL_MAX_LENGTH = 80;

const SELECT_COLUMNS = "id, category, value, label, sort_order, is_active, is_system";

/**
 * Derives a stable machine value from a label typed by the user
 * ("Machinery Loan" -> "MACHINERY_LOAN"). Stored values are what other tables
 * reference, so they must not carry spaces or punctuation.
 */
function slugifyValue(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, VALUE_MAX_LENGTH);
}

// ─── GET — options for a category (drives the dropdowns) ───

export async function GET(req: Request) {
  try {
    // Every lookups caller (LookupSelect inside loan/funding/client modals,
    // and Settings → Dropdown Lists) sits behind an admin-or-superadmin-only
    // page, so this can be as strict as PUT/DELETE below.
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category")?.trim() ?? "";
    const includeInactive = searchParams.get("include_inactive") === "true";

    if (!category) {
      return apiError("category is required", 400);
    }

    let query = supabaseAdmin
      .from("lookup_options")
      .select(SELECT_COLUMNS)
      .eq("category", category)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    // Inactive options are hidden from pickers but still needed by the
    // settings manager and by any record that already references them.
    if (!includeInactive) {
      query = query.eq("is_active", true);
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

// ─── POST — add an option ───

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    const category = typeof body.category === "string" ? body.category.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";

    if (!category) {
      return apiError("category is required", 400);
    }
    if (!label) {
      return apiError("Label is required", 400);
    }
    if (label.length > LABEL_MAX_LENGTH) {
      return apiError(`Label must be ${LABEL_MAX_LENGTH} characters or less`, 400);
    }

    // An explicit value is accepted (seeds and scripts use it); the UI only
    // sends a label and lets us derive one.
    const rawValue = typeof body.value === "string" ? body.value.trim() : "";
    const value = rawValue ? slugifyValue(rawValue) : slugifyValue(label);

    if (!value) {
      return apiError("Label must contain at least one letter or number", 400);
    }

    const sortOrder = Number.isFinite(Number(body.sort_order))
      ? Number(body.sort_order)
      : 100;

    const insertPayload = {
      category,
      value,
      label,
      sort_order: sortOrder,
      created_by: authUser.id,
    };

    const { data, error } = await supabaseAdmin
      .from("lookup_options")
      .insert([insertPayload])
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("This option already exists in the list", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_LOOKUP_OPTION",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lookup_options",
        recordId: data.id,
        details: { category, value, label },
      });
    });

    return apiSuccess({ option: data }, "Option added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — relabel / reorder / (de)activate ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();

    const id = Number(body.id);
    if (!body.id || !Number.isFinite(id)) {
      return apiError("Missing option ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) {
        return apiError("Label cannot be empty", 400);
      }
      if (label.length > LABEL_MAX_LENGTH) {
        return apiError(`Label must be ${LABEL_MAX_LENGTH} characters or less`, 400);
      }
      updatePayload.label = label;
    }

    if (body.sort_order !== undefined) {
      const sortOrder = Number(body.sort_order);
      if (!Number.isFinite(sortOrder)) {
        return apiError("Invalid sort order", 400);
      }
      updatePayload.sort_order = sortOrder;
    }

    if (body.is_active !== undefined) {
      updatePayload.is_active = Boolean(body.is_active);
    }

    // `value` is deliberately immutable: other tables store it as their
    // reference (loans.loan_type, clients.client_type), and there is no FK to
    // cascade a change through. Relabel instead.
    if (Object.keys(updatePayload).length === 0) {
      return apiError("No fields to update", 400);
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("lookup_options")
      .update(updatePayload)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return serverError(error);
    }
    if (!data) {
      return apiError("Option not found", 404);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_LOOKUP_OPTION",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lookup_options",
        recordId: id,
        details: { changes: updatePayload },
      });
    });

    return apiSuccess({ option: data }, "Option updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — remove a user-added option ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing option ID", 400);
    }

    const { data: option, error: fetchErr } = await supabaseAdmin
      .from("lookup_options")
      .select("id, category, value, label, is_system")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return serverError(fetchErr);
    }
    if (!option) {
      return apiError("Option not found", 404);
    }

    // Seeded options may be referenced by existing records and by the app's
    // own defaults, so they are deactivated rather than removed.
    if (option.is_system) {
      return apiError(
        `"${option.label}" is a built-in option and cannot be deleted. Turn it off instead to hide it from new records.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("lookup_options").delete().eq("id", id);

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_LOOKUP_OPTION",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "lookup_options",
        recordId: id,
        details: { category: option.category, value: option.value, label: option.label },
      });
    });

    return apiSuccess(null, "Option deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
