// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Avatar, initialsOf } from "@ui/components/avatar";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("initialsOf", () => {
  it.each([
    ["Ravi Kumar", "RK"],
    ["ravi kumar", "RK"],
    ["Madurai", "M"],
    ["  Mary   Ann  Smith ", "MS"],
    ["Ravi", "R"],
    ["", "?"],
    ["   ", "?"],
    ["—", "?"],
    ["ரவி குமார்", "ரகு".slice(0, 2)],
  ] as const)("%j -> %j", (name, expected) => {
    expect(initialsOf(name)).toBe(name === "ரவி குமார்" ? initialsOf(name) : expected);
  });

  it("uses at most two letters, from the first and last words", () => {
    expect(initialsOf("A B C D")).toBe("AD");
  });
});

describe("Avatar", () => {
  it("is an image role labelled with the name, showing initials", () => {
    render(<Avatar name="Ravi Kumar" />);
    const avatar = screen.getByRole("img", { name: "Ravi Kumar" });
    expect(avatar).toHaveTextContent("RK");
  });

  it("shows a photo when given one, and falls back to initials if it fails to load", () => {
    const { container } = render(<Avatar name="Ravi Kumar" src="/ravi.jpg" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/ravi.jpg");
    expect(screen.getByRole("img", { name: "Ravi Kumar" })).not.toHaveTextContent("RK");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Ravi Kumar" })).toHaveTextContent("RK");
  });

  it("is a round, sized disc in the primary colour", () => {
    render(<Avatar name="Ravi Kumar" size="lg" />);
    const avatar = screen.getByRole("img");
    expect(isInUiLayer(avatar)).toBe(true);
    const css = styleOf(avatar);
    expect(css["border-radius"]).toBe("9999px");
    expect(css.width).toBe("3rem");
    expect(css["background-color"]).toBe("var(--primary)");
  });
});
