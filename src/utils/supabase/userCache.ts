import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// getUser() revalidates the session against Supabase's auth server on every
// call — necessary for security (unlike getSession(), which just trusts the
// cookie), but too expensive to pay on every navigation when the same
// session was already verified moments ago. Cache the result briefly per
// session, same accepted-staleness tradeoff as getMaintenanceStatus()
// (systemSettings.ts): a stale read for up to TTL just delays when a role
// change/ban takes effect, it doesn't bypass it — the next request past the
// TTL (or the next token refresh, which changes the cache key) gets a real
// check.
const AUTH_USER_CACHE_TTL_MS = 5_000;
const MAX_ENTRIES = 2_000; // sized for admin web + all active mobile sessions

type CacheEntry = { promise: Promise<User | null>; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

// Keyed by the session's own cookies, sorted for stable ordering, so the key
// changes exactly when the session does: login, logout, and token refresh
// all produce a different key and therefore force a fresh check. Anonymous
// requests collapse to the same ("") key, which is correct — there's no
// per-user data at that key, and null is the right cached answer for all of
// them. No hashing needed: exact string keys have no collision risk (a weak
// hash could theoretically leak one session's cached identity onto another).
function sessionCacheKey(request: NextRequest): string {
  return request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`)
    .join(";");
}

export function getCachedUser(
  request: NextRequest,
  supabase: SupabaseClient,
): Promise<User | null> {
  const key = sessionCacheKey(request);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < AUTH_USER_CACHE_TTL_MS) {
    return hit.promise;
  }

  // Bound cache size with cheap FIFO eviction (Map preserves insertion
  // order) instead of a timer sweep — no background work, and an
  // expired-but-not-evicted entry is inert anyway since staleness is
  // checked at read time above.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  // Store the in-flight promise (not the awaited value) and insert before
  // awaiting, so concurrent requests for the same session (Next.js
  // prefetch/RSC fetches commonly fire in bursts) piggyback onto one
  // Supabase call instead of firing duplicates.
  const promise = supabase.auth.getUser().then(({ data }) => data.user);
  cache.set(key, { promise, fetchedAt: Date.now() });
  return promise;
}
