// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { FloatingActionButton, AccentProvider } from "@ui/components/floatingActionButton";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(() => {
  cleanup();
});

describe("FloatingActionButton", () => {
  it("renders the button once mounted and fires onClick", async () => {
    const onClick = vi.fn();
    render(<FloatingActionButton label="Add driver" onClick={onClick} />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is truly disabled (not explainable) with no disabledReason", async () => {
    const onClick = vi.fn();
    render(<FloatingActionButton label="Add" onClick={onClick} disabled />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("with a disabledReason, the button stays tappable and shows the reason on tap", async () => {
    const onClick = vi.fn();
    render(
      <FloatingActionButton label="Add" onClick={onClick} disabled disabledReason="Finish the form first" />,
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
      <FloatingActionButton label="Add" onClick={vi.fn()} disabled disabledReason="Reason" />,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3500));

    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });

  it("takes its background from the accent prop", async () => {
    render(<FloatingActionButton label="Add" onClick={vi.fn()} accent="#ea580c" />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(styleOf(screen.getByRole("button")).background).toBe("#ea580c");
  });

  it("falls back to the accent from the nearest AccentProvider", async () => {
    render(
      <AccentProvider value="#4f46e5">
        <FloatingActionButton label="Add" onClick={vi.fn()} />
      </AccentProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(styleOf(screen.getByRole("button")).background).toBe("#4f46e5");
  });

  it("lets the prop win over the provider, and ignores both while disabled", async () => {
    render(
      <AccentProvider value="#4f46e5">
        <FloatingActionButton label="Add" onClick={vi.fn()} accent="#ea580c" />
        <FloatingActionButton label="Off" onClick={vi.fn()} disabled />
      </AccentProvider>,
    );
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
    const [enabled, disabled] = screen.getAllByRole("button");
    expect(styleOf(enabled).background).toBe("#ea580c");
    expect(styleOf(disabled).background).toBeUndefined();
    expect(styleOf(disabled).opacity).toBe("60%");
  });

  it("sits in the bottom-right corner on phones only, with the page's enter animation on the bubble", async () => {
    render(<FloatingActionButton label="Add" onClick={vi.fn()} disabled disabledReason="Why" />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const corner = screen.getByRole("button").parentElement!;
    expect(corner).toHaveAttribute("data-ui", "floating-action-button");
    expect(isInUiLayer(corner)).toBe(true);
    expect(styleOf(corner).position).toBe("fixed");
    expect(styleOf(corner, { media: "(min-width: 768px)" }).display).toBe("none");
    expect(corner.getAttribute("style")).toBeNull();
  });

  it("is a 56px rounded square with the primary colour by default", async () => {
    render(<FloatingActionButton label="Add" onClick={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    const css = styleOf(screen.getByRole("button"));
    expect(css.width).toBe("var(--space-14)");
    expect(css["background-color"]).toBe("var(--primary)");
    expect(css["border-radius"]).toBe("var(--m-radius-card)");
  });
});
