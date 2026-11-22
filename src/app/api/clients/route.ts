import { after } from "next/server";
import { todayInIndia } from "@/lib/dateOnly";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  apiError,
  apiSuccess,
  handleApiError,
  readJsonObject,
  serverError,
} from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { parsePageParams } from "@/lib/pagination";
import { escapeLike, likeOrPattern } from "@/lib/escapeLike";
import {
  isValidDateString,
  moneyMessage,
  moneyProblem,
  optionalText,
  parseFlag,
  parseId,
} from "../loans/loans.utils";

// Clients and what they owe us. Same access rule as the loans routes —
// admin/superadmin on every method, GET included — since a receivables list is
// as sensitive as a loan book.
//
// Outstanding is never stored. It comes from the client_balances view
// (sql/33_add_clients.sql) as sum(debits) - sum(credits), so it cannot drift
// away from the ledger rows behind it.

const CLIENT_SELECT =
  "id, name, client_type, location, address, gst_number, notes, is_active, party_kind, entity_id, receiving_account_id, created_at, updated_at, entities:entity_id (id, name, entity_kind, phone), bank_accounts:receiving_account_id (id, bank_name, account_number, account_type, nickname, entities:holder_entity_id (name))";

const VALID_PARTY_KINDS = ["COMPANY", "INDIVIDUAL"] as const;

const NOTES_MAX_LENGTH = 500;
const LOCATION_MAX_LENGTH = 150;
const ADDRESS_MAX_LENGTH = 500;
// A GST number is 15 characters; the limit only keeps pasted junk out.
const GST_MAX_LENGTH = 20;

const DUPLICATE_NAME_MESSAGE = "A client with that name already exists";

/**
 * Whether another client already has this name, ignoring case. The database's
 * unique constraint on `name` is case-sensitive, so "ACT" and "act" would both
 * be accepted and the two accounts would be easy to confuse.
 */
