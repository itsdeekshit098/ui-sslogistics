"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  InboxIcon,
} from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DataTableProps, RowAction } from "./dataTable.types";

const SKELETON_ROWS = 10;

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction?: "asc" | "desc";
}) {
  return (
    <span
      className={cn(
        "inline-flex flex-col gap-px transition-opacity",
        active ? "text-primary opacity-100" : "text-muted-foreground opacity-30",
      )}
    >
      {!active ? (
        <ChevronsUpDownIcon size={14} />
      ) : direction === "asc" ? (
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
        <tr key={rowIdx} className="border-b border-border">
          {Array.from({ length: colCount }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3.5">
              <div
                className="h-3.5 animate-pulse rounded-md bg-muted"
                style={{ width: colIdx === 0 ? "45%" : colIdx % 3 === 0 ? "70%" : "55%" }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

const actionBtnBase =
  "inline-flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-40";

function ActionButton<TData>({
  action,
  row,
}: {
  action: RowAction<TData>;
  row: TData;
}) {
  const isDisabled = action.disabled?.(row) ?? false;
  const label = typeof action.label === "function" ? action.label(row) : action.label;
  const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
  const disabledTooltip =
    typeof action.disabledTooltip === "function"
      ? action.disabledTooltip(row)
      : action.disabledTooltip;
  const testId = typeof action.testId === "function" ? action.testId(row) : action.testId;

  const buttonNode = (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-testid={testId}
      disabled={isDisabled}
      className={cn(
        actionBtnBase,
        action.variant === "danger"
          ? "bg-destructive-subtle text-destructive hover:bg-destructive/20"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        !isDisabled && "hover:scale-105",
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) action.onClick(row);
      }}
    >
      {icon}
    </button>
  );

  if (isDisabled && disabledTooltip) {
    return (
      <Tooltip content={disabledTooltip} position="left">
        <span className="inline-block cursor-not-allowed">
          <span className="pointer-events-none inline-flex">{buttonNode}</span>
        </span>
      </Tooltip>
    );
  }

  return buttonNode;
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
  const clickable = rowClickable || !!onRowClick;
  // A clickable row always gets a visible chevron — relying on a hover-only
  // cursor change to signal "this opens something" isn't discoverable, and
  // when there are no rowActions at all there was previously no affordance
  // whatsoever that the row led anywhere.
  const hasTrailingColumn = hasActions || clickable;
  const totalCols = columns.length + (hasTrailingColumn ? 1 : 0);

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
    (e: KeyboardEvent<HTMLTableCellElement>, key: string, sortable?: boolean) => {
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
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className,
      )}
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm" role="table">
          {/* ── Head ── */}
          <thead className={cn(stickyHeader && "sticky top-0 z-[2]")}>
            <tr className="border-b border-border bg-muted">
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
                    className={cn(
                      "whitespace-nowrap bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none",
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left",
                      col.sortable && "cursor-pointer",
                    )}
                    style={{
                      ...(col.width !== undefined && {
                        width: typeof col.width === "number" ? `${col.width}px` : col.width,
                      }),
                      ...(col.minWidth !== undefined && {
                        minWidth:
                          typeof col.minWidth === "number" ? `${col.minWidth}px` : col.minWidth,
                      }),
                    }}
                    onClick={() => handleHeaderClick(col.key, col.sortable)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, col.key, col.sortable)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable && (
                        <SortIcon
                          active={isActive}
                          direction={isActive ? sortState?.direction : undefined}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
              {hasTrailingColumn && (
                <th
                  scope="col"
                  className="bg-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  aria-label={hasActions ? actionsLabel : "Open"}
                >
                  {hasActions ? actionsLabel : ""}
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
                  <div className="p-12 text-center">
                    {emptyNode ?? (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <InboxIcon size={40} />
                        <p className="text-[0.9rem] font-medium">{emptyMessage}</p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const extraStyle = rowStyle?.(row);
                const extraClass = rowClassName?.(row);

                return (
                  <tr
                    key={rowKey(row)}
                    role={clickable ? "button" : "row"}
                    tabIndex={clickable ? 0 : undefined}
                    className={cn(
                      "group border-b border-border transition-colors",
                      clickable && "cursor-pointer hover:bg-muted",
                      striped && index % 2 === 0 && "bg-muted",
                      extraClass,
                    )}
                    style={extraStyle}
                    onClick={() => clickable && handleRowClick(row)}
                    onKeyDown={(e) => clickable && handleRowKeyDown(e, row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          dense ? "py-2" : "py-3.5",
                          "px-4 align-middle leading-relaxed text-foreground",
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left",
                          col.className,
                        )}
                        style={col.style}
                      >
                        {col.cell(row, index)}
                      </td>
                    ))}
                    {hasTrailingColumn && (
                      <td className={cn(dense ? "py-2" : "py-3.5", "px-4 text-right")}>
                        <div className="flex items-center justify-end gap-2">
                          {hasActions && (
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {rowActions!
                                .filter((a) => !a.hidden?.(row))
                                .map((action) => (
                                  <ActionButton key={action.key} action={action} row={row} />
                                ))}
                            </div>
                          )}
                          {clickable && (
                            // Unlike the actions above, this is never
                            // hover-gated — it's the only signal some rows
                            // have that clicking them navigates somewhere.
                            <ChevronRightIcon
                              size={16}
                              className="shrink-0 text-muted-foreground/60"
                              aria-hidden="true"
                            />
                          )}
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
