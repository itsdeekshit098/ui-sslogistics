// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BusyOverlay } from "@/components/ui/busyOverlay/busyOverlay";

afterEach(cleanup);

describe("BusyOverlay", () => {
  it("renders children without the busy indicator when not busy", () => {
    render(
      <BusyOverlay busy={false}>
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the busy indicator and dims children when busy", () => {
    render(
      <BusyOverlay busy>
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Content").parentElement?.className).toContain("opacity-40");
  });

  it("marks the content wrapper aria-busy to match the busy flag", () => {
    const { rerender } = render(
      <BusyOverlay busy={false}>
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByText("Content").parentElement).toHaveAttribute("aria-busy", "false");

    rerender(
      <BusyOverlay busy>
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByText("Content").parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("shows a custom label when provided", () => {
    render(
      <BusyOverlay busy label="Saving…">
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("defaults the label to 'Updating…'", () => {
    render(
      <BusyOverlay busy>
        <div>Content</div>
      </BusyOverlay>,
    );
    expect(screen.getByText("Updating…")).toBeInTheDocument();
  });
});
