// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Slot } from "@ui/components/slot";

afterEach(cleanup);

describe("Slot", () => {
  it("renders its child element, not a wrapper", () => {
    render(
      <Slot>
        <a href="/x">Go</a>
      </Slot>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.tagName).toBe("A");
    expect(link.parentElement).toBe(document.body.firstElementChild);
  });

  it("hands its props to the child, and the child's own props win", () => {
    render(
      <Slot id="from-slot" title="from-slot">
        <a href="/x" title="from-child">
          Go
        </a>
      </Slot>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("id", "from-slot");
    expect(link).toHaveAttribute("title", "from-child");
  });

  it("runs both event handlers, the child's first", () => {
    const calls: string[] = [];
    render(
      <Slot onClick={() => calls.push("slot")}>
        <button onClick={() => calls.push("child")}>Hit</button>
      </Slot>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(calls).toEqual(["child", "slot"]);
  });

  it("joins class names and merges styles", () => {
    render(
      <Slot className="a" style={{ color: "red", margin: 1 }}>
        <span className="b" style={{ color: "blue" }}>
          x
        </span>
      </Slot>,
    );
    const el = screen.getByText("x");
    expect(el).toHaveClass("a", "b");
    expect(el).toHaveStyle({ color: "rgb(0, 0, 255)", margin: "1px" });
  });

  it("points both its own ref and the child's ref at the element", () => {
    const slotRef = createRef<HTMLElement>();
    const childRef = createRef<HTMLAnchorElement>();
    render(
      <Slot ref={slotRef}>
        <a href="/x" ref={childRef}>
          Go
        </a>
      </Slot>,
    );
    expect(slotRef.current).toBeInstanceOf(HTMLAnchorElement);
    expect(childRef.current).toBe(slotRef.current);
  });

  it("renders nothing for a child that is not an element", () => {
    const { container } = render(<Slot>just text</Slot>);
    expect(container).toBeEmptyDOMElement();
  });

  it("throws when given more than one child, since it cannot pick one", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Slot>
          <a href="/1">1</a>
          <a href="/2">2</a>
        </Slot>,
      ),
    ).toThrow();
    spy.mockRestore();
  });
});
