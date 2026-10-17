import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth, requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/specializations/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, { method, body: JSON.stringify(body) });
}

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/specializations", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns the list of specializations", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      specialization_options: [{ data: [{ id: 1, name: "Electrical" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 on a query error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      specialization_options: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe("POST /api/specializations", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/specializations", "POST", { name: "Electrical" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("http://localhost/api/specializations", "POST", {}));

    expect(res.status).toBe(400);
  });

  it("creates the specialization and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      specialization_options: [{ data: { id: 1, name: "Electrical" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/specializations", "POST", { name: "Electrical" }),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_SPECIALIZATION" }),
    );
  });
});
