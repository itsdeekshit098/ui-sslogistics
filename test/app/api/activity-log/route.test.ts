import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const requireAdminAuth = vi.fn();
const requireSuperAdminAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireAdminAuth: (...args: unknown[]) => requireAdminAuth(...args),
  requireSuperAdminAuth: (...args: unknown[]) => requireSuperAdminAuth(...args),
}));

/**
 * A minimal stand-in for a Supabase PostgREST query builder: every chain
 * method returns itself, and the chain resolves (via `then`, same as the
 * real builder) to the canned response for that call. `responses` is
 * consumed in call order — one entry per `.from("activity_log")` the route
 * makes in a single request.
 */
function mockSupabaseAdmin(
  responses: Array<{ data?: unknown; error?: unknown; count?: number }>,
) {
  let call = 0;
  const from = vi.fn(() => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.lt = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.range = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(response).then(resolve, reject);
    return builder;
  });
  return { from, callCount: () => call };
}

const SUPERADMIN = {
  id: "user-1",
  email: "boss@sslogistics.test",
  role: "superadmin",
  displayName: "Boss",
};

let supabaseAdmin: ReturnType<typeof mockSupabaseAdmin>;
vi.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseAdmin;
  },
}));

async function importRoute() {
  return await import("@/app/api/activity-log/route");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/activity-log", () => {
  it("rejects a non-superadmin the same way requireSuperAdminAuth does", async () => {
    requireSuperAdminAuth.mockRejectedValue(
      new Error("FORBIDDEN: Insufficient role privileges"),
    );
    supabaseAdmin = mockSupabaseAdmin([]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2020-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(403);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("400s when no cutoff date is given", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([]);
    const { DELETE } = await importRoute();

    const req = new NextRequest("http://localhost/api/activity-log", {
      method: "DELETE",
    });
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it("400s on an unparseable cutoff date", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=not-a-date",
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(400);
  });

  it("400s when the cutoff is inside the retention floor, even for a superadmin", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([]);
    const { DELETE } = await importRoute();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const req = new NextRequest(
      `http://localhost/api/activity-log?before=${yesterday.toISOString()}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/60 days/);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("accepts a cutoff well past the retention floor", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([{ count: 0 }]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(200);
  });

  it("accepts a cutoff exactly 61 days back and rejects one 59 days back", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));

    const sixtyOneDaysAgo = new Date("2026-08-16T12:00:00Z");
    sixtyOneDaysAgo.setDate(sixtyOneDaysAgo.getDate() - 61);
    const fiftyNineDaysAgo = new Date("2026-08-16T12:00:00Z");
    fiftyNineDaysAgo.setDate(fiftyNineDaysAgo.getDate() - 59);

    supabaseAdmin = mockSupabaseAdmin([{ count: 0 }]);
    const { DELETE } = await importRoute();

    const okRes = await DELETE(
      new NextRequest(
        `http://localhost/api/activity-log?before=${sixtyOneDaysAgo.toISOString()}`,
        { method: "DELETE" },
      ),
    );
    expect(okRes.status).toBe(200);

    const rejectedRes = await DELETE(
      new NextRequest(
        `http://localhost/api/activity-log?before=${fiftyNineDaysAgo.toISOString()}`,
        { method: "DELETE" },
      ),
    );
    expect(rejectedRes.status).toBe(400);

    vi.useRealTimers();
  });

  it("dry run reports the count and never calls delete or logActivity", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([{ count: 42 }]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01&dryRun=true",
      { method: "DELETE" },
    );
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      cutoff: "2000-01-01T00:00:00.000Z",
      count: 42,
      dryRun: true,
    });
    // Only the count query ran — no delete, no insert.
    expect(supabaseAdmin.callCount()).toBe(1);
  });

  it("reports zero deleted and skips the delete call when nothing matches", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([{ count: 0 }]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);
    const body = await res.json();

    expect(body.data).toEqual({ cutoff: "2000-01-01T00:00:00.000Z", deleted: 0 });
    expect(supabaseAdmin.callCount()).toBe(1);
  });

  it("deletes matched rows and writes a PURGE_ACTIVITY_LOG entry afterward", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([
      { count: 5 }, // count query
      { error: null }, // delete
      { data: [], error: null }, // logActivity's insert
    ]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ cutoff: "2000-01-01T00:00:00.000Z", deleted: 5 });
    // count, delete, and the purge's own activity-log insert.
    expect(supabaseAdmin.callCount()).toBe(3);
  });

  it("surfaces a 500 without deleting anything when the count query errors", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([{ error: { message: "connection reset" } }]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(500);
    expect(supabaseAdmin.callCount()).toBe(1);
  });

  it("surfaces a 500 and does not log a purge entry when the delete itself errors", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN);
    supabaseAdmin = mockSupabaseAdmin([
      { count: 5 },
      { error: { message: "deadlock detected" } },
    ]);
    const { DELETE } = await importRoute();

    const req = new NextRequest(
      "http://localhost/api/activity-log?before=2000-01-01",
      { method: "DELETE" },
    );
    const res = await DELETE(req);

    expect(res.status).toBe(500);
    // count + failed delete — never reaches the logActivity insert.
    expect(supabaseAdmin.callCount()).toBe(2);
  });
});

describe("GET /api/activity-log", () => {
  it("allows a plain admin (not just superadmin) to read the log", async () => {
    requireAdminAuth.mockResolvedValue({ ...SUPERADMIN, role: "admin" });
    supabaseAdmin = mockSupabaseAdmin([
      { count: 2 },
      { data: [{ id: 1 }, { id: 2 }], error: null },
    ]);
    const { GET } = await importRoute();

    const req = new NextRequest("http://localhost/api/activity-log?page=1&limit=30");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.totalPages).toBe(1);
  });
});
