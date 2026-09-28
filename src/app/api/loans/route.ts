import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { parsePageParams } from "@/lib/pagination";
import { escapeLike } from "@/lib/escapeLike";
import {
  LOAN_NOTES_MAX_LENGTH,
  LOAN_STATUSES,
  generateSchedule,
  isNonNegativeNumber,
  isPositiveNumber,
  isValidDateString,
} from "./loans.utils";

const MANDATE_TYPES = ["NACH", "ECS", "SI", "PDC", "MANUAL"] as const;

// Institutional loans. Every method — GET included — is admin/superadmin only:
// this is the most sensitive data in the app (EMIs, personal borrowings in
// family names), unlike most feature routes which let staff read.
//
// Balances are never computed here or on the client; they come from the
// loan_balances view (sql/31_add_loans.sql) so web and mobile can't disagree.

const LOAN_SELECT = `
  id, loan_type, borrower_entity_id, lender_id, loan_number,
  vehicle_id, collateral_description,
  principal_amount, disbursed_amount, interest_rate, processing_fee,
  start_date, first_emi_date, emi_amount, emi_day_of_month, total_installments,
  outstanding_override, status, closed_on, notes, created_at, updated_at,
  debit_account_id, mandate_type,
  entities:borrower_entity_id (id, name, entity_kind, relationship),
  lenders:lender_id (id, name, lender_kind),
  vehicles:vehicle_id (id, vehicle_number, vehicle_type, company, model),
  bank_accounts:debit_account_id (id, bank_name, account_number, account_type, nickname, entities:holder_entity_id (name))
`;

interface LoanBalance {
  loan_id: number;
  total_payable: number;
  total_paid: number;
  total_charges: number;
  outstanding: number;
  installments_paid: number;
  installments_left: number;
  next_due_date: string | null;
  next_due_amount: number | null;
  overdue_count: number;
  overdue_amount: number;
  final_due_date: string | null;
  last_payment_date: string | null;
}

const EMPTY_BALANCE: Omit<LoanBalance, "loan_id"> = {
  total_payable: 0,
  total_paid: 0,
  total_charges: 0,
  outstanding: 0,
  installments_paid: 0,
  installments_left: 0,
  next_due_date: null,
  next_due_amount: null,
  overdue_count: 0,
  overdue_amount: 0,
  final_due_date: null,
  last_payment_date: null,
};

/**
 * Fetches balances for the loans on this page in one query and returns them as
 * a Map, rather than a lookup per row.
 */
export async function fetchLoanBalances(
  loanIds: number[],
): Promise<Map<number, LoanBalance>> {
  const map = new Map<number, LoanBalance>();
  if (loanIds.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("loan_balances")
    .select("*")
    .in("loan_id", loanIds);

  for (const row of (data ?? []) as LoanBalance[]) {
    map.set(row.loan_id, row);
  }
  return map;
}

/** Portfolio totals for the stat cards, across all active loans. */
async function buildSummary() {
  const { data: activeLoans } = await supabaseAdmin
    .from("loans")
    .select("id, emi_amount")
    .eq("status", "ACTIVE");

  const active = activeLoans ?? [];
  const balances = await fetchLoanBalances(active.map((l) => l.id as number));

  let totalOutstanding = 0;
  let totalMonthlyEmi = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let dueThisMonth = 0;

  // "This month" is bounded by the month's last day so a 31-day month doesn't
  // spill into the next one.
  const now = new Date();
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  )
    .toISOString()
    .slice(0, 10);

  for (const loan of active) {
    const balance = balances.get(loan.id as number);
    totalMonthlyEmi += Number(loan.emi_amount) || 0;
    if (!balance) continue;

    totalOutstanding += Number(balance.outstanding) || 0;
    overdueCount += Number(balance.overdue_count) || 0;
    overdueAmount += Number(balance.overdue_amount) || 0;
    if (balance.next_due_date && balance.next_due_date <= monthEnd) {
      dueThisMonth += 1;
    }
  }

  // Scoped to BORROWED only — mixing in LENT fundings would total money we owe
  // together with money owed to us, which must never happen (sql/35).
  const { data: borrowedOpenFundings, count: openFundings } = await supabaseAdmin
    .from("fundings")
    .select("id", { count: "exact" })
    .eq("status", "OPEN")
    .eq("direction", "BORROWED");

  const { data: fundingRows } = await supabaseAdmin
    .from("funding_balances")
    .select("principal_outstanding")
    .in("funding_id", (borrowedOpenFundings ?? []).map((f) => f.id as number));

  const fundingPrincipalOutstanding = (fundingRows ?? []).reduce(
    (sum, row) => sum + (Number(row.principal_outstanding) || 0),
    0,
  );

  return {
    totalOutstanding,
    totalMonthlyEmi,
    dueThisMonth,
    overdueCount,
    overdueAmount,
    activeLoans: active.length,
    openFundings: openFundings ?? 0,
    fundingPrincipalOutstanding,
  };
}

