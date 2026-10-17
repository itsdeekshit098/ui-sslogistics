import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/vehicles/documents/route");
}

function makeFile(name: string, type: string, sizeBytes = 100) {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

function formDataRequest(fields: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest("http://localhost/api/vehicles/documents", {
    method: "POST",
    body: formData,
  });
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/vehicles/documents", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminAuth.mockReset();
  logActivity.mockReset();
});

describe("POST /api/vehicles/documents", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "rc_url",
      }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when a required field is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an invalid documentType", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "selfie_url",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on an oversized file", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf", 11 * 1024 * 1024),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "rc_url",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("400s on a disallowed mime type", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.txt", "text/plain"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "rc_url",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("uploads, saves the file path, and logs the audit entry", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      { vehicles: [{ error: null }] },
      {},
      { "vehicle-documents": [{ data: { path: "KA01AB1234/rc_url.pdf" }, error: null }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "rc_url",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.filePath).toBe("KA01AB1234/rc_url.pdf");
    expect(supa.storageUploadCallCount("vehicle-documents")).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPLOAD_DOCUMENT" }),
    );
  });

  it("surfaces a 500 when storage upload fails", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: null, error: { message: "storage down" } }] },
    );
    const { POST } = await importRoute();

    const res = await POST(
      formDataRequest({
        file: makeFile("rc.pdf", "application/pdf"),
        vehicleId: "1",
        vehicleNumber: "KA01AB1234",
        documentType: "rc_url",
      }),
    );

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/vehicles/documents", () => {
  it("rejects when requireAdminAuth fails", async () => {
    requireAdminAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      jsonRequest({ vehicleId: "1", documentType: "rc_url", filePath: "KA01AB1234/rc_url.pdf" }),
    );

    expect(res.status).toBe(403);
  });

  it("400s when a required field is missing", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(jsonRequest({ vehicleId: "1", documentType: "rc_url" }));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid documentType", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      jsonRequest({ vehicleId: "1", documentType: "selfie_url", filePath: "x" }),
    );

    expect(res.status).toBe(400);
  });

  it("clears the insurance validity dates alongside insurance_url", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin(
      { vehicles: [{ error: null }] },
      {},
      { "vehicle-documents": [{ error: null }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(
      jsonRequest({ vehicleId: "1", documentType: "insurance_url", filePath: "x/insurance_url.pdf" }),
    );

    expect(res.status).toBe(200);
    expect(supa.callCount("vehicles")).toBe(1);
  });

  it("does not touch date columns for a document type with no validity dates", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { vehicles: [{ error: null }] },
      {},
      { "vehicle-documents": [{ error: null }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(
      jsonRequest({ vehicleId: "1", documentType: "rc_url", filePath: "x/rc_url.pdf" }),
    );

    expect(res.status).toBe(200);
  });

  it("logs the audit entry on success", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      { vehicles: [{ error: null }] },
      {},
      { "vehicle-documents": [{ error: null }] },
    );
    const { DELETE } = await importRoute();

    await DELETE(jsonRequest({ vehicleId: "1", documentType: "rc_url", filePath: "x/rc_url.pdf" }));

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_DOCUMENT" }),
    );
  });

  it("surfaces a 500 when storage removal fails", async () => {
    requireAdminAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin(
      {},
      {},
      { "vehicle-documents": [{ data: null, error: { message: "storage down" } }] },
    );
    const { DELETE } = await importRoute();

    const res = await DELETE(
      jsonRequest({ vehicleId: "1", documentType: "rc_url", filePath: "x/rc_url.pdf" }),
    );

    expect(res.status).toBe(500);
  });
});
