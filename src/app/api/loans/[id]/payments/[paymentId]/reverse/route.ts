import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { reverseLedgerEntry } from "@/lib/ledgerReversal";

// Undoes a loan payment without deleting it. A new row is inserted pointing at
// the original; the balance views then exclude both — the one that was reversed
// and the one doing the reversing — so the pair nets to zero while the mistake
// and its correction both stay visible in the log.

type LoanPaymentRow = {
  id: number;
  loan_id: number;
  installment_id: number | null;
  payment_type: string;
  amount: number;
  reverses_payment_id: number | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam, paymentId: paymentIdParam } = await params;
    const loanId = Number(idParam);
    const paymentId = Number(paymentIdParam);

    if (!Number.isFinite(loanId) || !Number.isFinite(paymentId)) {
      return apiError("Invalid loan or payment ID", 400);
    }

    let reason = "";
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    } catch {
      // A reason is optional, so an empty body is fine.
    }

    const result = await reverseLedgerEntry<LoanPaymentRow>({
      table: "loan_payments",
      reversesColumn: "reverses_payment_id",
      ownerColumn: "loan_id",
      ownerId: loanId,
      entryId: paymentId,
      selectColumns: "id, loan_id, installment_id, payment_type, amount, reverses_payment_id",
      notFoundMessage: "Payment not found",
      ownerMismatchMessage: "That payment belongs to a different loan",
      alreadyReversedMessage: "This payment has already been reversed",
      buildInsertRow: (original) => ({
        loan_id: loanId,
        installment_id: original.installment_id,
        payment_type: original.payment_type,
        amount: original.amount,
        paid_on: new Date().toISOString().slice(0, 10),
        notes: reason
          ? `Reversal of #${paymentId}: ${reason}`
          : `Reversal of #${paymentId}`,
        reverses_payment_id: paymentId,
        created_by: authUser.id,
      }),
    });

    if (result.response) return result.response;
    const reversal = result.reversal;

    after(async () => {
      await logActivity({
        action: "REVERSE_LOAN_PAYMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loan_payments",
        recordId: reversal.id,
        details: { loan_id: loanId, reversed_payment_id: paymentId, reason },
      });
    });

    return apiSuccess({ payment: reversal }, "Payment reversed", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