// ─── GET — paginated list ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim() ?? "";
    const loanType = searchParams.get("loan_type")?.trim() ?? "";
    const borrowerId = searchParams.get("borrower_entity_id");
    const lenderId = searchParams.get("lender_id");
    const vehicleId = searchParams.get("vehicle_id");
    const debitAccountId = searchParams.get("debit_account_id");
    const search = searchParams.get("search")?.trim() ?? "";
    const overdueOnly = searchParams.get("overdue_only") === "true";
    const includeSummary = searchParams.get("include_summary") === "true";

    const { from, to } = parsePageParams(searchParams, {
      defaultPageSize: 10,
      maxPageSize: 200,
    });

    let query = supabaseAdmin
      .from("loans")
      .select(LOAN_SELECT, { count: "exact" })
      .order("start_date", { ascending: false });

    if (status) query = query.eq("status", status);
    if (loanType) query = query.eq("loan_type", loanType);
    if (borrowerId) query = query.eq("borrower_entity_id", Number(borrowerId));
    if (lenderId) query = query.eq("lender_id", Number(lenderId));
    if (vehicleId) query = query.eq("vehicle_id", Number(vehicleId));
    if (debitAccountId) query = query.eq("debit_account_id", Number(debitAccountId));
    if (search) {
      const escaped = escapeLike(search);
      query = query.or(
        `loan_number.ilike.%${escaped}%,collateral_description.ilike.%${escaped}%`,
      );
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return serverError(error);

    const rows = data ?? [];
    const balances = await fetchLoanBalances(rows.map((r) => r.id as number));

    let enriched = rows.map((row) => ({
      ...row,
      balance: balances.get(row.id as number) ?? {
        loan_id: row.id,
        ...EMPTY_BALANCE,
      },
    }));

    // Overdue status lives in a view, not a column, so it can't be an .eq()
    // filter — it's applied after the balances are merged. Fine at this scale
    // (a page at a time), and it keeps outstanding strictly derived.
    if (overdueOnly) {
      enriched = enriched.filter((row) => (row.balance.overdue_count ?? 0) > 0);
    }

    const summary = includeSummary ? await buildSummary() : undefined;

    return apiSuccess({ data: enriched, total: count ?? enriched.length, summary });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

/**
 * Shared validation for create/update. On update only supplied keys are
 * checked. Returns an error message or null, filling `payload` as it goes.
 */
async function validateLoanFields(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
  { partial }: { partial: boolean },
): Promise<string | null> {
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("loan_type")) {
    const loanType = typeof body.loan_type === "string" ? body.loan_type.trim() : "";
    if (!loanType) return "Loan type is required";
    // Loan types are a runtime-editable list, so validity is checked against
    // the table rather than a hardcoded array.
    const { data: option } = await supabaseAdmin
      .from("lookup_options")
      .select("value")
      .eq("category", "loan_type")
      .eq("value", loanType)
      .maybeSingle();
    if (!option) return "Unknown loan type";
    payload.loan_type = loanType;
  }

  if (has("borrower_entity_id")) {
    const borrowerId = Number(body.borrower_entity_id);
    if (!Number.isFinite(borrowerId)) return "Borrower is required";
    const { data: entity } = await supabaseAdmin
      .from("entities")
      .select("id")
      .eq("id", borrowerId)
      .maybeSingle();
    if (!entity) return "Selected borrower no longer exists";
    payload.borrower_entity_id = borrowerId;
  }

  if (body.lender_id !== undefined) {
    if (body.lender_id === null || body.lender_id === "") {
      payload.lender_id = null;
    } else {
      const lenderId = Number(body.lender_id);
      if (!Number.isFinite(lenderId)) return "Invalid lender";
      const { data: lender } = await supabaseAdmin
        .from("lenders")
        .select("id")
        .eq("id", lenderId)
        .maybeSingle();
      if (!lender) return "Selected lender no longer exists";
      payload.lender_id = lenderId;
    }
  }

  if (body.vehicle_id !== undefined) {
    if (body.vehicle_id === null || body.vehicle_id === "") {
      payload.vehicle_id = null;
    } else {
      const vehicleId = Number(body.vehicle_id);
      if (!Number.isFinite(vehicleId)) return "Invalid vehicle";
      const { data: vehicle } = await supabaseAdmin
        .from("vehicles")
        .select("id")
        .eq("id", vehicleId)
        .maybeSingle();
      if (!vehicle) return "Selected vehicle no longer exists";
      payload.vehicle_id = vehicleId;
    }
  }

  if (body.debit_account_id !== undefined) {
    if (body.debit_account_id === null || body.debit_account_id === "") {
      payload.debit_account_id = null;
    } else {
      const accountId = Number(body.debit_account_id);
      if (!Number.isFinite(accountId)) return "Invalid bank account";
      const { data: account } = await supabaseAdmin
        .from("bank_accounts")
        .select("id")
        .eq("id", accountId)
        .maybeSingle();
      if (!account) return "Selected bank account no longer exists";
      payload.debit_account_id = accountId;
    }
  }

  if (body.mandate_type !== undefined) {
    if (body.mandate_type === null || body.mandate_type === "") {
      payload.mandate_type = null;
    } else {
      const mandateType = String(body.mandate_type);
      if (!(MANDATE_TYPES as readonly string[]).includes(mandateType)) {
        return `Invalid mandate type. Allowed values: ${MANDATE_TYPES.join(", ")}`;
      }
      payload.mandate_type = mandateType;
    }
  }

  if (has("principal_amount")) {
    if (!isNonNegativeNumber(body.principal_amount)) {
      return "Principal amount must be a positive number";
    }
    payload.principal_amount = Number(body.principal_amount);
  }

  if (has("start_date")) {
    if (!isValidDateString(body.start_date)) return "Start date is required";
    payload.start_date = body.start_date;
  }

  if (has("first_emi_date")) {
    if (!isValidDateString(body.first_emi_date)) return "First EMI date is required";
    payload.first_emi_date = body.first_emi_date;
  }

  if (has("emi_amount")) {
    if (!isPositiveNumber(body.emi_amount)) {
      return "EMI amount must be greater than zero";
    }
    payload.emi_amount = Number(body.emi_amount);
  }

  if (has("emi_day_of_month")) {
    const day = Number(body.emi_day_of_month);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return "EMI day must be between 1 and 31";
    }
    payload.emi_day_of_month = day;
  }

  if (has("total_installments")) {
    const total = Number(body.total_installments);
    if (!Number.isInteger(total) || total < 1) {
      return "Total installments must be a whole number of at least 1";
    }
    if (total > 600) return "Total installments looks too large (max 600)";
    payload.total_installments = total;
  }

  for (const key of [
    "interest_rate",
    "processing_fee",
    "disbursed_amount",
    "outstanding_override",
  ] as const) {
    if (body[key] !== undefined) {
      if (body[key] === null || body[key] === "") {
        payload[key] = null;
      } else if (!isNonNegativeNumber(body[key])) {
        return `${key.replace(/_/g, " ")} must be a positive number`;
      } else {
        payload[key] = Number(body[key]);
      }
    }
  }

  for (const key of ["loan_number", "collateral_description"] as const) {
    if (body[key] !== undefined) {
      const value = body[key] === null ? "" : String(body[key]).trim();
      payload[key] = value || null;
    }
  }

  if (body.notes !== undefined) {
    const notes = body.notes === null ? "" : String(body.notes).trim();
    if (notes.length > LOAN_NOTES_MAX_LENGTH) {
      return `Notes must be ${LOAN_NOTES_MAX_LENGTH} characters or less`;
    }
    payload.notes = notes || null;
  }

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(LOAN_STATUSES as readonly string[]).includes(status)) {
      return `Invalid status. Allowed values: ${LOAN_STATUSES.join(", ")}`;
    }
    payload.status = status;
  }

  const start = payload.start_date as string | undefined;
  const firstEmi = payload.first_emi_date as string | undefined;
  if (start && firstEmi && firstEmi < start) {
    return "First EMI date cannot be before the loan start date";
  }

  return null;
}

