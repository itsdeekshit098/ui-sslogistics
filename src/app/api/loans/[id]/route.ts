import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";

// One loan in full: terms, the derived balance, every installment with its
// effective status, and the payment log. Loaded whole because a loan's schedule
// is bounded (a few dozen rows, capped at 600 installments by the create
// validation) — unlike the client statement, which grows without limit and is
// paginated.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return apiError("Invalid loan ID", 400);
    }

    const { data: loan, error } = await supabaseAdmin
      .from("loans")
      .select(
        `
        *,
        entities:borrower_entity_id (id, name, entity_kind, relationship),
        lenders:lender_id (id, name, lender_kind, phone, contact_person),
        vehicles:vehicle_id (id, vehicle_number, vehicle_type, company, model),
        bank_accounts:debit_account_id (id, bank_name, account_number, account_type, nickname, entities:holder_entity_id (name))
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) return serverError(error);
    if (!loan) return apiError("Loan not found", 404);

    const [
      { data: balance },
      { data: installments, error: installmentsErr },
      { data: payments, error: paymentsErr },
    ] = await Promise.all([
      supabaseAdmin.from("loan_balances").select("*").eq("loan_id", id).maybeSingle(),
      supabaseAdmin
        .from("loan_installment_state")
        .select("*")
        .eq("loan_id", id)
        .order("installment_no", { ascending: true }),
      supabaseAdmin
        .from("loan_payments")
        .select("*")
        .eq("loan_id", id)
        .order("paid_on", { ascending: false })
        .order("id", { ascending: false }),
    ]);

    if (installmentsErr) return serverError(installmentsErr);
    if (paymentsErr) return serverError(paymentsErr);

    // A payment is shown struck through once something reverses it. Derived
    // here rather than stored, so it can't fall out of step with the rows.
    const reversedIds = new Set(
      (payments ?? [])
        .map((p) => p.reverses_payment_id as number | null)
        .filter((value): value is number => value != null),
    );

    const paymentsWithState = (payments ?? []).map((payment) => ({
      ...payment,
      is_reversed: reversedIds.has(payment.id as number),
      is_reversal: payment.reverses_payment_id != null,
    }));

    return apiSuccess({
      loan,
      balance: balance ?? null,
      installments: installments ?? [],
      payments: paymentsWithState,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
