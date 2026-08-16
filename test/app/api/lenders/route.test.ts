import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/lenders/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_LENDER_BODY = {
  name: "ABC Finance",
  lender_kind: "INSTITUTION",
  phone: "9876543210",
  contact_person: "Ramesh",
  notes: "Reliable lender",
};

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/lenders", () => {
  it("rejects a non-admin the same way requireStrictAdminAuth does", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/lenders"));

    expect(res.status).toBe(403);
  });

  it("lists only active lenders by default", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: [{ id: 1, name: "ABC Finance" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/lenders"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toHaveLength(1);
  });

  it("applies lender_kind, include_inactive and escaped search filters", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/lenders?lender_kind=PRIVATE&include_inactive=true&search=50%25off",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 when the query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/lenders"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/lenders", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", VALID_LENDER_BODY),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", {
        ...VALID_LENDER_BODY,
        name: "  ",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Lender name is required");
  });

  it("400s on an invalid lender_kind", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", {
        ...VALID_LENDER_BODY,
        lender_kind: "BANK",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid lender type/);
  });

  it("400s on an invalid phone number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", {
        ...VALID_LENDER_BODY,
        phone: "12345",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/valid 10-digit mobile number/);
  });

  it("creates the lender and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "ABC Finance" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", VALID_LENDER_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.lender.id).toBe(5);
    expect(supa.callCount("lenders")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_LENDER", recordId: 5 }),
    );
  });

  it("creates a lender without optional fields", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 6, name: "Minimal Lender" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", {
        name: "Minimal Lender",
        lender_kind: "PRIVATE",
      }),
    );

    expect(res.status).toBe(201);
  });

  it("409s when the lender name already exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", VALID_LENDER_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("surfaces a 500 on a generic insert error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { message: "disk full" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lenders", "POST", VALID_LENDER_BODY),
    );

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/lenders", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the lender ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/lenders", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("400s when name is set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "   " }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Lender name cannot be empty");
  });

  it("400s on an invalid lender_kind", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, lender_kind: "BANK" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Invalid lender type/);
  });

  it("400s on an invalid phone number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, phone: "12345" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/valid 10-digit mobile number/);
  });

  it("400s when notes exceed the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", {
        id: 5,
        notes: "x".repeat(501),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/500 characters or less/);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/lenders", "PUT", { id: 5 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("clears phone/contact_person/notes when explicitly set to null, and updates is_active", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "ABC Finance" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", {
        id: 5,
        phone: null,
        contact_person: null,
        notes: null,
        is_active: false,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("updates the lender and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "New Name" }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "New Name" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.lender.name).toBe("New Name");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_LENDER", recordId: 5 }),
    );
  });

  it("404s when the lender doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "New Name" }),
    );

    expect(res.status).toBe(404);
  });

  it("409s when renaming to a name that already exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { code: "23505" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "Dup" }),
    );

    expect(res.status).toBe(409);
  });

  it("surfaces a 500 on a generic update error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { message: "disk full" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lenders", "PUT", { id: 5, name: "New Name" }),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/lenders", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(403);
  });

  it("400s when the lender ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders"));

    expect(res.status).toBe(400);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the lender fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: { message: "timeout" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(500);
  });

  it("404s when the lender doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 when the loan-reference check errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "ABC Finance" }, error: null }],
      loans: [{ count: null, error: { message: "timeout" } }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the funding-reference check errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "ABC Finance" }, error: null }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: null, error: { message: "timeout" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(500);
  });

  it("blocks deletion while loans or fundings still reference the lender", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [{ data: { id: 5, name: "ABC Finance" }, error: null }],
      loans: [{ count: 2, error: null }],
      fundings: [{ count: 1, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 loan\(s\) and 1 funding\(s\)/);
  });

  it("deletes the lender and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [
        { data: { id: 5, name: "ABC Finance" }, error: null },
        { error: null }, // delete
      ],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_LENDER", recordId: 5 }),
    );
  });

  it("surfaces a 500 when the final delete errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lenders: [
        { data: { id: 5, name: "ABC Finance" }, error: null },
        { error: { message: "fk violation" } },
      ],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lenders?id=5"));

    expect(res.status).toBe(500);
  });
});
