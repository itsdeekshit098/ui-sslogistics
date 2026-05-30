import { logger } from "@/lib/logger";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { after } from "next/server";
import type { CreateTechnicianPayload } from "@/components/techniciansPage";

const PHONE_REGEX = /^[6-9]\d{9}$/;

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
      .from("technicians")
      .select("*", { count: "exact" })
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (search) {
      // Escape characters that have special meaning in PostgREST filter syntax
      const safe = search.replace(/[,.*()%_]/g, "");
      query = query.or(
        `name.ilike.%${safe}%,phone.ilike.%${safe}%,location.ilike.%${safe}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    return apiSuccess({ data: data ?? [], total: count ?? 0 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body: CreateTechnicianPayload = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Name is required", 400);
    }

    const phone = body.phone?.trim();
    if (phone && !PHONE_REGEX.test(phone)) {
      return apiError("Invalid phone number (must be 10 digits)", 400);
    }

    if (!Array.isArray(body.specializations)) {
      return apiError("Specializations must be an array", 400);
    }

    const insertPayload = {
      name: body.name.trim(),
      phone: phone || null,
      location: body.location?.trim() || null,
      specializations: body.specializations,
      is_active: true,
      created_by: authUser.id,
      updated_by: authUser.id,
    };

    const { data: newTech, error } = await supabaseAdmin
      .from("technicians")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("A technician with this name already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_TECHNICIAN",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "technicians",
        recordId: newTech.id,
        details: insertPayload,
      });
    });

    return apiSuccess({ technician: newTech }, "Technician created", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing technician ID", 400);
    }

    const updatePayload: Record<string, unknown> = {
      updated_by: authUser.id,
    };

    if (fields.name !== undefined) {
      if (!fields.name || fields.name.trim() === "") {
        return apiError("Name cannot be empty", 400);
      }
      updatePayload.name = fields.name.trim();
    }

    if (fields.phone !== undefined) {
      const phone = fields.phone?.trim();
      if (phone && !PHONE_REGEX.test(phone)) {
        return apiError("Invalid phone number (must be 10 digits)", 400);
      }
      updatePayload.phone = phone || null;
    }

    if (fields.location !== undefined) {
      updatePayload.location = fields.location?.trim() || null;
    }

    if (fields.specializations !== undefined) {
      if (!Array.isArray(fields.specializations)) {
        return apiError("Specializations must be an array", 400);
      }
      updatePayload.specializations = fields.specializations;
    }

    if (fields.is_active !== undefined) {
      updatePayload.is_active = Boolean(fields.is_active);
    }

    const { data: updatedTech, error } = await supabaseAdmin
      .from("technicians")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_TECHNICIAN",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "technicians",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ technician: updatedTech }, "Technician updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    // Only admin can delete
    if (authUser.role !== "admin") {
      return apiError("Only admins can delete technicians", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing technician ID", 400);
    }

    // Check if technician is used in repair records before deleting
    const { count, error: countErr } = await supabaseAdmin
      .from("repair_records")
      .select("id", { count: "exact", head: true })
      .eq("technician_id", Number(id));

    if (countErr) {
      logger.error("Database error", { error: countErr.message, code: countErr?.code, hint: countErr?.hint });
      return apiError("Internal server error", 500);
    }

    if ((count ?? 0) > 0) {
      return apiError(
        "Cannot delete technician because they are linked to existing repair records. Deactivate them instead.",
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from("technicians")
      .delete()
      .eq("id", Number(id));

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_TECHNICIAN",
        userId: authUser.id,
        userEmail: authUser.email,
        tableName: "technicians",
        recordId: Number(id),
        details: { deleted: true },
      });
    });

    return apiSuccess(null, "Technician deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
