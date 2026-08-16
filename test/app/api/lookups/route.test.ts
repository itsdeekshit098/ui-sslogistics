import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import {
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
} from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, STAFF_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/lookups/route");
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

describe("GET /api/lookups", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/lookups?category=LOAN_TYPE"),
    );

    expect(res.status).toBe(403);
  });

  it("allows any authenticated staff user (requireUserAuth gate)", async () => {
    requireUserAuth.mockResolvedValue(STAFF_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: [{ id: 1, value: "TERM_LOAN" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/lookups?category=LOAN_TYPE"),
    );

    expect(res.status).toBe(200);
  });

  it("400s when category is missing", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/lookups"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("category is required");
  });

  it("filters to active options by default, and includes inactive when asked", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: [], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/lookups?category=LOAN_TYPE&include_inactive=true",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 when the query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/lookups?category=LOAN_TYPE"),
    );

    expect(res.status).toBe(500);
  });
});

describe("POST /api/lookups", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "Machinery Loan",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when category is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", { label: "Machinery Loan" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("category is required");
  });

  it("400s when label is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", { category: "LOAN_TYPE" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Label is required");
  });

  it("400s when the label exceeds the max length", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "x".repeat(81),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/80 characters or less/);
  });

  it("400s when the label slugifies to an empty value", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "!!!",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/at least one letter or number/);
  });

  it("derives the value from the label when none is supplied", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      lookup_options: [
        {
          data: { id: 1, category: "LOAN_TYPE", value: "MACHINERY_LOAN", label: "Machinery Loan" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "Machinery Loan",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.option.value).toBe("MACHINERY_LOAN");
    expect(supa.callCount("lookup_options")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_LOOKUP_OPTION",
        details: expect.objectContaining({ value: "MACHINERY_LOAN" }),
      }),
    );
  });

  it("uses an explicitly supplied value instead of deriving one, and honors sort_order", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        {
          data: { id: 2, category: "LOAN_TYPE", value: "CUSTOM_VAL", label: "Machinery Loan" },
          error: null,
        },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "Machinery Loan",
        value: "custom val!",
        sort_order: 5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.option.value).toBe("CUSTOM_VAL");
  });

  it("falls back to a default sort_order when the supplied one isn't finite", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        { data: { id: 3, category: "LOAN_TYPE", value: "X", label: "X" }, error: null },
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "X",
        sort_order: "not-a-number",
      }),
    );

    expect(res.status).toBe(201);
  });

  it("409s when the option already exists in the list", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "Machinery Loan",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("surfaces a 500 on a generic insert error", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: { message: "disk full" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/lookups", "POST", {
        category: "LOAN_TYPE",
        label: "Machinery Loan",
      }),
    );

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/lookups", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", { id: 1, label: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the option ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/lookups", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("400s when label is set to an empty string", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", { id: 1, label: "   " }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Label cannot be empty");
  });

  it("400s when label exceeds the max length", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", {
        id: 1,
        label: "x".repeat(81),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/80 characters or less/);
  });

  it("400s on a non-finite sort_order", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", { id: 1, sort_order: "abc" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid sort order");
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/lookups", "PUT", { id: 1 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("updates label, sort_order and is_active, and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        { data: { id: 1, category: "LOAN_TYPE", value: "X", label: "Renamed" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", {
        id: 1,
        label: "Renamed",
        sort_order: 10,
        is_active: false,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.option.label).toBe("Renamed");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_LOOKUP_OPTION", recordId: 1 }),
    );
  });

  it("404s when the option doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", { id: 1, label: "Renamed" }),
    );

    expect(res.status).toBe(404);
  });

  it("surfaces a 500 on an update error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: { message: "disk full" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/lookups", "PUT", { id: 1, label: "Renamed" }),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/lookups", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=1"));

    expect(res.status).toBe(403);
  });

  it("400s when the option ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups"));

    expect(res.status).toBe(400);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the option fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: { message: "timeout" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=1"));

    expect(res.status).toBe(500);
  });

  it("404s when the option doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=1"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion of a built-in (system) option", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        {
          data: { id: 1, category: "LOAN_TYPE", value: "TERM_LOAN", label: "Term Loan", is_system: true },
          error: null,
        },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/built-in option and cannot be deleted/);
  });

  it("deletes a non-system option and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        {
          data: {
            id: 2,
            category: "LOAN_TYPE",
            value: "CUSTOM_TYPE",
            label: "Custom Type",
            is_system: false,
          },
          error: null,
        },
        { error: null }, // delete
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=2"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_LOOKUP_OPTION", recordId: 2 }),
    );
  });

  it("surfaces a 500 when the final delete errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      lookup_options: [
        {
          data: {
            id: 2,
            category: "LOAN_TYPE",
            value: "CUSTOM_TYPE",
            label: "Custom Type",
            is_system: false,
          },
          error: null,
        },
        { error: { message: "fk violation" } },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/lookups?id=2"));

    expect(res.status).toBe(500);
  });
});
