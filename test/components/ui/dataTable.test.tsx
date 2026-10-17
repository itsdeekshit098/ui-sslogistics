// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { DataTable } from "@/components/ui/dataTable/dataTable";
import type { ColumnDef, RowAction } from "@/components/ui/dataTable/dataTable.types";

const isMobileMock = vi.fn();
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => isMobileMock(),
}));

interface Row {
  id: number;
  name: string;
  amount: string;
}

const rows: Row[] = [
  { id: 1, name: "Alice", amount: "100" },
  { id: 2, name: "Bob", amount: "200" },
];

function columns(): ColumnDef<Row>[] {
  return [
    { key: "name", header: "Name", cell: (r) => r.name, sortable: true },
    { key: "amount", header: "Amount", cell: (r) => r.amount, align: "right" },
  ];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DataTable — desktop", () => {
  beforeEach(() => isMobileMock.mockReturnValue(false));

  it("renders a header and a row per data item", () => {
    render(<DataTable columns={columns()} data={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 rows
  });

  it("shows skeleton rows while loading instead of data or empty state", () => {
    const { container } = render(
      <DataTable columns={columns()} data={[]} rowKey={(r) => r.id} loading />,
    );
    expect(screen.queryByText(/no records found/i)).toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  });

  it("shows the empty message when there is no data and not loading", () => {
    render(<DataTable columns={columns()} data={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText("No records found.")).toBeInTheDocument();
  });

  it("renders a custom emptyNode instead of the default message", () => {
    render(
      <DataTable
        columns={columns()}
        data={[]}
        rowKey={(r) => r.id}
        emptyNode={<div>Nothing to see</div>}
      />,
    );
    expect(screen.getByText("Nothing to see")).toBeInTheDocument();
    expect(screen.queryByText(/no records found/i)).toBeNull();
  });

  it("clicking a sortable header starts ascending, then flips to descending", () => {
    const onSort = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onSort={onSort} />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith("name", "asc");

    rerender(
      <DataTable
        columns={columns()}
        data={rows}
        rowKey={(r) => r.id}
        onSort={onSort}
        sortState={{ key: "name", direction: "asc" }}
      />,
    );
    fireEvent.click(screen.getByRole("columnheader", { name: /name/i }));
    expect(onSort).toHaveBeenLastCalledWith("name", "desc");
  });

  it("a non-sortable column header click does not call onSort", () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onSort={onSort} />);
    fireEvent.click(screen.getByRole("columnheader", { name: /amount/i }));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("supports sorting via keyboard (Enter) on the header", () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onSort={onSort} />);
    fireEvent.keyDown(screen.getByRole("columnheader", { name: /name/i }), { key: "Enter" });
    expect(onSort).toHaveBeenCalledWith("name", "asc");
  });

  it("sets aria-sort correctly for the active and inactive sortable columns", () => {
    render(
      <DataTable
        columns={columns()}
        data={rows}
        rowKey={(r) => r.id}
        onSort={vi.fn()}
        sortState={{ key: "name", direction: "desc" }}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /name/i })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("row click fires onRowClick only when the row is clickable", () => {
    const onRowClick = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} />,
    );
    const firstRow = screen.getAllByRole("row")[1];
    fireEvent.click(firstRow);
    expect(onRowClick).not.toHaveBeenCalled();

    rerender(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getAllByRole("button")[0] /* now role=button rows */);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("supports activating a clickable row via keyboard", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    const firstRow = screen.getAllByRole("button")[0];
    fireEvent.keyDown(firstRow, { key: "Enter" });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("renders row actions and respects disabled/hidden", () => {
    const onClickA = vi.fn();
    const actions: RowAction<Row>[] = [
      { key: "edit", label: "Edit", icon: <span>E</span>, onClick: onClickA },
      {
        key: "delete",
        label: "Delete",
        icon: <span>D</span>,
        onClick: vi.fn(),
        hidden: (r) => r.id === 2,
      },
    ];
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} rowActions={actions} />,
    );
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    expect(editButtons).toHaveLength(2);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons).toHaveLength(1); // hidden for row id 2

    fireEvent.click(editButtons[0]);
    expect(onClickA).toHaveBeenCalledWith(rows[0]);
  });

  it("a disabled row action does not call onClick", () => {
    const onClick = vi.fn();
    const actions: RowAction<Row>[] = [
      { key: "edit", label: "Edit", icon: <span>E</span>, onClick, disabled: () => true },
    ];
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} rowActions={actions} />,
    );
    const btn = screen.getAllByRole("button", { name: "Edit" })[0];
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicking a row action does not also trigger the row's onRowClick", () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    const actions: RowAction<Row>[] = [
      { key: "edit", label: "Edit", icon: <span>E</span>, onClick: onAction },
    ];
    render(
      <DataTable
        columns={columns()}
        data={rows}
        rowKey={(r) => r.id}
        rowActions={actions}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(onAction).toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("mobileOnly actions are excluded from the desktop actions column", () => {
    const actions: RowAction<Row>[] = [
      { key: "x", label: "Mobile Only", icon: <span>M</span>, onClick: vi.fn(), mobileOnly: true },
    ];
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} rowActions={actions} />,
    );
    expect(screen.queryByRole("button", { name: "Mobile Only" })).toBeNull();
  });

  it("showActions=false hides the actions column entirely", () => {
    const actions: RowAction<Row>[] = [
      { key: "edit", label: "Edit", icon: <span>E</span>, onClick: vi.fn() },
    ];
    render(
      <DataTable
        columns={columns()}
        data={rows}
        rowKey={(r) => r.id}
        rowActions={actions}
        showActions={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});

describe("DataTable — mobile cards", () => {
  beforeEach(() => isMobileMock.mockReturnValue(true));

  it("renders skeleton cards while loading with no data yet", () => {
    const { container } = render(
      <DataTable columns={columns()} data={[]} rowKey={(r) => r.id} loading />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows the empty state on phones when there is no data", () => {
    render(<DataTable columns={columns()} data={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText("No records found.")).toBeInTheDocument();
  });

  it("renders one card per row with the first column as title", () => {
    render(<DataTable columns={columns()} data={rows} rowKey={(r) => r.id} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Alice")).toBeInTheDocument();
  });

  it("drops a blank cell instead of rendering an empty field", () => {
    const cols: ColumnDef<Row>[] = [
      { key: "name", header: "Name", cell: (r) => r.name },
      { key: "amount", header: "Amount", cell: () => "—" },
    ];
    render(<DataTable columns={cols} data={rows} rowKey={(r) => r.id} />);
    expect(screen.queryByText("Amount")).toBeNull();
  });

  it("opens the action sheet via the '⋯' button and runs the chosen action", () => {
    const onClick = vi.fn();
    const actions: RowAction<Row>[] = [
      { key: "edit", label: "Edit", icon: <span>E</span>, onClick },
    ];
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} rowActions={actions} />,
    );
    fireEvent.click(screen.getAllByLabelText("Actions")[0]);
    const menuItem = screen.getByRole("menuitem", { name: /edit/i });
    fireEvent.click(menuItem);
    expect(onClick).toHaveBeenCalledWith(rows[0]);
  });

  it("row click fires onRowClick when the card is clickable", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns()} data={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getAllByRole("listitem")[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("renders the timeline layout with a left rail instead of card grid", () => {
    const { container } = render(
      <DataTable
        columns={columns()}
        data={rows}
        rowKey={(r) => r.id}
        mobileLayout="timeline"
      />,
    );
    expect(container.querySelector(".border-l-2")).not.toBeNull();
  });
});
