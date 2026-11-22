// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Pagination, MOBILE_MAX_ROWS } from "@ui/components/pagination";
import { styleOf, isInUiLayer } from "@test/uiStyles";

const isMobileMock = vi.fn();
vi.mock("@ui/hooks/useIsMobile", () => ({
  useIsMobile: () => isMobileMock(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Pagination — desktop (NumberedPagination)", () => {
  beforeEach(() => isMobileMock.mockReturnValue(false));

  it("renders nothing when totalCount is 0", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalCount={0}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the correct item range", () => {
    render(
      <Pagination
        page={2}
        totalCount={45}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText("11 - 20 of 45")).toBeInTheDocument();
  });

  it("clamps endItem to totalCount on the last partial page", () => {
    render(
      <Pagination
        page={5}
        totalCount={45}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText("41 - 45 of 45")).toBeInTheDocument();
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    render(
      <Pagination
        page={1}
        totalCount={10}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("calls onPageChange with page-1 / page+1 from the arrow buttons", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={3}
        totalCount={100}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("shows every page with no ellipsis when totalPages <= 7", () => {
    render(
      <Pagination
        page={1}
        totalCount={70}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.queryByText("...")).toBeNull();
  });

  it("shows leading pages + one ellipsis when near the start of a long list", () => {
    render(
      <Pagination
        page={2}
        totalCount={200}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    // totalPages = 20, page <= 4 branch: 1,2,3,4,5,...,20
    for (const n of [1, 2, 3, 4, 5, 20]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.getAllByText("...")).toHaveLength(1);
  });

  it("shows trailing pages + one ellipsis when near the end of a long list", () => {
    render(
      <Pagination
        page={19}
        totalCount={200}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    // totalPages = 20, page > totalPages - 4 (16): 1,...,16,17,18,19,20
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    for (const n of [16, 17, 18, 19, 20]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.getAllByText("...")).toHaveLength(1);
  });

  it("shows two ellipses when the current page is in the middle of a long list", () => {
    render(
      <Pagination
        page={10}
        totalCount={200}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    // 1,...,9,10,11,...,20
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    for (const n of [9, 10, 11]) {
      expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.getAllByText("...")).toHaveLength(2);
  });

  it("highlights the current page button distinctly", () => {
    render(
      <Pagination
        page={3}
        totalCount={70}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(styleOf(screen.getByRole("button", { name: "3" }))["background-color"]).toBe("var(--primary)");
    expect(styleOf(screen.getByRole("button", { name: "2" }))["background-color"]).toBeUndefined();
  });

  it("clicking a numbered page calls onPageChange with that number", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalCount={70}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it("treats totalPages as at least 1 even if totalCount < pageSize", () => {
    render(
      <Pagination
        page={1}
        totalCount={3}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });
});

describe("Pagination — mobile (LoadMore)", () => {
  beforeEach(() => {
    isMobileMock.mockReturnValue(true);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when totalCount is 0", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalCount={0}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows '1 result' for a single item", () => {
    render(
      <Pagination
        page={1}
        totalCount={1}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("shows 'All N shown' when everything fits on the page", () => {
    render(
      <Pagination
        page={1}
        totalCount={5}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText("All 5 shown")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load/i })).toBeNull();
  });

  it("shows 'Showing X of N' and a Load more button when more remain", () => {
    render(
      <Pagination
        page={1}
        totalCount={45}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 10 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load 10 more/i })).toBeInTheDocument();
  });

  it("Load more grows pageSize by the step and resets to page 1", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={2}
        totalCount={100}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /load/i }));

    // step = min(pageSize,20) = 10; next = min(200, max(20,10)+10) = 30
    expect(onPageSizeChange).toHaveBeenCalledWith(30);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("does not call onPageChange(1) a second time when already on page 1", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalCount={100}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /load/i }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("ignores a second Load-more click while a request is pending", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalCount={100}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    const btn = screen.getByRole("button", { name: /load/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onPageSizeChange).toHaveBeenCalledTimes(1);
  });

  it("clears the pending guard after the loading-safety timeout even with no response", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        totalCount={100}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    const btn = screen.getByRole("button", { name: /load/i });
    fireEvent.click(btn);
    act(() => vi.advanceTimersByTime(8000));
    fireEvent.click(btn);
    expect(onPageSizeChange).toHaveBeenCalledTimes(2);
  });

  it("disables Load more and shows a spinner while loading", () => {
    render(
      <Pagination
        page={1}
        totalCount={100}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        loading
      />,
    );
    const btn = screen.getByRole("button", { name: /loading/i });
    expect(btn).toBeDisabled();
  });

  it("caps page size at MOBILE_MAX_ROWS and shows the search-to-narrow hint", () => {
    render(
      <Pagination
        page={1}
        totalCount={500}
        pageSize={MOBILE_MAX_ROWS}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /load/i })).toBeNull();
    expect(screen.getByText(/search or filter to find the rest/i)).toBeInTheDocument();
  });
});

describe("Pagination styles", () => {
  const props = {
    page: 3,
    totalCount: 70,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  it("lays the numbered controls out in a column on phones and a row from sm up", () => {
    isMobileMock.mockReturnValue(false);
    const { container } = render(<Pagination {...props} />);
    const root = container.querySelector('[data-ui="pagination"]') as HTMLElement;
    expect(isInUiLayer(root)).toBe(true);
    expect(styleOf(root)["flex-direction"]).toBe("column");
    expect(styleOf(root, { media: "(min-width: 640px)" })["flex-direction"]).toBe("row");
  });

  it("shows page numbers only from sm up and the phone position text below it", () => {
    isMobileMock.mockReturnValue(false);
    render(<Pagination {...props} />);
    const sm = "(min-width: 640px)";
    const number = screen.getByRole("button", { name: "2" });
    expect(styleOf(number).display).toBe("none");
    expect(styleOf(number, { media: sm }).display).toBe("flex");
    expect(styleOf(screen.getByText(/Page 3 of 7/), { media: sm }).display).toBe("none");
  });

  it("tints the previous/next arrows and dims them when disabled", () => {
    isMobileMock.mockReturnValue(false);
    render(<Pagination {...props} page={1} />);
    const prev = screen.getByRole("button", { name: "Previous page" });
    expect(styleOf(prev).color).toBe("var(--primary)");
    expect(styleOf(prev, { state: ":disabled" }).opacity).toBe("50%");
    expect(styleOf(prev).height).toBe("var(--space-10)");
    expect(styleOf(prev, { media: "(min-width: 640px)" }).height).toBe("var(--space-8)");
  });

  it("the phone Load-more button is a full-width, 48px card-coloured button", () => {
    isMobileMock.mockReturnValue(true);
    render(<Pagination {...props} page={1} />);
    const more = screen.getByRole("button", { name: /Load \d+ more/ });
    const css = styleOf(more);
    expect(css.width).toBe("100%");
    expect(css.height).toBe("var(--space-12)");
    expect(css["background-color"]).toBe("var(--card)");
  });
});
