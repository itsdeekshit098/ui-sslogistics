// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EmptyState from "@/components/ui/emptyState/emptyState";

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
