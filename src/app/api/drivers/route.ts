import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import type { CreateDriverPayload } from "@/components/driversPage";

const PHONE_REGEX = /^[6-9]\d{9}$/;

// ─── GET ───

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize")) || 50),
    );
    const search = searchParams.get("search")?.trim() ?? "";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("drivers")
      .select("*", { count: "exact" })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (search) {
      // Escape characters that have special meaning in PostgREST filter syntax
      const safe = search.replace(/[,.*()]/g, "");
      query = query.or(
        `name.ilike.%${safe}%,phone.ilike.%${safe}%,place.ilike.%${safe}%,dl_number.ilike.%${safe}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return apiError(error.message, 500);
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

    const insertPayload = {
      name: body.name.trim(),
      phone: phone || null,
      place: body.place?.trim() || null,
      dl_number: body.dl_number?.trim() || null,
      photo_url: body.photo_url?.trim() || null,
      is_active: true,
    };

    const { data: newDriver, error } = await supabaseAdmin
      .from("drivers")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      return apiError(error.message, 500);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
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
    const authUser = await requireAdminAuth();
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

    const { data: updatedDriver, error } = await supabaseAdmin
      .from("drivers")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      return apiError(error.message, 500);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
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
    const authUser = await requireAdminAuth();

    if (authUser.role !== "admin") {
      return apiError("Only admins can delete drivers", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing driver ID", 400);
    }

    const { count, error: countErr } = await supabaseAdmin
      .from("external_trips")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", Number(id));

    if (countErr) {
      return apiError(countErr.message, 500);
    }

    if ((count ?? 0) > 0) {
      return apiError(
        "Cannot delete driver because they are linked to existing external_trips. Deactivate them instead.",
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from("drivers")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return apiError(error.message, 500);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_DRIVER",
        userId: authUser.id,
        userEmail: authUser.email,
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
