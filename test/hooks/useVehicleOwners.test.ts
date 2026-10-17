// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useVehicleOwners,
  invalidateVehicleOwnersCache,
} from "@/hooks/useVehicleOwners";

beforeEach(() => {
  invalidateVehicleOwnersCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateVehicleOwnersCache();
});

describe("useVehicleOwners", () => {
  it("loads owners from the API on mount", async () => {
    const owners = [{ id: 1, name: "Owner A" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: owners }) }),
    );

    const { result } = renderHook(() => useVehicleOwners());

    await waitFor(() => expect(result.current.owners).toEqual(owners));
  });

  it("returns an empty list and does not cache on a failed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ success: false }) }),
    );

    const { result } = renderHook(() => useVehicleOwners());

    await waitFor(() => expect(result.current.owners).toEqual([]));
  });

  it("appends a locally-added owner without refetching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ success: true, data: [] }) }),
    );

    const { result } = renderHook(() => useVehicleOwners());
    await waitFor(() => expect(result.current.owners).toEqual([]));

    act(() => result.current.addOwner({ id: 2, name: "New Owner" } as never));

    expect(result.current.owners).toEqual([{ id: 2, name: "New Owner" }]);
  });

  it("shares one in-flight request across concurrent mounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const a = renderHook(() => useVehicleOwners());
    const b = renderHook(() => useVehicleOwners());

    await waitFor(() => expect(a.result.current.owners).toEqual([]));
    await waitFor(() => expect(b.result.current.owners).toEqual([]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
