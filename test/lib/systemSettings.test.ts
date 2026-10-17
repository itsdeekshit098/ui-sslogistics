import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseAdmin } from "@test/supabaseMock";

async function importFresh() {
  // The module keeps an in-memory cache in a module-level variable, so each
  // test needs its own fresh module instance to avoid leaking cache state
  // (and therefore mock expectations) across tests.
  vi.resetModules();
  return await import("@/lib/systemSettings");
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getMaintenanceStatus (cached)", () => {
  it("returns the row's values when found", async () => {
    mockSupabaseAdmin({
      system_settings: [
        { data: { maintenance_mode: true, maintenance_message: "Down for upgrade" }, error: null },
      ],
    });
    const { getMaintenanceStatus } = await importFresh();

    const status = await getMaintenanceStatus();

    expect(status).toEqual({ maintenanceMode: true, message: "Down for upgrade" });
  });

  it("defaults to maintenance-off when the row doesn't exist", async () => {
    mockSupabaseAdmin({
      system_settings: [{ data: null, error: null }],
    });
    const { getMaintenanceStatus } = await importFresh();

    const status = await getMaintenanceStatus();

    expect(status).toEqual({ maintenanceMode: false, message: null });
  });

  it("defaults to maintenance-off when the query errors — a DB hiccup must not block the whole app", async () => {
    mockSupabaseAdmin({
      system_settings: [{ data: null, error: { message: "timeout" } }],
    });
    const { getMaintenanceStatus } = await importFresh();

    const status = await getMaintenanceStatus();

    expect(status).toEqual({ maintenanceMode: false, message: null });
  });

  it("serves a cached result on a second call within the TTL without re-querying", async () => {
    const supa = mockSupabaseAdmin({
      system_settings: [
        { data: { maintenance_mode: false, maintenance_message: null }, error: null },
      ],
    });
    const { getMaintenanceStatus } = await importFresh();

    await getMaintenanceStatus();
    await getMaintenanceStatus();

    expect(supa.callCount("system_settings")).toBe(1);
  });

  it("re-queries once the cache TTL has elapsed", async () => {
    vi.useFakeTimers();
    const supa = mockSupabaseAdmin({
      system_settings: [
        { data: { maintenance_mode: false, maintenance_message: null }, error: null },
      ],
    });
    const { getMaintenanceStatus } = await importFresh();

    await getMaintenanceStatus();
    vi.advanceTimersByTime(5_001);
    await getMaintenanceStatus();

    expect(supa.callCount("system_settings")).toBe(2);
  });
});

describe("getMaintenanceStatusUncached", () => {
  it("always queries, bypassing the cache", async () => {
    const supa = mockSupabaseAdmin({
      system_settings: [
        { data: { maintenance_mode: true, maintenance_message: "msg" }, error: null },
      ],
    });
    const { getMaintenanceStatus, getMaintenanceStatusUncached } = await importFresh();

    await getMaintenanceStatus(); // populates the cache
    await getMaintenanceStatusUncached();
    await getMaintenanceStatusUncached();

    expect(supa.callCount("system_settings")).toBe(3);
  });
});

describe("setMaintenanceMode", () => {
  it("updates the singleton row and invalidates the cache", async () => {
    const supa = mockSupabaseAdmin({
      system_settings: [
        { data: { maintenance_mode: false, maintenance_message: null }, error: null }, // initial cache-populating read
        { error: null }, // update
        { data: { maintenance_mode: true, maintenance_message: "Now down" }, error: null }, // post-invalidation read
      ],
    });
    const { getMaintenanceStatus, setMaintenanceMode } = await importFresh();

    await getMaintenanceStatus();
    await setMaintenanceMode(true, "Now down", "admin-1");
    const status = await getMaintenanceStatus();

    expect(status).toEqual({ maintenanceMode: true, message: "Now down" });
    expect(supa.callCount("system_settings")).toBe(3);
  });

  it("throws when the update fails", async () => {
    mockSupabaseAdmin({
      system_settings: [{ error: { message: "disk full" } }],
    });
    const { setMaintenanceMode } = await importFresh();

    await expect(setMaintenanceMode(true, "msg", "admin-1")).rejects.toThrow(
      /Failed to update maintenance mode/,
    );
  });
});

describe("getAppVersionConfigUncached", () => {
  it("returns the row's values when found", async () => {
    mockSupabaseAdmin({
      system_settings: [
        {
          data: { min_android_version_code: 42, force_update_message: "Please update" },
          error: null,
        },
      ],
    });
    const { getAppVersionConfigUncached } = await importFresh();

    const config = await getAppVersionConfigUncached();

    expect(config).toEqual({
      minAndroidVersionCode: 42,
      forceUpdateMessage: "Please update",
    });
  });

  it("defaults to nulls when the row doesn't exist", async () => {
    mockSupabaseAdmin({
      system_settings: [{ data: null, error: null }],
    });
    const { getAppVersionConfigUncached } = await importFresh();

    const config = await getAppVersionConfigUncached();

    expect(config).toEqual({ minAndroidVersionCode: null, forceUpdateMessage: null });
  });
});

describe("setMinAndroidVersionCode", () => {
  it("updates the singleton row", async () => {
    const supa = mockSupabaseAdmin({
      system_settings: [{ error: null }],
    });
    const { setMinAndroidVersionCode } = await importFresh();

    await setMinAndroidVersionCode(50, "Update now", "admin-1");

    expect(supa.callCount("system_settings")).toBe(1);
  });

  it("throws when the update fails", async () => {
    mockSupabaseAdmin({
      system_settings: [{ error: { message: "disk full" } }],
    });
    const { setMinAndroidVersionCode } = await importFresh();

    await expect(setMinAndroidVersionCode(50, "msg", "admin-1")).rejects.toThrow(
      /Failed to update minimum app version/,
    );
  });
});
