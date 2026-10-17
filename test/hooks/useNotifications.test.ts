// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotifications } from "@/hooks/useNotifications";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  emit(type: string, data: unknown) {
    this.listeners[type]?.forEach((cb) => cb({ data: JSON.stringify(data) } as MessageEvent));
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useNotifications", () => {
  it("fetches notifications on mount and opens an SSE stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: { data: [{ id: 1 }], total: 1, unreadCount: 1 },
        }),
      }),
    );

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.notifications).toEqual([{ id: 1 }]);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/notifications/stream");
  });

  it("prepends a notification pushed over SSE and bumps unreadCount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: { data: [], total: 0, unreadCount: 0 } }),
      }),
    );

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    act(() => {
      FakeEventSource.instances[0].emit("notification", { id: 5, title: "New" });
    });

    expect(result.current.notifications[0]).toMatchObject({ id: 5 });
    expect(result.current.unreadCount).toBe(1);
  });

  it("re-fetches on reconnect (onopen)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { data: [], total: 0, unreadCount: 0 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useNotifications());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      FakeEventSource.instances[0].onopen?.();
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("markRead optimistically updates and calls the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: { data: [{ id: 1, read_at: null }], total: 1, unreadCount: 1 },
        }),
      }),
    );

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markRead(1);
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].read_at).not.toBeNull();
  });

  it("markAllRead clears unreadCount and sets read_at on all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: {
            data: [
              { id: 1, read_at: null },
              { id: 2, read_at: null },
            ],
            total: 2,
            unreadCount: 2,
          },
        }),
      }),
    );

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read_at !== null)).toBe(true);
  });

  it("closes the EventSource on unmount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: { data: [], total: 0, unreadCount: 0 } }),
      }),
    );

    const { unmount } = renderHook(() => useNotifications());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    unmount();

    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it("swallows a failed initial fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});
