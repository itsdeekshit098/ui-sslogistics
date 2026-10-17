import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth, requireStrictAdminAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/attachments/view/route");
}

function fakeBlob(bytes = 100) {
  return new Blob([new Uint8Array(bytes)]);
}

beforeEach(() => {
  requireAdminAuth.mockReset();
  requireStrictAdminAuth.mockReset();
});

describe("GET /api/attachments/view", () => {
  it("400s when id is missing or invalid", async () => {
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=abc"));

    expect(res.status).toBe(400);
  });

  it("404s when the attachment does not exist", async () => {
    mockSupabaseAdmin({
      attachments: [{ data: null, error: null }],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=1"));

    expect(res.status).toBe(404);
  });

  it("uses requireAdminAuth for a vehicle photo (no client_entry_id/loan_id)", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({
      attachments: [
        { data: { storage_path: "p", file_name: "a.jpg", mime_type: "image/jpeg", client_entry_id: null, loan_id: null }, error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=1"));

    expect(res.status).toBe(403);
  });

  it("uses requireStrictAdminAuth for a loan attachment", async () => {
    requireStrictAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({
      attachments: [
        { data: { storage_path: "p", file_name: "a.pdf", mime_type: "application/pdf", client_entry_id: null, loan_id: 5 }, error: null },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=1"));

    expect(res.status).toBe(403);
  });

  it("404s when the storage download fails", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        attachments: [
          { data: { storage_path: "p", file_name: "a.jpg", mime_type: "image/jpeg", client_entry_id: null, loan_id: null }, error: null },
        ],
      },
      {},
      { attachments: [{ data: null, error: { message: "not found" } }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=1"));

    expect(res.status).toBe(404);
  });

  it("streams the attachment with its stored mime type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {
        attachments: [
          { data: { storage_path: "p", file_name: "a.jpg", mime_type: "image/jpeg", client_entry_id: null, loan_id: null }, error: null },
        ],
      },
      {},
      { attachments: [{ data: fakeBlob(50), error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/attachments/view?id=1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline/);
  });
});
