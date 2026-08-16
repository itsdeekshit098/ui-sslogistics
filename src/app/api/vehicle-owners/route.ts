import { after } from "next/server";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth, requireUserAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { normalizeName } from "@/lib/normalizeName";

// Compatibility adapter. The `vehicle_owners` table is gone — owners are now
// rows in `entities` (see sql/28_add_entities.sql), which also carries loan
// borrowers. This route survives unchanged in shape so existing callers — the
// Flutter owners screen, the vehicle create/edit forms and their owner
// dropdowns — keep working without a release. New UI should call
// /api/entities, which exposes the full record (kind, proprietor, contact
// details) instead of the two fields below.
//
// Mapping: entities.relationship INTERNAL <-> owner_type OWN, EXTERNAL both ways.

const VALID_OWNER_TYPES = ["OWN", "EXTERNAL"] as const;

type OwnerType = (typeof VALID_OWNER_TYPES)[number];

function toOwnerType(relationship: string): OwnerType {
  return relationship === "INTERNAL" ? "OWN" : "EXTERNAL";
}

function toRelationship(ownerType: string): "INTERNAL" | "EXTERNAL" {
  return ownerType === "OWN" ? "INTERNAL" : "EXTERNAL";
}

interface EntityRow {
  id: number;
  name: string;
  relationship: string;
  created_at?: string;
}

/** Projects an entity down to the legacy vehicle_owners shape. */
function toOwner(entity: EntityRow) {
  return {
    id: entity.id,
    name: entity.name,
    owner_type: toOwnerType(entity.relationship),
    ...(entity.created_at ? { created_at: entity.created_at } : {}),
  };
}

/**
 * Catches near-duplicate names ("SS LOGISTICS - SUKANYA" vs "SS LOGISTICS
 * -SUKANYA") that the DB's exact-string unique constraint lets through as
 * distinct rows — see sql/42_entities_normalized_name_unique.sql. Returns
 * the conflicting row's actual name for a readable error message, or null.
 */
async function findNormalizedNameConflict(
  name: string,
  excludeId: number | null,
): Promise<string | null> {
  const target = normalizeName(name);
  let query = supabaseAdmin.from("entities").select("id, name");
  if (excludeId !== null) query = query.neq("id", excludeId);

  const { data } = await query;
  const match = (data ?? []).find((row) => normalizeName(row.name as string) === target);
  return match ? (match.name as string) : null;
}

