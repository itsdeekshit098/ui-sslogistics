import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, readJsonObject, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { logger } from "@/lib/logger";
import { addMonths, todayInIndia } from "@/lib/dateOnly";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { isMonthSettled, loadDriverSalary } from "../../driver-salaries.data";
import { moneyMessage, moneyProblem } from "../../driver-salaries.utils";
import { SALARY_DESCRIPTION_MAX_LENGTH } from "@/components/salariesPage/salariesPage.types";

// Closes out a driver's month: records what was actually paid, and — when
// that differs from the computed net pay — carries the gap into next
// month's sheet as an ordinary advance (overpaid) or deduction (underpaid).
// The pay rule itself (computePay) is untouched; the carry-forward is just
// another driver_salary_entries row, tagged with settlement_id so the sheet
// can label it instead of it reading as a fresh manual entry.
//
// One settlement per driver per month (enforced by a unique index) — undo
// via the unsettle route rather than settling twice.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ driverId: string }> },
) {
  try {
    const authUser = await requireStrictAdminAuth();

    const { driverId: driverIdParam } = await params;
    const driverId = Number(driverIdParam);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return apiError("Invalid driver ID", 400);
    }

    const body = await readJsonObject(req);
    if (!body) return apiError("The request body must be a JSON object", 400);

    const today = todayInIndia();
    const currentMonth = today.slice(0, 7);
    const periodMonth = body.period_month;
    if (!isValidMonth(periodMonth)) {
      return apiError("Invalid month (expected YYYY-MM)", 400);
    }
    // Drivers are paid for a month after it ends, so only a finished month can
    // be settled. Settling early would lock entries while absences could still
    // change the pay (docs/decisions/0007). Same cut-off as `is_provisional`.
    if (periodMonth >= currentMonth) {
      return apiError("A month can be settled once it is over", 400);
    }

    const paidProblem = moneyProblem(body.amount_paid, true);
    if (paidProblem) {
      return apiError(moneyMessage(paidProblem, "Enter the amount actually paid"), 400);
    }
    const amountPaid = body.amount_paid as number;

    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, SALARY_DESCRIPTION_MAX_LENGTH)
        : null;

    const { data: driver, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("id")
      .eq("id", driverId)
      .maybeSingle();
    if (driverErr) return serverError(driverErr);
    if (!driver) return apiError("Driver not found", 404);

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("driver_salary_settlements")
      .select("id")
      .eq("driver_id", driverId)
      .eq("period_month", `${periodMonth}-01`)
      .maybeSingle();
    if (existingErr) return serverError(existingErr);
    if (existing) {
      return apiError(
        "This month is already settled — undo it first if you need to change it",
        409,
      );
    }

    // net_pay as the sheet sees it right now, at the moment of settling.
    const detail = await loadDriverSalary(driverId, periodMonth);
    if (!detail) return apiError("Driver not found", 404);
    if (detail.row.net_pay == null) {
      // Nothing to compute from — "owed nothing" and "no figure yet" are
      // different facts, and coercing the latter to 0 would carry the whole
      // amount_paid forward as a spurious advance. net_pay (not the monthly
      // salary) is the test: a per-trip driver has no monthly salary but is
      // fully settleable once their rate and trip count are set.
      return apiError(
        detail.row.pay_type === "PER_TRIP"
          ? "Set the rate per trip and this month's trip count before settling"
          : "Set a salary before settling this month",
        400,
      );
    }
    const netPayComputed = detail.row.net_pay;
    const gap = amountPaid - netPayComputed; // > 0 overpaid, < 0 underpaid

    // All-or-nothing: the settlement, its carry-forward entry (if any) and
    // the link between them go through one database function (sql/50), so a
    // failure partway through can't leave an untraceable carry-forward entry
    // or a settlement that doesn't record it.
    let settlementId: number;
    let carryForwardEntryId: number | null = null;
    const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc("settle_driver_salary", {
      p_driver_id: driverId,
      p_period_month: `${periodMonth}-01`,
      p_net_pay_computed: netPayComputed,
      p_amount_paid: amountPaid,
      p_note: note,
      p_user: authUser.id,
      p_today: today,
    });

    if (rpcErr && (rpcErr.code === "PGRST202" || rpcErr.code === "42883")) {
      // The function hasn't been created in this database yet (sql/ files
      // are applied by hand). Fall back to the three separate writes rather
      // than refusing every settle; this path is not atomic, so log it
      // loudly — a money write silently losing its transaction guarantee
      // should be visible, not discovered later from a support ticket.
      logger.error("settle_driver_salary RPC missing — using non-atomic fallback", {
        driverId,
        periodMonth,
        rpcErrorCode: rpcErr.code,
      });
      const nextMonth = addMonths(periodMonth, 1);
      if (gap !== 0 && (await isMonthSettled(driverId, nextMonth))) {
        return apiError(
          `${nextMonth} is already settled — undo that settlement first, or it would be changed by this carry-forward`,
          409,
        );
      }

      const { data: settlement, error: settlementErr } = await supabaseAdmin
        .from("driver_salary_settlements")
        .insert([
          {
            driver_id: driverId,
            period_month: `${periodMonth}-01`,
            net_pay_computed: netPayComputed,
            amount_paid: amountPaid,
            note,
            created_by: authUser.id,
          },
        ])
        .select("id")
        .single();
      if (settlementErr) {
        if (settlementErr.code === "23505") {
          return apiError(
            "This month is already settled — undo it first if you need to change it",
            409,
          );
        }
        return serverError(settlementErr);
      }
      settlementId = settlement.id;

      if (gap !== 0) {
        const { data: entry, error: entryErr } = await supabaseAdmin
          .from("driver_salary_entries")
          .insert([
            {
              driver_id: driverId,
              entry_type: gap > 0 ? "ADVANCE" : "DEDUCTION",
              amount: Math.abs(gap),
              entry_date: today,
              period_month: `${nextMonth}-01`,
              description:
                gap > 0
                  ? `Carried forward: overpaid for ${periodMonth}`
                  : `Carried forward: underpaid for ${periodMonth}`,
              settlement_id: settlementId,
              created_by: authUser.id,
            },
          ])
          .select("id")
          .single();
        if (entryErr) return serverError(entryErr);
        carryForwardEntryId = entry.id;

        const { error: linkErr } = await supabaseAdmin
          .from("driver_salary_settlements")
          .update({ carry_forward_entry_id: carryForwardEntryId })
          .eq("id", settlementId);
        if (linkErr) return serverError(linkErr);
      }
    } else if (rpcErr) {
      if (rpcErr.code === "23505") {
        return apiError(
          "This month is already settled — undo it first if you need to change it",
          409,
        );
      }
      if (rpcErr.message?.includes("next_month_settled")) {
        return apiError(
          `${addMonths(periodMonth, 1)} is already settled — undo that settlement first, or it would be changed by this carry-forward`,
          409,
        );
      }
      return serverError(rpcErr);
    } else {
      const row = rpcRows?.[0];
      if (!row) return serverError(new Error("settle_driver_salary returned no row"));
      settlementId = row.settlement_id;
      carryForwardEntryId = row.carry_forward_entry_id;
    }

    after(async () => {
      await logActivity({
        action: "SETTLE_DRIVER_SALARY",
        userId: authUser.id,
        userEmail: authUser.email,
        userDisplayName: authUser.displayName,
        tableName: "driver_salary_settlements",
        recordId: settlementId,
        details: {
          driver_id: driverId,
          period_month: periodMonth,
          net_pay_computed: netPayComputed,
          amount_paid: amountPaid,
          carry_forward: gap,
        },
      });
    });

    return apiSuccess(
      {
        settlement: {
          id: settlementId,
          driver_id: driverId,
          period_month: `${periodMonth}-01`,
          net_pay_computed: netPayComputed,
          amount_paid: amountPaid,
          note,
          carry_forward_entry_id: carryForwardEntryId,
        },
      },
      gap === 0
        ? "Month settled"
        : gap > 0
          ? "Month settled — overpayment carried to next month"
          : "Month settled — shortfall carried to next month",
      201,
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
