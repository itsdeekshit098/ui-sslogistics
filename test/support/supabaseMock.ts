import { vi } from "vitest";

/**
 * Shared Supabase-admin mock for money-module route tests.
 *
 * A minimal stand-in for the Supabase PostgREST query builder: every chain
 * method (`.select`, `.eq`, `.order`, ...) returns the same builder object,
 * and the chain resolves — via `.then`, exactly like the real builder — to
 * the next canned response queued for the table it was built from.
 *
 * Responses are queued **per table name**, consumed in call order: the first
 * `.from("loans")` in a request gets the first entry in `loans`, the second
 * `.from("loans")` gets the second entry, and so on. Once a table's queue is
 * exhausted, its last entry is reused, so a test only supplies as many
 * responses as it needs to distinguish.
 */

export type MockResult<T = unknown> = {
  data?: T | null;
  error?: unknown;
  count?: number | null;
};

type ResultEntry = MockResult | (() => MockResult);
type ResultQueue = ResultEntry[];

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
  "contains",
  "or",
  "not",
  "order",
  "range",
  "limit",
  "maybeSingle",
  "single",
] as const;

export interface SupabaseAdminMock {
  from: ReturnType<typeof vi.fn>;
  /** Total calls to `.from(table)`, or calls for one specific table. */
  callCount: (table?: string) => number;
}

let current: SupabaseAdminMock | undefined;

vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    if (!current) {
      throw new Error(
        "supabaseAdmin was used before mockSupabaseAdmin(...) was called in this test. " +
          "Call it (from '@test/supabaseMock') before invoking the route handler.",
      );
    }
    return current;
  },
}));

/**
 * Builds and installs a Supabase-admin mock as the module's `supabaseAdmin`
 * export. Call once per test, right before importing/invoking the route.
 *
 * @example
 *   const supa = mockSupabaseAdmin({
 *     loans: [{ data: [{ id: 1 }], error: null, count: 1 }],
 *     loan_balances: [{ data: [], error: null }],
 *   });
 *   const { GET } = await import("@/app/api/loans/route");
 *   await GET(req);
 *   expect(supa.callCount("loans")).toBe(1);
 */
export function mockSupabaseAdmin(
  tableResponses: Record<string, ResultQueue | MockResult>,
): SupabaseAdminMock {
  const queues = new Map<string, ResultQueue>();
  for (const [table, value] of Object.entries(tableResponses)) {
    queues.set(table, Array.isArray(value) ? [...value] : [value]);
  }
  const calls = new Map<string, number>();

  const from = vi.fn((table: string) => {
    const queue = queues.get(table);
    const callIndex = calls.get(table) ?? 0;
    calls.set(table, callIndex + 1);

    if (!queue || queue.length === 0) {
      throw new Error(
        `mockSupabaseAdmin: no response queued for table "${table}" (call #${callIndex + 1}). ` +
          `Pass tableResponses["${table}"] to stub it.`,
      );
    }
    const entry = queue[Math.min(callIndex, queue.length - 1)];
    const response = typeof entry === "function" ? entry() : entry;

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of CHAIN_METHODS) {
      builder[method] = vi.fn(chain);
    }
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(response).then(resolve, reject);
    return builder;
  });

  const mock: SupabaseAdminMock = {
    from,
    callCount: (table?: string) =>
      table
        ? (calls.get(table) ?? 0)
        : [...calls.values()].reduce((sum, n) => sum + n, 0),
  };
  current = mock;
  return mock;
}
