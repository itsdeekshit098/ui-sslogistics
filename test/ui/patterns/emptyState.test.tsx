// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EmptyState } from "@ui/patterns/emptyState";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No drivers yet" />);
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent("No drivers yet");
  });

  it("does not render a description when none is given", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByTestId("empty-state-description")).toBeNull();
  });

  it("renders a description when given", () => {
    render(<EmptyState title="Empty" description="Add one to get started." />);
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      "Add one to get started.",
    );
  });

  it("does not render an action button when actionLabel or onAction is missing", () => {
    render(<EmptyState title="Empty" actionLabel="Add" />);
    expect(screen.queryByTestId("empty-state-action-btn")).toBeNull();
  });

  it("renders and fires the action button when both actionLabel and onAction are given", () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Add driver" onAction={onAction} />);
    const btn = screen.getByTestId("empty-state-action-btn");
    expect(btn).toHaveTextContent("Add driver");
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("disables the action button when actionDisabled is true", () => {
    render(
      <EmptyState title="Empty" actionLabel="Add" onAction={vi.fn()} actionDisabled />,
    );
    expect(screen.getByTestId("empty-state-action-btn")).toBeDisabled();
  });
});

describe("EmptyState styles", () => {
  const phone = "(max-width: 767.98px)";

  it("centres its content in a padded column, with tighter padding on phones", () => {
    render(<EmptyState title="Nothing" />);
    const root = screen.getByTestId("empty-state");
    expect(isInUiLayer(root)).toBe(true);
    const css = styleOf(root);
    expect(css["flex-direction"]).toBe("column");
    expect(css["text-align"]).toBe("center");
    expect(css["padding-block"]).toBe("var(--space-12)");
    expect(styleOf(root, { media: phone }).padding).toBe("var(--space-8)");
    expect(root.getAttribute("style")).toBeNull();
  });

  it("tints its icon and turns the icon tile into a 64px rounded square on phones", () => {
    render(<EmptyState title="Nothing" />);
    const box = screen.getByTestId("empty-state").firstElementChild as HTMLElement;
    expect(styleOf(box)["background-color"]).toBe("var(--muted)");
    expect(styleOf(box, { media: phone }).width).toBe("var(--space-16)");
    expect(styleOf(box, { media: phone })["border-radius"]).toBe("var(--m-radius-card)");
  });

  it("makes the action a full-width, 48px-tall button on phones and marks it for the stylesheet", () => {
    render(<EmptyState title="Nothing" actionLabel="Add" onAction={() => {}} />);
    const action = screen.getByTestId("empty-state-action-btn");
    expect(action).toHaveAttribute("data-ui", "empty-state-action");
    expect(styleOf(action, { media: phone }).width).toBe("100%");
    expect(styleOf(action, { media: phone }).height).toBe("var(--space-12)");
  });
});