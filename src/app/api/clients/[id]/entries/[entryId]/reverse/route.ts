import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { reverseLedgerEntry } from "@/lib/ledgerReversal";

// Cancels a ledger entry by inserting its mirror image — same amount, opposite
// direction — pointing back at the original. A statement that deleted its
// mistakes could never be reconciled against the client's own books, so both
// rows stay and the pair nets to zero.

type ClientLedgerEntryRow = {
  id: number;
  client_id: number;
  entry_type: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  reverses_entry_id: number | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { id: idParam, entryId: entryIdParam } = await params;
    const clientId = Number(idParam);
    const entryId = Number(entryIdParam);

    if (!Number.isFinite(clientId) || !Number.isFinite(entryId)) {
      return apiError("Invalid client or entry ID", 400);
    }

    let reason = "";
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    } catch {
      // A reason is optional, so an empty body is fine.
    }

    const result = await reverseLedgerEntry<ClientLedgerEntryRow>({
      table: "client_ledger_entries",
      reversesColumn: "reverses_entry_id",
      ownerColumn: "client_id",
      ownerId: clientId,
      entryId,
      selectColumns: "id, client_id, entry_type, direction, amount, reverses_entry_id",
      notFoundMessage: "Entry not found",
      ownerMismatchMessage: "That entry belongs to a different client",
      alreadyReversedMessage: "This entry has already been reversed",
      buildInsertRow: (original) => ({
        client_id: clientId,
        entry_type: "ADJUSTMENT",
        // The mirror image: a wrongly-billed debit is cancelled by a credit.
        direction: original.direction === "DEBIT" ? "CREDIT" : "DEBIT",
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
        action: "REVERSE_CLIENT_LEDGER_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "client_ledger_entries",
        recordId: reversal.id,
        details: { client_id: clientId, reversed_entry_id: entryId, reason },
      });
    });

    return apiSuccess({ entry: reversal }, "Entry reversed", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
