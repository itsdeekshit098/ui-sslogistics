/**
 * Formats one CSV cell: quotes values containing a delimiter, quote or line
 * break, and neutralises spreadsheet formula injection (a leading =, +, -, @,
 * tab or CR) in text. Numbers are left untouched so figures render as-is.
 */
export function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
