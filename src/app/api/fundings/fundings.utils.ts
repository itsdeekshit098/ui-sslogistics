// Interest engine for private / "hand" loans.
//
// The arrangement these model: someone lends a lump sum at an agreed rate,
// say 2% per month. Interest is SIMPLE — ₹1,00,000 at 2%/month accrues ₹2,000
// every month whether or not last month's ₹2,000 was actually handed over.
// Unpaid interest never joins the principal, so next month is still ₹2,000 and
// not 2% of ₹1,02,000. Repaying principal reduces the accrual from that day on.
//
// Nothing is stored. Accrual is recomputed from two timelines every time it's
// asked for — how much principal was outstanding when, and what rate applied
// when — because entries are routinely backdated, and stored accrual rows would
// have to be rewritten (and could be missed) whenever that happens.
//
// Pure functions, no Supabase: this is the part most worth being able to reason
// about and check by hand.

import { parseDate, toDateString } from "@/lib/dateOnly";

/** Interest is quoted per month, so a month is normalised to 30 days. */
const DAYS_PER_MONTH = 30;

export const FUNDING_ENTRY_TYPES = [
  "PRINCIPAL_TAKEN",
  "PRINCIPAL_REPAID",
  "INTEREST_PAID",
  "ADJUSTMENT",
] as const;

export const INTEREST_MODES = ["PERCENT", "FIXED"] as const;
export const ROI_BASES = ["MONTHLY", "ANNUAL"] as const;

export interface FundingEntry {
  id: number;
  entry_type: (typeof FUNDING_ENTRY_TYPES)[number];
  amount: number;
  entry_date: string; // YYYY-MM-DD
  reverses_entry_id: number | null;
}

export interface FundingRate {
  roi: number | null;
  roi_basis: "MONTHLY" | "ANNUAL" | null;
  fixed_interest_amount: number | null;
  effective_from: string; // YYYY-MM-DD
}

export interface MonthlyBreakdownRow {
  /** First day of the month, YYYY-MM-DD. */
  month: string;
  /** Days of this month actually inside the funding's life. */
  days: number;
  /** Weighted-average principal outstanding across those days. */
  average_principal: number;
  /** Monthly rate in force, as a percentage. Null in FIXED mode. */
  monthly_rate: number | null;
  interest_accrued: number;
  interest_paid: number;
  /** Cumulative accrued minus cumulative paid, at the end of this month. */
  interest_balance: number;
}

