import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut } })),
}));

async function importRoute() {
  return await import("@/app/api/auth/signout/route");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/signout", () => {
  it("signs out successfully", async () => {
    signOut.mockResolvedValue({ error: null });
    const { POST } = await importRoute();

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Signed out successfully");
  });

  it("surfaces a 500 when sign-out fails", async () => {
    signOut.mockResolvedValue({ error: { message: "network error" } });
    const { POST } = await importRoute();

    const res = await POST();

    expect(res.status).toBe(500);
  });
});
