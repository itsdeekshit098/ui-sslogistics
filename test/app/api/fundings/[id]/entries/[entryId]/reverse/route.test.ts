import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/fundings/[id]/entries/[entryId]/reverse/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id: string, entryId: string) {
  return { params: Promise.resolve({ id, entryId }) };
}

const ORIGINAL_ENTRY = {
  id: 5,
  funding_id: 10,
  entry_type: "PRINCIPAL_REPAID",
  amount: 5000,
  entry_date: "2026-01-10",
  reverses_entry_id: null,
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/fundings/[id]/entries/[entryId]/reverse", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST"),
      params("10", "5"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric funding or entry id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/abc/entries/5/reverse", "POST"),
      params("abc", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid funding or entry ID");
  });

  it("treats a missing/invalid JSON body as an empty reason rather than failing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [
        { data: ORIGINAL_ENTRY, error: null },
        { data: null, error: null },
        { data: { id: 6, funding_id: 10, entry_type: "PRINCIPAL_REPAID", amount: 5000 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    // No body at all — req.json() will throw, exercising the catch branch.
    const res = await POST(
      new NextRequest("http://localhost/api/fundings/10/entries/5/reverse", { method: "POST" }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.id).toBe(6);
  });

  it("404s when the original entry doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the entry lookup errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );

    expect(res.status).toBe(500);
  });

  it("400s when the entry belongs to a different funding", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [{ data: { ...ORIGINAL_ENTRY, funding_id: 99 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("That entry belongs to a different funding");
  });

  it("400s when trying to reverse a reversal", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [{ data: { ...ORIGINAL_ENTRY, reverses_entry_id: 1 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A reversal cannot itself be reversed");
  });

  it("409s when the entry has already been reversed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [
        { data: ORIGINAL_ENTRY, error: null },
        { data: { id: 6 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This entry has already been reversed");
  });

  it("409s when the insert hits the unique-index race (code 23505)", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [
        { data: ORIGINAL_ENTRY, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23505", message: "duplicate key" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This entry has already been reversed");
  });

  it("surfaces a 500 for a non-23505 insert error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [
        { data: ORIGINAL_ENTRY, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23000", message: "constraint violation" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", { reason: "oops" }),
      params("10", "5"),
    );

    expect(res.status).toBe(500);
  });

  it("reverses the entry with a reason and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      funding_entries: [
        { data: ORIGINAL_ENTRY, error: null },
        { data: null, error: null },
        {
          data: {
            id: 6,
            funding_id: 10,
            entry_type: "PRINCIPAL_REPAID",
            amount: 5000,
            reverses_entry_id: 5,
            description: "Reversal of #5: entered in error",
          },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/fundings/10/entries/5/reverse", "POST", {
        reason: "entered in error",
      }),
      params("10", "5"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.id).toBe(6);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REVERSE_FUNDING_ENTRY",
        recordId: 6,
        details: expect.objectContaining({
          funding_id: 10,
          reversed_entry_id: 5,
          reason: "entered in error",
        }),
      }),
    );
  });
});