async function nameTaken(name: string, exceptId?: number): Promise<boolean> {
  let query = supabaseAdmin.from("clients").select("id").ilike("name", escapeLike(name)).limit(1);
  if (exceptId != null) query = query.neq("id", exceptId);
  const { data, error } = await query;
  // A failed lookup must not read as "name is free": that would let a
  // case-variant duplicate through. The route turns the throw into a 500.
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Turns a unique-violation into the reason that actually applies. */
function duplicateMessage(error: { message?: string; details?: string }): string {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.includes("uq_clients_entity")
    ? "That person or firm already has a client account"
    : DUPLICATE_NAME_MESSAGE;
}

interface ClientBalance {
  client_id: number;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  advance_amount: number;
  last_payment_date: string | null;
  last_entry_date: string | null;
  oldest_unpaid_date: string | null;
  entry_count: number;
}

const EMPTY_BALANCE: Omit<ClientBalance, "client_id"> = {
  total_billed: 0,
  total_paid: 0,
  outstanding: 0,
  advance_amount: 0,
  last_payment_date: null,
  last_entry_date: null,
  oldest_unpaid_date: null,
  entry_count: 0,
};

/** Balances for the clients on this page in one query, merged via a Map. */
export async function fetchClientBalances(
  clientIds: number[],
): Promise<Map<number, ClientBalance>> {
  const map = new Map<number, ClientBalance>();
  if (clientIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("client_balances")
    .select("*")
    .in("client_id", clientIds);

  for (const row of (data ?? []) as ClientBalance[]) {
    map.set(row.client_id, row);
  }
  return map;
}

/** Deployed-vehicle mix per client, for the fleet chips on the list. */
async function fetchDeploymentMix(clientIds: number[]) {
  const map = new Map<number, Record<string, number>>();
  if (clientIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("client_deployments")
    .select("client_id, vehicle_type, quantity")
    .in("client_id", clientIds)
    .eq("is_active", true);

  for (const row of data ?? []) {
    const clientId = row.client_id as number;
    const mix = map.get(clientId) ?? {};
    const type = row.vehicle_type as string;
    mix[type] = (mix[type] ?? 0) + (Number(row.quantity) || 0);
    map.set(clientId, mix);
  }

  return map;
}

// ─── GET — paginated list ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const clientType = searchParams.get("client_type")?.trim() ?? "";
    const partyKind = searchParams.get("party_kind")?.trim() ?? "";
    const isActive = searchParams.get("is_active");
    const hasDues = searchParams.get("has_dues") === "true";
    const includeSummary = searchParams.get("include_summary") === "true";

    const { from, to } = parsePageParams(searchParams, {
      defaultPageSize: 10,
      maxPageSize: 200,
    });

    let query = supabaseAdmin
      .from("clients")
      .select(CLIENT_SELECT, { count: "exact" })
      .order("name", { ascending: true });

    if (clientType) query = query.eq("client_type", clientType);
    if (partyKind) query = query.eq("party_kind", partyKind);
    if (isActive === "true" || isActive === "false") {
      query = query.eq("is_active", isActive === "true");
    }
    if (search) {
      const pattern = likeOrPattern(search);
      query = query.or(
        `name.ilike.${pattern},location.ilike.${pattern},gst_number.ilike.${pattern}`,
      );
    }

    // "Owes money" depends on a balance that lives in a view. The ids of the
    // clients that owe are read first and the list is limited to them, so the
    // count and the page come from the database and no row cap can cut the
    // list before the filter runs.
    if (hasDues) {
      const { data: owing, error: owingError } = await supabaseAdmin
        .from("client_balances")
        .select("client_id")
        .gt("outstanding", 0);
      if (owingError) return serverError(owingError);
      // No client has id 0, so "nobody owes" gives an empty page and still
      // lets the summary below be built.
      const owingIds = (owing ?? []).map((row) => row.client_id as number);
      query = query.in("id", owingIds.length > 0 ? owingIds : [0]);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) return serverError(error);

    const rows = data ?? [];
    const ids = rows.map((row) => row.id as number);
    const [balances, deploymentMix] = await Promise.all([
      fetchClientBalances(ids),
      fetchDeploymentMix(ids),
    ]);

    const enriched = rows.map((row) => ({
      ...row,
      balance: balances.get(row.id as number) ?? {
        client_id: row.id,
        ...EMPTY_BALANCE,
      },
      deployment_mix: deploymentMix.get(row.id as number) ?? {},
    }));

    const total = count ?? enriched.length;

    let summary;
    if (includeSummary) {
      const [{ data: allClients }, { data: allBalances }] = await Promise.all([
        supabaseAdmin.from("clients").select("id, is_active"),
        supabaseAdmin.from("client_balances").select("outstanding, advance_amount"),
      ]);

      const totalOutstanding = (allBalances ?? []).reduce(
        (sum, row) => sum + (Number(row.outstanding) > 0 ? Number(row.outstanding) : 0),
        0,
      );
      const totalAdvance = (allBalances ?? []).reduce(
        (sum, row) => sum + (Number(row.advance_amount) || 0),
        0,
      );

      summary = {
        totalClients: (allClients ?? []).length,
        activeClients: (allClients ?? []).filter((c) => c.is_active).length,
        totalOutstanding,
        totalAdvance,
        clientsWithDues: (allBalances ?? []).filter(
          (row) => Number(row.outstanding) > 0,
        ).length,
      };
    }

    return apiSuccess({ data: enriched, total, summary });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

/**
 * Shared field validation for create/update; fills `payload` as it goes.
 * `party_kind` must be resolved before `name` is checked — an INDIVIDUAL's
 * name comes from the linked entity via trg_clients_name_mirror
 * (sql/36_add_client_party_kind.sql), not from the request body.
 */
async function validateClientFields(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  {
    partial,
    existingPartyKind,
    exceptId,
    existingName,
  }: { partial: boolean; existingPartyKind?: string; exceptId?: number; existingName?: string },
): Promise<string | null> {
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("party_kind")) {
    const partyKind = String(body.party_kind ?? "COMPANY");
    if (!(VALID_PARTY_KINDS as readonly string[]).includes(partyKind)) {
      return `Party kind must be one of: ${VALID_PARTY_KINDS.join(", ")}`;
    }
    payload.party_kind = partyKind;
  }

  const effectivePartyKind = (payload.party_kind as string | undefined) ?? existingPartyKind ?? "COMPANY";

  if (has("entity_id")) {
    if (body.entity_id == null || body.entity_id === "") {
      if (effectivePartyKind === "INDIVIDUAL") {
        return "An individual must be linked to an entity";
      }
      payload.entity_id = null;
    } else {
      const entityId = parseId(body.entity_id);
      if (entityId === null) return "Invalid entity";
      const { data: entity } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("id", entityId)
        .maybeSingle();
      if (!entity) return "Selected entity no longer exists";
      payload.entity_id = entityId;
    }
  } else if (!partial && effectivePartyKind === "INDIVIDUAL") {
    return "An individual must be linked to an entity";
  }

  // The account this client normally pays into — independent of party_kind,
  // and reassignable at any time (unlike entity_id, which is fixed once an
  // individual is linked).
  if (has("receiving_account_id")) {
    if (body.receiving_account_id == null || body.receiving_account_id === "") {
      payload.receiving_account_id = null;
    } else {
      const accountId = parseId(body.receiving_account_id);
      if (accountId === null) return "Invalid receiving account";
      const { data: account } = await supabaseAdmin
        .from("bank_accounts")
        .select("id")
        .eq("id", accountId)
        .maybeSingle();
      if (!account) return "Selected account no longer exists";
      payload.receiving_account_id = accountId;
    }
  }

  if (has("name")) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    // An individual's name is mirrored from the linked entity — the trigger
    // supplies it, so an absent/empty name here is fine and expected.
    if (effectivePartyKind === "COMPANY") {
      if (!name) return "Company name is required";
      if (name.length > 150) return "Company name must be 150 characters or less";
      if (await nameTaken(name, exceptId)) return DUPLICATE_NAME_MESSAGE;
      payload.name = name;
    }
    // An individual's name is mirrored from their entity by a trigger that
    // only runs when the entity changes, so a name sent here would stick and
    // then disagree with the entity. Sending the name they already have is
    // harmless; a different one is refused rather than dropped with a success.
    if (
      effectivePartyKind === "INDIVIDUAL" &&
      existingName !== undefined &&
      name &&
      name !== existingName
    ) {
      return "An individual's name comes from their entity. Rename the entity instead.";
    }
  }

  if (body.client_type !== undefined) {
    const clientType = typeof body.client_type === "string" ? body.client_type.trim() : "";
    if (!clientType) return "Client type is required";
    // The type list is editable data (lookup_options), with no foreign key, so
    // the check lives here — as it does for a loan's type.
    const { data: option } = await supabaseAdmin
      .from("lookup_options")
      .select("value")
      .eq("category", "client_type")
      .eq("value", clientType)
      .maybeSingle();
    if (!option) return "Unknown client type";
    payload.client_type = clientType;
  }

  for (const [key, max, label] of [
    ["location", LOCATION_MAX_LENGTH, "Location"],
    ["address", ADDRESS_MAX_LENGTH, "Address"],
    ["gst_number", GST_MAX_LENGTH, "GST number"],
    ["notes", NOTES_MAX_LENGTH, "Notes"],
  ] as const) {
    if (body[key] !== undefined) {
      const text = optionalText(body[key], max);
      if ("error" in text) {
        return text.error === "too_long"
          ? `${label} must be ${max} characters or less`
          : `${label} must be text`;
      }
      payload[key] = text.value;
    }
  }

  if (body.is_active !== undefined) {
    const flag = parseFlag(body.is_active);
    if (flag === null) return "is_active must be true or false";
    payload.is_active = flag;
  }

  return null;
}

// ─── POST — create, optionally with an opening balance ───

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);

    const payload: Record<string, unknown> = { client_type: "VENDOR", party_kind: "COMPANY" };
    const validationError = await validateClientFields(body, payload, { partial: false });
    if (validationError) {
      return apiError(validationError, validationError === DUPLICATE_NAME_MESSAGE ? 409 : 400);
    }

    // The opening balance is checked before anything is saved, so a client is
    // never created with its starting balance silently missing.
    const hasOpening = body.opening_balance != null && body.opening_balance !== "";
    let openingDate: string = todayInIndia();
    if (hasOpening) {
      const problem = moneyProblem(body.opening_balance);
      if (problem) {
        return apiError(moneyMessage(problem, "Opening balance must be greater than zero"), 400);
      }
      openingDate = (body.opening_date ?? todayInIndia()) as string;
      if (!isValidDateString(openingDate)) return apiError("Invalid opening balance date", 400);
      if (openingDate > todayInIndia()) {
        return apiError("Opening balance date cannot be in the future", 400);
      }
    }

    payload.created_by = authUser.id;

    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .insert([payload])
      .select(CLIENT_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError(duplicateMessage(error), 409);
      }
      return serverError(error);
    }

    // A client carried over from paper usually already owes something; that
    // becomes the first ledger entry rather than a special column.
    let openingWarning: string | null = null;
    if (hasOpening) {
      const { error: entryError } = await supabaseAdmin.from("client_ledger_entries").insert([
        {
          client_id: client.id,
          entry_type: "OPENING",
          direction: "DEBIT",
          amount: Number(body.opening_balance),
          entry_date: openingDate,
          description: "Opening balance",
          created_by: authUser.id,
        },
      ]);
      if (entryError) openingWarning = "Client created, but the opening balance failed to record";
    }

    after(async () => {
      await logActivity({
        action: "CREATE_CLIENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "clients",
        recordId: client.id,
        details: { name: client.name, client_type: client.client_type },
      });
    });

    return apiSuccess({ client }, openingWarning ?? "Client added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — update ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);

    const id = parseId(body.id);
    if (id === null) {
      return apiError("Missing client ID", 400);
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("clients")
      .select("party_kind, name")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!existing) return apiError("Client not found", 404);

    const payload: Record<string, unknown> = {};
    const validationError = await validateClientFields(body, payload, {
      partial: true,
      existingPartyKind: existing.party_kind as string,
      existingName: existing.name as string,
      exceptId: id,
    });
    if (validationError) {
      return apiError(validationError, validationError === DUPLICATE_NAME_MESSAGE ? 409 : 400);
    }

    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    payload.updated_by = authUser.id;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(payload)
      .eq("id", id)
      .select(CLIENT_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return apiError(duplicateMessage(error), 409);
      }
      return serverError(error);
    }
    if (!data) return apiError("Client not found", 404);

    after(async () => {
      await logActivity({
        action: "UPDATE_CLIENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "clients",
        recordId: id,
        details: { changes: payload },
      });
    });

    return apiSuccess({ client: data }, "Client updated", 200);
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

    if (id === null) {
      return apiError("Missing client ID", 400);
    }

    const { data: client, error: fetchErr } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!client) return apiError("Client not found", 404);

    // Deleting a client with money on the books would erase the record of a
    // debt. Deactivating keeps the history and hides them from new work.
    const { data: balance } = await supabaseAdmin
      .from("client_balances")
      .select("outstanding, entry_count")
      .eq("client_id", id)
      .maybeSingle();

    if (Number(balance?.outstanding ?? 0) !== 0) {
      return apiError(
        `Cannot delete "${client.name}" — their account is not settled. Mark them inactive instead to keep the statement.`,
        400,
      );
    }

    if (Number(balance?.entry_count ?? 0) > 0) {
      return apiError(
        `Cannot delete "${client.name}" because their statement has ${balance?.entry_count} entries. Mark them inactive instead.`,
        400,
      );
    }

    // Contacts and vehicle assignments would be removed with the client by the
    // FK cascade; say what is attached instead of deleting it silently.
    const [{ count: contactCount }, { count: deploymentCount }] = await Promise.all([
      supabaseAdmin.from("client_contacts").select("id", { count: "exact", head: true }).eq("client_id", id),
      supabaseAdmin.from("client_deployments").select("id", { count: "exact", head: true }).eq("client_id", id),
    ]);
    const attached = [
      contactCount ? `${contactCount} contact${contactCount === 1 ? "" : "s"}` : null,
      deploymentCount ? `${deploymentCount} vehicle assignment${deploymentCount === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    if (attached.length > 0) {
      return apiError(
        `Cannot delete "${client.name}" because it has ${attached.join(" and ")}. Remove them first, or mark the client inactive.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("clients").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_CLIENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "clients",
        recordId: id,
        details: { name: client.name },
      });
    });

    return apiSuccess(null, "Client deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
