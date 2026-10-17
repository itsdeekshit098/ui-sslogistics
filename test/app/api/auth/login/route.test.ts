import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const signInWithPassword = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword },
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { mockSupabaseAdmin } from "@test/supabaseMock";

async function importRoute() {
  return await import("@/app/api/auth/login/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("400s when email is missing", async () => {
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ password: "secret" }));

    expect(res.status).toBe(400);
  });

  it("400s when password is missing", async () => {
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ email: "a@test.com" }));

    expect(res.status).toBe(400);
  });

  it("401s on invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login" } });
    mockSupabaseAdmin({});
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ email: "a@test.com", password: "wrong" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Invalid credentials. Please check your email and password.");
  });

  it("logs in successfully and revokes old sessions via RPC", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const supa = mockSupabaseAdmin({}, { revoke_old_user_sessions: [{ error: null }] });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ email: "a@test.com", password: "correct" }));

    expect(res.status).toBe(200);
    expect(supa.rpcCallCount("revoke_old_user_sessions")).toBe(1);
  });

  it("still returns success even if the session-revoke RPC fails — login must not be blocked by it", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockSupabaseAdmin({}, { revoke_old_user_sessions: [{ error: { message: "rpc failed" } }] });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ email: "a@test.com", password: "correct" }));

    expect(res.status).toBe(200);
  });

  it("still returns success even if the RPC call itself throws", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockSupabaseAdmin({}, { revoke_old_user_sessions: [() => { throw new Error("boom"); }] });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest({ email: "a@test.com", password: "correct" }));

    expect(res.status).toBe(200);
  });

  it("trims the email before authenticating", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mockSupabaseAdmin({}, { revoke_old_user_sessions: [{ error: null }] });
    const { POST } = await importRoute();

    await POST(jsonRequest({ email: "  a@test.com  ", password: "correct" }));

    expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@test.com", password: "correct" });
  });
});
