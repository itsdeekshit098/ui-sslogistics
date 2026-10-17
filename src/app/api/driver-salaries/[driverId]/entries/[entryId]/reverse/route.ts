import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { todayInIndia } from "@/lib/dateOnly";
import { reverseLedgerEntry } from "@/lib/ledgerReversal";
import { isMonthSettled } from "../../../../driver-salaries.data";
import { supabaseAdmin } from "@/lib/supabase";

// Cancels an advance or deduction by inserting a second row that points back
// at it. Both rows then drop out of the sheet's totals — the same pattern as
// loan payments, funding entries and client ledger entries — so a mistake is
// undone without losing the record that it was ever entered.
//
// Two cases are refused outright rather than reversed:
//   - the entry's own month is settled (reversing it would silently change
//     what a settlement receipt already says was paid)
//   - the entry is itself a settlement's carry-forward (settlement_id set) —
//     undoing that belongs to the settle/[id] DELETE route, which also
//     clears the settlement's own carry_forward figure; reversing it here
//     directly would leave that figure stale.

type SalaryEntryRow = {
  id: number;
  driver_id: number;
  entry_type: string;
  amount: number;
  period_month: string;
  reverses_entry_id: number | null;
  settlement_id: number | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ driverId: string; entryId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { driverId: driverIdParam, entryId: entryIdParam } = await params;
    const driverId = Number(driverIdParam);
    const entryId = Number(entryIdParam);
    if (!Number.isFinite(driverId) || !Number.isFinite(entryId)) {
      return apiError("Invalid driver or entry ID", 400);
    }

    let reason = "";
    try {
      const body = await req.json();
      reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    } catch {
      // A reason is optional, so an empty body is fine.
    }

    // Pre-checks that don't belong in reverseLedgerEntry (shared by every
    // money ledger): a carry-forward entry can only be undone by unsettling
    // the settlement that made it, and nothing reverses against a month
    // that's already been paid out.
    const { data: target, error: targetErr } = await supabaseAdmin
      .from("driver_salary_entries")
      .select("period_month, settlement_id, reverses_entry_id")
      .eq("id", entryId)
      .eq("driver_id", driverId)
      .maybeSingle();
    if (targetErr) return serverError(targetErr);
    if (target) {
      if (target.settlement_id != null && target.reverses_entry_id == null) {
        return apiError(
          "This was carried forward by a settlement — undo that settlement instead of reversing it here",
          400,
        );
      }
      const periodMonth = (target.period_month as string).slice(0, 7);
      if (await isMonthSettled(driverId, periodMonth)) {
        return apiError(
          "This month is already settled — undo the settlement first if you need to change it",
          409,
        );
      }
    }

    const result = await reverseLedgerEntry<SalaryEntryRow>({
      table: "driver_salary_entries",
      reversesColumn: "reverses_entry_id",
      ownerColumn: "driver_id",
      ownerId: driverId,
      entryId,
      selectColumns: "id, driver_id, entry_type, amount, period_month, reverses_entry_id, settlement_id",
      notFoundMessage: "Entry not found",
      ownerMismatchMessage: "That entry belongs to a different driver",
      alreadyReversedMessage: "This entry has already been reversed",
      buildInsertRow: (original) => ({
        driver_id: driverId,
        // Same type, amount and salary month as the original, so the pair
        // sits together on one sheet and cancels there.
        entry_type: original.entry_type,
        amount: original.amount,
        period_month: original.period_month,
        entry_date: todayInIndia(),
        description: reason ? `Reversal of #${entryId}: ${reason}` : `Reversal of #${entryId}`,
        reverses_entry_id: entryId,
        created_by: authUser.id,
      }),
    });

    if (result.response) return result.response;
    const reversal = result.reversal;

    after(async () => {
      await logActivity({
        action: "REVERSE_DRIVER_SALARY_ENTRY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_salary_entries",
        recordId: reversal.id,
        details: { driver_id: driverId, reversed_entry_id: entryId, reason },
      });
    });

    return apiSuccess({ entry: reversal }, "Entry reversed", 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