export async function GET(req: Request) {
  try {
    await requireUserAuth();

    const { searchParams } = new URL(req.url);
    const ownerType = searchParams.get("owner_type")?.trim() ?? "";
    const search = searchParams.get("search")?.trim() ?? "";
    // page is opt-in: omitting it preserves the legacy bare-array response
    // (existing web callers — the owner dropdowns and the owners table page —
    // expect `.data` to be VehicleOwner[], not a {data, total} envelope).
    const pageParam = searchParams.get("page");

    let query = supabaseAdmin
      .from("entities")
      .select("id, name, relationship, created_at", pageParam ? { count: "exact" } : undefined)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (ownerType) {
      query = query.eq("relationship", toRelationship(ownerType));
    }
    if (search) {
      const escaped = search.replace(/[%_]/g, "\\$&");
      query = query.ilike("name", `%${escaped}%`);
    }

    if (pageParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number(searchParams.get("pageSize")) || 20),
      );
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        return serverError(error);
      }
      return apiSuccess({ data: (data ?? []).map(toOwner), total: count ?? 0 });
    }

    query = query.limit(1000);
    const { data, error } = await query;

    if (error) {
      return serverError(error);
    }

    return apiSuccess((data ?? []).map(toOwner));
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = await req.json();

    if (!body.name || String(body.name).trim() === "") {
      return apiError("Owner name is required", 400);
    }
    if (!(VALID_OWNER_TYPES as readonly string[]).includes(body.owner_type)) {
      return apiError(
        `Invalid owner type. Allowed values: ${VALID_OWNER_TYPES.join(", ")}`,
        400,
      );
    }

    const name = String(body.name).trim();

    const nameConflict = await findNormalizedNameConflict(name, null);
    if (nameConflict) {
      return apiError(`A similar owner already exists: "${nameConflict}"`, 409);
    }

    // entity_kind isn't expressible in the legacy payload; FIRM is the safer
    // default (it matches how sql/28 backfilled existing owners) and the row
    // can be re-tagged as a person from the Firms & Owners page.
    const insertPayload = {
      name,
      entity_kind: "FIRM",
      relationship: toRelationship(body.owner_type),
      created_by: authUser.id,
    };

    const { data, error } = await supabaseAdmin
      .from("entities")
      .insert([insertPayload])
      .select("id, name, relationship, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An owner with this name already exists", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: data.id,
        details: { name, owner_type: body.owner_type },
      });
    });

    return apiSuccess({ owner: toOwner(data) }, "Owner added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return apiError("Missing owner ID", 400);
    }

    const updatePayload: Record<string, unknown> = {};

    if (fields.name !== undefined) {
      if (!fields.name || String(fields.name).trim() === "") {
        return apiError("Owner name cannot be empty", 400);
      }
      const trimmedName = String(fields.name).trim();
      const nameConflict = await findNormalizedNameConflict(trimmedName, Number(id));
      if (nameConflict) {
        return apiError(`A similar owner already exists: "${nameConflict}"`, 409);
      }
      updatePayload.name = trimmedName;
    }

    if (fields.owner_type !== undefined) {
      if (!(VALID_OWNER_TYPES as readonly string[]).includes(fields.owner_type)) {
        return apiError(
          `Invalid owner type. Allowed values: ${VALID_OWNER_TYPES.join(", ")}`,
          400,
        );
      }
      updatePayload.relationship = toRelationship(fields.owner_type);
    }

    if (Object.keys(updatePayload).length === 0) {
      return apiError("No fields to update", 400);
    }

    updatePayload.updated_by = authUser.id;
    updatePayload.updated_at = new Date().toISOString();

    // The cascade onto vehicles.owner_name / owner_type is handled by
    // trg_entities_cascade_rename (sql/28_add_entities.sql), which replaced the
    // rename_vehicle_owner RPC this route used to call.
    const { data, error } = await supabaseAdmin
      .from("entities")
      .update(updatePayload)
      .eq("id", Number(id))
      .select("id, name, relationship, created_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return apiError("An owner with this name already exists", 409);
      }
      return serverError(error);
    }

    if (!data) {
      return apiError("Owner not found", 404);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: Number(id),
        details: updatePayload,
      });
    });

    return apiSuccess({ owner: toOwner(data) }, "Owner updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError("Missing owner ID", 400);
    }

    const { data: owner, error: fetchErr } = await supabaseAdmin
      .from("entities")
      .select("id, name")
      .eq("id", Number(id))
      .maybeSingle();

    if (fetchErr) {
      return serverError(fetchErr);
    }
    if (!owner) {
      return apiError("Owner not found", 404);
    }

    // Now a real foreign key rather than a name match, so this counts exactly
    // what the DB itself would refuse to orphan. Same six directions as
    // /api/entities DELETE — this route deletes the same underlying entities
    // row, so it needs the same guards (an owner deleted out from under a
    // loan/funding/firm/client/bank account would orphan it).
    const ownerId = Number(id);
    const [vehicles, loans, fundings, firms, clients, bankAccounts] = await Promise.all([
      supabaseAdmin
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("owner_entity_id", ownerId),
      supabaseAdmin
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("borrower_entity_id", ownerId),
      supabaseAdmin
        .from("fundings")
        .select("id", { count: "exact", head: true })
        .or(`borrower_entity_id.eq.${ownerId},counterparty_entity_id.eq.${ownerId}`),
      supabaseAdmin
        .from("entities")
        .select("id", { count: "exact", head: true })
        .eq("proprietor_entity_id", ownerId),
      supabaseAdmin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", ownerId),
      supabaseAdmin
        .from("bank_accounts")
        .select("id", { count: "exact", head: true })
        .eq("holder_entity_id", ownerId),
    ]);

    for (const result of [vehicles, loans, fundings, firms, clients, bankAccounts]) {
      if (result.error) return serverError(result.error);
    }

    if ((vehicles.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${vehicles.count} vehicle(s) are currently assigned to this owner. Reassign those vehicles first.`,
        400,
      );
    }

    const blocking: string[] = [];
    if (loans.count) blocking.push(`${loans.count} loan(s)`);
    if (fundings.count) blocking.push(`${fundings.count} private funding(s)`);

    if (blocking.length > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${blocking.join(" and ")} are in its name.`,
        400,
      );
    }

    if ((firms.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${firms.count} firm(s) list it as proprietor. Clear those first.`,
        400,
      );
    }

    if ((clients.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${clients.count} client account(s) are linked to it. Unlink those first.`,
        400,
      );
    }

    if ((bankAccounts.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${owner.name}" because ${bankAccounts.count} bank account(s) are held in its name. Remove those first.`,
        400,
      );
    }

    const { error } = await supabaseAdmin
      .from("entities")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "DELETE_VEHICLE_OWNER",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: Number(id),
        details: { name: owner.name },
      });
    });

    return apiSuccess(null, "Owner deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
