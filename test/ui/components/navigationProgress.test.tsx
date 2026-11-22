// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { styleOf } from "@test/uiStyles";
import { NavigationProgress } from "@ui/components/navigationProgress";

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
    expect(styleOf(getBar(container)).opacity).toBe("0");
  });

  it("becomes visible and starts progressing when an internal link is clicked", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    document.body.appendChild(link);

    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(styleOf(getBar(container)).opacity).toBe("1");
    expect(getInnerBar(container).style.getPropertyValue("--progress")).toBe("10%");
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

    expect(styleOf(getBar(container)).opacity).toBe("0");
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

    expect(styleOf(getBar(container)).opacity).toBe("0");
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

    expect(styleOf(getBar(container)).opacity).toBe("0");
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

    expect(styleOf(getBar(container)).opacity).toBe("0");
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
    expect(getInnerBar(container).style.getPropertyValue("--progress")).toBe("100%");

    act(() => vi.advanceTimersByTime(400));
    expect(styleOf(getBar(container)).opacity).toBe("0");

    document.body.removeChild(link);
  });

  it("advances progress over time via the interval, capped below 90%", () => {
    const { container } = render(<NavigationProgress />);
    const link = document.createElement("a");
    link.href = "/admin/vehicles";
    document.body.appendChild(link);
    act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    act(() => vi.advanceTimersByTime(120 * 20));

    const width = parseFloat(getInnerBar(container).style.getPropertyValue("--progress"));
    expect(width).toBeGreaterThan(10);
    expect(width).toBeLessThan(90);

    document.body.removeChild(link);
  });

  const click = (href: string) => {
    const link = document.createElement("a");
    link.href = href;
    document.body.appendChild(link);
    act(() => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    document.body.removeChild(link);
  };

  it("ignores a link that only changes the query string of the current page", () => {
    const { container } = render(<NavigationProgress />);
    click("/admin/drivers?status=active");
    expect(styleOf(getBar(container)).opacity).toBe("0");
  });

  it("restarts rather than stacking timers when a second link is clicked mid-crawl", () => {
    const { container } = render(<NavigationProgress />);
    click("/admin/vehicles");
    const afterFirst = vi.getTimerCount();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    click("/admin/trips");
    expect(getInnerBar(container).style.getPropertyValue("--progress")).toBe("10%");
    expect(vi.getTimerCount()).toBe(afterFirst);
  });

  it("gives up after ten seconds if the path never changes, and stops its timer", () => {
    const { container } = render(<NavigationProgress />);
    const idle = vi.getTimerCount();
    click("/admin/vehicles");
    act(() => {
      vi.advanceTimersByTime(10_500);
    });
    expect(styleOf(getBar(container)).opacity).toBe("0");
    expect(vi.getTimerCount()).toBe(idle);
  });

  it("stops its timer when it unmounts mid-crawl", () => {
    const { unmount } = render(<NavigationProgress />);
    const clear = vi.spyOn(globalThis, "clearInterval");
    click("/admin/vehicles");
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});

