"use client";

import React, { useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronRightIcon, InboxIcon, MoreHorizontalIcon } from "../../icons";
import { BottomSheet } from "../../components/bottomSheet";
import {
  Block,
  Card,
  CardBody,
  CardChevron,
  CardHeader,
  CardList,
  EmptyCard,
  EmptyCardColumn,
  EmptyCardIcon,
  EmptyCardText,
  FieldLabel,
  FieldValue,
  Fields,
  FooterRow,
  Grow,
  MenuButton,
  MenuIcon,
  MenuItem,
  MenuReason,
  MenuText,
  MinZero,
  SheetMenu,
  Side,
  Subtitle,
  TimelineDot,
  TimelineField,
  TimelineFields,
  TimelineItem,
  TimelineLabel,
  TimelineRow,
  TimelineValue,
  Title,
  Titles,
} from "./dataTable.styles";
import { SkeletonCards } from "./dataTableSkeleton";
import { renderSlot, slotOf, type Slot } from "./dataTable.utils";
import type { ColumnDef, RowAction } from "./dataTable.types";

/**
 * Phone-width rendering of the same columns: one card per row instead of a
 * table that has to be scrolled sideways. Built from the column definitions,
 * so every table gets it without a page-specific card list. Blank ("—")
 * fields are dropped rather than shown as a grid of dashes.
 *
 * `layout="timeline"` renders the rows on a vertical rail instead — for
 * chronological ledgers (payments, entries), where the sequence is the point.
 */
export function MobileCards<TData>({
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
  mobileCard,
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
  mobileCard?: (row: TData, index: number) => React.ReactNode;
}) {
  const bySlot = (slot: Slot) => columns.filter((col, i) => slotOf(col, i) === slot);
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
      <CardList data-ui="data-table-cards" $timeline={false} $loading={false} className={className}>
        <SkeletonCards />
      </CardList>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyCard data-ui="data-table-cards" className={className}>
        {emptyNode ?? (
          <EmptyCardColumn>
            <EmptyCardIcon>
              <InboxIcon size={28} />
            </EmptyCardIcon>
            <EmptyCardText>{emptyMessage}</EmptyCardText>
          </EmptyCardColumn>
        )}
      </EmptyCard>
    );
  }

  const menuActions = menu ? (rowActions ?? []).filter((a) => !a.hidden?.(menu.row)) : [];

  return (
    <>
      <BottomSheet open={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        <SheetMenu role="menu">
          {menu &&
            menuActions.map((action) => {
              const row = menu.row;
              const isDisabled = action.disabled?.(row) ?? false;
              const label = typeof action.label === "function" ? action.label(row) : action.label;
              const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
              const reason =
                typeof action.disabledTooltip === "function"
                  ? action.disabledTooltip(row)
                  : action.disabledTooltip;
              return (
                <MenuItem
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={isDisabled}
                  $danger={action.variant === "danger"}
                  onClick={() => {
                    setMenu(null);
                    action.onClick(row);
                  }}
                >
                  <MenuIcon>{icon}</MenuIcon>
                  <MenuText>
                    <Block>{label}</Block>
                    {isDisabled && reason && <MenuReason>{reason}</MenuReason>}
                  </MenuText>
                </MenuItem>
              );
            })}
        </SheetMenu>
      </BottomSheet>
      <CardList
        data-ui="data-table-cards"
        role="list"
        $timeline={timeline}
        $loading={loading}
        className={className}
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
            <MenuButton
              type="button"
              aria-label="Actions"
              aria-haspopup="dialog"
              onClick={openMenu}
              // Only the keys that would also activate the card; letting
              // Escape through keeps the sheet's close-on-Escape working.
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
            >
              <MoreHorizontalIcon size={20} />
            </MenuButton>
          );
          // On a timeline, per-row buttons (e.g. "Reverse") sit under the
          // amount instead of on a line of their own between entries.
          const sideNodes = timeline ? [...trailing, ...footer] : trailing;
          const hasFooter = !timeline && footer.length > 0;

          const header = (
            <CardHeader>
              <Titles>
                {titles.map((t) => (
                  <Title key={t.key} data-ui="card-cell" $timeline={timeline}>
                    {t.node}
                  </Title>
                ))}
                {subtitles.map((t) => (
                  <Subtitle key={t.key} data-ui="card-cell">
                    {t.node}
                  </Subtitle>
                ))}
              </Titles>
              {sideNodes.length > 0 && (
                <Side onClick={(e) => timeline && e.stopPropagation()}>
                  {sideNodes.map((t) => (
                    <div key={t.key}>{t.node}</div>
                  ))}
                </Side>
              )}
              {menuButton}
              {clickable && !menuButton && (
                <CardChevron aria-hidden="true">
                  <ChevronRightIcon size={18} />
                </CardChevron>
              )}
            </CardHeader>
          );

          const footerRow = hasFooter && (
            <FooterRow $timeline={timeline} onClick={(e) => e.stopPropagation()}>
              {footer.map((f) => (
                <MinZero key={f.key}>{f.node}</MinZero>
              ))}
            </FooterRow>
          );

          // A caller's own per-row class and inline style are passed through as given.
          const callerProps = {
            className: rowClassName?.(row),
            style: rowStyle?.(row),
          };
          const interactive = {
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
              <TimelineItem key={rowKey(row)} role="listitem">
                <TimelineDot aria-hidden="true" />
                <TimelineRow $clickable={clickable} {...callerProps} {...interactive}>
                  {header}
                  {fields.length > 0 && (
                    <TimelineFields>
                      {fields.map((f) => (
                        <TimelineField key={f.key}>
                          {f.header && <TimelineLabel>{f.header}</TimelineLabel>}
                          <TimelineValue data-ui="card-cell">{f.node}</TimelineValue>
                        </TimelineField>
                      ))}
                    </TimelineFields>
                  )}
                  {footerRow}
                </TimelineRow>
              </TimelineItem>
            );
          }

          return (
            <Card
              key={rowKey(row)}
              role="listitem"
              $clickable={clickable}
              {...callerProps}
              {...interactive}
            >
              {mobileCard ? (
                <CardBody>
                  <Grow>{mobileCard(row, index)}</Grow>
                  {menuButton}
                </CardBody>
              ) : (
                header
              )}
              {!mobileCard && fields.length > 0 && (
                <Fields>
                  {fields.map((f) => (
                    <MinZero key={f.key}>
                      {f.header && <FieldLabel>{f.header}</FieldLabel>}
                      <FieldValue data-ui="card-cell">{f.node}</FieldValue>
                    </MinZero>
                  ))}
                </Fields>
              )}
              {footerRow}
            </Card>
          );
        })}
      </CardList>
    </>
  );
}
