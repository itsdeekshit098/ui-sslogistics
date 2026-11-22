/** Longest digit string accepted, so a pasted number can't overflow what a double represents exactly. */
export const MAX_DIGITS = 15;

interface Rules {
  maxDecimals: number;
  allowNegative: boolean;
}

/**
 * Whether `text` is something a person could be partway through typing as a
 * number under these rules. Used to accept or reject a whole change: a rejected
 * change leaves the field as it was, so a pasted "1e20" or "1.5" in an
 * integer-only field is refused rather than quietly turned into a different
 * number.
 */
export function isAcceptable(text: string, { maxDecimals, allowNegative }: Rules): boolean {
  if (text === "") return true;
  const m = /^(-?)(\d*)(?:(\.)(\d*))?$/.exec(text);
  if (!m) return false;
  const [, sign, whole, dot, decimals = ""] = m;
  if (sign && !allowNegative) return false;
  if (dot && maxDecimals === 0) return false;
  if (decimals.length > maxDecimals) return false;
  if (whole.length + decimals.length > MAX_DIGITS) return false;
  return true;
}

/** The number a field's text stands for, or null while it is empty or incomplete ("", "-", ".", "-."). */
export function parseNumber(text: string): number | null {
  if (!/\d/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** How a number is shown in the field: plain digits, no grouping, no exponent. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  // Very large whole numbers: exact digits (toFixed would switch to exponent form too).
  if (Math.abs(value) >= 1e21) return BigInt(Math.round(value)).toString();
  const text = String(value);
  // Very small numbers print as "1e-7"; spell them out and trim the padding.
  return /e/i.test(text) ? value.toFixed(20).replace(/\.?0+$/, "") : text;
}

/** Keeps `value` within [min, max]. */
export function clamp(value: number, min?: number, max?: number): number {
  let v = value;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/** Rounds away floating-point noise from stepping, to the field's decimals. */
export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
