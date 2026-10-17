// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Skeleton } from "@/components/ui/skeletonLoader/skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("defaults to full-width 16px height with 6px radius", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("100%");
    expect(el.style.height).toBe("16px");
    expect(el.style.borderRadius).toBe("6px");
  });

  it("normalizes a numeric width/height/radius to px", () => {
    const { container } = render(<Skeleton width={120} height={40} borderRadius={8} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("40px");
    expect(el.style.borderRadius).toBe("8px");
  });

  it("passes through a string width/height unchanged", () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("50%");
    expect(el.style.height).toBe("2rem");
  });
});
