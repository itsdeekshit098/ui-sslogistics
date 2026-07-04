import { logger } from "@/lib/logger";
import { after } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

const VALID_OWNER_TYPES = ["OWN", "EXTERNAL"] as const;

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("owner_type")?.trim() ?? "";
    const search = searchParams.get("search")?.trim() ?? "";

    let query = supabaseAdmin
      .from("vehicle_owners")
      .select("id, name, owner_type")
      .order("name", { ascending: true })
      .limit(1000);

    if (ownerType) {
      query = query.eq("owner_type", ownerType);
    }
    if (search) {
      const escaped = search.replace(/[%_]/g, "\\$&");
      query = query.ilike("name", `%${escaped}%`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    return apiSuccess(data);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    if (!body.name || body.name.trim() === "") {
      return apiError("Owner name is required", 400);
    }
    if (!(VALID_OWNER_TYPES as readonly string[]).includes(body.owner_type)) {
      return apiError(`Invalid owner type. Allowed values: ${VALID_OWNER_TYPES.join(", ")}`, 400);
    }

    const insertPayload = { name: body.name.trim(), owner_type: body.owner_type };

    const { data, error } = await supabaseAdmin
      .from("vehicle_owners")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An owner with this name already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicle_owners",
        recordId: data.id,
        details: insertPayload,
      });
    });

    return apiSuccess({ owner: data }, "Owner added", 201);
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
      return apiError("Missing owner ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (fields.name !== undefined) {
      if (!fields.name || fields.name.trim() === "") {
        return apiError("Owner name cannot be empty", 400);
      }
      updatePayload.name = fields.name.trim();
    }

    if (fields.owner_type !== undefined) {
      if (!(VALID_OWNER_TYPES as readonly string[]).includes(fields.owner_type)) {
        return apiError(`Invalid owner type. Allowed values: ${VALID_OWNER_TYPES.join(", ")}`, 400);
      }
      updatePayload.owner_type = fields.owner_type;
    }

    if (Object.keys(updatePayload).length === 0) {
      return apiError("No fields to update", 400);
    }

    // Fetch the current row first: vehicles store the owner's name/type as
    // denormalized plain text, so a rename must cascade to keep them in sync
    // (and to keep the DELETE in-use check, which matches by name, reliable).
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("vehicle_owners")
      .select("id, name, owner_type")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !existing) {
      return apiError("Owner not found", 404);
    }

    // Renaming the owner and cascading the new name/type onto every vehicle
    // row that references it must be atomic — done via a single plpgsql
    // function (sql/2026-07-04_atomic_vehicle_owner_rename.sql) rather than
    // two separate updates, so a mid-flight failure can't leave vehicle_owners
    // and vehicles out of sync with no rollback.
    const { data: rpcRows, error } = await supabaseAdmin.rpc(
      "rename_vehicle_owner",
      {
        p_id: Number(id),
        p_name: (updatePayload.name as string | undefined) ?? existing.name,
        p_owner_type:
          (updatePayload.owner_type as string | undefined) ?? existing.owner_type,
      },
    );

    if (error) {
      if (error.code === "23505") {
        return apiError("An owner with this name already exists", 409);
      }
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    const data = rpcRows?.[0];
    if (!data) {
      return apiError("Owner not found", 404);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicle_owners",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ owner: data }, "Owner updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireAdminAuth();

    if (authUser.role !== "admin") {
      return apiError("Only admins can delete owners", 403);
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing owner ID", 400);
    }

    const { data: owner, error: fetchErr } = await supabaseAdmin
      .from("vehicle_owners")
      .select("name")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !owner) {
      return apiError("Owner not found", 404);
    }

    // Owner names are copied onto vehicles as plain text (no FK), so check by
    // name to warn before removing an owner that's still referenced.
    const { count, error: countErr } = await supabaseAdmin
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("owner_name", owner.name);

    if (countErr) {
      logger.error("Database error", { error: countErr.message, code: countErr?.code, hint: countErr?.hint });
      return apiError("Internal server error", 500);
    }

    if ((count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${count} vehicle(s) are currently assigned to this owner. Reassign those vehicles first.`,
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from("vehicle_owners")
      .delete()
      .eq("id", Number(id));

    if (error) {
      logger.error("Database error", { error: error.message, code: error?.code, hint: error?.hint });
      return apiError("Internal server error", 500);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "vehicle_owners",
        recordId: Number(id),
        details: { name: owner.name },
      });
    });

    return apiSuccess(null, "Owner deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
