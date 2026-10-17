// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LoadingSpinner from "@/components/ui/loadingSpinner/loadingSpinner";

afterEach(cleanup);

describe("LoadingSpinner", () => {
  it("renders an inline SVG arc by default (no label, not centered)", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders bouncing dots when centered", () => {
    const { container } = render(<LoadingSpinner centered />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("span").length).toBeGreaterThanOrEqual(3);
  });

  it("renders bouncing dots when a label is given, even without centered", () => {
    render(<LoadingSpinner label="Loading…" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("does not render a label span when no label is given in dots mode", () => {
    const { container } = render(<LoadingSpinner centered />);
    // 3 dot spans only, no label span
    expect(container.querySelectorAll("span").length).toBe(3);
  });
});
