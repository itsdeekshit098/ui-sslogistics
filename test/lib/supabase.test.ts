import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ mocked: true })),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("supabaseAdmin module init", () => {
  it("throws if NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    await expect(import("@/lib/supabase")).rejects.toThrow(
      /Missing NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws if SUPABASE_SERVICE_ROLE_KEY is missing — must never fall back to the anon key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import("@/lib/supabase")).rejects.toThrow(
      /Missing SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("constructs the admin client when both env vars are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/lib/supabase");

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-key",
    );
    expect(supabaseAdmin).toEqual({ mocked: true });
  });
});
