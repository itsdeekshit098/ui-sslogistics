import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getMaintenanceStatusUncached = vi.fn();
const setMaintenanceMode = vi.fn();
vi.mock("@/lib/systemSettings", () => ({
  getMaintenanceStatusUncached: (...args: unknown[]) => getMaintenanceStatusUncached(...args),
  setMaintenanceMode: (...args: unknown[]) => setMaintenanceMode(...args),
}));

import { requireSuperAdminAuth } from "@test/authMock";
import { logActivity } from "@test/activityLogMock";
import { SUPERADMIN_USER, forbiddenError } from "@test/fixtures";

async function importRoute() {
  return await import("@/app/api/admin/settings/maintenance/route");
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/settings/maintenance", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireSuperAdminAuth.mockReset();
  logActivity.mockReset();
  getMaintenanceStatusUncached.mockReset();
  setMaintenanceMode.mockReset();
});

describe("GET /api/admin/settings/maintenance", () => {
  it("rejects when requireSuperAdminAuth fails — a plain admin cannot reach this", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns the current status", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    getMaintenanceStatusUncached.mockResolvedValue({ maintenanceMode: false, message: null });
    const { GET } = await importRoute();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.maintenanceMode).toBe(false);
  });
});

describe("PUT /api/admin/settings/maintenance", () => {
  it("rejects when requireSuperAdminAuth fails", async () => {
    requireSuperAdminAuth.mockRejectedValue(forbiddenError());
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ maintenanceMode: true }));

    expect(res.status).toBe(403);
  });

  it("400s when maintenanceMode is not a boolean", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ maintenanceMode: "yes" }));

    expect(res.status).toBe(400);
  });

  it("400s when message is neither a string nor null", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ maintenanceMode: true, message: 123 }));

    expect(res.status).toBe(400);
  });

  it("enables maintenance mode and logs ENABLE_MAINTENANCE_MODE", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    setMaintenanceMode.mockResolvedValue(undefined);
    const { PUT } = await importRoute();

    const res = await PUT(jsonRequest({ maintenanceMode: true, message: "Down for upgrade" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.maintenanceMode).toBe(true);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ENABLE_MAINTENANCE_MODE" }),
    );
  });

  it("disables maintenance mode and logs DISABLE_MAINTENANCE_MODE", async () => {
    requireSuperAdminAuth.mockResolvedValue(SUPERADMIN_USER);
    setMaintenanceMode.mockResolvedValue(undefined);
    const { PUT } = await importRoute();

    await PUT(jsonRequest({ maintenanceMode: false }));

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DISABLE_MAINTENANCE_MODE" }),
    );
  });
});
