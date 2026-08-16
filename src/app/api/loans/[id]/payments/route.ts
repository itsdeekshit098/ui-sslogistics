import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import {
  INSTALLMENT_MANUAL_STATUSES,
  PAYMENT_TYPES,
  isPositiveNumber,
  isValidDateString,
} from "../../loans.utils";

// Records what actually happened against a loan: an EMI settled, a prepayment,
// a foreclosure, a bounce charge. Append-only — nothing here is ever edited or
// deleted, corrections go through the reverse endpoint.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const loanId = Number(idParam);
    if (!Number.isFinite(loanId)) {
      return apiError("Invalid loan ID", 400);
    }

    const body = (await req.json()) as Record<string, unknown>;

    const { data: loan, error: loanErr } = await supabaseAdmin
      .from("loans")
      .select("id, status")
      .eq("id", loanId)
      .maybeSingle();

    if (loanErr) return serverError(loanErr);
    if (!loan) return apiError("Loan not found", 404);

    const paymentType = String(body.payment_type ?? "EMI");
    if (!(PAYMENT_TYPES as readonly string[]).includes(paymentType)) {
      return apiError(
        `Invalid payment type. Allowed values: ${PAYMENT_TYPES.join(", ")}`,
        400,
      );
    }

    if (!isPositiveNumber(body.amount)) {
      return apiError("Amount must be greater than zero", 400);
    }
    const amount = Number(body.amount);

    const paidOn = body.paid_on ?? new Date().toISOString().slice(0, 10);
    if (!isValidDateString(paidOn)) {
      return apiError("Invalid payment date", 400);
    }

    let installmentId: number | null = null;

    if (paymentType === "EMI") {
      installmentId = Number(body.installment_id);
      if (!Number.isFinite(installmentId)) {
        return apiError("An EMI payment must say which installment it settles", 400);
      }

      // Read the derived state, not the raw row, so we know what is already
      // paid against this installment before allowing more.
      const { data: installment, error: instErr } = await supabaseAdmin
        .from("loan_installment_state")
        .select("id, loan_id, amount_due, amount_paid, amount_remaining, status")
        .eq("id", installmentId)
        .maybeSingle();

      if (instErr) return serverError(instErr);
      if (!installment) return apiError("Installment not found", 404);
      if (installment.loan_id !== loanId) {
        return apiError("That installment belongs to a different loan", 400);
      }
      if (installment.status === "PAID") {
        return apiError("This installment is already fully paid", 409);
      }
      if (installment.status === "WAIVED") {
        return apiError("This installment was waived and cannot be paid", 409);
      }
      // Overpaying an installment would misreport the loan; the surplus belongs
      // on a PREPAYMENT row instead, where it reduces the balance without
      // pretending the schedule changed.
      if (amount > Number(installment.amount_remaining)) {
        return apiError(
          `That is more than the ₹${Number(installment.amount_remaining).toLocaleString("en-IN")} still due on this installment. Record the extra as a prepayment.`,
          400,
        );
      }
    } else if (body.installment_id != null && body.installment_id !== "") {
      // Charges and prepayments may optionally cite an installment for context
      // (display only — loan_balances.total_paid already excludes CHARGE, and
      // sql/42_fix_charge_installment_state.sql excludes it from
      // loan_installment_state's amount_paid too). Still worth confirming the
      // installment is actually on this loan before attaching it.
      const parsed = Number(body.installment_id);
      if (!Number.isFinite(parsed)) {
        return apiError("Invalid installment ID", 400);
      }
      const { data: contextInstallment, error: contextErr } = await supabaseAdmin
        .from("loan_installments")
        .select("id, loan_id")
        .eq("id", parsed)
        .maybeSingle();
      if (contextErr) return serverError(contextErr);
      if (!contextInstallment) return apiError("Installment not found", 404);
      if (contextInstallment.loan_id !== loanId) {
        return apiError("That installment belongs to a different loan", 400);
      }
      installmentId = parsed;
    }

    const insertPayload = {
      loan_id: loanId,
      installment_id: installmentId,
      payment_type: paymentType,
      amount,
      paid_on: paidOn,
      payment_method: body.payment_method ? String(body.payment_method) : null,
      reference: body.reference ? String(body.reference).trim() : null,
      notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
      created_by: authUser.id,
    };

    const { data: payment, error } = await supabaseAdmin
      .from("loan_payments")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "CREATE_LOAN_PAYMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loan_payments",
        recordId: payment.id,
        details: { loan_id: loanId, payment_type: paymentType, amount, paid_on: paidOn },
      });
    });

    return apiSuccess({ payment }, "Payment recorded", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

// ─── PUT — flag an installment as bounced or waived ───
// These are states no payment row can express: the mandate failed, or the
// lender let it go. Kept on the installment as an explicit override rather than
// inferred, and clearable by sending null.

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const loanId = Number(idParam);
    if (!Number.isFinite(loanId)) {
      return apiError("Invalid loan ID", 400);
    }

    const body = (await req.json()) as Record<string, unknown>;

    const installmentId = Number(body.installment_id);
    if (!Number.isFinite(installmentId)) {
      return apiError("Missing installment ID", 400);
    }

    const manualStatus =
      body.manual_status == null || body.manual_status === ""
        ? null
        : String(body.manual_status);

    if (
      manualStatus !== null &&
      !(INSTALLMENT_MANUAL_STATUSES as readonly string[]).includes(manualStatus)
    ) {
      return apiError(
        `Invalid status. Allowed values: ${INSTALLMENT_MANUAL_STATUSES.join(", ")}`,
        400,
      );
    }

    const { data: installment, error: fetchErr } = await supabaseAdmin
      .from("loan_installments")
      .select("id, loan_id")
      .eq("id", installmentId)
      .maybeSingle();

    if (fetchErr) return serverError(fetchErr);
    if (!installment) return apiError("Installment not found", 404);
    if (installment.loan_id !== loanId) {
      return apiError("That installment belongs to a different loan", 400);
    }

    const { data, error } = await supabaseAdmin
      .from("loan_installments")
      .update({
        manual_status: manualStatus,
        notes: body.notes !== undefined ? String(body.notes ?? "").trim() || null : undefined,
      })
      .eq("id", installmentId)
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "UPDATE_LOAN_INSTALLMENT",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "loan_installments",
        recordId: installmentId,
        details: { loan_id: loanId, manual_status: manualStatus },
      });
    });

    return apiSuccess({ installment: data }, "Installment updated", 200);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
