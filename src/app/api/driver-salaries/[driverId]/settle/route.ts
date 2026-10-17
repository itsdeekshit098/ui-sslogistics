import { after } from "next/server";
import { requireStrictAdminAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { apiError, apiSuccess, handleApiError, serverError } from "@/lib/apiResponse";
import { logActivity } from "@/lib/activityLog";
import { addMonths, todayInIndia } from "@/lib/dateOnly";
import { isNonNegativeNumber } from "../../../loans/loans.utils";
import { isValidMonth } from "../../../driver-attendance/driver-attendance.utils";
import { isMonthSettled, loadDriverSalary } from "../../driver-salaries.data";
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

    const body = (await req.json()) as Record<string, unknown>;

    const today = todayInIndia();
    const currentMonth = today.slice(0, 7);
    const periodMonth = body.period_month;
    if (!isValidMonth(periodMonth)) {
      return apiError("Invalid month (expected YYYY-MM)", 400);
    }
    if (periodMonth > currentMonth) {
      return apiError("Can't settle a month that hasn't started", 400);
    }

    if (!isNonNegativeNumber(body.amount_paid)) {
      return apiError("Enter the amount actually paid", 400);
    }
    const amountPaid = body.amount_paid;

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
    if (detail.row.monthly_salary == null || detail.row.net_pay == null) {
      // No salary rate means there's no figure to settle against — "owed
      // nothing" and "nothing to compute from" are different facts, and
      // coercing the latter to 0 would carry the whole amount_paid forward
      // as a spurious advance. The web/mobile UIs already disable "Mark
      // paid" for this case; this is the same rule enforced server-side.
      return apiError("Set a salary before settling this month", 400);
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
      // than refusing every settle; this path is not atomic.
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
