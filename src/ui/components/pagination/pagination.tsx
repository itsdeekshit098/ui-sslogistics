"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Select, SelectContent, SelectItem, SelectValue } from "../select";
import {
  Arrow,
  CapNote,
  Controls,
  Ellipsis,
  MoreButton,
  MoreRoot,
  NumberedRoot,
  PageButton,
  PhonePosition,
  Sentinel,
  SizeTrigger,
  SpinningLoader,
  Summary,
} from "./pagination.styles";
import type { PaginationProps } from "./pagination.types";

/** Highest page size "Load more" grows to — the list APIs cap page_size here
 * too. Past it, narrowing by search/filter beats scrolling hundreds of cards. */
export const MOBILE_MAX_ROWS = 200;

/**
 * Phone footer: one growing list instead of numbered pages. "Load more"
 * re-requests page 1 with a larger page size (20 → 40 → 60…) rather than
 * appending page 2, 3… client-side — every refetch then returns the whole
 * visible list fresh, so an edit or delete made further up is never left
 * stale, and no page needs its own accumulation logic.
 */
function LoadMore({
  page,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  autoLoad = false,
  className,
}: PaginationProps) {
  // The batch size is the page's starting size (e.g. 10), capped at 20 so a
  // remount with an already-grown size (switching tabs) doesn't double it.
  const [step] = useState(() => Math.min(pageSize, 20));
  // One request at a time: set on "Load more", cleared once the page has
  // reported loading and finished. Without it a double-tap — or the
  // auto-loader firing again before the parent flips `loading` — sent two
  // requests (20 and 30), and whichever answered last won.
  const pendingRef = useRef(false);
  const sawLoadingRef = useRef(false);
  useEffect(() => {
    if (loading) {
      sawLoadingRef.current = true;
      return;
    }
    if (sawLoadingRef.current) {
      sawLoadingRef.current = false;
      pendingRef.current = false;
    }
  }, [loading]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shown = Math.min(page * pageSize, totalCount);
  const atCap = pageSize >= MOBILE_MAX_ROWS;
  const canLoadMore = shown < totalCount && !atCap;

  const loadMore = () => {
    if (loading || !canLoadMore || pendingRef.current) return;
    pendingRef.current = true;
    // Safety net in case the page never reports a load (e.g. it errored
    // before setting its loading flag).
    setTimeout(() => {
      pendingRef.current = false;
    }, 8000);
    // Page > 1 only if the list was paged on desktop before a resize; the
    // grown page 1 then covers everything up to and including it.
    const next = Math.min(MOBILE_MAX_ROWS, Math.max(pageSize * page, pageSize) + step);
    onPageSizeChange(next);
    if (page !== 1) onPageChange(1);
  };

  // Auto-load: watch a sentinel at the end of the list. Re-armed after every
  // load (deps), so a short batch that doesn't fill the screen keeps going.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });
  useEffect(() => {
    if (!autoLoad || !canLoadMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && loadMoreRef.current(),
      { rootMargin: "0px 0px 300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad, canLoadMore, loading, pageSize]);

  if (totalCount === 0) return null;

  return (
    <MoreRoot data-ui="pagination" className={className}>
      <span aria-live="polite">
        {shown >= totalCount
          ? totalCount === 1
            ? "1 result"
            : `All ${totalCount} shown`
          : `Showing ${shown} of ${totalCount}`}
      </span>
      {canLoadMore &&
        (autoLoad ? (
          <Sentinel ref={sentinelRef}>
            {loading && <SpinningLoader size={16} />}
            {loading ? "Loading…" : ""}
          </Sentinel>
        ) : (
          <MoreButton variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <SpinningLoader size={16} $gap />
                Loading…
              </>
            ) : (
              `Load ${Math.min(step, totalCount - shown)} more`
            )}
          </MoreButton>
        ))}
      {atCap && shown < totalCount && <CapNote>Search or filter to find the rest.</CapNote>}
    </MoreRoot>
  );
}

export function Pagination(props: PaginationProps) {
  const isMobile = useIsMobile();
  return isMobile ? <LoadMore {...props} /> : <NumberedPagination {...props} />;
}

function NumberedPagination({
  page,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  // Prevent startItem from showing > totalCount if page is out of bounds
  const startItem = Math.min((page - 1) * pageSize + 1, totalCount);
  const endItem = Math.min(page * pageSize, totalCount);

  // Generate page numbers array with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (page > totalPages - 4) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  };

  if (totalCount === 0) return null;

  return (
    <NumberedRoot data-ui="pagination" className={className}>
      <Summary>
        <span>
          {startItem} - {endItem} of {totalCount}
        </span>
        {/*
          Plain <Select> primitive, no one-off overrides — the previous
          version replaced the item padding with a value meant for a
          left-side checkmark (this primitive's checkmark sits on the
          right), which pushed the popover wider than its 80px trigger, and
          swapped in a 1.5rem corner radius no other dropdown in the app
          uses. Popper-mode positioning already matches the popover to (at
          least) the trigger's width on its own.
        */}
        <Select
          data-testid="components-pagination-pagination-select-1"
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SizeTrigger>
            <SelectValue />
          </SizeTrigger>
          {/* Pinned to the trigger's own width (not just min-width, which is
              all the base component guarantees), so "10"/"20"/"50"/"100"
              don't force the popover wider than the 4.5rem trigger it opens from. */}
          <SelectContent compact matchTriggerWidth>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)} compact hideIndicator>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Summary>

      <Controls>
        <Arrow
          variant="ghost"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={16} />
        </Arrow>

        {/* Phones: "Page 3 of 12" between the arrows instead of a row of
            numbered buttons too small to tap reliably. */}
        <PhonePosition>
          Page {page} of {totalPages}
        </PhonePosition>

        {getPageNumbers().map((pageNum, idx) => {
          if (pageNum === "...") {
            return <Ellipsis key={`ellipsis-${idx}`}>...</Ellipsis>;
          }
          return (
            <PageButton
              variant="ghost"
              key={`page-${pageNum}`}
              $active={page === pageNum}
              onClick={() => onPageChange(pageNum as number)}
            >
              {pageNum}
            </PageButton>
          );
        })}

        <Arrow
          variant="ghost"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon size={16} />
        </Arrow>
      </Controls>
    </NumberedRoot>
  );
}
