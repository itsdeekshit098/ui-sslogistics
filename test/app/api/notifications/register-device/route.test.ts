import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockSupabaseAdmin } from "@test/supabaseMock";
import { requireUserAuth } from "@test/authMock";
import { ADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/notifications/register-device/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/notifications/register-device", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireUserAuth.mockReset();
});

describe("POST /api/notifications/register-device", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ token: "tok", platform: "android" }));

    expect(res.status).toBe(403);
  });

  it("400s when token is missing", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ platform: "android" }));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid platform", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ token: "tok", platform: "windows" }));

    expect(res.status).toBe(400);
  });

  it("reassigns the token away from any other user before upserting for the caller", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    const supa = mockSupabaseAdmin({
      device_push_tokens: [{ error: null }, { error: null }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ token: "tok", platform: "android" }));

    expect(res.status).toBe(200);
    expect(supa.callCount("device_push_tokens")).toBe(2);
  });

  it("surfaces a 500 when the reassign step fails", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      device_push_tokens: [{ error: { message: "timeout" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ token: "tok", platform: "android" }));

    expect(res.status).toBe(500);
  });

  it("surfaces a 500 when the upsert step fails", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      device_push_tokens: [{ error: null }, { error: { message: "disk full" } }],
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ token: "tok", platform: "android" }));

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/notifications/register-device", () => {
  it("rejects when requireUserAuth fails", async () => {
    requireUserAuth.mockRejectedValue(forbiddenError());
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/notifications/register-device?token=tok"),
    );

    expect(res.status).toBe(403);
  });

  it("400s when token is missing", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({});
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/notifications/register-device"),
    );

    expect(res.status).toBe(400);
  });

  it("unregisters the caller's own token", async () => {
    requireUserAuth.mockResolvedValue(ADMIN_USER);
    mockSupabaseAdmin({
      device_push_tokens: [{ error: null }],
    });
    const { DELETE } = await importRoute();

    const res = await DELETE(
      new NextRequest("http://localhost/api/notifications/register-device?token=tok"),
    );

    expect(res.status).toBe(200);
  });
});
