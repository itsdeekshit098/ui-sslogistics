// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { BottomSheet } from "@ui/components/bottomSheet";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("BottomSheet", () => {
  it("renders nothing when closed", () => {
    render(
      <BottomSheet open={false} onClose={vi.fn()} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog with its title and content once mounted", async () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Sheet title">
        <div>Body content</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Sheet title")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("clicking the backdrop calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(document.querySelector('[data-ui="bottom-sheet-backdrop"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the close button calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pressing Escape calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the sheet while open", async () => {
    render(
      <BottomSheet open onClose={vi.fn()} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
  });
});

describe("BottomSheet styles", () => {
  it("is fixed to the bottom edge with a rounded top and a dimmed backdrop beneath it", async () => {
    render(<BottomSheet open onClose={() => {}} title="Sheet">x</BottomSheet>);
    const panel = await screen.findByRole("dialog");
    expect(isInUiLayer(panel)).toBe(true);
    const css = styleOf(panel);
    expect(css.position).toBe("fixed");
    expect(css.bottom).toBe("0");
    expect(css["max-height"]).toBe("92dvh");
    expect(css["border-top-left-radius"]).toBe("var(--m-radius-sheet)");
    expect(css["background-color"]).toBe("var(--card)");
    const backdrop = document.querySelector('[data-ui="bottom-sheet-backdrop"]')!;
    expect(styleOf(backdrop)["background-color"]).toBe("var(--overlay-background)");
    expect(Number(styleOf(backdrop)["z-index"])).toBeLessThan(Number(css["z-index"]));
    expect(panel.getAttribute("style")).toBeNull();
  });

  it("stacks below the modal overlay, so a confirm dialog opened from it shows on top", async () => {
    render(<BottomSheet open onClose={() => {}} title="Sheet">x</BottomSheet>);
    const panel = await screen.findByRole("dialog");
    expect(Number(styleOf(panel)["z-index"])).toBeLessThan(50);
  });
});

describe("BottomSheet close button", () => {
  it("pulls 4px into the header's right padding with a valid negative margin", async () => {
    // Regression: `-var(--space-1)` is invalid CSS and was silently dropped,
    // moving the close icon 4px.
    render(<BottomSheet open onClose={() => {}} title="Sheet">x</BottomSheet>);
    const close = await screen.findByRole("button", { name: "Close" });
    expect(styleOf(close)["margin-right"]).toBe("calc(var(--space-1) * -1)");
  });
});
