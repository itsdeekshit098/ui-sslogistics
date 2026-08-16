import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { FUNDING_ENTRY_TYPES } from "../../fundings.utils";
import { isPositiveNumber, isValidDateString } from "../../../loans/loans.utils";

// Money moving on a private funding: more borrowed, principal returned,
// interest handed over, or an agreed write-off. Append-only — a mistake is
// undone through the reverse endpoint, never by editing.

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
      .select("id, start_date, status")
      .eq("id", fundingId)
      .maybeSingle();

    if (fundingErr) return serverError(fundingErr);
    if (!funding) return apiError("Funding not found", 404);

    const entryType = String(body.entry_type ?? "");
    if (!(FUNDING_ENTRY_TYPES as readonly string[]).includes(entryType)) {
      return apiError(
        `Invalid entry type. Allowed values: ${FUNDING_ENTRY_TYPES.join(", ")}`,
        400,
      );
    }

    if (!isPositiveNumber(body.amount)) {
      return apiError("Amount must be greater than zero", 400);
    }
    const amount = Number(body.amount);

    const entryDate = body.entry_date ?? new Date().toISOString().slice(0, 10);
    if (!isValidDateString(entryDate)) {
      return apiError("Invalid entry date", 400);
    }
    // Interest is accrued from the first principal entry onward, so an entry
    // before the funding began would be charged at a rate that didn't exist.
    if (entryDate < funding.start_date) {
      return apiError("Entry date cannot be before the funding start date", 400);
    }

    // Repaying more principal than is outstanding would drive the balance
    // negative and quietly stop interest accruing.
    if (entryType === "PRINCIPAL_REPAID" || entryType === "ADJUSTMENT") {
      const { data: balance } = await supabaseAdmin
        .from("funding_balances")
        .select("principal_outstanding")
        .eq("funding_id", fundingId)
        .maybeSingle();

      const outstanding = Number(balance?.principal_outstanding ?? 0);
      if (amount > outstanding) {
        return apiError(
          `That is more than the ₹${outstanding.toLocaleString("en-IN")} principal still outstanding.`,
          400,
        );
      }
    }

    const insertPayload = {
      funding_id: fundingId,
      entry_type: entryType,
      amount,
      entry_date: entryDate,
      payment_method: body.payment_method ? String(body.payment_method) : null,
      reference: body.reference ? String(body.reference).trim() : null,
      description: body.description ? String(body.description).trim().slice(0, 300) : null,
      created_by: authUser.id,
    };

    const { data: entry, error } = await supabaseAdmin
      .from("funding_entries")
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) return serverError(error);

    after(async () => {
      await logActivity({
        action: "CREATE_FUNDING_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "funding_entries",
        recordId: entry.id,
        details: { funding_id: fundingId, entry_type: entryType, amount, entry_date: entryDate },
      });
    });

    return apiSuccess({ entry }, "Entry recorded", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
