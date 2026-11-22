"use client";

import { useCallback } from "react";
import type { KeyboardEvent } from "react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  InboxIcon,
} from "../../icons";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  ActionGroup,
  BodyRow,
  EmptyBox,
  EmptyColumn,
  EmptyText,
  Frame,
  Grid,
  Head,
  HeadRow,
  RowChevron,
  ScrollX,
  SortGlyph,
  Td,
  TdTrailing,
  Th,
  ThInner,
  ThTrailing,
  TrailingRow,
} from "./dataTable.styles";
import { MobileCards } from "./dataTableMobileCards";
import { RowActionButton } from "./dataTableRowAction";
import { SkeletonRows } from "./dataTableSkeleton";
import { toCssLength } from "../../utils/cssLength";
import type { DataTableProps } from "./dataTable.types";

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  return (
    <SortGlyph $active={active}>
      {!active ? (
        <ChevronsUpDownIcon size={14} />
      ) : direction === "asc" ? (
        <ChevronUpIcon size={14} />
      ) : (
        <ChevronDownIcon size={14} />
      )}
    </SortGlyph>
  );
}

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
  mobileCard,
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
        mobileCard={mobileCard}
      />
    );
  }

  return (
    <Frame data-ui="data-table" className={className} $maxHeight={maxHeight}>
      <ScrollX>
        <Grid role="table">
          {/* ── Head ── */}
          <Head $sticky={stickyHeader}>
            <HeadRow>
              {columns.map((col) => {
                const isActive = sortState?.key === col.key;
                return (
                  <Th
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
                    $align={col.align ?? "left"}
                    $sortable={!!col.sortable}
                    $width={toCssLength(col.width)}
                    $minWidth={toCssLength(col.minWidth)}
                    onClick={() => handleHeaderClick(col.key, col.sortable)}
                    onKeyDown={(e) => handleHeaderKeyDown(e, col.key, col.sortable)}
                  >
                    <ThInner>
                      {col.header}
                      {col.sortable && (
                        <SortIcon
                          active={isActive}
                          direction={isActive ? sortState?.direction : undefined}
                        />
                      )}
                    </ThInner>
                  </Th>
                );
              })}
              {hasTrailingColumn && (
                <ThTrailing scope="col" aria-label={hasActions ? actionsLabel : "Open"}>
                  {hasActions ? actionsLabel : ""}
                </ThTrailing>
              )}
            </HeadRow>
          </Head>

          {/* ── Body ── */}
          <tbody>
            {loading ? (
              <SkeletonRows colCount={totalCols} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={totalCols}>
                  <EmptyBox>
                    {emptyNode ?? (
                      <EmptyColumn>
                        <InboxIcon size={40} />
                        <EmptyText>{emptyMessage}</EmptyText>
                      </EmptyColumn>
                    )}
                  </EmptyBox>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                // A caller's own per-row class and inline style are passed through as given.
                // `group` is Tailwind's marker class: cells rendered by callers
                // style themselves with `group-hover:` against the row.
                const callerProps = {
                  className: ["group", rowClassName?.(row)].filter(Boolean).join(" "),
                  style: rowStyle?.(row),
                };

                return (
                  <BodyRow
                    key={rowKey(row)}
                    role={clickable ? "button" : "row"}
                    tabIndex={clickable ? 0 : undefined}
                    $clickable={clickable}
                    $striped={striped && index % 2 === 0}
                    {...callerProps}
                    onClick={() => clickable && handleRowClick(row)}
                    onKeyDown={(e) => clickable && handleRowKeyDown(e, row)}
                  >
                    {columns.map((col) => (
                      <Td
                        key={col.key}
                        $dense={dense}
                        $align={col.align ?? "left"}
                        // The column's own class and inline style, as the caller wrote them.
                        {...{ className: col.className, style: col.style }}
                      >
                        {col.cell(row, index)}
                      </Td>
                    ))}
                    {hasTrailingColumn && (
                      <TdTrailing $dense={dense}>
                        <TrailingRow>
                          {hasActions && (
                            <ActionGroup onClick={(e) => e.stopPropagation()}>
                              {desktopActions
                                .filter((a) => !a.hidden?.(row))
                                .map((action) => (
                                  <RowActionButton key={action.key} action={action} row={row} />
                                ))}
                            </ActionGroup>
                          )}
                          {clickable && (
                            // Unlike the actions above, this is never
                            // hover-gated — it's the only signal some rows
                            // have that clicking them navigates somewhere.
                            <RowChevron aria-hidden="true">
                              <ChevronRightIcon size={16} />
                            </RowChevron>
                          )}
                        </TrailingRow>
                      </TdTrailing>
                    )}
                  </BodyRow>
                );
              })
            )}
          </tbody>
        </Grid>
      </ScrollX>
    </Frame>
  );
}
