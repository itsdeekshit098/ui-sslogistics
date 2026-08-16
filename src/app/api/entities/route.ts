import { after } from "next/server";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminAuth, requireStrictAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parsePageParams } from "@/lib/pagination";
import { escapeLike } from "@/lib/escapeLike";

// Entities are the single master list of parties: our own proprietorships and
// the family members behind them (FIRM / PERSON, INTERNAL), plus external
// parties whose vehicles we run (EXTERNAL). Loans and private fundings record
// "in whose name" by pointing here, and vehicles.owner_entity_id replaced the
// old vehicle_owners text match (see sql/28_add_entities.sql).

const VALID_ENTITY_KINDS = ["FIRM", "PERSON"] as const;
const VALID_RELATIONSHIPS = ["INTERNAL", "EXTERNAL"] as const;
const PHONE_PATTERN = /^[6-9]\d{9}$/;
const NOTES_MAX_LENGTH = 500;

const SELECT_COLUMNS =
  "id, name, entity_kind, relationship, proprietor_entity_id, phone, email, pan, gst_number, address, notes, is_active, created_at, updated_at";

type FieldErrors = Record<string, string>;

/**
 * Shared field validation for POST (all fields present) and PUT (partial).
 * On PUT, only keys actually supplied in the body are checked, so an untouched
 * field can never be invalidated by a value it already holds.
 * Mutates `payload` with the normalized values.
 */
function validateEntityFields(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  { partial }: { partial: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("name")) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      errors.name = "Name is required";
    } else if (name.length > 120) {
      errors.name = "Name must be 120 characters or less";
    } else {
      payload.name = name;
    }
  }

  if (has("entity_kind")) {
    const kind = String(body.entity_kind ?? "");
    if (!(VALID_ENTITY_KINDS as readonly string[]).includes(kind)) {
      errors.entity_kind = `Type must be one of: ${VALID_ENTITY_KINDS.join(", ")}`;
    } else {
      payload.entity_kind = kind;
    }
  }

  if (has("relationship")) {
    const relationship = String(body.relationship ?? "");
    if (!(VALID_RELATIONSHIPS as readonly string[]).includes(relationship)) {
      errors.relationship = `Relationship must be one of: ${VALID_RELATIONSHIPS.join(", ")}`;
    } else {
      payload.relationship = relationship;
    }
  }

  if (body.phone !== undefined) {
    const phone = body.phone === null ? "" : String(body.phone).trim();
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.phone = "Enter a valid 10-digit mobile number";
    } else {
      payload.phone = phone || null;
    }
  }

  if (body.email !== undefined) {
    const email = body.email === null ? "" : String(body.email).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address";
    } else {
      payload.email = email || null;
    }
  }

  if (body.notes !== undefined) {
    const notes = body.notes === null ? "" : String(body.notes).trim();
    if (notes.length > NOTES_MAX_LENGTH) {
      errors.notes = `Notes must be ${NOTES_MAX_LENGTH} characters or less`;
    } else {
      payload.notes = notes || null;
    }
  }

  for (const key of ["pan", "gst_number", "address"] as const) {
    if (body[key] !== undefined) {
      const value = body[key] === null ? "" : String(body[key]).trim();
      payload[key] = value || null;
    }
  }

  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }

  return errors;
}

/**
 * A proprietor link may only hang off a FIRM, must point at an existing
 * PERSON, and must not be the entity itself — the DB enforces the first and
 * last as CHECK constraints, but we resolve the target row anyway so the user
 * gets a readable message instead of a constraint violation.
 */
async function validateProprietor(
  proprietorId: number | null,
  entityKind: string | undefined,
  selfId: number | null,
): Promise<{ error?: string }> {
  if (proprietorId === null) return {};

  if (entityKind !== "FIRM") {
    return { error: "Only a firm can have a proprietor" };
  }
  if (selfId !== null && proprietorId === selfId) {
    return { error: "An entity cannot be its own proprietor" };
  }

  const { data, error } = await supabaseAdmin
    .from("entities")
    .select("id, entity_kind")
    .eq("id", proprietorId)
    .maybeSingle();

  if (error) return { error: "Could not verify the selected proprietor" };
  if (!data) return { error: "Selected proprietor no longer exists" };
  if (data.entity_kind !== "PERSON") {
    return { error: "A proprietor must be a person, not a firm" };
  }

  return {};
}

/**
 * Tallies how many vehicles each entity owns, in one query rather than one
 * per row. Returns a Map keyed by entity id.
 */
