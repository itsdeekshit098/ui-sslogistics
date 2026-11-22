// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { PageHeader } from "@ui/patterns/pageHeader";
import { styleOf } from "@test/uiStyles";

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
    // Both the desktop button and the mobile FloatingActionButton share the label "Add
    // Driver" — scope to the header block (not the FAB, portalled to body).
    const header = container.querySelector('[data-ui="page-header"]')!;
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
    const header = container.querySelector('[data-ui="page-header"]')!;
    const btn = within(header as HTMLElement).getByRole("button", { name: /add driver/i });
    expect(btn).toBeDisabled();
  });

  it("also mounts a FloatingActionButton for the primary action (mobile)", async () => {
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

describe("PageHeader styles", () => {
  const phone = "(max-width: 767.98px)";

  it("hides a list page's header on phones, where the top bar names the page", () => {
    const { container } = render(<PageHeader title="Drivers" />);
    const root = container.querySelector('[data-ui="page-header"]') as HTMLElement;
    expect(styleOf(root, { media: phone }).display).toBe("none");
  });

  it("keeps a detail page's header on phones", () => {
    const { container } = render(<PageHeader title="Loan" backHref="/loans" />);
    const root = container.querySelector('[data-ui="page-header"]') as HTMLElement;
    expect(styleOf(root, { media: phone }).display).toBeUndefined();
  });

  it("sets the title at 20px, 30px on desktop", () => {
    render(<PageHeader title="Drivers" />);
    const h1 = screen.getByRole("heading", { name: "Drivers" });
    expect(styleOf(h1)["font-size"]).toBe("1.25rem");
    expect(styleOf(h1, { media: "(min-width: 768px)" })["font-size"]).toBe("1.875rem");
  });

  it("shows the back link only from desktop width", () => {
    render(<PageHeader title="X" backHref="/x" />);
    const back = screen.getByText("Back").closest("a") as HTMLElement;
    expect(styleOf(back).display).toBe("none");
    expect(styleOf(back, { media: "(min-width: 768px)" }).display).toBe("inline-flex");
  });

  it("hides the desktop primary button on phones, where the floating button takes over", () => {
    render(<PageHeader title="X" primaryAction={{ label: "Add", onClick: () => {} }} />);
    const [desktop] = screen.getAllByRole("button", { name: /add/i });
    expect(styleOf(desktop, { media: phone }).display).toBe("none");
  });
});