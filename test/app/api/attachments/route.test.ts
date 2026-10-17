import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth, requireStrictAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/attachments/route");
}

function makeFile(name: string, type: string, sizeBytes = 100) {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

function formDataRequest(url: string, fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest(url, { method: "POST", body: formData });
}

beforeEach(() => {
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("GET /api/attachments", () => {
  it("400s on an invalid owner_type", async () => {
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/attachments?owner_type=invoice&owner_id=1"),
    );

    expect(res.status).toBe(400);
  });

  it("400s when owner_id is missing", async () => {
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments?owner_type=vehicle"));

    expect(res.status).toBe(400);
  });

  it("uses requireAdminAuth for a vehicle owner", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/attachments?owner_type=vehicle&owner_id=1"),
    );

    expect(res.status).toBe(403);
  });

  it("uses requireStrictAdminAuth for a loan owner", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/attachments?owner_type=loan&owner_id=1"),
    );

    expect(res.status).toBe(403);
  });

  it("returns the attachments for the owner", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      attachments: [{ data: [{ id: 1, vehicle_id: 1 }], error: null, count: 1 }],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/attachments?owner_type=vehicle&owner_id=1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.total).toBe(1);
  });
});

describe("POST /api/attachments", () => {
  it("400s on an invalid owner_type", async () => {
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "invoice",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s when file is missing", async () => {
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects when the auth tier for the owner fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when the file exceeds 10MB", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg", 11 * 1024 * 1024),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a disallowed mime type for a vehicle (PDF not allowed for photos)", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.pdf", "application/pdf"),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("allows a PDF for a loan attachment", async () => {
    requireStrictAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      loans: [{ data: { id: 1 }, error: null }],
      attachments: [{ data: { id: 5 }, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "loan",
        owner_id: "1",
        file: makeFile("statement.pdf", "application/pdf"),
      }),
    );

    expect(res.status).toBe(201);
  });

  it("404s when the parent (vehicle/loan/client entry) does not exist", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      vehicles: [{ data: null, error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("uploads to storage, inserts the row, and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      {
        vehicles: [{ data: { id: 1 }, error: null }],
        attachments: [{ data: { id: 5, vehicle_id: 1, file_name: "a.jpg" }, error: null }],
      },
      {},
      { attachments: [{ data: { path: "vehicles/1/x.jpg" }, error: null }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.attachment.id).toBe(5);
    expect(supa.storageUploadCallCount("attachments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPLOAD_ATTACHMENT" }),
    );
  });

  it("surfaces a 500 when the storage upload itself fails", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { vehicles: [{ data: { id: 1 }, error: null }] },
      {},
      { attachments: [{ data: null, error: { message: "storage down" } }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );

    expect(res.status).toBe(500);
  });

  it("removes the orphaned storage object when the DB insert fails after a successful upload", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      {
        vehicles: [{ data: { id: 1 }, error: null }],
        attachments: [{ data: null, error: { message: "disk full" } }],
      },
      {},
      { attachments: [{ data: { path: "vehicles/1/x.jpg" }, error: null }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest("http://localhost/api/attachments", {
        owner_type: "vehicle",
        owner_id: "1",
        file: makeFile("a.jpg", "image/jpeg"),
      }),
    );

    expect(res.status).toBe(500);
    expect(supa.storageRemoveCallCount("attachments")).toBe(1);
  });
});

describe("DELETE /api/attachments", () => {
  it("400s when id is missing", async () => {
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments"));

    expect(res.status).toBe(400);
  });

  it("404s when the attachment does not exist", async () => {
    mockSupabaseAdmin({
      attachments: [{ data: null, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments?id=1"));

    expect(res.status).toBe(404);
  });

  it("uses requireAdminAuth when the attachment belongs to a vehicle", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({
      attachments: [{ data: { id: 1, vehicle_id: 1, client_entry_id: null, loan_id: null, storage_path: "p", file_name: "a.jpg" }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments?id=1"));

    expect(res.status).toBe(403);
  });

  it("uses requireStrictAdminAuth when the attachment belongs to a loan", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({
      attachments: [{ data: { id: 1, vehicle_id: null, client_entry_id: null, loan_id:5, storage_path: "p", file_name: "a.pdf" }, error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments?id=1"));

    expect(res.status).toBe(403);
  });

  it("removes the storage object, deletes the row, and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      attachments: [
        { data: { id: 1, vehicle_id: 1, client_entry_id: null, loan_id: null, storage_path: "vehicles/1/x.jpg", file_name: "a.jpg" }, error: null },
        { error: null }, // delete
      ],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments?id=1"));

    expect(res.status).toBe(200);
    expect(supa.storageRemoveCallCount("attachments")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_ATTACHMENT", recordId: 1 }),
    );
  });

  it("surfaces a 500 when storage removal fails, without deleting the DB row", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      {
        attachments: [
          { data: { id: 1, vehicle_id: 1, client_entry_id: null, loan_id: null, storage_path: "vehicles/1/x.jpg", file_name: "a.jpg" }, error: null },
        ],
      },
      {},
      { attachments: [{ data: null, error: { message: "storage error" } }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest("http://localhost/api/attachments?id=1"));

    expect(res.status).toBe(500);
    expect(supa.callCount("attachments")).toBe(1);
  });
});
