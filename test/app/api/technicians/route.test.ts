import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/technicians/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/technicians", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/technicians"));

    expect(res.status).toBe(403);
  });

  it("lists technicians", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      technicians: [{ data: [{ id: 1, name: "Tech" }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/technicians"));

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 on a query error", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      technicians: [{ data: null, error: { message: "timeout" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/technicians"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/technicians", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", { name: "Tech", specializations: [] }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", { specializations: [] }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid phone", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", {
        name: "Tech",
        phone: "123",
        specializations: [],
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when specializations is not an array", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", {
        name: "Tech",
        specializations: "electrical",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("creates the technician and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      technicians: [{ data: { id: 1, name: "Tech" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", {
        name: "Tech",
        specializations: ["electrical"],
      }),
    );

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_TECHNICIAN" }),
    );
  });

  it("409s when the name already exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      technicians: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/technicians", "POST", {
        name: "Tech",
        specializations: [],
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/technicians", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/technicians", "PUT", { id: 1, name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/technicians", "PUT", { name: "New" }));

    expect(res.status).toBe(400);
  });

  it("400s when specializations is set to a non-array", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/technicians", "PUT", { id: 1, specializations: "x" }),
    );

    expect(res.status).toBe(400);
  });

  it("updates the technician and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      technicians: [{ data: { id: 1, name: "Updated" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/technicians", "PUT", { id: 1, name: "Updated" }),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_TECHNICIAN", recordId: 1 }),
    );
  });
});

describe("DELETE /api/technicians", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/technicians?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when id is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/technicians"));

    expect(res.status).toBe(400);
  });

  it("blocks deletion when linked to repair records", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ count: 3, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/technicians?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Deactivate them instead/);
  });

  it("deletes the technician and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      repair_records: [{ count: 0, error: null }],
      technicians: [{ error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/technicians?id=1"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_TECHNICIAN", recordId: 1 }),
    );
  });
});
