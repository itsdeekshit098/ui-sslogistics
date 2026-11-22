/** The three fields that suggest one another when a date is chosen. */
export interface LoanDateTerms {
  startDate: string;
  firstEmiDate: string;
  emiDayOfMonth: number | null;
}

/**
 * Sets one field of the loan form and fills in what follows from it.
 *
 * The first EMI is almost always a month after disbursal and the EMI day
 * follows from it, so choosing the start date prefills both (and choosing the
 * first EMI date prefills the day). Either can still be overridden. A month on
 * never goes past that month's end: 31 Jan is followed by 28 Feb, not 3 Mar.
 */
export function applyLoanField<T extends LoanDateTerms, K extends keyof T>(
  prev: T,
  key: K,
  value: T[K],
): T {
  const next = { ...prev, [key]: value };
  if (key === "startDate" && value && !prev.firstEmiDate) {
    const [y, m, d] = String(value).split("-").map(Number);
    const lastDayNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const suggested = new Date(Date.UTC(y, m, Math.min(d, lastDayNextMonth)));
    next.firstEmiDate = suggested.toISOString().slice(0, 10);
    if (prev.emiDayOfMonth == null) next.emiDayOfMonth = d;
  }
  if (key === "firstEmiDate" && value && prev.emiDayOfMonth == null) {
    next.emiDayOfMonth = Number(String(value).slice(8, 10));
  }
  return next;
}
