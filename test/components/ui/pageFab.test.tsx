// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { PageFab } from "@/components/ui/pageFab/pageFab";

afterEach(() => {
  cleanup();
});

describe("PageFab", () => {
  it("renders the button once mounted and fires onClick", async () => {
    const onClick = vi.fn();
    render(<PageFab label="Add driver" onClick={onClick} />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is truly disabled (not explainable) with no disabledReason", async () => {
    const onClick = vi.fn();
    render(<PageFab label="Add" onClick={onClick} disabled />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("with a disabledReason, the button stays tappable and shows the reason on tap", async () => {
    const onClick = vi.fn();
    render(
      <PageFab label="Add" onClick={onClick} disabled disabledReason="Finish the form first" />,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Finish the form first");
  });

  it("the disabled-reason message auto-hides after its timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <PageFab label="Add" onClick={vi.fn()} disabled disabledReason="Reason" />,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3500));

    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });
});
