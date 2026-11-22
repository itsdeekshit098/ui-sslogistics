// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LoadingOverlay } from "@ui/components/loadingOverlay";
import { styleOf } from "@test/uiStyles";

afterEach(cleanup);

describe("LoadingOverlay", () => {
  it("renders children without the busy indicator when not busy", () => {
    render(
      <LoadingOverlay busy={false}>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the busy indicator and dims children when busy", () => {
    render(
      <LoadingOverlay busy>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    const css = styleOf(screen.getByText("Content").parentElement!);
    expect(css.opacity).toBe("40%");
    expect(css["pointer-events"]).toBe("none");
  });

  it("marks the content wrapper aria-busy to match the busy flag", () => {
    const { rerender } = render(
      <LoadingOverlay busy={false}>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Content").parentElement).toHaveAttribute("aria-busy", "false");

    rerender(
      <LoadingOverlay busy>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Content").parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("shows a custom label when provided", () => {
    render(
      <LoadingOverlay busy label="Saving…">
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("defaults the label to 'Updating…'", () => {
    render(
      <LoadingOverlay busy>
        <div>Content</div>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Updating…")).toBeInTheDocument();
  });
});
