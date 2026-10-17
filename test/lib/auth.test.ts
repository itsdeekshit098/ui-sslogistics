import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

const setSentryUser = vi.fn();
vi.mock("@/lib/sentry/setUser", () => ({
  setSentryUser: (...args: unknown[]) => setSentryUser(...args),
}));

import {
  getAuthUser,
  requireUserAuth,
  requireAdminAuth,
  requireStrictAdminAuth,
  requireSuperAdminAuth,
} from "@/lib/auth";

function mockUser(overrides: Partial<{
  id: string;
  email: string;
  role: string | null;
  display_name: string;
}> = {}) {
  getUser.mockResolvedValue({
    data: {
      user: {
        id: overrides.id ?? "user-1",
        email: overrides.email ?? "person@test.com",
        app_metadata: { role: overrides.role ?? "staff" },
        user_metadata: overrides.display_name ? { display_name: overrides.display_name } : {},
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAuthUser", () => {
  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getAuthUser()).toBeNull();
  });

  it("returns the mapped user when a session exists", async () => {
    mockUser({ id: "u1", email: "a@test.com", role: "admin" });
    const user = await getAuthUser();
    expect(user).toEqual({
      id: "u1",
      email: "a@test.com",
      role: "admin",
      displayName: "a@test.com",
    });
  });

  it("prefers user_metadata.display_name over email when present", async () => {
    mockUser({ email: "a@test.com", display_name: "Alice" });
    const user = await getAuthUser();
    expect(user?.displayName).toBe("Alice");
  });

  it("reads the role from app_metadata, never user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "a@test.com",
          app_metadata: { role: "staff" },
          // A user could edit their own user_metadata — if role were ever
          // read from here by mistake, this test would catch it.
          user_metadata: { role: "admin" },
        },
      },
    });
    const user = await getAuthUser();
    expect(user?.role).toBe("staff");
  });

  it("defaults role to null when app_metadata has none", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@test.com", app_metadata: {}, user_metadata: {} } },
    });
    const user = await getAuthUser();
    expect(user?.role).toBeNull();
  });

  it("defaults email to 'unknown' when the session has none", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: null, app_metadata: { role: "staff" }, user_metadata: {} } },
    });
    const user = await getAuthUser();
    expect(user?.email).toBe("unknown");
  });

  it("attaches id + role only to Sentry — never email", async () => {
    mockUser({ id: "u1", email: "secret@test.com", role: "admin" });
    await getAuthUser();
    expect(setSentryUser).toHaveBeenCalledWith({ id: "u1", role: "admin" });
    expect(setSentryUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.anything() }),
    );
  });

  it("returns null rather than throwing when the Supabase call itself throws", async () => {
    getUser.mockRejectedValue(new Error("network down"));
    expect(await getAuthUser()).toBeNull();
  });
});

describe("requireUserAuth", () => {
  it("throws UNAUTHORIZED when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireUserAuth()).rejects.toThrow(/^UNAUTHORIZED/);
  });

  it("throws FORBIDDEN for an invalid/unknown role", async () => {
    mockUser({ role: "owner" });
    await expect(requireUserAuth()).rejects.toThrow(/^FORBIDDEN/);
  });

  it("resolves for every valid role", async () => {
    for (const role of ["admin", "staff", "driver", "superadmin"]) {
      mockUser({ role });
      await expect(requireUserAuth()).resolves.toMatchObject({ role });
    }
  });
});

describe("requireAdminAuth", () => {
  it("resolves for admin, superadmin, and staff", async () => {
    for (const role of ["admin", "superadmin", "staff"]) {
      mockUser({ role });
      await expect(requireAdminAuth()).resolves.toMatchObject({ role });
    }
  });

  it("throws FORBIDDEN for driver", async () => {
    mockUser({ role: "driver" });
    await expect(requireAdminAuth()).rejects.toThrow(/^FORBIDDEN/);
  });

  it("throws UNAUTHORIZED when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireAdminAuth()).rejects.toThrow(/^UNAUTHORIZED/);
  });
});

describe("requireStrictAdminAuth", () => {
  it("resolves for admin and superadmin only", async () => {
    for (const role of ["admin", "superadmin"]) {
      mockUser({ role });
      await expect(requireStrictAdminAuth()).resolves.toMatchObject({ role });
    }
  });

  it("throws FORBIDDEN for staff — staff can edit most things but not money modules", async () => {
    mockUser({ role: "staff" });
    await expect(requireStrictAdminAuth()).rejects.toThrow(/^FORBIDDEN/);
  });

  it("throws FORBIDDEN for driver", async () => {
    mockUser({ role: "driver" });
    await expect(requireStrictAdminAuth()).rejects.toThrow(/^FORBIDDEN/);
  });
});

describe("requireSuperAdminAuth", () => {
  it("resolves only for superadmin", async () => {
    mockUser({ role: "superadmin" });
    await expect(requireSuperAdminAuth()).resolves.toMatchObject({ role: "superadmin" });
  });

  it("throws FORBIDDEN for a plain admin — superadmin-exclusive routes lock even admin out", async () => {
    mockUser({ role: "admin" });
    await expect(requireSuperAdminAuth()).rejects.toThrow(/^FORBIDDEN/);
  });

  it("throws FORBIDDEN for staff and driver", async () => {
    for (const role of ["staff", "driver"]) {
      mockUser({ role });
      await expect(requireSuperAdminAuth()).rejects.toThrow(/^FORBIDDEN/);
    }
  });

  it("throws UNAUTHORIZED when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireSuperAdminAuth()).rejects.toThrow(/^UNAUTHORIZED/);
  });
});