export interface FundingComputation {
  principal_taken: number;
  principal_repaid: number;
  principal_outstanding: number;
  interest_accrued: number;
  interest_paid: number;
  /** Accrued minus paid. Negative means interest has been paid ahead. */
  interest_due: number;
  /**
   * One full month's interest on the principal outstanding at `asOf`, at the
   * rate in force that day (the fixed amount in FIXED mode). Zero once the
   * principal is cleared.
   */
  monthly_interest: number;
  total_due: number;
  monthly_breakdown: MonthlyBreakdownRow[];
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole days between two dates, treating the range as [from, to). */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Rounds to paise, so repeated arithmetic can't drift into float noise. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Drops reversed entries and the reversals themselves. The pair nets to zero,
 * which is exactly what excluding both achieves — and it means a reversal never
 * has to be modelled as a negative amount.
 */
export function effectiveEntries(entries: FundingEntry[]): FundingEntry[] {
  const reversedIds = new Set(
    entries
      .map((entry) => entry.reverses_entry_id)
      .filter((id): id is number => id != null),
  );
  return entries.filter(
    (entry) => entry.reverses_entry_id == null && !reversedIds.has(entry.id),
  );
}

/** The rate in force on a given day: the latest one effective on or before it. */
function rateOn(rates: FundingRate[], date: string): FundingRate | null {
  let active: FundingRate | null = null;
  for (const rate of rates) {
    if (rate.effective_from <= date) active = rate;
    else break;
  }
  return active;
}

/** A rate row reduced to a per-month percentage, whatever basis it was quoted in. */
function monthlyRateOf(rate: FundingRate | null): number {
  if (!rate || rate.roi == null) return 0;
  return rate.roi_basis === "ANNUAL" ? rate.roi / 12 : rate.roi;
}

/**
 * Computes the full interest position of a funding as at `asOf`.
 *
 * Walks day by day from the first principal entry. Each day carries the
 * principal outstanding that morning and the rate in force, and accrues
 * `principal × monthlyRate% × (1/30)` — so a part month is charged pro rata.
 * ₹1,00,000 at 2%/month taken on the 10th and checked on the 25th shows ₹1,000,
 * i.e. half a month's interest for half a month's use, rather than nothing
 * until the month completes.
 *
 * A day loop rather than closed-form segment maths because principal changes,
 * rate changes and month boundaries all cut the timeline at different points;
 * the loop makes the pro-rating obviously correct instead of subtly wrong at
 * the joins. Fundings run for months, not centuries, so the cost is trivial.
 */
export function computeFunding({
  entries,
  rates,
  interestMode,
  asOf,
}: {
  entries: FundingEntry[];
  rates: FundingRate[];
  interestMode: "PERCENT" | "FIXED";
  asOf?: string;
}): FundingComputation {
  const live = effectiveEntries(entries).sort((a, b) =>
    a.entry_date === b.entry_date ? a.id - b.id : a.entry_date.localeCompare(b.entry_date),
  );

  const sortedRates = [...rates].sort((a, b) =>
    a.effective_from.localeCompare(b.effective_from),
  );

  const principalTaken = live
    .filter((e) => e.entry_type === "PRINCIPAL_TAKEN")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const principalRepaid = live
    .filter((e) => e.entry_type === "PRINCIPAL_REPAID")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const adjustments = live
    .filter((e) => e.entry_type === "ADJUSTMENT")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const interestPaid = live
    .filter((e) => e.entry_type === "INTEREST_PAID")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const principalOutstanding = Math.max(
    principalTaken - principalRepaid - adjustments,
    0,
  );

  const asOfDate = asOf ?? toDateString(new Date());
  const currentRate = rateOn(sortedRates, asOfDate);
  let monthlyInterest = 0;
  if (principalOutstanding > 0) {
    monthlyInterest =
      interestMode === "FIXED"
        ? Number(currentRate?.fixed_interest_amount ?? 0)
        : (principalOutstanding * monthlyRateOf(currentRate)) / 100;
  }

  const empty: FundingComputation = {
    principal_taken: round2(principalTaken),
    principal_repaid: round2(principalRepaid),
    principal_outstanding: round2(principalOutstanding),
    interest_accrued: 0,
    interest_paid: round2(interestPaid),
    interest_due: round2(-interestPaid),
    monthly_interest: round2(monthlyInterest),
    total_due: round2(principalOutstanding - interestPaid),
    monthly_breakdown: [],
  };

  const firstPrincipal = live.find((e) => e.entry_type === "PRINCIPAL_TAKEN");
  if (!firstPrincipal) return empty;

  const start = parseDate(firstPrincipal.entry_date);
  const end = parseDate(asOfDate);
  if (daysBetween(start, end) <= 0) return empty;

  // Principal deltas keyed by the day they take effect.
  const deltasByDate = new Map<string, number>();
  for (const entry of live) {
    let delta = 0;
    if (entry.entry_type === "PRINCIPAL_TAKEN") delta = Number(entry.amount);
    else if (entry.entry_type === "PRINCIPAL_REPAID") delta = -Number(entry.amount);
    else if (entry.entry_type === "ADJUSTMENT") delta = -Number(entry.amount);
    if (delta === 0) continue;
    deltasByDate.set(
      entry.entry_date,
      (deltasByDate.get(entry.entry_date) ?? 0) + delta,
    );
  }

  const interestPaidByMonth = new Map<string, number>();
  for (const entry of live) {
    if (entry.entry_type !== "INTEREST_PAID") continue;
    const month = `${entry.entry_date.slice(0, 7)}-01`;
    interestPaidByMonth.set(
      month,
      (interestPaidByMonth.get(month) ?? 0) + Number(entry.amount),
    );
  }

  const monthly = new Map<
    string,
    { days: number; principalDaySum: number; accrued: number; rateSum: number }
  >();

  let principal = 0;
  let totalAccrued = 0;

  for (let cursor = start; daysBetween(cursor, end) > 0; cursor = addDays(cursor, 1)) {
    const dateStr = toDateString(cursor);

    // Money moves at the start of its day: principal taken today earns from
    // today, principal repaid today stops earning today.
    principal += deltasByDate.get(dateStr) ?? 0;
    if (principal < 0) principal = 0;

    const rate = rateOn(sortedRates, dateStr);
    const monthlyRate = monthlyRateOf(rate);

    let dayInterest = 0;
    if (interestMode === "FIXED") {
      // A flat "pay me ₹X a month" arrangement, spread across the month so a
      // part month is charged proportionally, same as the percentage case.
      const fixed = Number(rate?.fixed_interest_amount ?? 0);
      // No principal outstanding means nothing is owed, even on a fixed deal.
      dayInterest = principal > 0 ? fixed / DAYS_PER_MONTH : 0;
    } else {
      dayInterest = (principal * (monthlyRate / 100)) / DAYS_PER_MONTH;
    }

    totalAccrued += dayInterest;

    const monthKey = `${dateStr.slice(0, 7)}-01`;
    const bucket = monthly.get(monthKey) ?? {
      days: 0,
      principalDaySum: 0,
      accrued: 0,
      rateSum: 0,
    };
    bucket.days += 1;
    bucket.principalDaySum += principal;
    bucket.accrued += dayInterest;
    bucket.rateSum += monthlyRate;
    monthly.set(monthKey, bucket);
  }

  let runningBalance = 0;
  const breakdown: MonthlyBreakdownRow[] = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => {
      const paid = interestPaidByMonth.get(month) ?? 0;
      runningBalance += bucket.accrued - paid;
      return {
        month,
        days: bucket.days,
        average_principal: round2(bucket.principalDaySum / bucket.days),
        monthly_rate:
          interestMode === "FIXED" ? null : round2(bucket.rateSum / bucket.days),
        interest_accrued: round2(bucket.accrued),
        interest_paid: round2(paid),
        interest_balance: round2(runningBalance),
      };
    });

