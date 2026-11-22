// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Alert } from "@ui/components/alert";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Alert", () => {
  it("shows its message and an optional title", () => {
    render(<Alert title="Save failed">Check your connection.</Alert>);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(screen.getByText("Check your connection.")).toBeInTheDocument();
  });

  it("announces danger and warning assertively, the rest politely", () => {
    const { rerender } = render(<Alert tone="danger">x</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<Alert tone="warning">x</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<Alert tone="success">x</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<Alert tone="info">x</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  describe("scrollIntoView", () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    beforeEach(() => {
      scroll.mockClear();
      Element.prototype.scrollIntoView = scroll;
    });
    afterEach(() => {
      Element.prototype.scrollIntoView = original;
    });

    it("does nothing unless asked", () => {
      render(<Alert tone="danger">x</Alert>);
      expect(scroll).not.toHaveBeenCalled();
    });

    it("brings the message into view when it appears and when its text changes", () => {
      const { rerender } = render(<Alert tone="danger" scrollIntoView>first</Alert>);
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
      rerender(<Alert tone="danger" scrollIntoView>second</Alert>);
      expect(scroll).toHaveBeenCalledTimes(2);
    });

    it("does not scroll again for an unrelated re-render", () => {
      const { rerender } = render(<Alert tone="danger" scrollIntoView>same</Alert>);
      rerender(<Alert tone="danger" scrollIntoView>same</Alert>);
      expect(scroll).toHaveBeenCalledTimes(1);
    });
  });

  it("lets the caller override the role", () => {
    render(<Alert tone="danger" role="status">x</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onDismiss from a labelled close button, and has none without it", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Alert>x</Alert>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    rerender(<Alert onDismiss={onDismiss}>x</Alert>);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders an action beside the message", () => {
    render(<Alert action={<button>Retry</button>}>x</Alert>);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("omits the icon when given null", () => {
    const { container, rerender } = render(<Alert>x</Alert>);
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<Alert icon={null}>x</Alert>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it.each([
    ["danger", "var(--destructive-subtle)", "var(--destructive-subtle-foreground)"],
    ["success", "var(--success-subtle)", "var(--success-subtle-foreground)"],
    ["warning", "var(--warning-subtle)", "var(--warning-subtle-foreground)"],
    ["info", "var(--info-subtle)", "var(--info-subtle-foreground)"],
    ["neutral", "var(--muted)", "var(--muted-foreground)"],
  ] as const)("%s uses its tinted surface and readable text", (tone, bg, fg) => {
    render(<Alert tone={tone}>x</Alert>);
    const root = screen.getByText("x").closest('[data-ui="alert"]') as HTMLElement;
    expect(isInUiLayer(root)).toBe(true);
    expect(styleOf(root)["background-color"]).toBe(bg);
    expect(styleOf(root).color).toBe(fg);
    expect(root.getAttribute("style")).toBeNull();
  });

  it("passes a caller's className through", () => {
    render(<Alert className="mb-4">x</Alert>);
    expect(screen.getByText("x").closest('[data-ui="alert"]')).toHaveClass("mb-4");
  });
});
