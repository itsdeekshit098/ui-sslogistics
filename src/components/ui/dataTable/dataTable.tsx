"use client";

import React, { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  InboxIcon,
  MoreHorizontalIcon,
} from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Tooltip } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import type { ColumnDef, DataTableProps, RowAction } from "./dataTable.types";

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
        active
          ? "text-primary opacity-100"
          : "text-muted-foreground opacity-30",
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
                style={{
                  width:
                    colIdx === 0 ? "45%" : colIdx % 3 === 0 ? "70%" : "55%",
                }}
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
  const label =
    typeof action.label === "function" ? action.label(row) : action.label;
  const icon =
    typeof action.icon === "function" ? action.icon(row) : action.icon;
  const disabledTooltip =
    typeof action.disabledTooltip === "function"
      ? action.disabledTooltip(row)
      : action.disabledTooltip;
  const testId =
    typeof action.testId === "function" ? action.testId(row) : action.testId;

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
        !isDisabled && "hover:scale-105 active:scale-95",
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

// ─── Mobile Cards ─────────────────────────────────────────────────────────────

type Slot = "title" | "subtitle" | "trailing" | "field" | "footer";

function slotOf<TData>(col: ColumnDef<TData>, index: number): Slot | "hidden" {
  if (col.mobile) return col.mobile;
  if (col.key === "action" || col.key === "actions") return "footer";
  return index === 0 ? "title" : "field";
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex justify-between gap-4">
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="h-3 w-3/4 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Phone-width rendering of the same columns: one card per row instead of a
 * table that has to be scrolled sideways. Built from the column definitions,
 * so every table gets it without a page-specific card list.
 */
/** Placeholder glyphs a cell renders for "no value". */
const BLANK_TEXT = new Set(["", "—", "-", "–"]);

/**
 * True when a rendered cell carries no information — nothing at all, or
 * just a dash placeholder, possibly wrapped in a plain element such as
 * `<span className="text-muted-foreground">—</span>`. Only host elements are
 * unwrapped; a component (Badge, Money…) always counts as content.
 */
function isBlankCell(node: React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean")
    return true;
  if (typeof node === "string") return BLANK_TEXT.has(node.trim());
  if (Array.isArray(node)) return node.every(isBlankCell);
  if (React.isValidElement(node) && typeof node.type === "string") {
    return isBlankCell((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

type CellEntry = { key: string; header: string; node: React.ReactNode };

function renderSlot<TData>(
  cols: ColumnDef<TData>[],
  row: TData,
  index: number,
): CellEntry[] {
  return cols
    .map((col) => ({
      key: col.key,
      header: col.header,
      node: col.cell(row, index),
    }))
    .filter((entry) => !isBlankCell(entry.node));
}

/**
 * Phone-width rendering of the same columns: one card per row instead of a
 * table that has to be scrolled sideways. Built from the column definitions,
 * so every table gets it without a page-specific card list. Blank ("—")
 * fields are dropped rather than shown as a grid of dashes.
 *
 * `layout="timeline"` renders the rows on a vertical rail instead — for
 * chronological ledgers (payments, entries), where the sequence is the point.
 */
function MobileCards<TData>({
  columns,
  data,
  rowKey,
  loading,
  emptyMessage,
  emptyNode,
  onRowClick,
  clickable,
  rowClassName,
  rowStyle,
  rowActions,
  className,
  layout,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  rowKey: (row: TData) => string | number;
  loading: boolean;
  emptyMessage: string;
  emptyNode?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  clickable: boolean;
  rowClassName?: (row: TData) => string;
  rowStyle?: (row: TData) => React.CSSProperties;
  rowActions?: RowAction<TData>[];
  className?: string;
  layout: "cards" | "timeline";
}) {
  const bySlot = (slot: Slot) =>
    columns.filter((col, i) => slotOf(col, i) === slot);
  const titleCols = bySlot("title");
  const subtitleCols = bySlot("subtitle");
  const trailingCols = bySlot("trailing");
  const fieldCols = bySlot("field");
  const footerCols = bySlot("footer");
  const timeline = layout === "timeline";
  // Row actions live in a "⋯" action sheet on phones rather than a strip of
  // icon buttons on every card — one quiet affordance instead of 2–3 tinted
  // squares per row, and labelled actions instead of bare icons.
  const [menu, setMenu] = useState<{
    row: TData;
    title: React.ReactNode;
  } | null>(null);

  // Skeletons only for a first load. With cards already on screen (a
  // "Load more", a refresh after an edit) they stay put — swapping them for
  // skeletons would collapse the list and throw the reader back to the top.
  if (loading && data.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3 md:hidden", className)}>
        <SkeletonCards />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border bg-card p-10 text-center md:hidden",
          className,
        )}
      >
        {emptyNode ?? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <InboxIcon size={36} />
            <p className="text-sm font-medium">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  const menuActions = menu
    ? (rowActions ?? []).filter((a) => !a.hidden?.(menu.row))
    : [];

  return (
    <>
      <BottomSheet
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.title}
      >
        <div className="flex flex-col py-1" role="menu">
          {menu &&
            menuActions.map((action) => {
              const row = menu.row;
              const isDisabled = action.disabled?.(row) ?? false;
              const label =
                typeof action.label === "function"
                  ? action.label(row)
                  : action.label;
              const icon =
                typeof action.icon === "function"
                  ? action.icon(row)
                  : action.icon;
              const reason =
                typeof action.disabledTooltip === "function"
                  ? action.disabledTooltip(row)
                  : action.disabledTooltip;
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={isDisabled}
                  onClick={() => {
                    setMenu(null);
                    action.onClick(row);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[15px] font-medium transition-colors active:bg-muted disabled:opacity-50",
                    action.variant === "danger"
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
                    {icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block">{label}</span>
                    {isDisabled && reason && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {reason}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
        </div>
      </BottomSheet>
      <div
        className={cn(
          "md:hidden",
          timeline ? "ml-1.5 border-l-2 border-border" : "flex flex-col gap-3",
          loading && "opacity-70 transition-opacity",
          className,
        )}
        role="list"
      >
        {data.map((row, index) => {
          const actions = rowActions?.filter((a) => !a.hidden?.(row)) ?? [];
          const titles = renderSlot(titleCols, row, index);
          const subtitles = renderSlot(subtitleCols, row, index);
          const trailing = renderSlot(trailingCols, row, index);
          const fields = renderSlot(fieldCols, row, index);
          const footer = renderSlot(footerCols, row, index);
          const openMenu = (e: React.MouseEvent) => {
            e.stopPropagation();
            setMenu({ row, title: titles[0]?.node ?? null });
          };
          const menuButton = actions.length > 0 && (
            <button
              type="button"
              aria-label="Actions"
              aria-haspopup="dialog"
              onClick={openMenu}
              // Only the keys that would also activate the card; letting
            // Escape through keeps the sheet's close-on-Escape working.
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
              className="-mr-2 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
            >
              <MoreHorizontalIcon size={20} />
            </button>
          );
          // On a timeline, per-row buttons (e.g. "Reverse") sit under the
          // amount instead of on a line of their own between entries.
          const sideNodes = timeline ? [...trailing, ...footer] : trailing;
          const hasFooter = !timeline && footer.length > 0;

          const header = (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                {titles.map((t) => (
                  <div
                    key={t.key}
                    className="ss-card-cell text-[0.9375rem] font-semibold text-foreground"
                  >
                    {t.node}
                  </div>
                ))}
                {subtitles.map((t) => (
                  <div
                    key={t.key}
                    className="ss-card-cell text-[13px] text-muted-foreground"
                  >
                    {t.node}
                  </div>
                ))}
              </div>
              {sideNodes.length > 0 && (
                <div
                  className="flex max-w-[50%] shrink-0 flex-col items-end gap-1 text-right text-sm"
                  onClick={(e) => timeline && e.stopPropagation()}
                >
                  {sideNodes.map((t) => (
                    <div key={t.key}>{t.node}</div>
                  ))}
                </div>
              )}
              {menuButton}
              {clickable && !menuButton && (
                <ChevronRightIcon
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
            </div>
          );

          const footerRow = hasFooter && (
            <div
              className={cn(
                "flex flex-wrap items-center justify-end gap-2",
                timeline ? "mt-2" : "mt-3 border-t border-border pt-3",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {footer.map((f) => (
                <div key={f.key} className="min-w-0">
                  {f.node}
                </div>
              ))}
            </div>
          );

          const interactive = {
            style: rowStyle?.(row),
            onClick: () => clickable && onRowClick?.(row),
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              if (clickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onRowClick?.(row);
              }
            },
            tabIndex: clickable ? 0 : undefined,
          };

          if (timeline) {
            return (
              <div
                key={rowKey(row)}
                role="listitem"
                className="relative pb-5 pl-5 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                />
                <div
                  className={cn(
                    "rounded-lg",
                    clickable && "cursor-pointer active:bg-muted/50",
                    rowClassName?.(row),
                  )}
                  {...interactive}
                >
                  {header}
                  {fields.length > 0 && (
                    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {fields.map((f) => (
                        <div
                          key={f.key}
                          className="flex min-w-0 items-baseline gap-1.5"
                        >
                          {f.header && (
                            <dt className="text-muted-foreground">
                              {f.header}
                            </dt>
                          )}
                          <dd className="ss-card-cell text-foreground">
                            {f.node}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {footerRow}
                </div>
              </div>
            );
          }

          return (
            <div
              key={rowKey(row)}
              role="listitem"
              className={cn(
                "rounded-xl border border-border bg-card p-4 shadow-card transition-transform",
                clickable &&
                  "cursor-pointer active:scale-[0.99] active:bg-muted/50",
                rowClassName?.(row),
              )}
              {...interactive}
            >
              {header}
              {fields.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3">
                  {fields.map((f) => (
                    <div key={f.key} className="min-w-0">
                      {f.header && (
                        <dt className="mb-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                          {f.header}
                        </dt>
                      )}
                      <dd className="ss-card-cell text-sm text-foreground">
                        {f.node}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {footerRow}
            </div>
          );
        })}
      </div>
    </>
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
  mobileLayout = "cards",
}: DataTableProps<TData>) {
  const desktopActions = rowActions?.filter((a) => !a.mobileOnly) ?? [];
  const hasActions = showActions && desktopActions.length > 0;
  const hasMobileActions = showActions && !!rowActions && rowActions.length > 0;
  const clickable = rowClickable || !!onRowClick;
  const isMobile = useIsMobile();
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

  // Only one layout is mounted: rendering both (one CSS-hidden) ran every
  // cell renderer twice and left hidden duplicates for text lookups to hit.
  if (isMobile) {
    return (
      <MobileCards
        columns={columns}
        data={data}
        rowKey={rowKey}
        loading={loading}
        emptyMessage={emptyMessage}
        emptyNode={emptyNode}
        onRowClick={onRowClick}
        clickable={clickable}
        rowClassName={rowClassName}
        rowStyle={rowStyle}
        rowActions={hasMobileActions ? rowActions : undefined}
        className={className}
        layout={mobileLayout}
      />
    );
  }

  return (
    <div
      className={cn(
        "hidden w-full overflow-hidden rounded-xl border border-border bg-card shadow-card md:block",
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
                        width:
                          typeof col.width === "number"
                            ? `${col.width}px`
                            : col.width,
                      }),
                      ...(col.minWidth !== undefined && {
                        minWidth:
                          typeof col.minWidth === "number"
                            ? `${col.minWidth}px`
                            : col.minWidth,
                      }),
                    }}
                    onClick={() => handleHeaderClick(col.key, col.sortable)}
                    onKeyDown={(e) =>
                      handleHeaderKeyDown(e, col.key, col.sortable)
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
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
                        <p className="text-[0.9rem] font-medium">
                          {emptyMessage}
                        </p>
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
                      <td
                        className={cn(
                          dense ? "py-2" : "py-3.5",
                          "px-4 text-right",
                        )}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {hasActions && (
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {desktopActions
                                .filter((a) => !a.hidden?.(row))
                                .map((action) => (
                                  <ActionButton
                                    key={action.key}
                                    action={action}
                                    row={row}
                                  />
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