  const accrued = round2(totalAccrued);
  const paid = round2(interestPaid);

  return {
    principal_taken: round2(principalTaken),
    principal_repaid: round2(principalRepaid),
    principal_outstanding: round2(principalOutstanding),
    interest_accrued: accrued,
    interest_paid: paid,
    interest_due: round2(accrued - paid),
    monthly_interest: round2(monthlyInterest),
    total_due: round2(principalOutstanding + accrued - paid),
    monthly_breakdown: breakdown,
  };
}

export const FUNDING_SORTS = [
  "newest",
  "oldest",
  "principal",
  "rate",
  "monthly_interest",
  "interest_due",
] as const;
export type FundingSort = (typeof FUNDING_SORTS)[number];

/** Sorts the database can do itself, so the list can stay a ranged query. */
export const DB_FUNDING_SORTS: readonly FundingSort[] = ["newest", "oldest"];

interface SortableFunding {
  id: number;
  start_date: string;
  interest_mode: "PERCENT" | "FIXED";
  computed: FundingComputation | null;
  current_rate: FundingRate | null;
}

/**
 * The monthly rate a funding runs at today, as a percentage — for ordering
 * only. A FIXED deal ranks by the rate its fixed amount works out to on the
 * principal still outstanding.
 */
function sortRateOf(funding: SortableFunding): number {
  if (funding.interest_mode === "FIXED") {
    const principal = funding.computed?.principal_outstanding ?? 0;
    return principal > 0 ? (funding.computed?.monthly_interest ?? 0) / principal : 0;
  }
  return monthlyRateOf(funding.current_rate);
}

/**
 * Orders computed fundings for the list. The money sorts are highest first —
 * "who costs / owes the most" is the question being asked — and ties fall
 * back to newest first so the order is stable across page turns.
 */
export function sortFundings<T extends SortableFunding>(rows: T[], sort: FundingSort): T[] {
  const newest = (a: T, b: T) => b.start_date.localeCompare(a.start_date) || b.id - a.id;
  const desc = (value: (f: T) => number) => (a: T, b: T) => value(b) - value(a) || newest(a, b);

  const compare: Record<FundingSort, (a: T, b: T) => number> = {
    newest,
    oldest: (a, b) => newest(b, a),
    principal: desc((f) => f.computed?.principal_outstanding ?? 0),
    rate: desc(sortRateOf),
    monthly_interest: desc((f) => f.computed?.monthly_interest ?? 0),
    interest_due: desc((f) => f.computed?.interest_due ?? 0),
  };
  return [...rows].sort(compare[sort]);
}
