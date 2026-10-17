// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { MaintenanceProvider, useMaintenance } from "@/context/MaintenanceContext";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

function Consumer() {
  const { maintenanceMode, message } = useMaintenance();
  return (
    <div>
      <span data-testid="mode">{String(maintenanceMode)}</span>
      <span data-testid="message">{message ?? "none"}</span>
    </div>
  );
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MaintenanceProvider", () => {
  it("defaults to maintenance off", () => {
    render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );
    expect(screen.getByTestId("mode").textContent).toBe("false");
  });

  it("opens an SSE stream to the maintenance endpoint", () => {
    render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe("/api/system/maintenance-stream");
  });

  it("updates state when a valid message arrives", async () => {
    render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );

    act(() => {
      FakeEventSource.instances[0].onmessage?.({
        data: JSON.stringify({ maintenanceMode: true, message: "Down for maintenance" }),
      } as MessageEvent);
    });

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("true"));
    expect(screen.getByTestId("message").textContent).toBe("Down for maintenance");
  });

  it("ignores malformed event data", async () => {
    render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );

    expect(() =>
      act(() => {
        FakeEventSource.instances[0].onmessage?.({ data: "not json" } as MessageEvent);
      }),
    ).not.toThrow();

    expect(screen.getByTestId("mode").textContent).toBe("false");
  });

  it("ignores a message without a boolean maintenanceMode", () => {
    render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );

    act(() => {
      FakeEventSource.instances[0].onmessage?.({
        data: JSON.stringify({ message: "no mode field" }),
      } as MessageEvent);
    });

    expect(screen.getByTestId("mode").textContent).toBe("false");
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = render(
      <MaintenanceProvider>
        <Consumer />
      </MaintenanceProvider>,
    );
    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it("useMaintenance outside a provider returns the default context", () => {
    render(<Consumer />);
    expect(screen.getByTestId("mode").textContent).toBe("false");
    expect(screen.getByTestId("message").textContent).toBe("none");
  });
});
