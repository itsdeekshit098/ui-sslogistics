// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

afterEach(cleanup);

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders a leading dot only when dot is true", () => {
    const { container, rerender } = render(<Badge>Status</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();

    rerender(<Badge dot>Status</Badge>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
