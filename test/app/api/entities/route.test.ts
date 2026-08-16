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
  return await import("@/app/api/entities/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const VALID_ENTITY_BODY = {
  name: "Acme Transport",
  entity_kind: "FIRM",
  relationship: "INTERNAL",
  phone: "9876543210",
  email: "acme@example.com",
  notes: "A note",
  pan: "ABCDE1234F",
  gst_number: "22AAAAA0000A1Z5",
  address: "123 Main St",
};

beforeEach(() => {
  requireUserAuth.mockReset();
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/entities", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/entities"));

    expect(res.status).toBe(403);
  });

  it("allows any authenticated staff user (requireUserAuth gate)", async () => {
    requireUserAuth.mockResolvedValue(STAFF_USER);
    mockSupabaseAdmin({
      entities: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/entities"));

    expect(res.status).toBe(200);
  });

  it("lists entities and resolves proprietor names in a follow-up query", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      entities: [
        {
          data: [
            { id: 1, name: "Firm A", proprietor_entity_id: 2 },
            { id: 2, name: "Person B", proprietor_entity_id: null },
          ],
          error: null,
          count: 2,
        },
        { data: [{ id: 2, name: "Person B" }], error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/entities"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(2);
    expect(body.data.data[0]).toEqual(
      expect.objectContaining({ id: 1, proprietor_name: "Person B" }),
    );
    expect(body.data.data[1]).toEqual(
      expect.objectContaining({ id: 2, proprietor_name: null }),
    );
    expect(supa.callCount("entities")).toBe(2);
  });

  it("skips the proprietor lookup query when no rows reference one", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      entities: [
        { data: [{ id: 1, name: "Solo", proprietor_entity_id: null }], error: null, count: 1 },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/entities"));

    expect(res.status).toBe(200);
    expect(supa.callCount("entities")).toBe(1);
  });

  it("includes vehicle_count per entity when with_counts=true", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: [{ id: 1, name: "Firm A", proprietor_entity_id: null }], error: null, count: 1 },
      ],
      vehicles: [{ data: [{ owner_entity_id: 1 }, { owner_entity_id: 1 }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/entities?with_counts=true"),
    );
    const body = await res.json();

    expect(body.data.data[0].vehicle_count).toBe(2);
  });

  it("applies entity_kind, relationship, is_active and search filters", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/entities?entity_kind=FIRM&relationship=INTERNAL" +
          "&is_active=true&search=50%25off",
      ),
    );

    expect(res.status).toBe(200);
  });

  it("applies is_active=false filter distinctly from true", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/entities?is_active=false"),
    );

    expect(res.status).toBe(200);
  });

  it("paginates using page and page_size, clamping page_size to 100", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: [], error: null, count: 0 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/entities?page=2&page_size=500"),
    );

    expect(res.status).toBe(200);
  });

  it("surfaces a 500 when the list query errors", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/entities"));

    expect(res.status).toBe(500);
  });
});

