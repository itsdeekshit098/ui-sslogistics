import { describe, it, expect, vi, beforeEach } from "vitest";

const getAppVersionConfigUncached = vi.fn();
vi.mock("@/lib/systemSettings", () => ({
  getAppVersionConfigUncached: (...args: unknown[]) => getAppVersionConfigUncached(...args),
}));

async function importRoute() {
  return await import("@/app/api/system/app-version/route");
}

beforeEach(() => {
  getAppVersionConfigUncached.mockReset();
});

describe("GET /api/system/app-version", () => {
  it("requires no authentication — must work pre-login and during maintenance", async () => {
    getAppVersionConfigUncached.mockResolvedValue({
      minAndroidVersionCode: 10,
      forceUpdateMessage: null,
    });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(200);
  });

  it("returns the config as-is", async () => {
    getAppVersionConfigUncached.mockResolvedValue({
      minAndroidVersionCode: 20,
      forceUpdateMessage: "Please update",
    });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(body.data).toEqual({ minAndroidVersionCode: 20, forceUpdateMessage: "Please update" });
  });
});
