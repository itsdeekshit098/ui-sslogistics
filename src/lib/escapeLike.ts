/** Escapes the wildcards Postgres ILIKE treats specially, so a search for
 * "50%" doesn't match everything. */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * Builds a `name.ilike.<pattern>` value for a PostgREST `.or()` filter
 * string, safe for any search text — including a comma or parenthesis,
 * which are the `.or()` string's OWN delimiters (not LIKE wildcards, so
 * `escapeLike` alone doesn't touch them). An unquoted comma in a search term
 * splits the filter into two conditions and a 500; PostgREST's own answer is
 * to quote the value, so a stray `"` or `\` inside it is escaped too.
 *
 * Use this instead of hand-building `%${escapeLike(search)}%` for anything
 * that goes into `.or(...)`, not plain `.ilike(column, pattern)` (a single
 * `.ilike()` call never parses commas as structure, so it only needs
 * `escapeLike` on its own).
 */
export function likeOrPattern(search: string): string {
  const wildcarded = `%${escapeLike(search)}%`;
  return `"${wildcarded.replace(/[\\"]/g, "\\$&")}"`;
}
