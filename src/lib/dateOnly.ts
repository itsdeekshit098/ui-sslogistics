/** Formats a UTC date as YYYY-MM-DD — the shape Postgres `date` columns take. */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses YYYY-MM-DD as a UTC midnight date, avoiding local-timezone drift. */
export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
