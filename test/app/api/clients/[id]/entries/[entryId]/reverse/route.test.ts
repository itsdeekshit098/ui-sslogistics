import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/[id]/entries/[entryId]/reverse/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function requestWithNoBody(url: string) {
  // Mirrors how the mobile/web client can call this without a body — the
  // route reads req.json() defensively inside its own try/catch.
  return new NextRequest(url, { method: "POST" });
}

function params(id: string, entryId: string) {
  return { params: Promise.resolve({ id, entryId }) };
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/clients/[id]/entries/[entryId]/reverse", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on non-numeric client or entry IDs", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/abc/entries/10/reverse", "POST", {}),
      params("abc", "10"),
    );

    expect(res.status).toBe(400);
  });

  it("works with no request body at all (reason defaults to empty)", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        {
          data: { id: 10, client_id: 1, entry_type: "BILL", direction: "DEBIT", amount: 100, reverses_entry_id: null },
          error: null,
        },
        { data: null, error: null }, // no existing reversal
        { data: { id: 11, reverses_entry_id: 10, direction: "CREDIT" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(requestWithNoBody("http://localhost/api/clients/1/entries/10/reverse"), params("1", "10"));

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ reason: "" }) }),
    );
  });

  it("surfaces a 500 when the original-entry fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the original entry doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the entry belongs to a different client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 2, direction: "DEBIT", amount: 100, reverses_entry_id: null }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different client/);
  });

  it("400s when trying to reverse a reversal itself", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        {
          data: { id: 11, client_id: 1, direction: "CREDIT", amount: 100, reverses_entry_id: 10 },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/11/reverse", "POST", {}),
      params("1", "11"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A reversal cannot itself be reversed");
  });

  it("409s when the entry has already been reversed", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 1, direction: "DEBIT", amount: 100, reverses_entry_id: null }, error: null },
        { data: { id: 11 }, error: null }, // existing reversal found
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This entry has already been reversed");
  });

  it("creates the mirror-image reversal and logs the audit entry, including the truncated reason", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 1, entry_type: "BILL", direction: "DEBIT", amount: 250, reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: { id: 11, direction: "CREDIT", amount: 250, reverses_entry_id: 10 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {
        reason: "billed twice by mistake",
      }),
      params("1", "10"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entry.id).toBe(11);
    expect(supa.callCount("client_ledger_entries")).toBe(3);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REVERSE_CLIENT_LEDGER_ENTRY",
        recordId: 11,
        details: expect.objectContaining({ reversed_entry_id: 10, reason: "billed twice by mistake" }),
      }),
    );
  });

  it("truncates an overly long reason to 200 characters", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 1, direction: "CREDIT", amount: 100, reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: { id: 11, direction: "DEBIT", amount: 100, reverses_entry_id: 10 }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const longReason = "x".repeat(250);
    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {
        reason: longReason,
      }),
      params("1", "10"),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ reason: "x".repeat(200) }),
      }),
    );
  });

  it("409s when the insert hits the concurrent-reversal unique constraint", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 1, direction: "DEBIT", amount: 100, reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This entry has already been reversed");
  });

  it("surfaces a 500 for other insert errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_ledger_entries: [
        { data: { id: 10, client_id: 1, direction: "DEBIT", amount: 100, reverses_entry_id: null }, error: null },
        { data: null, error: null },
        { data: null, error: { message: "connection reset" } },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/entries/10/reverse", "POST", {}),
      params("1", "10"),
    );

    expect(res.status).toBe(500);
  });
});
