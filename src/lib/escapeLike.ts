/** Escapes the wildcards Postgres ILIKE treats specially, so a search for
 * "50%" doesn't match everything. */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
