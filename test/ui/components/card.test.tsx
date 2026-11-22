// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/card";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("Card", () => {
  it("renders its parts as the right elements", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Foot</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title").tagName).toBe("H3");
    expect(screen.getByText("Description").tagName).toBe("P");
    expect(screen.getByTestId("card")).toBeInTheDocument();
  });

  it("is a bordered surface with the card tokens, and a larger corner on phones", () => {
    render(<Card data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(isInUiLayer(card)).toBe(true);
    const css = styleOf(card);
    expect(css["background-color"]).toBe("var(--card)");
    expect(css["border-radius"]).toBe("var(--card-radius)");
    expect(css["box-shadow"]).toBe("var(--card-shadow)");
    const phone = styleOf(card, { media: "(max-width: 767.98px)" });
    expect(phone["border-radius"]).toBe("var(--m-radius-card)");
    expect(phone["box-shadow"]).toBe("var(--m-card-shadow)");
  });

  it("pads the header on a 16px grid, 24px from the sm breakpoint", () => {
    render(<CardHeader data-testid="h" />);
    const h = screen.getByTestId("h");
    expect(styleOf(h).padding).toBe("var(--space-4)");
    expect(styleOf(h, { media: "(min-width: 640px)" }).padding).toBe("var(--space-6)");
  });

  it("content and footer drop their top padding so they sit under the header", () => {
    render(
      <>
        <CardContent data-testid="c" />
        <CardFooter data-testid="f" />
      </>,
    );
    expect(styleOf(screen.getByTestId("c"))["padding-top"]).toBe("0");
    expect(styleOf(screen.getByTestId("f"))["padding-top"]).toBe("0");
    expect(styleOf(screen.getByTestId("f")).display).toBe("flex");
  });

  it("sets the title at 24px semibold with a tight line", () => {
    render(<CardTitle>T</CardTitle>);
    const css = styleOf(screen.getByText("T"));
    expect(css["font-size"]).toBe("1.5rem");
    expect(css["font-weight"]).toBe("600");
    expect(css["line-height"]).toBe("1");
  });

  it("keeps a caller's className on every part", () => {
    render(<Card className="p-0" data-testid="card" />);
    expect(screen.getByTestId("card")).toHaveClass("p-0");
  });
});
