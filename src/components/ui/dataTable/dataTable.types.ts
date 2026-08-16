import type { CSSProperties, ReactNode } from "react";

// ─── Column Definition ───────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface ColumnDef<TData> {
  /** Unique key for this column */
  key: string;
  /** Header label displayed in the table head */
  header: string;
  /** Optional fixed or min/max width */
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  /** Alignment of the cell content */
  align?: "left" | "center" | "right";
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether this column can be hidden */
  hideable?: boolean;
  /** Custom cell renderer */
  cell: (row: TData, index: number) => ReactNode;
  /** Optional header tooltip */
  tooltip?: string;
  /** Additional class name for the column's cells */
  className?: string;
  /** Additional inline style for the column's cells */
  style?: CSSProperties;
}

// ─── Sorting State ───────────────────────────────────────────────────────────

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

// ─── Row Actions ─────────────────────────────────────────────────────────────

export interface RowAction<TData> {
  key: string;
  label: string | ((row: TData) => string);
  icon?: ReactNode | ((row: TData) => ReactNode);
  variant?: "default" | "danger";
  onClick: (row: TData) => void;
  /** Conditionally show the action */
  hidden?: (row: TData) => boolean;
  /** Conditionally disable the action */
  disabled?: (row: TData) => boolean;
  /** Tooltip to show when disabled */
  disabledTooltip?: string | ((row: TData) => string);
  /**
   * `data-testid` for this action's button, per row. A plain `aria-label`
   * (already set from `label`) is enough for a single instance, but a table
   * has one of these per row — a function keyed by the row's own id (e.g.
   * `` (row) => `edit-btn-${row.id}` ``) is what a spec needs to target one
   * specific row's action instead of the first match.
   */
  testId?: string | ((row: TData) => string);
}

// ─── DataTable Props ─────────────────────────────────────────────────────────

export interface DataTableProps<TData> {
  /** Column definitions */
  columns: ColumnDef<TData>[];
  /** Data rows */
  data: TData[];
  /** Key extractor for React reconciliation */
  rowKey: (row: TData) => string | number;
  /** Whether data is loading */
  loading?: boolean;
  /** Custom loading label */
  loadingLabel?: string;
  /** Message shown when data is empty */
  emptyMessage?: string;
  /** Custom empty state node */
  emptyNode?: ReactNode;
  /** Current sort state */
  sortState?: SortState;
  /** Called when a sortable header is clicked */
  onSort?: (key: string, direction: "asc" | "desc") => void;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Whether rows are clickable (adds pointer cursor + hover style) */
  rowClickable?: boolean;
  /** Per-row additional class name */
  rowClassName?: (row: TData) => string;
  /** Per-row additional style */
  rowStyle?: (row: TData) => CSSProperties;
  /** Inline row actions (rendered in last column) */
  rowActions?: RowAction<TData>[];
  /** Label for the actions column header */
  actionsLabel?: string;
  /** Whether to show the actions column */
  showActions?: boolean;
  /** Additional class name for the table wrapper */
  className?: string;
  /** Striped rows */
  striped?: boolean;
  /** Dense/compact row mode */
  dense?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Max height for scrollable body (enables sticky header) */
  maxHeight?: string;
}
