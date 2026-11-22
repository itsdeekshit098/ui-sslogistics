/** A number is pixels; a string is passed through (`"12rem"`, `"30%"`). */
export function toCssLength(value: string | number): string;
export function toCssLength(value: string | number | undefined): string | undefined;
export function toCssLength(value: string | number | undefined): string | undefined {
  return value === undefined ? undefined : typeof value === "number" ? `${value}px` : value;
}
