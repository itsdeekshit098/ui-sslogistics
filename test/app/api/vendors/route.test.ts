import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/vendors/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, { method, body: JSON.stringify(body) });
}

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/vendors", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vendors"));

    expect(res.status).toBe(403);
  });

  it("lists vendors with pagination", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vendors: [{ data: [{ id: 1, name: "ACME Spares" }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vendors"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
  });

  it("surfaces a 500 on a query error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vendors: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vendors"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/vendors", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vendors", "POST", { name: "ACME" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/vendors", "POST", {}));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid phone number", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vendors", "POST", { name: "ACME", phone: "123" }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the vendor and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vendors: [{ data: { id: 1, name: "ACME" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vendors", "POST", { name: "ACME" }),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_VENDOR" }),
    );
  });

  it("409s when the vendor name already exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vendors: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/vendors", "POST", { name: "ACME" }),
    );

    expect(res.status).toBe(409);
  });
});
