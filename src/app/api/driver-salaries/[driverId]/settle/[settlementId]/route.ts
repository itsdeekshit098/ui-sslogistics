import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { todayInIndia } from "@/lib/dateOnly";

// Undoes a settlement: reverses its carry-forward entry (if it made one, so
// the pair nets to zero and the history stays on record, same as any other
// ledger reversal) and then removes the settlement row itself — a
// settlement is this month's fact ("was it paid"), not a ledger line, so it
// is deleted rather than reversed-in-place.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ driverId: string; settlementId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { driverId: driverIdParam, settlementId: settlementIdParam } = await params;
    const driverId = Number(driverIdParam);
    const settlementId = Number(settlementIdParam);
    if (!Number.isInteger(driverId) || driverId <= 0 || !Number.isFinite(settlementId)) {
      return apiError("Invalid driver or settlement ID", 400);
    }

    const { data: settlement, error: fetchErr } = await supabaseAdmin
      .from("driver_salary_settlements")
      .select("id, driver_id, period_month, carry_forward_entry_id")
      .eq("id", settlementId)
      .maybeSingle();
    if (fetchErr) return serverError(fetchErr);
    if (!settlement) return apiError("Settlement not found", 404);
    if (settlement.driver_id !== driverId) {
      return apiError("That settlement belongs to a different driver", 400);
    }

    // All-or-nothing: reversing the carry-forward entry, untagging it, and
    // deleting the settlement go through one database function (sql/50), so
    // a failure partway through can't leave the carry-forward reversed while
    // the settlement still shows as settled, or leave the FK blocking the
    // delete.
    const { error: rpcErr } = await supabaseAdmin.rpc("unsettle_driver_salary", {
      p_settlement_id: settlementId,
      p_driver_id: driverId,
      p_user: authUser.id,
    });

    if (rpcErr && (rpcErr.code === "PGRST202" || rpcErr.code === "42883")) {
      // The function hasn't been created in this database yet (sql/ files
      // are applied by hand). Fall back to the separate writes rather than
      // refusing every undo; this path is not atomic.
      if (settlement.carry_forward_entry_id != null) {
        const { data: original, error: entryFetchErr } = await supabaseAdmin
          .from("driver_salary_entries")
          .select("id, entry_type, amount, period_month, reverses_entry_id")
          .eq("id", settlement.carry_forward_entry_id)
          .maybeSingle();
        if (entryFetchErr) return serverError(entryFetchErr);
        // Already reversed by someone acting directly on the entry — unlikely
        // (the UI never exposes that), but don't fail the unsettle over it.
        if (original && original.reverses_entry_id == null) {
          const { data: alreadyReversed, error: checkErr } = await supabaseAdmin
            .from("driver_salary_entries")
            .select("id")
            .eq("reverses_entry_id", original.id)
            .maybeSingle();
          if (checkErr) return serverError(checkErr);
          if (!alreadyReversed) {
            const { error: reverseErr } = await supabaseAdmin.from("driver_salary_entries").insert([
              {
                driver_id: driverId,
                entry_type: original.entry_type,
                amount: original.amount,
                period_month: original.period_month,
                entry_date: todayInIndia(),
                description: `Reversal of #${original.id}: settlement undone`,
                reverses_entry_id: original.id,
                created_by: authUser.id,
              },
            ]);
            if (reverseErr) return serverError(reverseErr);
          }
        }
        // The carry-forward entry still points at this settlement via its
        // FK; clear the tag so the settlement row can be deleted. The entry
        // itself (and its reversal) stay on record either way.
        const { error: untagErr } = await supabaseAdmin
          .from("driver_salary_entries")
          .update({ settlement_id: null })
          .eq("id", settlement.carry_forward_entry_id);
        if (untagErr) return serverError(untagErr);
      }

      const { error: deleteErr } = await supabaseAdmin
        .from("driver_salary_settlements")
        .delete()
        .eq("id", settlementId);
      if (deleteErr) return serverError(deleteErr);
    } else if (rpcErr) {
      return serverError(rpcErr);
    }

    after(async () => {
      await logActivity({
        action: "UNSETTLE_DRIVER_SALARY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_salary_settlements",
        recordId: settlementId,
        details: { driver_id: driverId, period_month: settlement.period_month },
      });
    });

    return apiSuccess({}, "Settlement undone");
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
