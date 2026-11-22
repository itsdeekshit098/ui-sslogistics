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
import {
  DB_FUNDING_SORTS,
  FUNDING_SORTS,
  INTEREST_MODES,
  MAX_MONTHLY_INTEREST_RATE,
  ROI_BASES,
  computeFunding,
  rateMessage,
  sortFundings,
  type FundingSort,
  type FundingEntry,
  type FundingRate,
} from "./fundings.utils";
import {
  isValidDateString,
  MAX_INTEREST_RATE,
  MAX_LOAN_AMOUNT,
  moneyMessage,
  moneyProblem,
  optionalText,
  parseId,
} from "../loans/loans.utils";

const FUNDING_DIRECTIONS = ["BORROWED", "LENT"] as const;
const FUNDING_STATUSES = ["OPEN", "SETTLED"] as const;

type ReferenceTable = "lenders" | "entities" | "loans";

/** Whether a row exists, so a bad reference is a 400 and not a foreign-key 500. */
async function referenceExists(table: ReferenceTable, id: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from(table).select("id").eq("id", id).maybeSingle();
  // A failed lookup is a server problem, not "no longer exists"; the route's
  // catch turns the throw into a 500.
  if (error) throw error;
  return Boolean(data);
}

// Private / hand loans. Same access rule as /api/loans — admin/superadmin on
// every method, GET included.
//
// Interest is never stored; each row's figures come from computeFunding()
// (fundings.utils.ts) over that funding's entries and rate history.

const FUNDING_SELECT = `
  id, funder_id, borrower_entity_id, counterparty_entity_id, direction,
  linked_loan_id, interest_mode,
  interest_due_day, start_date, status, settled_on, notes, created_at, updated_at,
  lenders:funder_id (id, name, lender_kind, phone),
  borrower:borrower_entity_id (id, name, entity_kind),
  counterparty:counterparty_entity_id (id, name, entity_kind),
  loans:linked_loan_id (id, loan_type, loan_number)
`;

interface FundingRow {
  id: number;
  interest_mode: "PERCENT" | "FIXED";
}

/**
 * Computes interest for a set of fundings using two bulk reads rather than a
 * query pair per row.
 */
export async function computeForFundings(fundings: FundingRow[]) {
  const ids = fundings.map((f) => f.id);
  if (ids.length === 0) {
    return {
      computed: new Map<number, ReturnType<typeof computeFunding>>(),
      ratesByFunding: new Map<number, FundingRate[]>(),
    };
  }

  const [{ data: entries }, { data: rates }] = await Promise.all([
    supabaseAdmin
      .from("funding_entries")
      .select("id, funding_id, entry_type, amount, entry_date, reverses_entry_id")
      .in("funding_id", ids),
    supabaseAdmin
      .from("funding_rate_history")
      .select("funding_id, roi, roi_basis, fixed_interest_amount, effective_from")
      .in("funding_id", ids)
      .order("effective_from", { ascending: true }),
  ]);

  const entriesByFunding = new Map<number, FundingEntry[]>();
  for (const entry of entries ?? []) {
    const list = entriesByFunding.get(entry.funding_id as number) ?? [];
    list.push(entry as unknown as FundingEntry);
    entriesByFunding.set(entry.funding_id as number, list);
  }

  const ratesByFunding = new Map<number, FundingRate[]>();
  for (const rate of rates ?? []) {
    const list = ratesByFunding.get(rate.funding_id as number) ?? [];
    list.push(rate as unknown as FundingRate);
    ratesByFunding.set(rate.funding_id as number, list);
  }

  const result = new Map<number, ReturnType<typeof computeFunding>>();
  for (const funding of fundings) {
    result.set(
      funding.id,
      computeFunding({
        entries: entriesByFunding.get(funding.id) ?? [],
        rates: ratesByFunding.get(funding.id) ?? [],
        interestMode: funding.interest_mode,
      }),
    );
  }

  return { computed: result, ratesByFunding };
}

