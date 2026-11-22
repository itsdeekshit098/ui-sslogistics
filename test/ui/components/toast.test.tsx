// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@ui/components/toast";
import { styleOf, isInUiLayer } from "@test/uiStyles";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger({ options }: { options: Parameters<ReturnType<typeof useToast>["toast"]>[0] }) {
  const { toast, dismissAll } = useToast();
  return (
    <>
      <button onClick={() => toast(options)}>show</button>
      <button onClick={dismissAll}>clear</button>
    </>
  );
}
const setup = (options: React.ComponentProps<typeof Trigger>["options"]) =>
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
const show = () => fireEvent.click(screen.getByText("show"));

describe("Toast", () => {
  it("shows a message in a labelled notifications region", () => {
    setup({ title: "Saved", description: "Loan updated" });
    show();
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Loan updated")).toBeInTheDocument();
  });

  it("announces a danger toast assertively and the others politely", () => {
    setup({ title: "Failed", tone: "danger" });
    show();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    cleanup();
    setup({ title: "Saved", tone: "success" });
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("goes away by itself after five seconds", () => {
    setup({ title: "Saved" });
    show();
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("keeps a danger toast longer", () => {
    setup({ title: "Failed", tone: "danger" });
    show();
    act(() => vi.advanceTimersByTime(7900));
    expect(screen.getByText("Failed")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Failed")).toBeNull();
  });

  it("stays until dismissed with duration 0", () => {
    setup({ title: "Sticky", duration: 0 });
    show();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Sticky")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Sticky")).toBeNull();
  });

  it("pauses while hovered, then finishes the time that was left", () => {
    setup({ title: "Saved", duration: 5000 });
    show();
    const item = screen.getByText("Saved").closest('[data-ui="toast"]') as HTMLElement;
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(item);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Saved")).toBeInTheDocument(); // paused
    fireEvent.mouseLeave(item);
    act(() => vi.advanceTimersByTime(1900));
    expect(screen.getByText("Saved")).toBeInTheDocument(); // ~2s were left
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("runs an action and closes the toast", () => {
    const onClick = vi.fn();
    setup({ title: "Deleted", action: { label: "Undo", onClick } });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Deleted")).toBeNull();
  });

  it("shows at most four, dropping the oldest", () => {
    function Many() {
      const { toast } = useToast();
      return <button onClick={() => ["a", "b", "c", "d", "e"].forEach((t) => toast({ title: t, duration: 0 }))}>go</button>;
    }
    render(
      <ToastProvider>
        <Many />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.queryByText("a")).toBeNull();
    expect(["b", "c", "d", "e"].every((t) => screen.getByText(t))).toBe(true);
  });

  it("dismisses everything", () => {
    setup({ title: "One", duration: 0 });
    show();
    fireEvent.click(screen.getByText("clear"));
    expect(screen.queryByText("One")).toBeNull();
  });

  it("throws a clear error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger options={{}} />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it("sits above modals, with a coloured edge for the tone", () => {
    setup({ title: "Saved", tone: "success" });
    show();
    const viewport = document.querySelector('[data-ui="toast-viewport"]') as HTMLElement;
    expect(isInUiLayer(viewport)).toBe(true);
    expect(styleOf(viewport).position).toBe("fixed");
    expect(styleOf(viewport)["z-index"]).toContain("var(--z-modal-nested-overlay)");
    const item = screen.getByText("Saved").closest('[data-ui="toast"]') as HTMLElement;
    expect(styleOf(item)["border-left-color"]).toBe("var(--success)");
  });

  it("sits in the corner on desktop", () => {
    setup({ title: "Saved" });
    show();
    const viewport = document.querySelector('[data-ui="toast-viewport"]') as HTMLElement;
    expect(styleOf(viewport, { media: "(min-width: 768px)" }).width).toBe("24rem");
  });
});
