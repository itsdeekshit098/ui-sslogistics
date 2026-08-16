import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/clients/[id]/contacts/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/clients/[id]/contacts", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/contacts"), params("1"));

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/abc/contacts"), params("abc"));

    expect(res.status).toBe(400);
  });

  it("surfaces a 500 when the query errors", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [{ data: null, error: { message: "connection reset" } }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/contacts"), params("1"));

    expect(res.status).toBe(500);
  });

  it("lists contacts for the client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [{ data: [{ id: 1, name: "Jane" }], error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/clients/1/contacts"), params("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.data).toHaveLength(1);
  });
});

describe("POST /api/clients/[id]/contacts", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", { name: "Jane" }),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/abc/contacts", "POST", { name: "Jane" }),
      params("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the client doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: null, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", { name: "Jane" }),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the contact name is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {}),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Contact name is required");
  });

  it("400s on an invalid phone number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Jane",
        phone: "12345",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Enter a valid 10-digit mobile number");
  });

  it("400s on an invalid alt_phone number", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Jane",
        alt_phone: "abc",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Enter a valid 10-digit mobile number");
  });

  it("400s on an invalid email address", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ clients: [{ data: { id: 1 }, error: null }] });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Jane",
        email: "not-an-email",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Enter a valid email address");
  });

  it("creates a non-primary contact without demoting anyone", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_contacts: [{ data: { id: 5, name: "Jane" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Jane",
        phone: "9876543210",
        email: "jane@example.com",
        role: "Operations",
        designation: "Manager",
        notes: "primary contact for ops",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.contact.id).toBe(5);
    // Only one client_contacts call (the insert) — clearExistingPrimary wasn't invoked.
    expect(supa.callCount("client_contacts")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_CLIENT_CONTACT", recordId: 5 }),
    );
  });

  it("demotes the existing primary when creating a new primary contact", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_contacts: [
        { error: null }, // clearExistingPrimary update
        { data: { id: 6, name: "Primary Jane", is_primary: true }, error: null }, // insert
      ],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Primary Jane",
        is_primary: true,
      }),
      params("1"),
    );

    expect(res.status).toBe(201);
    expect(supa.callCount("client_contacts")).toBe(2);
  });

  it("surfaces a 500 when the insert fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_contacts: [{ data: null, error: { message: "connection reset" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", { name: "Jane" }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });

  it("clears optional fields set to null", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      clients: [{ data: { id: 1 }, error: null }],
      client_contacts: [{ data: { id: 5, name: "Jane" }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest("http://localhost/api/clients/1/contacts", "POST", {
        name: "Jane",
        phone: null,
        alt_phone: null,
        email: null,
        role: null,
        designation: null,
        notes: null,
      }),
      params("1"),
    );

    expect(res.status).toBe(201);
  });
});

describe("PUT /api/clients/[id]/contacts", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { id: 5, name: "x" }),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on a non-numeric client id", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/abc/contacts", "PUT", { id: 5, name: "x" }),
      params("abc"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when the contact ID is missing", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { name: "x" }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Missing contact ID");
  });

  it("404s when the contact doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ client_contacts: [{ data: null, error: null }] });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { id: 5, name: "x" }),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the contact belongs to a different client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [{ data: { id: 5, client_id: 2 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { id: 5, name: "x" }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different client/);
  });

  it("400s when no updatable fields are supplied", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [{ data: { id: 5, client_id: 1 }, error: null }],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { id: 5 }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("No fields to update");
  });

  it("updates the contact and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_contacts: [
        { data: { id: 5, client_id: 1 }, error: null },
        { data: { id: 5, name: "Updated Jane" }, error: null },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", {
        id: 5,
        name: "Updated Jane",
      }),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.contact.name).toBe("Updated Jane");
    expect(supa.callCount("client_contacts")).toBe(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_CLIENT_CONTACT", recordId: 5 }),
    );
  });

  it("demotes the existing primary when updating a contact to become primary", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      client_contacts: [
        { data: { id: 5, client_id: 1 }, error: null }, // fetch existing
        { error: null }, // clearExistingPrimary
        { data: { id: 5, name: "Jane", is_primary: true }, error: null }, // update
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", {
        id: 5,
        is_primary: true,
      }),
      params("1"),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("client_contacts")).toBe(3);
  });

  it("surfaces a 500 when the update fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [
        { data: { id: 5, client_id: 1 }, error: null },
        { data: null, error: { message: "connection reset" } },
      ],
    });
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest("http://localhost/api/clients/1/contacts", "PUT", { id: 5, name: "x" }),
      params("1"),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/clients/[id]/contacts", () => {
  it("rejects a non-admin", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=5"),
      params("1"),
    );

    expect(res.status).toBe(403);
  });

  it("400s on invalid client or contact IDs", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=abc"),
      params("1"),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the contact doesn't exist", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({ client_contacts: [{ data: null, error: null }] });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=5"),
      params("1"),
    );

    expect(res.status).toBe(404);
  });

  it("400s when the contact belongs to a different client", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [{ data: { id: 5, client_id: 2, name: "Jane" }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=5"),
      params("1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/different client/);
  });

  it("deletes the contact and logs the audit entry", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [
        { data: { id: 5, client_id: 1, name: "Jane" }, error: null },
        { error: null },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=5"),
      params("1"),
    );

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_CLIENT_CONTACT", recordId: 5 }),
    );
  });

  it("surfaces a 500 when the delete fails", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      client_contacts: [
        { data: { id: 5, client_id: 1, name: "Jane" }, error: null },
        { error: { message: "connection reset" } },
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/clients/1/contacts?contact_id=5"),
      params("1"),
    );

    expect(res.status).toBe(500);
  });
});