/**
 * Portfolio totals for the summary strip, scoped to the same filters as the
 * list query but across every matching row, not just the current page —
 * mirrors buildSummary() in loans/route.ts, which exists for the identical
 * reason (a page-scoped client-side sum understates the true total once a
 * filtered list exceeds one page).
 */
async function buildFundingSummary(filters: {
  status: string;
  funderId: number | null;
  loanId: number | null;
  direction: string;
}) {
  let query = supabaseAdmin.from("fundings").select("id, interest_mode, status");
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.funderId) query = query.eq("funder_id", filters.funderId);
  if (filters.loanId) query = query.eq("linked_loan_id", filters.loanId);
  if (filters.direction) query = query.eq("direction", filters.direction);

  const { data, error } = await query;
  if (error) return { principalOutstanding: 0, interestDue: 0, openCount: 0 };

  const rows = data ?? [];
  const { computed } = await computeForFundings(rows as unknown as FundingRow[]);

  let principalOutstanding = 0;
  let interestDue = 0;
  let openCount = 0;
  for (const row of rows) {
    const c = computed.get(row.id as number);
    if (c) {
      principalOutstanding += c.principal_outstanding;
      interestDue += c.interest_due;
    }
    if (row.status === "OPEN") openCount += 1;
  }
  return { principalOutstanding, interestDue, openCount };
}

// ─── GET — list ───

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim() ?? "";
    const funderIdParam = searchParams.get("funder_id");
    const loanIdParam = searchParams.get("loan_id");
    // An empty value means "no filter"; anything else must be a real id, or the
    // database rejects it as an integer-syntax error and the list returns 500.
    const funderId = funderIdParam ? parseId(funderIdParam) : null;
    const loanId = loanIdParam ? parseId(loanIdParam) : null;
    if (funderIdParam && funderId === null) return apiError("Invalid funder_id", 400);
    if (loanIdParam && loanId === null) return apiError("Invalid loan_id", 400);
    const direction = searchParams.get("direction")?.trim() ?? "";
    // A made-up value used to return an empty list, which looks like "no
    // fundings" rather than "that filter doesn't exist".
    if (status && !FUNDING_STATUSES.includes(status as (typeof FUNDING_STATUSES)[number])) {
      return apiError(`Invalid status. Allowed values: ${FUNDING_STATUSES.join(", ")}`, 400);
    }
    if (direction && !FUNDING_DIRECTIONS.includes(direction as (typeof FUNDING_DIRECTIONS)[number])) {
      return apiError(`Invalid direction. Allowed values: ${FUNDING_DIRECTIONS.join(", ")}`, 400);
    }
    const includeSummary = searchParams.get("include_summary") === "true";
    const sortParam = searchParams.get("sort")?.trim() || "newest";
    if (!(FUNDING_SORTS as readonly string[]).includes(sortParam)) {
      return apiError(`Invalid sort. Allowed values: ${FUNDING_SORTS.join(", ")}`, 400);
    }
    const sort = sortParam as FundingSort;
    // Principal, rate and interest are computed per request, so the database
    // can't order by them: those sorts load every matching funding, compute,
    // sort, then cut out the page. There are tens of fundings, not thousands.
    const sortInDb = DB_FUNDING_SORTS.includes(sort);

    const { from, to } = parsePageParams(searchParams, {
      defaultPageSize: 10,
      maxPageSize: 200,
    });

    let query = supabaseAdmin
      .from("fundings")
      .select(FUNDING_SELECT, { count: "exact" })
      .order("start_date", { ascending: sort === "oldest" })
      .order("id", { ascending: sort === "oldest" });

    if (status) query = query.eq("status", status);
    if (funderId) query = query.eq("funder_id", funderId);
    if (loanId) query = query.eq("linked_loan_id", loanId);
    if (direction) query = query.eq("direction", direction);

    if (sortInDb) query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) return serverError(error);

    const rows = data ?? [];
    const { computed, ratesByFunding } = await computeForFundings(
      rows as unknown as FundingRow[],
    );

    // The current rate is what the list column shows; the full history lives
    // on the detail route. ratesByFunding is ordered by effective_from
    // ascending, so the last entry is the one in force now.
    const withComputed = rows.map((row) => {
      const rates = ratesByFunding.get(row.id as number) ?? [];
      return {
        ...row,
        computed: computed.get(row.id as number) ?? null,
        current_rate: rates.length > 0 ? rates[rates.length - 1] : null,
      };
    });
    const enriched = sortInDb
      ? withComputed
      : sortFundings(withComputed, sort).slice(from, to + 1);

    const summary = includeSummary
      ? await buildFundingSummary({ status, funderId, loanId, direction })
      : undefined;

    return apiSuccess({ data: enriched, total: count ?? enriched.length, summary });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── POST — create ───

