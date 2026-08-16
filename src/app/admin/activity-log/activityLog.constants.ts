/**
 * Retention windows offered by the "Clear Old Logs" control.
 *
 * Presets rather than a free date picker: the server refuses any cutoff newer
 * than 60 days (MIN_RETENTION_DAYS in the route), so every option here is
 * guaranteed valid and there is no way to typo a date into a bad request.
 *
 * The shortest option is 3 months, not 2 — a calendar month is ~30.4 days on
 * average but as short as 28, so "2 months ago" can land under the 60-day
 * floor whenever the span crosses February (e.g. 31 Jan back 2 months is 31
 * Mar, only 59 days earlier). 3 months clears the floor in every case: the
 * shortest possible 3-month span (Feb+Mar+Apr or Jan+Feb+Mar) is still ~89
 * days.
 */
export interface RetentionOption {
  /** Value bound to the <Select>; months of history to keep. */
  months: number;
  label: string;
}

export const RETENTION_OPTIONS: RetentionOption[] = [
  { months: 3, label: "Older than 3 months" },
  { months: 6, label: "Older than 6 months" },
  { months: 12, label: "Older than 1 year" },
  { months: 24, label: "Older than 2 years" },
  { months: 36, label: "Older than 3 years" },
];

export const DEFAULT_RETENTION_MONTHS = 12;

/** Typed into the confirmation field before the purge button unlocks. */
export const PURGE_CONFIRM_PHRASE = "DELETE";

/**
 * Converts a retention window into the cutoff date the API expects.
 *
 * Built by hand rather than via `Date.setMonth()`, which overflows on a
 * month-end date whose target month is shorter (e.g. 31 Aug back 6 months
 * naively lands on 3 Mar instead of 28 Feb, since Feb only has 28 days and
 * `setMonth` spills the extra 3 days into March). Clamping the day to the
 * target month's actual length keeps the cutoff inside the month the label
 * promises.
 */
export function retentionCutoff(months: number): Date {
  const now = new Date();
  const targetMonthIndex = now.getMonth() - months;
  // Day 0 of the month after the target lands on the target month's last
  // real day, whatever its length. JS normalizes a negative month index
  // (and a negative day-of-month here) across year boundaries automatically.
  const lastDayOfTargetMonth = new Date(
    now.getFullYear(),
    targetMonthIndex + 1,
    0,
  ).getDate();
  const day = Math.min(now.getDate(), lastDayOfTargetMonth);
  return new Date(now.getFullYear(), targetMonthIndex, day);
}
