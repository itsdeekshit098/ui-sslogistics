import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { isValidDateString } from "../loans.utils";

// Every EMI falling in a date window, grouped by day — "what is due on the
// 5th", "what does this month cost me". Defaults to the current month so the
// tab opens on something useful rather than an empty date picker.
//
// Anything already overdue is returned alongside the window regardless of its
// date: an EMI missed in March is still the most urgent thing on the page in
// May, and it would otherwise be invisible unless you knew to go looking.

/** First and last day of the month containing `date`, as YYYY-MM-DD. */
function monthBounds(date: Date): { from: string; to: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}

export async function GET(req: Request) {
  try {
    await requireStrictAdminAuth();

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const includeOverdue = searchParams.get("include_overdue") !== "false";

    const defaults = monthBounds(new Date());
    const from = fromParam && isValidDateString(fromParam) ? fromParam : defaults.from;
    const to = toParam && isValidDateString(toParam) ? toParam : defaults.to;

    if (to < from) {
      return apiError("End date cannot be before the start date", 400);
    }

    const today = new Date().toISOString().slice(0, 10);

    // Two reads rather than one .or(): the overdue set is unbounded in the past
    // and would otherwise force a full scan on every month change.
    const inWindow = supabaseAdmin
      .from("loan_installment_state")
      .select("*")
      .gte("due_date", from)
      .lte("due_date", to)
      .order("due_date", { ascending: true });

    const overdue = includeOverdue
      ? supabaseAdmin
          .from("loan_installment_state")
          .select("*")
          .lt("due_date", today)
          .in("status", ["OVERDUE", "BOUNCED"])
          .order("due_date", { ascending: true })
      : null;

    const [windowResult, overdueResult] = await Promise.all([
      inWindow,
      overdue ?? Promise.resolve({ data: [], error: null }),
    ]);

    if (windowResult.error) return serverError(windowResult.error);
    if (overdueResult.error) return serverError(overdueResult.error);

    // An overdue EMI inside the requested window would otherwise appear twice.
    const seen = new Set<number>();
    const installments = [...(overdueResult.data ?? []), ...(windowResult.data ?? [])]
      .filter((row) => {
        const id = row.id as number;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      // Settled rows are noise on a "what do I owe" screen.
      .filter((row) => row.status !== "PAID" && row.status !== "WAIVED");

    if (installments.length === 0) {
      return apiSuccess({ from, to, days: [], overdue: [], total_due: 0 });
    }

    // Attach who each EMI is owed to, in one query for the whole window.
    const loanIds = [...new Set(installments.map((row) => row.loan_id as number))];
    const { data: loans, error: loansErr } = await supabaseAdmin
      .from("loans")
      .select(
        `id, loan_type, loan_number, status,
         entities:borrower_entity_id (id, name),
         lenders:lender_id (id, name),
         vehicles:vehicle_id (id, vehicle_number)`,
      )
      .in("id", loanIds);

    if (loansErr) return serverError(loansErr);

    const loanById = new Map(loans?.map((loan) => [loan.id as number, loan]) ?? []);

    const enriched = installments
      // A closed loan's leftover schedule rows aren't owed any more.
      .filter((row) => loanById.get(row.loan_id as number)?.status === "ACTIVE")
      .map((row) => ({ ...row, loan: loanById.get(row.loan_id as number) ?? null }));

    const overdueRows = enriched.filter((row) => row.due_date < today);

    // Grouped server-side so every client renders the same day buckets and
    // totals rather than each re-deriving them.
    const byDate = new Map<string, typeof enriched>();
    for (const row of enriched) {
      const date = row.due_date as string;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(row);
    }

    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({
        date,
        is_overdue: date < today,
        total: rows.reduce((sum, row) => sum + Number(row.amount_remaining), 0),
        installments: rows,
      }));

    const totalDue = enriched.reduce(
      (sum, row) => sum + Number(row.amount_remaining),
      0,
    );

    return apiSuccess({
      from,
      to,
      days,
      overdue: overdueRows,
      total_due: totalDue,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
