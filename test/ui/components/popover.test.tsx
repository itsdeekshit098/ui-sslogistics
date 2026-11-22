// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Popover } from "@ui/components/popover";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

function Harness({ initiallyOpen = true, onOpenChange = vi.fn(), ...props }: Partial<React.ComponentProps<typeof Popover>> & { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button ref={setAnchor} data-testid="anchor" onClick={() => setOpen((o) => !o)}>
        anchor
      </button>
      <button data-testid="elsewhere">elsewhere</button>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange(next);
        }}
        anchor={anchor}
        {...props}
      >
        <button>inside</button>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  it("renders its content in a portal when open, and nothing when closed", () => {
    const { rerender } = render(<Harness />);
    expect(screen.getByText("inside")).toBeInTheDocument();
    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
    cleanup();
    render(<Harness initiallyOpen={false} />);
    expect(screen.queryByText("inside")).toBeNull();
    void rerender;
  });

  it("closes on Escape and returns focus to the anchor", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(screen.getByTestId("anchor"));
    expect(screen.queryByText("inside")).toBeNull();
  });

  it("closes on a pointer-down outside", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByTestId("elsewhere"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open for a pointer-down inside it", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByText("inside"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not treat a pointer-down on its own anchor as outside (the anchor toggles it)", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.pointerDown(screen.getByTestId("anchor"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("is a bordered, shadowed surface above the page, positioned by custom properties", () => {
    render(<Harness />);
    const popup = screen.getByRole("dialog");
    expect(isInUiLayer(popup)).toBe(true);
    const css = styleOf(popup);
    expect(css.position).toBe("fixed");
    expect(css["z-index"]).toBe("var(--z-popover)");
    expect(css["background-color"]).toBe("var(--popover)");
    expect(popup.getAttribute("style")).toMatch(/--pop-left/);
    expect(popup.getAttribute("style")).not.toMatch(/(^|;)\s*(top|left)\s*:/);
  });

  it("can match the anchor's width or take a fixed one", () => {
    const { unmount } = render(<Harness matchAnchorWidth />);
    expect(screen.getByRole("dialog").getAttribute("style")).toMatch(/--pop-width: 0px/);
    unmount();
    render(<Harness width={280} />);
    expect(screen.getByRole("dialog").getAttribute("style")).toMatch(/--pop-width: 280px/);
  });

  it("takes another role", () => {
    render(<Harness role="listbox" />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("flips above the anchor when there is no room below", () => {
    const anchorRect = { top: 780, bottom: 800, left: 10, right: 100, width: 90, height: 20, x: 10, y: 780, toJSON() {} } as DOMRect;
    Object.defineProperty(window, "innerHeight", { value: 820, configurable: true });
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(anchorRect);
    render(<Harness />);
    // Opening upward anchors the bottom edge to the top of the anchor.
    expect(screen.getByRole("dialog").getAttribute("style")).toMatch(/--pop-bottom: -?[\d.]+px/);
    expect(screen.getByRole("dialog").getAttribute("style")).toMatch(/--pop-top: auto/);
    spy.mockRestore();
    act(() => {});
  });
});
