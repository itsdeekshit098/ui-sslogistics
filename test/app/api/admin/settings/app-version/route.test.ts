import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getAppVersionConfigUncached = vi.fn();
const setMinAndroidVersionCode = vi.fn();
vi.mock("@/lib/systemSettings", () => ({
  getAppVersionConfigUncached: (...args: unknown[]) => getAppVersionConfigUncached(...args),
  setMinAndroidVersionCode: (...args: unknown[]) => setMinAndroidVersionCode(...args),
}));

import { requireSuperAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { SUPERADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/admin/settings/app-version/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/settings/app-version", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireSuperAdminAuth.mockReset();
  logActivity.mockReset();
  getAppVersionConfigUncached.mockReset();
  setMinAndroidVersionCode.mockReset();
});

describe("GET /api/admin/settings/app-version", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns the current config", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getAppVersionConfigUncached.mockResolvedValue({
      minAndroidVersionCode: 10,
      forceUpdateMessage: null,
    });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.minAndroidVersionCode).toBe(10);
  });
});

describe("PUT /api/admin/settings/app-version", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ minAndroidVersionCode: 10 }));

    expect(res.status).toBe(403);
  });

  it("400s on a non-integer minAndroidVersionCode", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ minAndroidVersionCode: 10.5 }));

    expect(res.status).toBe(400);
  });

  it("accepts null to clear the requirement", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    setMinAndroidVersionCode.mockResolvedValue(undefined);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ minAndroidVersionCode: null }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Force-update requirement cleared");
  });

  it("sets a new minimum version and logs SET_MIN_APP_VERSION", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    setMinAndroidVersionCode.mockResolvedValue(undefined);
    const { PUT } = await importRoute();

    const res = await PUT(
      jsonRequest({ minAndroidVersionCode: 15, message: "Please update" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Minimum app version updated");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SET_MIN_APP_VERSION" }),
    );
  });
});
