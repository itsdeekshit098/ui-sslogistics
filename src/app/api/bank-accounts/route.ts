import { after } from "next/server";
import { apiSuccess, apiError, handleApiError, serverError } from "@/lib/apiResponse";
import { supabaseAdmin } from "@/lib/supabase";
import { requireStrictAdminAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { escapeLike } from "@/lib/escapeLike";

// Our own bank accounts, recorded so a loan can say which account its EMI
// mandate debits (sql/34_add_bank_accounts.sql). Not a lender, not a loan
// reference — see that migration's header. Deliberately never referenced from
// any payment row, so there is no per-account balance to derive here.
//
// Same access rule as loans/fundings/clients — requireStrictAdminAuth() on
// every method, GET included. routePermissions.ts groups /admin/bank-accounts
// with the staff-locked-out pages for the same reason: this is the account a
// loan's EMI mandate debits from, not something staff should read or create.

const VALID_ACCOUNT_TYPES = ["SAVINGS", "CURRENT", "OD", "CC"] as const;
const ACCOUNT_NUMBER_PATTERN = /^[0-9]{6,20}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const NOTES_MAX_LENGTH = 500;

const SELECT_COLUMNS =
  "id, holder_entity_id, bank_name, account_number, account_type, ifsc, branch, nickname, notes, is_active, created_at, updated_at, entities:holder_entity_id (id, name, entity_kind)";

type FieldErrors = Record<string, string>;

/**
 * Shared field validation for POST (all fields present) and PUT (partial).
 * On PUT, only keys actually supplied in the body are checked. Mutates
 * `payload` with the normalized values.
 */
async function validateBankAccountFields(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  { partial }: { partial: boolean },
): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("holder_entity_id")) {
    const holderId = Number(body.holder_entity_id);
    if (!Number.isFinite(holderId)) {
      errors.holder_entity_id = "Holder is required";
    } else {
      const { data: entity } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("id", holderId)
        .maybeSingle();
      if (!entity) {
        errors.holder_entity_id = "Selected holder no longer exists";
      } else {
        payload.holder_entity_id = holderId;
      }
    }
  }

  if (has("bank_name")) {
    const bankName = typeof body.bank_name === "string" ? body.bank_name.trim() : "";
    if (!bankName) {
      errors.bank_name = "Bank is required";
    } else {
      payload.bank_name = bankName;
    }
  }

  if (has("account_number")) {
    const accountNumber =
      typeof body.account_number === "string" ? body.account_number.trim() : "";
    if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      errors.account_number = "Enter a valid account number (6-20 digits)";
    } else {
      payload.account_number = accountNumber;
    }
  }

  if (body.account_type !== undefined) {
    const accountType = String(body.account_type ?? "SAVINGS");
    if (!(VALID_ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
      errors.account_type = `Account type must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}`;
    } else {
      payload.account_type = accountType;
    }
  }

  if (body.ifsc !== undefined) {
    const ifsc = body.ifsc === null ? "" : String(body.ifsc).trim().toUpperCase();
    if (ifsc && !IFSC_PATTERN.test(ifsc)) {
      errors.ifsc = "Enter a valid IFSC code";
    } else {
      payload.ifsc = ifsc || null;
    }
  }

  for (const key of ["branch", "nickname"] as const) {
    if (body[key] !== undefined) {
      const value = body[key] === null ? "" : String(body[key]).trim();
      payload[key] = value || null;
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

  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }

  return errors;
}

// ─── GET — list / search bank accounts ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const holderId = searchParams.get("holder_entity_id");
    const isActive = searchParams.get("is_active");
    const withCounts = searchParams.get("with_counts") === "true";
    const pageParam = searchParams.get("page");

    let query = supabaseAdmin
      .from("bank_accounts")
      .select(SELECT_COLUMNS, { count: "exact" })
      .order("bank_name", { ascending: true })
      .order("account_number", { ascending: true });

    if (holderId) query = query.eq("holder_entity_id", Number(holderId));
    if (isActive === "true" || isActive === "false") {
      query = query.eq("is_active", isActive === "true");
    }
    if (search) {
      const safe = escapeLike(search);
      query = query.or(
        `nickname.ilike.%${safe}%,account_number.ilike.%${safe}%,bank_name.ilike.%${safe}%`,
      );
    }

    if (pageParam) {
      const page = Math.max(1, Number(pageParam) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number(searchParams.get("page_size")) || 20),
      );
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    } else {
      query = query.limit(500);
    }

    const { data, error, count } = await query;
    if (error) return serverError(error);

    const rows = data ?? [];

    let loanCounts = new Map<number, number>();
    if (withCounts && rows.length > 0) {
      const { data: loanRows } = await supabaseAdmin
        .from("loans")
        .select("debit_account_id")
        .in(
          "debit_account_id",
          rows.map((r) => r.id as number),
        );
      loanCounts = new Map();
      for (const row of loanRows ?? []) {
        const id = row.debit_account_id as number | null;
        if (id == null) continue;
        loanCounts.set(id, (loanCounts.get(id) ?? 0) + 1);
      }
    }

    const enriched = withCounts
      ? rows.map((row) => ({
          ...row,
          loan_count: loanCounts.get(row.id as number) ?? 0,
        }))
      : rows;

    return apiSuccess({ data: enriched, total: count ?? enriched.length });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — create a bank account ───

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const payload: Record<string, unknown> = { account_type: "SAVINGS" };
    const fieldErrors = await validateBankAccountFields(body, payload, { partial: false });

    if (Object.keys(fieldErrors).length > 0) {
      return apiError(Object.values(fieldErrors)[0], 400);
    }

    payload.created_by = authUser.id;

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .insert([payload])
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An account with that number already exists at this bank.", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_BANK_ACCOUNT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "bank_accounts",
        recordId: data.id,
        details: { bank_name: data.bank_name, account_number: data.account_number },
      });
    });

    return apiSuccess({ bank_account: data }, "Bank account added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — update a bank account ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const id = Number(body.id);
    if (!body.id || !Number.isFinite(id)) {
      return apiError("Missing bank account ID", 400);
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("bank_accounts")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!existing) return apiError("Bank account not found", 404);

    const payload: Record<string, unknown> = {};
    const fieldErrors = await validateBankAccountFields(body, payload, { partial: true });

    if (Object.keys(fieldErrors).length > 0) {
      return apiError(Object.values(fieldErrors)[0], 400);
    }

    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    payload.updated_by = authUser.id;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("bank_accounts")
      .update(payload)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("An account with that number already exists at this bank.", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_BANK_ACCOUNT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "bank_accounts",
        recordId: id,
        details: { changes: payload },
      });
    });

    return apiSuccess({ bank_account: data }, "Bank account updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── DELETE — remove a bank account, if no loan debits from it ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing bank account ID", 400);
    }

    const { data: account, error: fetchErr } = await supabaseAdmin
      .from("bank_accounts")
      .select("id, bank_name, account_number")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!account) return apiError("Bank account not found", 404);

    const [
      { count: loanCount, error: loanErr },
      { count: clientCount, error: clientErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("debit_account_id", id),
      supabaseAdmin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("receiving_account_id", id),
    ]);

    if (loanErr) return serverError(loanErr);
    if (clientErr) return serverError(clientErr);

    const references: string[] = [];
    if ((loanCount ?? 0) > 0) references.push(`${loanCount} loan(s) auto-debit from it`);
    if ((clientCount ?? 0) > 0) references.push(`${clientCount} client(s) pay into it`);

    if (references.length > 0) {
      return apiError(
        `Cannot delete this account because ${references.join(" and ")}. Reassign them first, or mark the account inactive instead.`,
        409,
      );
    }

    const { error } = await supabaseAdmin.from("bank_accounts").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_BANK_ACCOUNT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "bank_accounts",
        recordId: id,
        details: { bank_name: account.bank_name, account_number: account.account_number },
      });
    });

    return apiSuccess(null, "Bank account deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
