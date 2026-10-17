import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth } from "@test/authMock";
import { forbiddenError, ADMIN_USER } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/vehicles/documents/view/route");
}

function fakeBlob(bytes = 100) {
  const blob = new Blob([new Uint8Array(bytes)]);
  return blob;
}

beforeEach(() => {
  requireAdminAuth.mockReset();
});

describe("GET /api/vehicles/documents/view", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/vehicles/documents/view?filePath=a/b.pdf"),
    );

    expect(res.status).toBe(403);
  });

  it("400s when filePath is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(new NextRequest("http://localhost/api/vehicles/documents/view"));

    expect(res.status).toBe(400);
  });

  it("400s on a path-traversal attempt with '..'", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/vehicles/documents/view?filePath=" +
          encodeURIComponent("../../etc/passwd"),
      ),
    );

    expect(res.status).toBe(400);
  });

  it("400s when filePath starts with a slash", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/vehicles/documents/view?filePath=" + encodeURIComponent("/etc/passwd"),
      ),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the storage download fails", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: null, error: { message: "not found" } }] },
    );
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/vehicles/documents/view?filePath=a/b.pdf"),
    );

    expect(res.status).toBe(404);
  });

  it("streams the file inline with the correct content type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: fakeBlob(50), error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest("http://localhost/api/vehicles/documents/view?filePath=a/rc_url.pdf"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline/);
  });

  it("forces a download attachment when download=true", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: fakeBlob(50), error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/vehicles/documents/view?filePath=a/rc_url.pdf&download=true",
      ),
    );

    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment/);
  });

  it("sanitizes a filename with unsafe characters for the Content-Disposition header", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: fakeBlob(50), error: null }] },
    );
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest(
        "http://localhost/api/vehicles/documents/view?filePath=" +
          encodeURIComponent('a/evil".pdf'),
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).not.toContain('"evil"');
  });
});
