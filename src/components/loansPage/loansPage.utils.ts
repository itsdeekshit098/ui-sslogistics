import type { InstallmentStatus } from "./loansPage.types";
import { todayString } from "@/lib/format";

// Loan-specific display helpers — due-date proximity and installment-status
// badges, used by the loans list, the two detail pages and the EMI calendar.
// Generic formatters (currency, date, month, todayString) live in
// @/lib/format since Clients and Fundings need them too.

/** First and last day of the month containing `date`. */
export function monthBounds(date: Date): { from: string; to: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}

export function shiftMonth(from: string, delta: number): string {
  const [year, month] = from.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
}

/** Signed day count from today; negative means the date has passed. */
export function daysFromToday(dateStr: string): number {
  const today = new Date(todayString());
  const target = new Date(dateStr.slice(0, 10));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "in 3 days" / "5 days ago" / "today", for the Next EMI column. */
export function relativeDueLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const days = daysFromToday(dateStr);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PAID: "Paid",
  PARTIAL: "Partly paid",
  OVERDUE: "Overdue",
  PENDING: "Pending",
  WAIVED: "Waived",
  BOUNCED: "Bounced",
};

/**
 * Badge tone for an installment's status, driven by the same tokens as
 * every other status indicator in the app (see components/ui/badge.tsx) —
 * Overdue and Bounced are the two that demand attention, so they're the
 * only ones in destructive red.
 */
export function installmentStatusVariant(
  status: InstallmentStatus,
): "success-subtle" | "warning-subtle" | "destructive-subtle" | "outline" | "info-subtle" {
  switch (status) {
    case "PAID":
      return "success-subtle";
    case "PARTIAL":
      return "warning-subtle";
    case "OVERDUE":
    case "BOUNCED":
      return "destructive-subtle";
    case "WAIVED":
      return "outline";
    default:
      return "info-subtle";
  }
}

/** Percentage of a loan's installments settled, for the progress bar. */
export function progressPercent(paid: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

/**
 * Implied flat annual rate from the schedule alone — EMI × tenure vs
 * principal — not the reducing-balance rate a lender actually applies. This
 * is a display-only estimate for cross-checking the stored interest_rate,
 * not a number stored or fed back into the schedule. Returns null (rather
 * than a negative/zero rate) whenever the schedule's total payable doesn't
 * fall below the principal — that only happens with a part schedule or bad
 * data, where "% p.a." would be actively misleading. Total payable equal to
 * principal is a real, valid case (an interest-free arrangement) and
 * correctly reports 0%.
 */
export function flatRoiFromSchedule(
  principal: number,
  totalPayable: number,
  totalInstallments: number,
): number | null {
  if (!principal || !totalInstallments) return null;
  const totalInterest = totalPayable - principal;
  if (totalInterest < 0) return null;
  const tenureYears = totalInstallments / 12;
  return (totalInterest / principal / tenureYears) * 100;
}