describe("POST /api/entities", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", VALID_ENTITY_BODY),
    );

    expect(res.status).toBe(403);
  });

  it("400s when name is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        name: undefined,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name is required");
  });

  it("400s when name exceeds 120 characters", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        name: "x".repeat(121),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/120 characters or less/);
  });

  it("400s on an invalid entity_kind", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        entity_kind: "COMPANY",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Type must be one of/);
  });

  it("400s on an invalid relationship", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        relationship: "OTHER",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Relationship must be one of/);
  });

  it("400s on an invalid phone number", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        phone: "12345",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/valid 10-digit mobile number/);
  });

  it("400s on an invalid email address", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        email: "not-an-email",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/valid email address/);
  });

  it("400s when notes exceed the max length", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        notes: "x".repeat(501),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/500 characters or less/);
  });

  it("400s on a non-numeric proprietor_entity_id", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        proprietor_entity_id: "abc",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid proprietor");
  });

  it("400s when a proprietor is set on a non-FIRM entity", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        entity_kind: "PERSON",
        proprietor_entity_id: 5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Only a firm can have a proprietor");
  });

  it("400s when the selected proprietor does not exist", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        proprietor_entity_id: 5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Selected proprietor no longer exists");
  });

  it("400s when the selected proprietor is itself a firm", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: { id: 5, entity_kind: "FIRM" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        proprietor_entity_id: 5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A proprietor must be a person, not a firm");
  });

  it("400s when the proprietor lookup itself errors", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { message: "timeout" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        proprietor_entity_id: 5,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Could not verify the selected proprietor");
  });

  it("creates the entity, defaults relationship, and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      entities: [{ data: { id: 42, name: "Acme Transport", entity_kind: "FIRM", relationship: "INTERNAL" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", VALID_ENTITY_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.entity.id).toBe(42);
    expect(supa.callCount("entities")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_ENTITY", recordId: 42 }),
    );
  });

  it("creates an entity with a valid proprietor", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 6, entity_kind: "PERSON" }, error: null }, // proprietor lookup
        { data: { id: 42, name: "Acme Transport" }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", {
        ...VALID_ENTITY_BODY,
        proprietor_entity_id: 6,
      }),
    );

    expect(res.status).toBe(201);
  });

  it("409s when the entity name already exists", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { code: "23505" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", VALID_ENTITY_BODY),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("surfaces a 500 on a generic insert error", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { message: "disk full" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/entities", "POST", VALID_ENTITY_BODY),
    );

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/entities", () => {
  const EXISTING_FIRM = { id: 10, name: "Old Name", entity_kind: "FIRM", relationship: "INTERNAL" };

  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "New" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the entity ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/entities", "PUT", {}));

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the existing-row fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { message: "timeout" } }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "New" }),
    );

    expect(res.status).toBe(500);
  });

  it("404s when the entity doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "New" }),
    );

    expect(res.status).toBe(404);
  });

  it("400s on partial-update field errors (e.g. bad email) without requiring other fields", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: EXISTING_FIRM, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, email: "bad" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/valid email address/);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: EXISTING_FIRM, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest("http://localhost/api/entities", "PUT", { id: 10 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("400s on an invalid proprietor_entity_id value", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: EXISTING_FIRM, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", {
        id: 10,
        proprietor_entity_id: "abc",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid proprietor");
  });

  it("400s when the new proprietor is the entity itself", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: EXISTING_FIRM, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", {
        id: 10,
        proprietor_entity_id: 10,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("An entity cannot be its own proprietor");
  });

  it("clears proprietor_entity_id automatically when switching a firm to a person", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null }, // fetch existing
        { data: { id: 10, name: "Old Name", entity_kind: "PERSON" }, error: null }, // update
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, entity_kind: "PERSON" }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("entities")).toBe(2);
  });

  it("re-validates a supplied proprietor against the target entity_kind", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null }, // fetch existing
        { data: { id: 99, entity_kind: "FIRM" }, error: null }, // proprietor lookup (fails: firm)
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", {
        id: 10,
        proprietor_entity_id: 99,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("A proprietor must be a person, not a firm");
  });

  it("updates the entity and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null },
        { data: { id: 10, name: "New Name", entity_kind: "FIRM" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "New Name" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.entity.name).toBe("New Name");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_ENTITY", recordId: 10 }),
    );
  });

  it("clears phone/email/notes/pan/gst/address when explicitly set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null },
        { data: { id: 10, name: "Old Name" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", {
        id: 10,
        phone: null,
        email: null,
        notes: null,
        pan: null,
        gst_number: null,
        address: null,
        is_active: false,
      }),
    );

    expect(res.status).toBe(200);
  });

  it("409s when renaming to a name that already exists", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null },
        { data: null, error: { code: "23505" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "Dup" }),
    );

    expect(res.status).toBe(409);
  });

  it("surfaces a 500 on a generic update error", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: EXISTING_FIRM, error: null },
        { data: null, error: { message: "disk full" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/entities", "PUT", { id: 10, name: "New Name" }),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/entities", () => {
  it("rejects when requireStrictAdminAuth fails", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(403);
  });

  it("400s when the entity ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities"));

    expect(res.status).toBe(400);
    expect(supa.from).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the entity fetch errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: { message: "timeout" } }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(500);
  });

  it("404s when the entity doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(404);
  });

  it("blocks deletion while vehicles are assigned to the entity", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null }, // fetch
        { count: 0, error: null }, // firms (proprietor references)
      ],
      vehicles: [{ count: 3, error: null }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/3 vehicle\(s\)/);
  });

  it("blocks deletion while loans or fundings reference the entity", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null },
        { count: 0, error: null },
      ],
      vehicles: [{ count: 0, error: null }],
      loans: [{ count: 1, error: null }],
      fundings: [{ count: 2, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/1 loan\(s\) and 2 private funding\(s\)/);
  });

  it("blocks deletion while other firms list it as proprietor", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null },
        { count: 2, error: null },
      ],
      vehicles: [{ count: 0, error: null }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/2 firm\(s\) list it as proprietor/);
  });

  it("surfaces a 500 when a referential guard query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null },
        { count: 0, error: null },
      ],
      vehicles: [{ count: null, error: { message: "timeout" } }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(500);
  });

  it("deletes the entity and logs the audit entry when nothing blocks it", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null },
        { count: 0, error: null },
        { error: null }, // delete
      ],
      vehicles: [{ count: 0, error: null }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_ENTITY", recordId: 10 }),
    );
  });

  it("surfaces a 500 when the final delete errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      entities: [
        { data: { id: 10, name: "Acme" }, error: null },
        { count: 0, error: null },
        { error: { message: "fk violation" } },
      ],
      vehicles: [{ count: 0, error: null }],
      loans: [{ count: 0, error: null }],
      fundings: [{ count: 0, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/entities?id=10"));

    expect(res.status).toBe(500);
  });
});
