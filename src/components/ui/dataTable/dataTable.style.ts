import type { CSSProperties } from "react";

// ─── Table Wrapper ────────────────────────────────────────────────────────────

export const tableWrapper = (
  maxHeight?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _stickyHeader?: boolean,
): CSSProperties => ({
  width: "100%",
  borderRadius: "0.75rem",
  border: "1px solid var(--border)",
  overflow: "hidden",
  backgroundColor: "var(--card)",
  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
  ...(maxHeight && {
    maxHeight,
    overflowY: "auto",
  }),
});

export const tableScrollContainer: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

export const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.875rem",
};

// ─── Head ─────────────────────────────────────────────────────────────────────

export const thead = (sticky?: boolean): CSSProperties => ({
  ...(sticky && {
    position: "sticky",
    top: 0,
    zIndex: 2,
  }),
});

export const theadRow: CSSProperties = {
  borderBottom: "1px solid var(--border)",
  backgroundColor: "var(--muted)",
};

export const th = (
  align: "left" | "center" | "right" = "left",
  sortable?: boolean,
  width?: string | number,
  minWidth?: string | number,
): CSSProperties => ({
  padding: "0.75rem 1rem",
  textAlign: align,
  fontWeight: 600,
  fontSize: "0.75rem",
  color: "var(--muted-foreground)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  userSelect: "none",
  backgroundColor: "var(--muted)",
  ...(sortable && { cursor: "pointer" }),
  ...(width !== undefined && { width: typeof width === "number" ? `${width}px` : width }),
  ...(minWidth !== undefined && {
    minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth,
  }),
});

export const thInner: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const sortIconWrapper = (active: boolean, _dir?: "asc" | "desc"): CSSProperties => ({
  display: "inline-flex",
  flexDirection: "column",
  gap: "1px",
  opacity: active ? 1 : 0.3,
  transition: "opacity 0.15s ease",
  color: active ? "var(--primary)" : "var(--muted-foreground)",
});

// ─── Body ─────────────────────────────────────────────────────────────────────

export const tbodyRow = (
  clickable?: boolean,
  striped?: boolean,
  index?: number,
): CSSProperties => ({
  borderBottom: "1px solid var(--border)",
  transition: "background-color 0.12s ease",
  ...(clickable && { cursor: "pointer" }),
  ...(striped && index !== undefined && index % 2 === 0
    ? { backgroundColor: "var(--muted)" }
    : { backgroundColor: "transparent" }),
});

export const td = (
  align: "left" | "center" | "right" = "left",
  dense?: boolean,
): CSSProperties => ({
  padding: dense ? "0.5rem 1rem" : "0.875rem 1rem",
  textAlign: align,
  verticalAlign: "middle",
  color: "var(--foreground)",
  lineHeight: "1.5",
});

// ─── Empty / Loading State ────────────────────────────────────────────────────

export const emptyRow: CSSProperties = {
  padding: "3rem 1rem",
  textAlign: "center",
};

export const emptyIconWrapper: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.75rem",
  color: "var(--muted-foreground)",
};

export const emptyText: CSSProperties = {
  fontSize: "0.9rem",
  color: "var(--muted-foreground)",
  fontWeight: 500,
};

export const emptySubText: CSSProperties = {
  fontSize: "0.8125rem",
  color: "var(--muted-foreground)",
  opacity: 0.7,
  marginTop: "-0.25rem",
};

export const loadingWrapper: CSSProperties = {
  padding: "3rem 1rem",
  textAlign: "center",
  color: "var(--muted-foreground)",
};

// ─── Actions Cell ─────────────────────────────────────────────────────────────

export const actionsCell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "0.5rem",
};

export const actionBtn = (variant: "default" | "danger" = "default"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.125rem",
  height: "2.125rem",
  borderRadius: "0.5rem",
  border: "none",
  backgroundColor:
    variant === "danger"
      ? "rgba(239, 68, 68, 0.10)"
      : "var(--muted)",
  color:
    variant === "danger"
      ? "var(--destructive)"
      : "var(--muted-foreground)",
  cursor: "pointer",
  transition:
    "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease",
  flexShrink: 0,
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

export const skeletonRow: CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

export const skeletonCell: CSSProperties = {
  padding: "0.875rem 1rem",
};

export const skeletonBar = (width?: string): CSSProperties => ({
  height: "0.875rem",
  borderRadius: "0.375rem",
  backgroundColor: "var(--muted)",
  width: width || "60%",
  animation: "pulse 1.5s ease-in-out infinite",
});
