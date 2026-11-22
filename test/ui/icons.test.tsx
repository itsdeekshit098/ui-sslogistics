// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as icons from "@ui/icons";

afterEach(cleanup);

const all = Object.entries(icons).filter(([name]) => name.endsWith("Icon")) as [
  string,
  React.ComponentType<icons.IconProps>,
][];

describe("icons", () => {
  it("exports all 87 icons", () => {
    expect(all.length).toBe(87);
  });

  it.each(all)("%s is a decorative 24×24 stroke drawing in the current colour", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("path, circle, rect, line, polyline, ellipse").length).toBeGreaterThan(0);
  });

  it("defaults to 16px and takes a size", () => {
    const { container, rerender } = render(<icons.TruckIcon />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "16");
    rerender(<icons.TruckIcon size={32} />);
    expect(container.querySelector("svg")).toHaveAttribute("height", "32");
  });

  it("keeps the one icon that defaults to a larger size", () => {
    const larger = all.filter(([, Icon]) => {
      const { container } = render(<Icon />);
      const w = container.querySelector("svg")!.getAttribute("width");
      cleanup();
      return w !== "16";
    });
    expect(larger.length).toBe(1);
    expect(larger[0][0]).toBe("InboxIcon");
  });

  it("passes className and other svg props through, so styled() and callers can style them", () => {
    const { container } = render(<icons.CheckIcon className="text-primary" data-testid="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("text-primary");
    expect(svg).toHaveAttribute("data-testid", "x");
  });

  it("names each icon for the React DevTools", () => {
    expect((icons.TrashIcon as unknown as { displayName: string }).displayName).toBe("TrashIcon");
  });
});
