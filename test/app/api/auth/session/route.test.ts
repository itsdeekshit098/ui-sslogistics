import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

async function importRoute() {
  return await import("@/app/api/auth/session/route");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/session", () => {
  it("401s with SESSION_INVALID when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("SESSION_INVALID");
  });

  it("401s with SESSION_INVALID when Supabase returns an error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns the user's id, email, role and displayName on success", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "a@test.com",
          app_metadata: { role: "admin" },
          user_metadata: { display_name: "Alice" },
        },
      },
      error: null,
    });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      id: "u1",
      email: "a@test.com",
      role: "admin",
      displayName: "Alice",
    });
  });

  it("falls back to email for displayName when no display_name is set", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "u1", email: "a@test.com", app_metadata: {}, user_metadata: {} },
      },
      error: null,
    });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(body.data.displayName).toBe("a@test.com");
    expect(body.data.role).toBeNull();
  });
});