export async function POST(req: Request) {
  try {
    const authUser = await requireStrictAdminAuth();
    const body = await readJsonObject(req);
    if (!body) return apiError("Request body must be a JSON object", 400);

    const direction = String(body.direction ?? "BORROWED");
    if (!FUNDING_DIRECTIONS.includes(direction as (typeof FUNDING_DIRECTIONS)[number])) {
      return apiError(
        `Invalid direction. Allowed values: ${FUNDING_DIRECTIONS.join(", ")}`,
        400,
      );
    }

    let funderId: number | null = null;
    let counterpartyEntityId: number | null = null;

    if (direction === "BORROWED") {
      funderId = parseId(body.funder_id);
      if (funderId === null) {
        return apiError("Funder is required", 400);
      }
      if (!(await referenceExists("lenders", funderId))) {
        return apiError("Selected funder no longer exists", 400);
      }
    } else {
      counterpartyEntityId = parseId(body.counterparty_entity_id);
      if (counterpartyEntityId === null) {
        return apiError("Borrower is required", 400);
      }
      if (!(await referenceExists("entities", counterpartyEntityId))) {
        return apiError("Selected borrower no longer exists", 400);
      }
    }

    if (!isValidDateString(body.start_date)) {
      return apiError("Start date is required", 400);
    }

    const interestMode = String(body.interest_mode ?? "PERCENT");
    if (!(INTEREST_MODES as readonly string[]).includes(interestMode)) {
      return apiError(
        `Invalid interest mode. Allowed values: ${INTEREST_MODES.join(", ")}`,
        400,
      );
    }

    // The opening rate and the opening principal are what make a funding
    // meaningful, so both are captured on creation rather than left for a
    // second step the user might not take.
    const amountProblem = moneyProblem(body.amount, { max: MAX_LOAN_AMOUNT });
    if (amountProblem) {
      return apiError(
        moneyMessage(
          amountProblem,
          direction === "LENT"
            ? "Amount lent must be greater than zero"
            : "Amount borrowed must be greater than zero",
        ),
        400,
      );
    }
    const amount = body.amount as number;

    let roi: number | null = null;
    let roiBasis: string | null = null;
    let fixedAmount: number | null = null;

    if (interestMode === "PERCENT") {
      const roiBasisCandidate = String(body.roi_basis ?? "MONTHLY");
      if (!(ROI_BASES as readonly string[]).includes(roiBasisCandidate)) {
        return apiError(`Invalid ROI basis. Allowed values: ${ROI_BASES.join(", ")}`, 400);
      }
      const roiProblem = moneyProblem(body.roi, {
        allowZero: true,
        max: roiBasisCandidate === "ANNUAL" ? MAX_INTEREST_RATE : MAX_MONTHLY_INTEREST_RATE,
      });
      if (roiProblem) {
        return apiError(rateMessage(roiProblem, roiBasisCandidate as "MONTHLY" | "ANNUAL"), 400);
      }
      roi = body.roi as number;
      roiBasis = roiBasisCandidate;
    } else {
      const fixedProblem = moneyProblem(body.fixed_interest_amount, {
        allowZero: true,
        max: MAX_LOAN_AMOUNT,
      });
      if (fixedProblem) {
        return apiError(
          moneyMessage(fixedProblem, "Fixed monthly interest amount is required"),
          400,
        );
      }
      fixedAmount = body.fixed_interest_amount as number;
    }

    let interestDueDay: number | null = null;
    if (body.interest_due_day != null && body.interest_due_day !== "") {
      const day = Number(body.interest_due_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return apiError("Interest due day must be between 1 and 31", 400);
      }
      interestDueDay = day;
    }

    let borrowerEntityId: number | null = null;
    if (body.borrower_entity_id != null && body.borrower_entity_id !== "") {
      borrowerEntityId = parseId(body.borrower_entity_id);
      if (borrowerEntityId === null) return apiError("Invalid borrower", 400);
      if (!(await referenceExists("entities", borrowerEntityId))) {
        return apiError("Selected borrower no longer exists", 400);
      }
    }

    let linkedLoanId: number | null = null;
    if (body.linked_loan_id != null && body.linked_loan_id !== "") {
      linkedLoanId = parseId(body.linked_loan_id);
      if (linkedLoanId === null) return apiError("Invalid linked loan", 400);
      if (!(await referenceExists("loans", linkedLoanId))) {
        return apiError("Selected loan no longer exists", 400);
      }
    }

    const notes = optionalText(body.notes, 500);
    if ("error" in notes) {
      return apiError(
        notes.error === "too_long" ? "Notes must be 500 characters or less" : "Notes must be text",
        400,
      );
    }

    const insertPayload = {
      direction,
      funder_id: funderId,
      counterparty_entity_id: counterpartyEntityId,
      borrower_entity_id: borrowerEntityId,
      linked_loan_id: linkedLoanId,
      interest_mode: interestMode,
      interest_due_day: interestDueDay,
      start_date: body.start_date,
      notes: notes.value,
      created_by: authUser.id,
    };

    const { data: funding, error } = await supabaseAdmin
      .from("fundings")
      .insert([insertPayload])
      .select("id")
      .single();

    if (error) return serverError(error);

    // A funding with no opening rate or no principal computes to nothing, so a
    // partial insert is rolled back rather than left as a confusing empty row.
    const { error: rateError } = await supabaseAdmin
      .from("funding_rate_history")
      .insert([
        {
          funding_id: funding.id,
          roi,
          roi_basis: roiBasis,
          fixed_interest_amount: fixedAmount,
          effective_from: body.start_date,
          note: "Opening rate",
          created_by: authUser.id,
        },
      ]);

    if (rateError) {
      await supabaseAdmin.from("fundings").delete().eq("id", funding.id);
      return serverError(rateError, { operation: "funding opening rate", funding_id: funding.id });
    }

    const { error: entryError } = await supabaseAdmin.from("funding_entries").insert([
      {
        funding_id: funding.id,
        entry_type: "PRINCIPAL_TAKEN",
        amount,
        entry_date: body.start_date,
        description: direction === "LENT" ? "Amount lent" : "Amount borrowed",
        created_by: authUser.id,
      },
    ]);

    if (entryError) {
      await supabaseAdmin.from("fundings").delete().eq("id", funding.id);
      return serverError(entryError, { operation: "funding opening principal", funding_id: funding.id });
    }

    after(async () => {
      await logActivity({
        action: "CREATE_FUNDING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "fundings",
        recordId: funding.id,
        details: { direction, funder_id: funderId, amount, interest_mode: interestMode, roi },
      });
    });

    return apiSuccess({ funding: { id: funding.id } }, "Funding added", 201);
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
      return apiError("Missing funding ID", 400);
    }

    const payload: Record<string, unknown> = {};

    if (body.funder_id !== undefined) {
      const funderId = parseId(body.funder_id);
      if (funderId === null) return apiError("Invalid funder", 400);
      if (!(await referenceExists("lenders", funderId))) {
        return apiError("Selected funder no longer exists", 400);
      }
      payload.funder_id = funderId;
    }

    if (body.borrower_entity_id !== undefined) {
      if (body.borrower_entity_id == null || body.borrower_entity_id === "") {
        payload.borrower_entity_id = null;
      } else {
        const borrowerId = parseId(body.borrower_entity_id);
        if (borrowerId === null) return apiError("Invalid borrower", 400);
        if (!(await referenceExists("entities", borrowerId))) {
          return apiError("Selected borrower no longer exists", 400);
        }
        payload.borrower_entity_id = borrowerId;
      }
    }

    if (body.counterparty_entity_id !== undefined) {
      if (body.counterparty_entity_id == null || body.counterparty_entity_id === "") {
        payload.counterparty_entity_id = null;
      } else {
        const counterpartyId = parseId(body.counterparty_entity_id);
        if (counterpartyId === null) return apiError("Invalid borrower", 400);
        if (!(await referenceExists("entities", counterpartyId))) {
          return apiError("Selected borrower no longer exists", 400);
        }
        payload.counterparty_entity_id = counterpartyId;
      }
    }

    if (body.linked_loan_id !== undefined) {
      if (body.linked_loan_id == null || body.linked_loan_id === "") {
        payload.linked_loan_id = null;
      } else {
        const loanId = parseId(body.linked_loan_id);
        if (loanId === null) return apiError("Invalid linked loan", 400);
        if (!(await referenceExists("loans", loanId))) {
          return apiError("Selected loan no longer exists", 400);
        }
        payload.linked_loan_id = loanId;
      }
    }

    if (body.interest_due_day !== undefined) {
      if (body.interest_due_day == null || body.interest_due_day === "") {
        payload.interest_due_day = null;
      } else {
        const day = Number(body.interest_due_day);
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          return apiError("Interest due day must be between 1 and 31", 400);
        }
        payload.interest_due_day = day;
      }
    }

    if (body.status !== undefined) {
      const status = String(body.status);
      if (!(FUNDING_STATUSES as readonly string[]).includes(status)) {
        return apiError(`Invalid status. Allowed values: ${FUNDING_STATUSES.join(", ")}`, 400);
      }
      payload.status = status;
      // Settling without a date leaves the arrangement's end unrecorded.
      if (status === "SETTLED") {
        const settledOn = body.settled_on ?? todayInIndia();
        if (!isValidDateString(settledOn)) {
          return apiError("Invalid settlement date", 400);
        }
        payload.settled_on = settledOn;
      } else {
        payload.settled_on = null;
      }
    }

    if (body.notes !== undefined) {
      const notes = optionalText(body.notes, 500);
      if ("error" in notes) {
        return apiError(
          notes.error === "too_long" ? "Notes must be 500 characters or less" : "Notes must be text",
          400,
        );
      }
      payload.notes = notes.value;
    }

    // interest_mode is deliberately not updatable: it changes how every past
    // day is charged. Recording a new rate row is the supported path.
    if (Object.keys(payload).length === 0) {
      return apiError("No fields to update", 400);
    }

    payload.updated_by = authUser.id;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("fundings")
      .update(payload)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) return serverError(error);
    if (!data) return apiError("Funding not found", 404);

    after(async () => {
      await logActivity({
        action: "UPDATE_FUNDING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "fundings",
        recordId: id,
        details: { changes: payload },
      });
    });

    return apiSuccess({ funding: { id } }, "Funding updated", 200);
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
      return apiError("Missing funding ID", 400);
    }

    const { data: funding, error: fetchErr } = await supabaseAdmin
      .from("fundings")
      .select("id, funder_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!funding) return apiError("Funding not found", 404);

    // Entries cascade via the FK (sql/32_add_fundings.sql) — deleting a
    // funding with recorded entries would erase that ledger, which the
    // append-only invariant exists to prevent. Mark it SETTLED instead.
    const { count: entryCount } = await supabaseAdmin
      .from("funding_entries")
      .select("id", { count: "exact", head: true })
      .eq("funding_id", id);

    if ((entryCount ?? 0) > 0) {
      return apiError(
        `Cannot delete this funding because it has ${entryCount} recorded entr${entryCount === 1 ? "y" : "ies"}. Mark it SETTLED instead to keep the ledger.`,
        400,
      );
    }

    const { error } = await supabaseAdmin.from("fundings").delete().eq("id", id);
    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "DELETE_FUNDING",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "fundings",
        recordId: id,
        details: { funder_id: funding.funder_id },
      });
    });

    return apiSuccess(null, "Funding deleted", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
