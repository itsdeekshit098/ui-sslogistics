/**
 * Parses `page` / `page_size` query params into a clamped page number, a
 * clamped page size, and the `[from, to]` pair `.range()` expects.
 *
 * `defaultPageSize`/`maxPageSize` are left as call-site parameters rather
 * than fixed constants — different lists have deliberately different caps
 * (e.g. an owner-picker dropdown wants a larger default page than a ledger
 * table), and this only centralizes the arithmetic, not the tuning.
 */
export function parsePageParams(
  searchParams: URLSearchParams,
  { defaultPageSize, maxPageSize }: { defaultPageSize: number; maxPageSize: number },
): { page: number; pageSize: number; from: number; to: number } {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(searchParams.get("page_size")) || defaultPageSize),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
