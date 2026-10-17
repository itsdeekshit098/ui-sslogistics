import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getMaintenanceStatusUncached = vi.fn();
vi.mock("@/lib/systemSettings", () => ({
  getMaintenanceStatusUncached: (...args: unknown[]) => getMaintenanceStatusUncached(...args),
}));

async function importRoute() {
  return await import("@/app/api/system/maintenance-stream/route");
}

async function readOneChunk(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(value);
}

beforeEach(() => {
  getMaintenanceStatusUncached.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/system/maintenance-stream", () => {
  it("requires no authentication and returns SSE headers", async () => {
    getMaintenanceStatusUncached.mockResolvedValue({ maintenanceMode: false, message: null });
    const { GET } = await importRoute();

    const res = await GET();

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("sends the current status immediately on connect", async () => {
    getMaintenanceStatusUncached.mockResolvedValue({ maintenanceMode: true, message: "Down" });
    const { GET } = await importRoute();

    const res = await GET();
    const chunk = await readOneChunk(res);

    expect(chunk).toContain('"maintenanceMode":true');
    expect(chunk).toContain('"message":"Down"');
  });

  it("formats the event as a valid SSE data line", async () => {
    getMaintenanceStatusUncached.mockResolvedValue({ maintenanceMode: false, message: null });
    const { GET } = await importRoute();

    const res = await GET();
    const chunk = await readOneChunk(res);

    expect(chunk).toMatch(/^data: .+\n\n$/);
  });
});
