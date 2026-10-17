// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a native button by default and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild renders the child element instead of a <button>, forwarding props", () => {
    const onClick = vi.fn();
    render(
      <Button asChild onClick={onClick}>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/somewhere");
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards a ref to the underlying button element", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref}>X</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