async function fetchVehicleCounts(entityIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (entityIds.length === 0) return counts;

  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("owner_entity_id")
    .in("owner_entity_id", entityIds);

  if (error || !data) return counts;

  for (const row of data) {
    const id = row.owner_entity_id as number | null;
    if (id == null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

// ─── GET — list / search entities ───

export async function GET(req: Request) {
  try {
    // /admin/entities is staff-accessible (routePermissions.ts) — unlike
    // loans/fundings/clients/bank-accounts, staff is not locked out here.
    // requireAdminAuth (not requireStrictAdminAuth) blocks driver while
    // preserving that.
    await requireAdminAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const entityKind = searchParams.get("entity_kind")?.trim() ?? "";
    const relationship = searchParams.get("relationship")?.trim() ?? "";
    const isActive = searchParams.get("is_active");
    const withCounts = searchParams.get("with_counts") === "true";
    const pageParam = searchParams.get("page");

    let query = supabaseAdmin
      .from("entities")
      .select(SELECT_COLUMNS, { count: "exact" })
      .order("name", { ascending: true });

    if (entityKind) query = query.eq("entity_kind", entityKind);
    if (relationship) query = query.eq("relationship", relationship);
    if (isActive === "true" || isActive === "false") {
      query = query.eq("is_active", isActive === "true");
    }
    if (search) {
      const safe = escapeLike(search);
      query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }

    if (pageParam) {
      const { from, to } = parsePageParams(searchParams, {
        defaultPageSize: 20,
        maxPageSize: 100,
      });
      query = query.range(from, to);
    } else {
      query = query.limit(1000);
    }

    const { data, error, count } = await query;
    if (error) {
      return serverError(error);
    }

    const rows = data ?? [];

    // The proprietor is shown as a name, not an id — resolve the referenced
    // rows in one extra query instead of embedding (a self-referencing FK
    // embed needs the constraint name and is easy to break on rename).
    const proprietorIds = [
      ...new Set(
        rows
          .map((row) => row.proprietor_entity_id as number | null)
          .filter((id): id is number => id != null),
      ),
    ];

    const proprietorNames = new Map<number, string>();
    if (proprietorIds.length > 0) {
      const { data: proprietors } = await supabaseAdmin
        .from("entities")
        .select("id, name")
        .in("id", proprietorIds);
      for (const p of proprietors ?? []) {
        proprietorNames.set(p.id as number, p.name as string);
      }
    }

    const vehicleCounts = withCounts
      ? await fetchVehicleCounts(rows.map((row) => row.id as number))
      : new Map<number, number>();

    const enriched = rows.map((row) => ({
      ...row,
      proprietor_name:
        row.proprietor_entity_id != null
          ? (proprietorNames.get(row.proprietor_entity_id as number) ?? null)
          : null,
      ...(withCounts
        ? { vehicle_count: vehicleCounts.get(row.id as number) ?? 0 }
        : {}),
    }));

    return apiSuccess({ data: enriched, total: count ?? enriched.length });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — create an entity ───

export async function POST(req: Request) {
  try {
    const authUser = await requireAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const payload: Record<string, unknown> = { relationship: "INTERNAL" };
    const fieldErrors = validateEntityFields(body, payload, { partial: false });

    if (Object.keys(fieldErrors).length > 0) {
      return apiError(Object.values(fieldErrors)[0], 400);
    }

    const proprietorId =
      body.proprietor_entity_id == null || body.proprietor_entity_id === ""
        ? null
        : Number(body.proprietor_entity_id);

    if (proprietorId !== null && !Number.isFinite(proprietorId)) {
      return apiError("Invalid proprietor", 400);
    }

    const proprietorCheck = await validateProprietor(
      proprietorId,
      payload.entity_kind as string,
      null,
    );
    if (proprietorCheck.error) {
      return apiError(proprietorCheck.error, 400);
    }
    payload.proprietor_entity_id = proprietorId;
    payload.created_by = authUser.id;

    const { data, error } = await supabaseAdmin
      .from("entities")
      .insert([payload])
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An entity with this name already exists", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_ENTITY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: data.id,
        details: {
          name: data.name,
          entity_kind: data.entity_kind,
          relationship: data.relationship,
        },
      });
    });

    return apiSuccess({ entity: data }, "Entity added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — update an entity ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const id = Number(body.id);
    if (!body.id || !Number.isFinite(id)) {
      return apiError("Missing entity ID", 400);
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("entities")
      .select("id, name, entity_kind, relationship")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!existing) return apiError("Entity not found", 404);

    const payload: Record<string, unknown> = {};
    const fieldErrors = validateEntityFields(body, payload, { partial: true });

    if (Object.keys(fieldErrors).length > 0) {
      return apiError(Object.values(fieldErrors)[0], 400);
    }

    if (body.proprietor_entity_id !== undefined) {
      const proprietorId =
        body.proprietor_entity_id == null || body.proprietor_entity_id === ""
          ? null
          : Number(body.proprietor_entity_id);

      if (proprietorId !== null && !Number.isFinite(proprietorId)) {
        return apiError("Invalid proprietor", 400);
      }

      const check = await validateProprietor(
        proprietorId,
        (payload.entity_kind as string | undefined) ?? existing.entity_kind,
        id,
      );
      if (check.error) return apiError(check.error, 400);
      payload.proprietor_entity_id = proprietorId;
    }

    // Switching a firm to a person has to release the proprietor link too,
    // or the DB's entities_proprietor_check rejects the update with a raw
    // constraint error.
    if (payload.entity_kind === "PERSON" && payload.proprietor_entity_id === undefined) {
      payload.proprietor_entity_id = null;
    }

    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    payload.updated_by = authUser.id;
    payload.updated_at = new Date().toISOString();

    // Renaming (or flipping INTERNAL/EXTERNAL) cascades onto every vehicle
    // that references this entity via trg_entities_cascade_rename — no manual
    // cascade needed here, unlike the old rename_vehicle_owner RPC.
    const { data, error } = await supabaseAdmin
      .from("entities")
      .update(payload)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An entity with this name already exists", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_ENTITY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: id,
        details: { changes: payload },
      });
    });

    return apiSuccess({ entity: data }, "Entity updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — remove an entity, if nothing references it ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing entity ID", 400);
    }

    const { data: entity, error: fetchErr } = await supabaseAdmin
      .from("entities")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!entity) return apiError("Entity not found", 404);

    // Referential guards: an entity is referenced from six directions, and a
    // borrower deleted out from under an active loan would orphan it.
    // fundings is checked on both borrower_entity_id (BORROWED direction) and
    // counterparty_entity_id (LENT direction) — a LENT funding's counterparty
    // is otherwise a real FK with no guard, and the DB's default NO ACTION
    // would 500 instead of giving the same friendly 400 as every other case.
    // bank_accounts.holder_entity_id (sql/34) is a not-null FK with the same
    // gap.
    const [vehicles, loans, fundings, firms, clients, bankAccounts] = await Promise.all([
      supabaseAdmin
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("owner_entity_id", id),
      supabaseAdmin
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("borrower_entity_id", id),
      supabaseAdmin
        .from("fundings")
        .select("id", { count: "exact", head: true })
        .or(`borrower_entity_id.eq.${id},counterparty_entity_id.eq.${id}`),
      supabaseAdmin
        .from("entities")
        .select("id", { count: "exact", head: true })
        .eq("proprietor_entity_id", id),
      supabaseAdmin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", id),
      supabaseAdmin
        .from("bank_accounts")
        .select("id", { count: "exact", head: true })
        .eq("holder_entity_id", id),
    ]);

    for (const result of [vehicles, loans, fundings, firms, clients, bankAccounts]) {
      if (result.error) return serverError(result.error);
    }

    if ((vehicles.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${entity.name}" because ${vehicles.count} vehicle(s) are assigned to it. Reassign those vehicles first.`,
        400,
      );
    }

    const blocking: string[] = [];
    if (loans.count) blocking.push(`${loans.count} loan(s)`);
    if (fundings.count) blocking.push(`${fundings.count} private funding(s)`);

    if (blocking.length > 0) {
      return apiError(
        `Cannot delete "${entity.name}" because ${blocking.join(" and ")} are in its name.`,
        400,
      );
    }

    if ((firms.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${entity.name}" because ${firms.count} firm(s) list it as proprietor. Clear those first.`,
        400,
      );
    }

    if ((clients.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${entity.name}" because ${clients.count} client account(s) are linked to it. Unlink those first.`,
        400,
      );
    }

    if ((bankAccounts.count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${entity.name}" because ${bankAccounts.count} bank account(s) are held in its name. Remove those first.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("entities").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_ENTITY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "entities",
        recordId: id,
        details: { name: entity.name },
      });
    });

    return apiSuccess(null, "Entity deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
