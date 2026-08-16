import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { reverseLedgerEntry } from "@/lib/ledgerReversal";

// Undoes a funding entry by inserting a row that points at it. Both are then
// excluded from the principal timeline and the interest computation, so the
// pair nets to zero and — crucially for a backdated entry — the accrual is
// recomputed as if it had never been made, rather than being patched forward.

type FundingEntryRow = {
  id: number;
  funding_id: number;
  entry_type: string;
  amount: number;
  entry_date: string;
  reverses_entry_id: number | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam, entryId: entryIdParam } = await params;
    const fundingId = Number(idParam);
    const entryId = Number(entryIdParam);

    if (!Number.isFinite(fundingId) || !Number.isFinite(entryId)) {
      return apiError("Invalid funding or entry ID", 400);
    }

    let reason = "";
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    } catch {
      // A reason is optional, so an empty body is fine.
    }

    const result = await reverseLedgerEntry<FundingEntryRow>({
      table: "funding_entries",
      reversesColumn: "reverses_entry_id",
      ownerColumn: "funding_id",
      ownerId: fundingId,
      entryId,
      selectColumns: "id, funding_id, entry_type, amount, entry_date, reverses_entry_id",
      notFoundMessage: "Entry not found",
      ownerMismatchMessage: "That entry belongs to a different funding",
      alreadyReversedMessage: "This entry has already been reversed",
      buildInsertRow: (original) => ({
        funding_id: fundingId,
        entry_type: original.entry_type,
        amount: original.amount,
        entry_date: new Date().toISOString().slice(0, 10),
        description: reason
          ? `Reversal of #${entryId}: ${reason}`
          : `Reversal of #${entryId}`,
        reverses_entry_id: entryId,
        created_by: authUser.id,
      }),
    });

    if (result.response) return result.response;
    const reversal = result.reversal;

    after(async () => {
      await logActivity({
        action: "REVERSE_FUNDING_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "funding_entries",
        recordId: reversal.id,
        details: { funding_id: fundingId, reversed_entry_id: entryId, reason },
      });
    });

    return apiSuccess({ entry: reversal }, "Entry reversed", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
