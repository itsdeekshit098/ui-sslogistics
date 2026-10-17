import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const listUsers = vi.fn();
const getUserById = vi.fn();
const updateUserById = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    auth: { admin: { listUsers, getUserById, updateUserById, signOut } },
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { requireSuperAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { SUPERADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/admin/sessions/route");
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const URL = "http://localhost/api/admin/sessions";

beforeEach(() => {
  requireSuperAdminAuth.mockReset();
  logActivity.mockReset();
  listUsers.mockReset();
  getUserById.mockReset();
  updateUserById.mockReset();
  signOut.mockReset();
  rpc.mockReset();
});

describe("GET /api/admin/sessions", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL));

    expect(res.status).toBe(403);
  });

  it("surfaces a 500 when listUsers fails", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    listUsers.mockResolvedValue({ data: null, error: { message: "timeout" } });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL));

    expect(res.status).toBe(500);
  });

  it("groups sessions by user and derives device labels", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "a@test.com", user_metadata: {}, app_metadata: { role: "admin" }, created_at: "2026-01-01" },
        ],
        total: 1,
      },
      error: null,
    });
    rpc.mockResolvedValue({
      data: [
        {
          session_id: "s1",
          user_id: "u1",
          user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit",
          ip: "1.2.3.4",
          created_at: "2026-01-02",
          updated_at: "2026-01-03",
        },
      ],
      error: null,
    });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.users[0].sessions[0].device).toBe("iPhone");
  });

  it("gracefully degrades to an empty session list when the RPC hasn't been created yet", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    listUsers.mockResolvedValue({
      data: { users: [{ id: "u1", email: "a@test.com", user_metadata: {}, app_metadata: {}, created_at: "2026-01-01" }], total: 1 },
      error: null,
    });
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.users[0].sessions).toEqual([]);
  });

  it("marks a user as banned only when banned_until is in the future", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "a@test.com", user_metadata: {}, app_metadata: {}, created_at: "2026-01-01", banned_until: "2099-01-01T00:00:00Z" },
          { id: "u2", email: "b@test.com", user_metadata: {}, app_metadata: {}, created_at: "2026-01-01", banned_until: "2000-01-01T00:00:00Z" },
        ],
        total: 2,
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: [], error: null });
    const { GET } = await importRoute();

    const res = await GET(new NextRequest(URL));
    const body = await res.json();

    expect(body.data.users[0].isBanned).toBe(true);
    expect(body.data.users[1].isBanned).toBe(false);
  });
});

describe("PUT /api/admin/sessions (ban/unban)", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "ban" }));

    expect(res.status).toBe(403);
  });

  it("400s on a missing userId", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { action: "ban" }));

    expect(res.status).toBe(400);
  });

  it("400s on an invalid action", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "delete" }));

    expect(res.status).toBe(400);
  });

  it("400s when trying to ban your own account", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest(URL, "PUT", { userId: SUPERADMIN_USER.id, action: "ban" }),
    );

    expect(res.status).toBe(400);
  });

  it("404s when the target user does not exist", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "ban" }));

    expect(res.status).toBe(404);
  });

  it("bans the user and logs BAN_USER", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "ban" }));

    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("u2", expect.objectContaining({ ban_duration: "876600h" }));
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "BAN_USER" }));
  });

  it("unbans the user and logs UNBAN_USER", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "unban" }));

    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith("u2", { ban_duration: "none" });
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "UNBAN_USER" }));
  });

  it("surfaces a 500 when the ban update fails", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: { message: "db error" } });
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest(URL, "PUT", { userId: "u2", action: "ban" }));

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/admin/sessions (revoke)", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(`${URL}?userId=u2`));

    expect(res.status).toBe(403);
  });

  it("400s on a missing userId", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(URL));

    expect(res.status).toBe(400);
  });

  it("400s when trying to revoke your own sessions", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(`${URL}?userId=${SUPERADMIN_USER.id}`));

    expect(res.status).toBe(400);
  });

  it("404s when the target user does not exist", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: null, error: { message: "not found" } });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(`${URL}?userId=u2`));

    expect(res.status).toBe(404);
  });

  it("revokes sessions via RPC and logs REVOKE_SESSIONS", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    rpc.mockResolvedValue({ error: null });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(`${URL}?userId=u2`));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("revoke_user_sessions", { target_user_id: "u2" });
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: "REVOKE_SESSIONS" }));
  });

  it("surfaces a 500 when the RPC fails", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    rpc.mockResolvedValue({ error: { message: "db error" } });
    const { DELETE } = await importRoute();

    const res = await DELETE(new NextRequest(`${URL}?userId=u2`));

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/sessions (reset password)", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { PATCH } = await importRoute();

    const res = await PATCH(jsonRequest(URL, "PATCH", { userId: "u2", newPassword: "secret1" }));

    expect(res.status).toBe(403);
  });

  it("400s when newPassword is too short", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PATCH } = await importRoute();

    const res = await PATCH(jsonRequest(URL, "PATCH", { userId: "u2", newPassword: "abc" }));

    expect(res.status).toBe(400);
  });

  it("400s when resetting your own password here", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PATCH } = await importRoute();

    const res = await PATCH(
      jsonRequest(URL, "PATCH", { userId: SUPERADMIN_USER.id, newPassword: "secret1" }),
    );

    expect(res.status).toBe(400);
  });

  it("resets the password, revokes sessions, and logs RESET_PASSWORD", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    const { PATCH } = await importRoute();

    const res = await PATCH(jsonRequest(URL, "PATCH", { userId: "u2", newPassword: "secret1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sessionsRevoked).toBe(true);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RESET_PASSWORD", details: expect.objectContaining({ sessionsRevoked: true }) }),
    );
  });

  it("still succeeds, flagging sessionsRevoked=false, if signOut throws", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    signOut.mockRejectedValue(new Error("boom"));
    const { PATCH } = await importRoute();

    const res = await PATCH(jsonRequest(URL, "PATCH", { userId: "u2", newPassword: "secret1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sessionsRevoked).toBe(false);
  });

  it("surfaces a 500 when the password update itself fails", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getUserById.mockResolvedValue({ data: { user: { id: "u2", email: "b@test.com", app_metadata: {} } }, error: null });
    updateUserById.mockResolvedValue({ error: { message: "db error" } });
    const { PATCH } = await importRoute();

    const res = await PATCH(jsonRequest(URL, "PATCH", { userId: "u2", newPassword: "secret1" }));

    expect(res.status).toBe(500);
  });
});
