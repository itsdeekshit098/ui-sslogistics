// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { BottomSheet } from "@/components/ui/bottomSheet/bottomSheet";

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
    const { container } = render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <div>Body</div>
      </BottomSheet>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(document.querySelector('[aria-hidden="true"].fixed.inset-0')!);
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
