import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { forbiddenError, ADMIN_USER } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/fundings/[id]/route");
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
});

describe("GET /api/fundings/[id]", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/fundings/abc"),
      params("abc"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid funding ID");
  });

  it("404s when the funding doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the funding query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the entries query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, interest_mode: "PERCENT" }, error: null }],
      funding_entries: [{ data: null, error: { message: "boom" } }],
      funding_rate_history: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the rates query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, interest_mode: "PERCENT" }, error: null }],
      funding_entries: [{ data: [], error: null }],
      funding_rate_history: [{ data: null, error: { message: "boom" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));

    expect(res.status).toBe(500);
  });

  it("returns the funding with computed interest and reversal state on its entries", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, interest_mode: "PERCENT" }, error: null }],
      funding_entries: [
        {
          data: [
            {
              id: 1,
              funding_id: 10,
              entry_type: "PRINCIPAL_TAKEN",
              amount: 100000,
              entry_date: "2026-01-01",
              reverses_entry_id: null,
            },
            {
              id: 2,
              funding_id: 10,
              entry_type: "INTEREST_PAID",
              amount: 500,
              entry_date: "2026-01-05",
              reverses_entry_id: null,
            },
            {
              id: 3,
              funding_id: 10,
              entry_type: "INTEREST_PAID",
              amount: 500,
              entry_date: "2026-01-06",
              reverses_entry_id: 2,
            },
          ],
          error: null,
        },
      ],
      funding_rate_history: [
        {
          data: [
            {
              funding_id: 10,
              roi: 2,
              roi_basis: "MONTHLY",
              fixed_interest_amount: null,
              effective_from: "2026-01-01",
            },
          ],
          error: null,
        },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.funding.id).toBe(10);
    expect(body.data.rates).toHaveLength(1);
    expect(body.data.computed).toEqual(
      expect.objectContaining({ principal_taken: 100000 }),
    );

    const entry2 = body.data.entries.find((e: { id: number }) => e.id === 2);
    const entry3 = body.data.entries.find((e: { id: number }) => e.id === 3);
    // Entry 2 was reversed by entry 3, so it's marked as reversed but not itself a reversal.
    expect(entry2).toEqual(expect.objectContaining({ is_reversed: true, is_reversal: false }));
    // Entry 3 is the reversal, so it's flagged as such and isn't itself reversed.
    expect(entry3).toEqual(expect.objectContaining({ is_reversed: false, is_reversal: true }));
  });

  it("falls back to empty arrays when entries/rates come back null with no error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      fundings: [{ data: { id: 10, interest_mode: "PERCENT" }, error: null }],
      funding_entries: [{ data: null, error: null }],
      funding_rate_history: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/fundings/10"), params("10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.rates).toEqual([]);
    expect(body.data.entries).toEqual([]);
    expect(body.data.computed).toEqual(
      expect.objectContaining({ principal_taken: 0, monthly_breakdown: [] }),
    );
  });
});
