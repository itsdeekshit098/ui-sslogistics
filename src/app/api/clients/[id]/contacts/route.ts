import { after } from "next/server";
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
import { optionalText, parseFlag, parseId } from "../../../loans/loans.utils";

// Points of contact at a client company — HR for the contract, operations for
// day-to-day vehicles, accounts for the money. Several per client, with one
// marked primary as the person to actually ring.

const PHONE_PATTERN = /^[6-9]\d{9}$/;
const MAX_NAME_LENGTH = 150;
// role is a lookup value (the lookups route limits those to 60).
const TEXT_FIELDS = [
  ["role", 60, "Role"],
  ["designation", 100, "Designation"],
  ["notes", 500, "Notes"],
] as const;

function validateContactFields(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  { partial }: { partial: boolean },
): string | null {
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("name")) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return "Contact name is required";
    if (name.length > MAX_NAME_LENGTH) {
      return `Contact name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    payload.name = name;
  }

  for (const key of ["phone", "alt_phone"] as const) {
    if (body[key] !== undefined) {
      // A phone sent as an object or number is not a phone; String() would
      // have turned it into text that only looks like one.
      if (body[key] !== null && typeof body[key] !== "string") {
        return "Enter a valid 10-digit mobile number";
      }
      const value = body[key] === null ? "" : (body[key] as string).trim();
      if (value && !PHONE_PATTERN.test(value)) {
        return "Enter a valid 10-digit mobile number";
      }
      payload[key] = value || null;
    }
  }

  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== "string") {
      return "Enter a valid email address";
    }
    const email = body.email === null ? "" : (body.email as string).trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Enter a valid email address";
    }
    payload.email = email || null;
  }

  for (const [key, max, label] of TEXT_FIELDS) {
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

  if (body.is_primary !== undefined) {
    const flag = parseFlag(body.is_primary);
    if (flag === null) return "is_primary must be true or false";
    payload.is_primary = flag;
  }

  return null;
}

/**
 * The DB allows only one primary per client (a partial unique index), so an
 * incoming primary has to demote the existing one first — otherwise the insert
 * fails with a raw constraint error.
 */
async function clearExistingPrimary(clientId: number, exceptId?: number) {
  let query = supabaseAdmin
    .from("client_contacts")
    .update({ is_primary: false })
    .eq("client_id", clientId)
    .eq("is_primary", true);

  if (exceptId != null) query = query.neq("id", exceptId);

  await query;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });

    if (error) return serverError(error);

    return apiSuccess({ data: data ?? [] });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return apiError("Client not found", 404);

    const payload: Record<string, unknown> = { client_id: clientId };
    const validationError = validateContactFields(body, payload, { partial: false });
    if (validationError) return apiError(validationError, 400);

    if (payload.is_primary) await clearExistingPrimary(clientId);

    payload.created_by = authUser.id;

    const { data, error } = await supabaseAdmin
      .from("client_contacts")
      .insert([payload])
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "CREATE_CLIENT_CONTACT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_contacts",
        recordId: data.id,
        details: { client_id: clientId, name: data.name },
      });
    });

    return apiSuccess({ contact: data }, "Contact added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);
    if (clientId === null) {
      return apiError("Invalid client ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);
    const contactId = parseId(body.id);
    if (contactId === null) {
      return apiError("Missing contact ID", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("client_contacts")
      .select("id, client_id")
      .eq("id", contactId)
      .maybeSingle();

    if (!existing) return apiError("Contact not found", 404);
    if (existing.client_id !== clientId) {
      return apiError("That contact belongs to a different client", 400);
    }

    const payload: Record<string, unknown> = {};
    const validationError = validateContactFields(body, payload, { partial: true });
    if (validationError) return apiError(validationError, 400);

    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    if (payload.is_primary) await clearExistingPrimary(clientId, contactId);

    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("client_contacts")
      .update(payload)
      .eq("id", contactId)
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "UPDATE_CLIENT_CONTACT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_contacts",
        recordId: contactId,
        details: { client_id: clientId, changes: payload },
      });
    });

    return apiSuccess({ contact: data }, "Contact updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = parseId(idParam);

    const { searchParams } = new URL(req.url);
    const contactId = parseId(searchParams.get("contact_id"));

    if (clientId === null || contactId === null) {
      return apiError("Invalid client or contact ID", 400);
    }

    const { data: existing } = await supabaseAdmin
      .from("client_contacts")
      .select("id, client_id, name")
      .eq("id", contactId)
      .maybeSingle();

    if (!existing) return apiError("Contact not found", 404);
    if (existing.client_id !== clientId) {
      return apiError("That contact belongs to a different client", 400);
    }

    const { error } = await supabaseAdmin
      .from("client_contacts")
      .delete()
      .eq("id", contactId);

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_CLIENT_CONTACT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_contacts",
        recordId: contactId,
        details: { client_id: clientId, name: existing.name },
      });
    });

    return apiSuccess(null, "Contact removed", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
