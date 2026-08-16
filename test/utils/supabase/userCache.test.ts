import { describe, it, expect, vi, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedUser } from "@/utils/supabase/userCache";

// The module under test keeps its cache in a Map scoped to the module
// instance, which vitest loads once per test file — so every test below
// uses its own unique cookie token to get its own cache key. Reusing a
// token across tests would let an earlier test's still-fresh cache entry
// silently answer a later test without Supabase ever being called.
function fakeRequest(cookiePairs: [string, string][]): NextRequest {
  return {
    cookies: {
      getAll: () => cookiePairs.map(([name, value]) => ({ name, value })),
    },
  } as unknown as NextRequest;
}

function fakeSupabase(user: { id: string } | null) {
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  return {
    client: { auth: { getUser } } as unknown as SupabaseClient,
    getUser,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getCachedUser", () => {
  it("calls Supabase once and returns the user on a fresh key", async () => {
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const req = fakeRequest([["sb-access-token", "token-fresh"]]);

    const user = await getCachedUser(req, client);

    expect(user).toEqual({ id: "user-1" });
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("serves a second call for the same session from cache, not a new Supabase call", async () => {
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const req = fakeRequest([["sb-access-token", "token-repeat"]]);

    await getCachedUser(req, client);
    await getCachedUser(req, client);

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("re-checks once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const req = fakeRequest([["sb-access-token", "token-ttl"]]);

    await getCachedUser(req, client);
    vi.advanceTimersByTime(5_001); // just past AUTH_USER_CACHE_TTL_MS (5s)
    await getCachedUser(req, client);

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("treats a different session (different cookie value) as a different cache key", async () => {
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const reqA = fakeRequest([["sb-access-token", "token-diff-a"]]);
    const reqB = fakeRequest([["sb-access-token", "token-diff-b"]]);

    await getCachedUser(reqA, client);
    await getCachedUser(reqB, client);

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("produces the same cache key regardless of cookie order", async () => {
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const reqA = fakeRequest([
      ["sb-access-token", "token-order-a"],
      ["sb-refresh-token", "token-order-b"],
    ]);
    const reqB = fakeRequest([
      ["sb-refresh-token", "token-order-b"],
      ["sb-access-token", "token-order-a"],
    ]);

    await getCachedUser(reqA, client);
    await getCachedUser(reqB, client);

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("ignores non-sb- cookies when building the cache key", async () => {
    const { client, getUser } = fakeSupabase({ id: "user-1" });
    const reqA = fakeRequest([
      ["sb-access-token", "token-nonsb"],
      ["theme", "dark"],
    ]);
    const reqB = fakeRequest([
      ["sb-access-token", "token-nonsb"],
      ["theme", "light"],
    ]);

    await getCachedUser(reqA, client);
    await getCachedUser(reqB, client);

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("caches a null user for anonymous requests just like a real one", async () => {
    const { client, getUser } = fakeSupabase(null);
    const req = fakeRequest([]);

    const first = await getCachedUser(req, client);
    const second = await getCachedUser(req, client);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
