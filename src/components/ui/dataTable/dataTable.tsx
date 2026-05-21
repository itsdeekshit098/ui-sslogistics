"use client";

import { useState, useCallback } from "react";
import type { KeyboardEvent, CSSProperties } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  InboxIcon,
} from "@/components/ui/icon";
import type { DataTableProps, RowAction } from "./dataTable.types";
import * as styles from "./dataTable.style";

const SKELETON_ROWS = 10;

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction?: "asc" | "desc";
}) {
  if (!active) {
    return (
      <span style={styles.sortIconWrapper(false)}>
        <ChevronsUpDownIcon size={14} />
      </span>
    );
  }
  return (
    <span style={styles.sortIconWrapper(true, direction)}>
      {direction === "asc" ? (
        <ChevronUpIcon size={14} />
      ) : (
        <ChevronDownIcon size={14} />
      )}
    </span>
  );
}

// ─── Skeleton Rows ────────────────────────────────────────────────────────────

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
        <tr key={rowIdx} style={styles.skeletonRow}>
          {Array.from({ length: colCount }).map((_, colIdx) => (
            <td key={colIdx} style={styles.skeletonCell}>
              <div
                style={styles.skeletonBar(
                  colIdx === 0 ? "45%" : colIdx % 3 === 0 ? "70%" : "55%",
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton<TData>({
  action,
  row,
}: {
  action: RowAction<TData>;
  row: TData;
}) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = action.disabled?.(row) ?? false;

  const baseStyle = styles.actionBtn(action.variant);
  const hoveredStyle: CSSProperties =
    hovered && !isDisabled
      ? {
          backgroundColor:
            action.variant === "danger"
              ? "rgba(239, 68, 68, 0.18)"
              : "var(--accent, var(--muted))",
          transform: "scale(1.08)",
          boxShadow:
            action.variant === "danger"
              ? "0 0 0 1px rgba(239, 68, 68, 0.15)"
              : "0 0 0 1px var(--border)",
        }
      : {};

  const label = typeof action.label === "function" ? action.label(row) : action.label;
  const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={isDisabled}
      style={{
        ...baseStyle,
        ...hoveredStyle,
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) action.onClick(row);
      }}
    >
      {icon}
    </button>
  );
}

// ─── Main DataTable ───────────────────────────────────────────────────────────

export function DataTable<TData>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage = "No records found.",
  emptyNode,
  sortState,
  onSort,
  onRowClick,
  rowClickable = false,
  rowClassName,
  rowStyle,
  rowActions,
  actionsLabel = "Actions",
  showActions = true,
  className,
  striped = false,
  dense = false,
  stickyHeader = false,
  maxHeight,
}: DataTableProps<TData>) {
  const hasActions = showActions && rowActions && rowActions.length > 0;
  const totalCols = columns.length + (hasActions ? 1 : 0);

  const handleHeaderClick = useCallback(
    (key: string, sortable?: boolean) => {
      if (!sortable || !onSort) return;
      const currentDir = sortState?.key === key ? sortState.direction : null;
      const nextDir: "asc" | "desc" = currentDir === "asc" ? "desc" : "asc";
      onSort(key, nextDir);
    },
    [sortState, onSort],
  );

  const handleHeaderKeyDown = useCallback(
    (
      e: KeyboardEvent<HTMLTableCellElement>,
      key: string,
      sortable?: boolean,
    ) => {
      if (!sortable) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleHeaderClick(key, sortable);
      }
    },
    [handleHeaderClick],
  );

  const handleRowClick = useCallback(
    (row: TData) => {
      if (onRowClick) onRowClick(row);
    },
    [onRowClick],
  );

  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>, row: TData) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onRowClick) onRowClick(row);
      }
    },
    [onRowClick],
  );

  return (
    <div
      style={styles.tableWrapper(maxHeight, stickyHeader)}
      className={className}
    >
      <div style={styles.tableScrollContainer}>
        <table style={styles.table} role="table">
          {/* ── Head ── */}
          <thead style={styles.thead(stickyHeader)}>
            <tr style={styles.theadRow}>
              {columns.map((col) => {
                const isActive = sortState?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    role="columnheader"
                    aria-sort={
                      isActive
                        ? sortState?.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : col.sortable
                          ? "none"
                          : undefined
                    }
                    tabIndex={col.sortable ? 0 : undefined}
                    title={col.tooltip}
                    style={styles.th(
                      col.align,
                      col.sortable,
                      col.width,
                      col.minWidth,
                    )}
                    onClick={() => handleHeaderClick(col.key, col.sortable)}
                    onKeyDown={(e) =>
                      handleHeaderKeyDown(e, col.key, col.sortable)
                    }
                  >
                    <span style={styles.thInner}>
                      {col.header}
                      {col.sortable && (
                        <SortIcon
                          active={isActive}
                          direction={
                            isActive ? sortState?.direction : undefined
                          }
                        />
                      )}
                    </span>
                  </th>
                );
              })}
              {hasActions && (
                <th
                  scope="col"
                  style={styles.th("right")}
                  aria-label={actionsLabel}
                >
                  {actionsLabel}
                </th>
              )}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {loading ? (
              <SkeletonRows colCount={totalCols} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={totalCols}>
                  <div style={styles.emptyRow}>
                    {emptyNode ?? (
                      <div style={styles.emptyIconWrapper}>
                        <InboxIcon size={40} />
                        <p style={styles.emptyText}>{emptyMessage}</p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const isClickable = rowClickable || !!onRowClick;
                const baseStyle = styles.tbodyRow(isClickable, striped, index);
                const extra = rowStyle?.(row) ?? {};
                const extraClass = rowClassName?.(row) ?? "";

                return (
                  <tr
                    key={rowKey(row)}
                    role={isClickable ? "button" : "row"}
                    tabIndex={isClickable ? 0 : undefined}
                    className={extraClass}
                    style={{ ...baseStyle, ...extra }}
                    onClick={() => isClickable && handleRowClick(row)}
                    onKeyDown={(e) => isClickable && handleRowKeyDown(e, row)}
                    onMouseEnter={(e) => {
                      if (isClickable) {
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.backgroundColor = "var(--muted)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isClickable) {
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.backgroundColor =
                          striped && index % 2 === 0
                            ? "var(--muted)"
                            : "transparent";
                      }
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          ...styles.td(col.align, dense),
                          ...(col.style ?? {}),
                        }}
                        className={col.className}
                      >
                        {col.cell(row, index)}
                      </td>
                    ))}
                    {hasActions && (
                      <td style={{ ...styles.td("right", dense) }}>
                        <div
                          style={styles.actionsCell}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rowActions!
                            .filter((a) => !a.hidden?.(row))
                            .map((action) => (
                              <ActionButton
                                key={action.key}
                                action={action}
                                row={row}
                              />
                            ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
