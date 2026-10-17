// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { PageHeader } from "@/components/ui/pageHeader/pageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("renders the title and description", () => {
    render(<PageHeader title="Drivers" description="Manage drivers" />);
    expect(screen.getByRole("heading", { name: "Drivers" })).toBeInTheDocument();
    expect(screen.getByText("Manage drivers")).toBeInTheDocument();
  });

  it("renders a back link only when backHref is given", () => {
    const { rerender } = render(<PageHeader title="X" />);
    expect(screen.queryByText("Back")).toBeNull();

    rerender(<PageHeader title="X" backHref="/admin/drivers" />);
    expect(screen.getByText("Back").closest("a")).toHaveAttribute("href", "/admin/drivers");
  });

  it("renders the primary action button (desktop) and fires onClick", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <PageHeader
        title="Drivers"
        primaryAction={{ label: "Add Driver", onClick }}
      />,
    );
    // Both the desktop button and the mobile PageFab share the label "Add
    // Driver" — scope to the header block (not the FAB, portalled to body).
    const header = container.querySelector(".max-md\\:hidden")!;
    const btn = within(header as HTMLElement).getByRole("button", { name: /add driver/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables the desktop primary action button when disabled", () => {
    const { container } = render(
      <PageHeader
        title="Drivers"
        primaryAction={{
          label: "Add Driver",
          onClick: vi.fn(),
          disabled: true,
          disabledReason: "No permission",
        }}
      />,
    );
    const header = container.querySelector(".max-md\\:hidden")!;
    const btn = within(header as HTMLElement).getByRole("button", { name: /add driver/i });
    expect(btn).toBeDisabled();
  });

  it("also mounts a PageFab for the primary action (mobile)", async () => {
    render(<PageHeader title="Drivers" primaryAction={{ label: "Add Driver", onClick: vi.fn() }} />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /add driver/i }).length).toBe(2);
    });
  });

  it("renders a badge next to the title when provided", () => {
    render(<PageHeader title="Drivers" badge={<span>12</span>} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders custom actions alongside the primary action", () => {
    render(
      <PageHeader
        title="Drivers"
        actions={<button>Export</button>}
        primaryAction={{ label: "Add Driver", onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
