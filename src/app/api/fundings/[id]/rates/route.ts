import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { MAX_MONTHLY_INTEREST_RATE, ROI_BASES } from "../../fundings.utils";
import {
  isValidDateString,
  MAX_INTEREST_RATE,
  MAX_LOAN_AMOUNT,
  moneyMessage,
  moneyProblem,
} from "../../../loans/loans.utils";

// Records a renegotiated rate from a given date. Rates are never edited in
// place: interest already accrued at the old rate has to stay accrued at the
// old rate, so a change is a new row with its own effective_from and the
// engine charges each day at whatever was in force that day.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam } = await params;
    const fundingId = Number(idParam);
    if (!Number.isFinite(fundingId)) {
      return apiError("Invalid funding ID", 400);
    }

    const body = (await req.json()) as Record<string, unknown>;

    const { data: funding, error: fundingErr } = await supabaseAdmin
      .from("fundings")
      .select("id, interest_mode, start_date")
      .eq("id", fundingId)
      .maybeSingle();

    if (fundingErr) return serverError(fundingErr);
    if (!funding) return apiError("Funding not found", 404);

    const effectiveFrom = body.effective_from;
    if (!isValidDateString(effectiveFrom)) {
      return apiError("Effective-from date is required", 400);
    }
    if (effectiveFrom < funding.start_date) {
      return apiError("A rate cannot take effect before the funding started", 400);
    }

    let roi: number | null = null;
    let roiBasis: string | null = null;
    let fixedAmount: number | null = null;

    // Which fields are required follows the funding's own mode — a percentage
    // on a fixed-amount arrangement would simply never be read.
    if (funding.interest_mode === "PERCENT") {
      // Same limits as creating the funding (POST /api/fundings), so a rate
      // change can't store what the opening rate would have refused.
      const roiBasisCandidate = String(body.roi_basis ?? "MONTHLY");
      if (!(ROI_BASES as readonly string[]).includes(roiBasisCandidate)) {
        return apiError(`Invalid ROI basis. Allowed values: ${ROI_BASES.join(", ")}`, 400);
      }
      const roiProblem = moneyProblem(body.roi, {
        allowZero: true,
        max: roiBasisCandidate === "ANNUAL" ? MAX_INTEREST_RATE : MAX_MONTHLY_INTEREST_RATE,
      });
      if (roiProblem) {
        return apiError(moneyMessage(roiProblem, "Rate of interest is required"), 400);
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

    const { data: rate, error } = await supabaseAdmin
      .from("funding_rate_history")
      .insert([
        {
          funding_id: fundingId,
          roi,
          roi_basis: roiBasis,
          fixed_interest_amount: fixedAmount,
          effective_from: effectiveFrom,
          note: body.note ? String(body.note).trim().slice(0, 200) : null,
          created_by: authUser.id,
        },
      ])
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiError("A rate already takes effect on that date", 409);
      }
      return serverError(error);
    }

    after(async () => {
      await logActivity({
        action: "CREATE_FUNDING_RATE_CHANGE",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "funding_rate_history",
        recordId: rate.id,
        details: { funding_id: fundingId, roi, roi_basis: roiBasis, effective_from: effectiveFrom },
      });
    });

    return apiSuccess({ rate }, "Rate change recorded", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
