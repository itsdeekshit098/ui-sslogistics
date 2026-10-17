// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PageLoadingSkeleton } from "@/components/ui/pageLoadingSkeleton/pageLoadingSkeleton";

afterEach(cleanup);

describe("PageLoadingSkeleton", () => {
  it("renders the admin variant's layout", () => {
    const { container } = render(<PageLoadingSkeleton variant="admin" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(container.querySelector(".grid-cols-2")).not.toBeNull();
  });

  it("renders the login variant's layout", () => {
    const { container } = render(<PageLoadingSkeleton variant="login" />);
    expect(container.querySelector(".max-w-md")).not.toBeNull();
  });
});