// ─── POST — create a loan and its schedule ───

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const payload: Record<string, unknown> = {};
    const validationError = await validateLoanFields(body, payload, { partial: false });
    if (validationError) return apiError(validationError, 400);

    payload.status = "ACTIVE";
    payload.created_by = authUser.id;

    const { data: loan, error } = await supabaseAdmin
      .from("loans")
      .insert([payload])
      .select("id")
      .single();

    if (error) return serverError(error);

    // The schedule is what every balance, the EMI calendar and the reminder job
    // read from, so a loan without one is useless. If it fails, the loan is
    // rolled back by hand — there is no transaction across two PostgREST calls.
    const schedule = generateSchedule({
      firstEmiDate: payload.first_emi_date as string,
      emiDayOfMonth: payload.emi_day_of_month as number,
      emiAmount: payload.emi_amount as number,
      totalInstallments: payload.total_installments as number,
    }).map((row) => ({ ...row, loan_id: loan.id }));

    const { error: scheduleError } = await supabaseAdmin
      .from("loan_installments")
      .insert(schedule);

    if (scheduleError) {
      await supabaseAdmin.from("loans").delete().eq("id", loan.id);
      return serverError(scheduleError, { operation: "loan schedule insert", loan_id: loan.id });
    }

    after(async () => {
      await logActivity({
        action: "CREATE_LOAN",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loans",
        recordId: loan.id,
        details: {
          loan_type: payload.loan_type,
          principal_amount: payload.principal_amount,
          total_installments: payload.total_installments,
        },
      });
    });

    return apiSuccess({ loan: { id: loan.id } }, "Loan added", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — update terms ───

export async function PUT(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = (await req.json()) as Record<string, unknown>;

    const id = Number(body.id);
    if (!body.id || !Number.isFinite(id)) {
      return apiError("Missing loan ID", 400);
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("loans")
      .select("id, first_emi_date, emi_day_of_month, emi_amount, total_installments")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!existing) return apiError("Loan not found", 404);

    const payload: Record<string, unknown> = {};
    const validationError = await validateLoanFields(body, payload, { partial: true });
    if (validationError) return apiError(validationError, 400);

    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    // If any schedule-shaping term moved, the future rows have to be rebuilt.
    // PostgREST returns `numeric` columns (emi_amount) as strings while
    // `payload` holds coerced JS numbers, so a plain !== would always be true
    // for that field even on a no-op resave — normalize numeric-looking
    // values before comparing. Date strings and anything non-numeric compare
    // as-is.
    const normalizeForCompare = (value: unknown): unknown => {
      if (typeof value !== "number" && typeof value !== "string") return value;
      const trimmed = String(value).trim();
      if (trimmed === "") return value;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : value;
    };
    const scheduleKeys = [
      "first_emi_date",
      "emi_day_of_month",
      "emi_amount",
      "total_installments",
    ] as const;
    const scheduleChanged = scheduleKeys.some(
      (key) =>
        payload[key] !== undefined &&
        normalizeForCompare(payload[key]) !== normalizeForCompare(existing[key]),
    );

    const scheduleTerms = {
      firstEmiDate: (payload.first_emi_date as string) ?? existing.first_emi_date,
      emiDayOfMonth: (payload.emi_day_of_month as number) ?? existing.emi_day_of_month,
      emiAmount: (payload.emi_amount as number) ?? existing.emi_amount,
      totalInstallments:
        (payload.total_installments as number) ?? existing.total_installments,
    };

    // Checked before the loans row is written, not after: rejecting inside
    // regenerateUnpaidSchedule would leave total_installments already saved
    // with no matching schedule regenerated behind it.
    if (scheduleChanged) {
      const conflict = await findScheduleConflict(id, scheduleTerms.totalInstallments);
      if (conflict) return apiError(conflict, 400);
    }

    payload.updated_by = authUser.id;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from("loans").update(payload).eq("id", id);
    if (error) return serverError(error);

    if (scheduleChanged) {
      const regenError = await regenerateUnpaidSchedule(id, scheduleTerms);
      if (regenError) return serverError(regenError, { operation: "loan schedule regeneration", loan_id: id });
    }

    after(async () => {
      await logActivity({
        action: "UPDATE_LOAN",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loans",
        recordId: id,
        details: { changes: payload, schedule_regenerated: scheduleChanged },
      });
    });

    return apiSuccess({ loan: { id } }, "Loan updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

/**
 * Installments still genuinely settled by a real payment — a reversed
 * payment's installment_id doesn't count, and neither does the reversal row
 * itself (it carries the same installment_id as what it reverses). Without
 * this, paying an installment and then reversing that payment leaves it
 * permanently "protected" from schedule regeneration even though it's
 * unpaid again, the same effective-entries exclusion fundings.utils.ts
 * already applies to its own ledger.
 */
async function getProtectedInstallmentIds(loanId: number): Promise<Set<number>> {
  const { data: touched } = await supabaseAdmin
    .from("loan_payments")
    .select("id, installment_id, reverses_payment_id")
    .eq("loan_id", loanId)
    .not("installment_id", "is", null);

  const rows = touched ?? [];
  const reversedIds = new Set(
    rows
      .map((row) => row.reverses_payment_id as number | null)
      .filter((id): id is number => id != null),
  );

  return new Set(
    rows
      .filter((row) => row.reverses_payment_id == null && !reversedIds.has(row.id as number))
      .map((row) => row.installment_id as number),
  );
}

/**
 * Returns an error message if `totalInstallments` would leave an
 * already-paid-against installment beyond the end of the schedule, or null
 * if the regeneration is safe to run. Must be checked (and the loans row
 * left unwritten on conflict) before regenerateUnpaidSchedule runs, since a
 * rejection discovered mid-regeneration would leave total_installments
 * already saved with no matching schedule behind it.
 */
async function findScheduleConflict(
  loanId: number,
  totalInstallments: number,
): Promise<string | null> {
  const protectedIds = await getProtectedInstallmentIds(loanId);
  if (protectedIds.size === 0) return null;

  const { data: current } = await supabaseAdmin
    .from("loan_installments")
    .select("id, installment_no")
    .eq("loan_id", loanId)
    .in("id", [...protectedIds]);

  const maxKept = (current ?? []).reduce(
    (max, row) => Math.max(max, row.installment_no as number),
    0,
  );

  if (maxKept > totalInstallments) {
    return `Cannot reduce total installments to ${totalInstallments}: installment #${maxKept} already has a payment recorded against it.`;
  }
  return null;
}

/**
 * Rebuilds the schedule after a terms change, leaving anything already paid
 * against alone — rewriting a settled installment would orphan its payment and
 * silently change history.
 */
async function regenerateUnpaidSchedule(
  loanId: number,
  terms: {
    firstEmiDate: string;
    emiDayOfMonth: number;
    emiAmount: number;
    totalInstallments: number;
  },
): Promise<Error | null> {
  const protectedIds = await getProtectedInstallmentIds(loanId);

  const { data: current } = await supabaseAdmin
    .from("loan_installments")
    .select("id, installment_no")
    .eq("loan_id", loanId);

  const keptNumbers = new Set(
    (current ?? [])
      .filter((row) => protectedIds.has(row.id as number))
      .map((row) => row.installment_no as number),
  );

  const removable = (current ?? [])
    .filter((row) => !protectedIds.has(row.id as number))
    .map((row) => row.id as number);

  if (removable.length > 0) {
    const { error } = await supabaseAdmin
      .from("loan_installments")
      .delete()
      .in("id", removable);
    if (error) return error as unknown as Error;
  }

  const rows = generateSchedule(terms)
    .filter((row) => !keptNumbers.has(row.installment_no))
    .map((row) => ({ ...row, loan_id: loanId }));

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from("loan_installments").insert(rows);
    if (error) return error as unknown as Error;
  }

  return null;
}

// ─── DELETE — remove a loan and everything under it ───

export async function DELETE(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = Number(idParam);

    if (!idParam || !Number.isFinite(id)) {
      return apiError("Missing loan ID", 400);
    }

    const { data: loan, error: fetchErr } = await supabaseAdmin
      .from("loans")
      .select("id, loan_type, loan_number")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!loan) return apiError("Loan not found", 404);

    // A funding raised against this loan would be orphaned, so it blocks.
    const { count: fundingCount } = await supabaseAdmin
      .from("fundings")
      .select("id", { count: "exact", head: true })
      .eq("linked_loan_id", id);

    if ((fundingCount ?? 0) > 0) {
      return apiError(
        `Cannot delete this loan because ${fundingCount} private funding(s) are linked to it. Unlink those first.`,
        400,
      );
    }

    // Payments cascade via the FK (sql/31_add_loans.sql) — deleting a loan
    // with recorded payments would erase that ledger, which the append-only
    // invariant exists to prevent. Mark it CLOSED/FORECLOSED/DEFAULTED instead.
    const { count: paymentCount } = await supabaseAdmin
      .from("loan_payments")
      .select("id", { count: "exact", head: true })
      .eq("loan_id", id);

    if ((paymentCount ?? 0) > 0) {
      return apiError(
        `Cannot delete this loan because it has ${paymentCount} recorded payment(s). Mark it CLOSED, FORECLOSED, or DEFAULTED instead to keep the payment history.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("loans").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_LOAN",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loans",
        recordId: id,
        details: { loan_type: loan.loan_type, loan_number: loan.loan_number },
      });
    });

    return apiSuccess(null, "Loan deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
