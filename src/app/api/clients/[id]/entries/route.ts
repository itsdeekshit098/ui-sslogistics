import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { isPositiveNumber, isValidDateString } from "../../../loans/loans.utils";

// The receivables statement. Bills are debits (they owe more), payments are
// credits (they owe less), and the balance is simply the running difference —
// there is no invoice-to-payment matching, because that isn't how this business
// settles: money arrives against the account, not against a specific bill.

const DESCRIPTION_MAX_LENGTH = 300;

const CLIENT_ENTRY_TYPES = ["BILL", "PAYMENT", "OPENING", "ADJUSTMENT"] as const;

interface LedgerRow {
  id: number;
  entry_date: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  reverses_entry_id: number | null;
}

// ─── GET — paginated statement with a running balance ───

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = Number(idParam);
    if (!Number.isFinite(clientId)) {
      return apiError("Invalid client ID", 400);
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("page_size")) || 25),
    );

    // A running balance is cumulative, so it can't be computed from one page in
    // isolation. This first pass reads only the five columns the arithmetic
    // needs — entries are ordered by (date, id) because a backdated entry gets a
    // later id but belongs earlier in the statement, so id order alone is wrong.
    const { data: skeleton, error: skeletonErr } = await supabaseAdmin
      .from("client_ledger_entries")
      .select("id, entry_date, direction, amount, reverses_entry_id")
      .eq("client_id", clientId)
      .order("entry_date", { ascending: true })
      .order("id", { ascending: true });

    if (skeletonErr) return serverError(skeletonErr);

    const rows = (skeleton ?? []) as LedgerRow[];

    // A reversed entry and its reversal both drop out of the balance, so the
    // pair nets to zero while staying visible in the list.
    const reversedIds = new Set(
      rows
        .map((row) => row.reverses_entry_id)
        .filter((value): value is number => value != null),
    );

    const runningById = new Map<number, number>();
    let running = 0;
    for (const row of rows) {
      const counts = row.reverses_entry_id == null && !reversedIds.has(row.id);
      if (counts) {
        running += row.direction === "DEBIT" ? Number(row.amount) : -Number(row.amount);
      }
      runningById.set(row.id, running);
    }

    // Newest first for display; the running balance stays the one computed in
    // chronological order above.
    const ordered = [...rows].reverse();
    const total = ordered.length;
    const from = (page - 1) * pageSize;
    const pageIds = ordered.slice(from, from + pageSize).map((row) => row.id);

    if (pageIds.length === 0) {
      return apiSuccess({ data: [], total, closing_balance: running });
    }

    // Second pass fetches the wide columns for this page only.
    const { data: full, error: fullErr } = await supabaseAdmin
      .from("client_ledger_entries")
      .select("*")
      .in("id", pageIds);

    if (fullErr) return serverError(fullErr);

    const byId = new Map((full ?? []).map((row) => [row.id as number, row]));

    // One count per entry so the statement can show a paperclip badge without
    // a request per row — mirrors how fetchClientBalances merges via a Map.
    const { data: attachmentRows } = await supabaseAdmin
      .from("attachments")
      .select("client_entry_id")
      .in("client_entry_id", pageIds);
    const attachmentCounts = new Map<number, number>();
    for (const row of attachmentRows ?? []) {
      const entryId = row.client_entry_id as number;
      attachmentCounts.set(entryId, (attachmentCounts.get(entryId) ?? 0) + 1);
    }

    const data = pageIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row != null)
      .map((row) => ({
        ...row,
        running_balance: runningById.get(row.id as number) ?? 0,
        is_reversed: reversedIds.has(row.id as number),
        is_reversal: row.reverses_entry_id != null,
        attachment_count: attachmentCounts.get(row.id as number) ?? 0,
      }));

    return apiSuccess({ data, total, closing_balance: running });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — add a bill or record a payment ───

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const clientId = Number(idParam);
    if (!Number.isFinite(clientId)) {
      return apiError("Invalid client ID", 400);
    }

    const body = (await req.json()) as Record<string, unknown>;

    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr) return serverError(clientErr);
    if (!client) return apiError("Client not found", 404);

    const entryType = String(body.entry_type ?? "");
    if (!(CLIENT_ENTRY_TYPES as readonly string[]).includes(entryType)) {
      return apiError(
        `Invalid entry type. Allowed values: ${CLIENT_ENTRY_TYPES.join(", ")}`,
        400,
      );
    }

    if (!isPositiveNumber(body.amount)) {
      return apiError("Amount must be greater than zero", 400);
    }

    const entryDate = body.entry_date ?? new Date().toISOString().slice(0, 10);
    if (!isValidDateString(entryDate)) {
      return apiError("Invalid date", 400);
    }

    // Direction follows from the type for bills and payments — the caller only
    // gets to choose it for an adjustment, which can go either way.
    let direction: "DEBIT" | "CREDIT";
    if (entryType === "BILL" || entryType === "OPENING") {
      direction = "DEBIT";
    } else if (entryType === "PAYMENT") {
      direction = "CREDIT";
    } else {
      const supplied = String(body.direction ?? "");
      if (supplied !== "DEBIT" && supplied !== "CREDIT") {
        return apiError("An adjustment must say whether it is a debit or a credit", 400);
      }
      direction = supplied;
    }

    let periodMonth: string | null = null;
    if (body.period_month) {
      // Accepts either YYYY-MM from a month input or a full date.
      const raw = String(body.period_month);
      const normalized = raw.length === 7 ? `${raw}-01` : raw.slice(0, 8) + "01";
      if (!isValidDateString(normalized)) {
        return apiError("Invalid billing month", 400);
      }
      periodMonth = normalized;
    }

    const description =
      body.description == null ? null : String(body.description).trim().slice(0, DESCRIPTION_MAX_LENGTH);

    const insertPayload = {
      client_id: clientId,
      entry_type: entryType,
      direction,
      amount: Number(body.amount),
      entry_date: entryDate,
      invoice_no: body.invoice_no ? String(body.invoice_no).trim() : null,
      period_month: periodMonth,
      payment_method: body.payment_method ? String(body.payment_method) : null,
      reference: body.reference ? String(body.reference).trim() : null,
      description: description || null,
      created_by: authUser.id,
    };

    const { data: entry, error } = await supabaseAdmin
      .from("client_ledger_entries")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "CREATE_CLIENT_LEDGER_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_ledger_entries",
        recordId: entry.id,
        details: {
          client_id: clientId,
          entry_type: entryType,
          direction,
          amount: insertPayload.amount,
          entry_date: entryDate,
        },
      });
    });

    return apiSuccess(
      { entry },
      entryType === "PAYMENT" ? "Payment recorded" : "Bill added",
      201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
