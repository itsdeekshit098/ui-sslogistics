// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FilterDrawer } from "@/components/ui/filterDrawer/filterDrawer";

afterEach(cleanup);

describe("FilterDrawer", () => {
  it("renders nothing when closed", () => {
    render(
      <FilterDrawer open={false} onClose={vi.fn()} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog with title and children once mounted", async () => {
    render(
      <FilterDrawer open onClose={vi.fn()} onApply={vi.fn()} title="My Filters">
        <div>Field A</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "My Filters");
    expect(screen.getByText("Field A")).toBeInTheDocument();
  });

  it("clicking the backdrop calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <FilterDrawer open onClose={onClose} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // The backdrop is the dialog's preceding sibling under the portal root.
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.previousElementSibling!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the X button calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <FilterDrawer open onClose={onClose} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Close filters"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the footer Close button calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <FilterDrawer open onClose={onClose} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking Apply Filters calls onApply (not onClose)", async () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(
      <FilterDrawer open onClose={onClose} onApply={onApply}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("pressing Escape calls onClose", async () => {
    const onClose = vi.fn();
    render(
      <FilterDrawer open onClose={onClose} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("defaults the title to 'Filters'", async () => {
    render(
      <FilterDrawer open onClose={vi.fn()} onApply={vi.fn()}>
        <div>Fields</div>
      </FilterDrawer>,
    );
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Filters");
  });
});
