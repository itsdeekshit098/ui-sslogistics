// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ErrorState from "@/components/ui/errorState/errorState";

afterEach(cleanup);

describe("ErrorState", () => {
  it("renders default title and description", () => {
    render(<ErrorState />);
    expect(screen.getByTestId("error-state-title")).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("error-state-description")).toHaveTextContent(
      /couldn.t load the data/i,
    );
  });

  it("renders custom title/description when given", () => {
    render(<ErrorState title="Load failed" description="Try later." />);
    expect(screen.getByTestId("error-state-title")).toHaveTextContent("Load failed");
    expect(screen.getByTestId("error-state-description")).toHaveTextContent("Try later.");
  });

  it("does not render a retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(screen.queryByTestId("error-state-retry-btn")).toBeNull();
  });

  it("renders a retry button and calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId("error-state-retry-btn"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows 'Retrying...' and disables the button while retrying", () => {
    render(<ErrorState onRetry={vi.fn()} retrying />);
    const btn = screen.getByTestId("error-state-retry-btn");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Retrying...");
  });

  it("uses a custom retryLabel when not retrying", () => {
    render(<ErrorState onRetry={vi.fn()} retryLabel="Reload" />);
    expect(screen.getByTestId("error-state-retry-btn")).toHaveTextContent("Reload");
  });
});
