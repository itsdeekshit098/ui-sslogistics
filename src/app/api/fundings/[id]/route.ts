import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { computeFunding, type FundingEntry, type FundingRate } from "../fundings.utils";

// One funding in full: the arrangement, its rate history, every entry, and the
// computed interest position including the month-by-month breakdown that shows
// how the accrual was arrived at.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return apiError("Invalid funding ID", 400);
    }

    const { data: funding, error } = await supabaseAdmin
      .from("fundings")
      .select(
        `*,
         lenders:funder_id (id, name, lender_kind, phone, contact_person),
         borrower:borrower_entity_id (id, name, entity_kind),
         counterparty:counterparty_entity_id (id, name, entity_kind),
         loans:linked_loan_id (id, loan_type, loan_number)`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(error);
    if (!funding) return apiError("Funding not found", 404);

    const [{ data: entries, error: entriesErr }, { data: rates, error: ratesErr }] =
      await Promise.all([
        supabaseAdmin
          .from("funding_entries")
          .select("*")
          .eq("funding_id", id)
          .order("entry_date", { ascending: false })
          .order("id", { ascending: false }),
        supabaseAdmin
          .from("funding_rate_history")
          .select("*")
          .eq("funding_id", id)
          .order("effective_from", { ascending: true }),
      ]);

    if (entriesErr) return serverError(entriesErr);
    if (ratesErr) return serverError(ratesErr);

    const computed = computeFunding({
      entries: (entries ?? []) as unknown as FundingEntry[],
      rates: (rates ?? []) as unknown as FundingRate[],
      interestMode: funding.interest_mode,
    });

    // Reversal state is derived, so a struck-through row can't disagree with
    // what the balance actually counted.
    const reversedIds = new Set(
      (entries ?? [])
        .map((e) => e.reverses_entry_id as number | null)
        .filter((value): value is number => value != null),
    );

    const entriesWithState = (entries ?? []).map((entry) => ({
      ...entry,
      is_reversed: reversedIds.has(entry.id as number),
      is_reversal: entry.reverses_entry_id != null,
    }));

    return apiSuccess({
      funding,
      rates: rates ?? [],
      entries: entriesWithState,
      computed,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
