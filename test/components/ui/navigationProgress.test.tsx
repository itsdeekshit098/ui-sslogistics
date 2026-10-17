// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { NavigationProgress } from "@/components/ui/navigationProgress/navigationProgress";

let pathname = "/admin/drivers";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function getBar(container: HTMLElement) {
  return container.firstChild as HTMLElement;
}
function getInnerBar(container: HTMLElement) {
  return getBar(container).firstChild as HTMLElement;
}

beforeEach(() => {
  pathname = "/admin/drivers";
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NavigationProgress", () => {
  it("is hidden (opacity 0) initially", () => {
    const { container } = render(<NavigationProgress />);
    expect(getBar(container).style.opacity).toBe("0");
  });

  it("becomes visible and starts progressing when an internal link is clicked", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBar(container).style.opacity).toBe("1");
    expect(getInnerBar(container).style.width).toBe("10%");
    document.body.removeChild(link);
  });

  it("does not trigger for a download link", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    link.setAttribute("download", "");
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBar(container).style.opacity).toBe("0");
    document.body.removeChild(link);
  });

  it("does not trigger for an external (http) link", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "https://example.com";
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBar(container).style.opacity).toBe("0");
    document.body.removeChild(link);
  });

  it("does not trigger for a hash link on the same page", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.setAttribute("href", "#section");
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBar(container).style.opacity).toBe("0");
    document.body.removeChild(link);
  });

  it("does not trigger for a link to the current pathname", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.setAttribute("href", pathname);
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(getBar(container).style.opacity).toBe("0");
    document.body.removeChild(link);
  });

  it("completes (jumps to 100% then hides) when the pathname actually changes", () => {
    const { container, rerender } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    document.body.appendChild(link);
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    pathname = "/admin/vehicles";
    rerender(<NavigationProgress />);

    act(() => vi.advanceTimersByTime(0));
    expect(getInnerBar(container).style.width).toBe("100%");

    act(() => vi.advanceTimersByTime(400));
    expect(getBar(container).style.opacity).toBe("0");

    document.body.removeChild(link);
  });

  it("advances progress over time via the interval, capped below 90%", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    document.body.appendChild(link);
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    act(() => vi.advanceTimersByTime(120 * 20));

    const width = parseFloat(getInnerBar(container).style.width);
    expect(width).toBeGreaterThan(10);
    expect(width).toBeLessThan(90);

    document.body.removeChild(link);
  });
});
