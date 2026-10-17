// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function Consumer() {
  const { user, userRole, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="role">{userRole ?? "none"}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("fetches the session on mount and exposes the user/role", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "1", email: "a@b.com", role: "admin", displayName: "A" },
        }),
      }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("email").textContent).toBe("a@b.com");
  });

  it("clears user/role when the session fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("none");
  });

  it("clears user/role when the response is not ok/success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false }) }),
    );

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("none");
  });

  it("re-fetches on visibilitychange when stale enough", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: "1", email: "a@b.com", role: "admin", displayName: "A" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.advanceTimersByTime(16_000);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("does not re-fetch on visibilitychange within the stale threshold", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: "1", email: null, role: "staff", displayName: null } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("useAuth outside a provider returns the default context", () => {
    render(<Consumer />);
    expect(screen.getByTestId("role").textContent).toBe("none");
  });
});
