"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { LoaderIcon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className={cn("flex flex-col items-center gap-3 pt-4 text-[13px] text-muted-foreground", className)}>
      <span aria-live="polite">
        {shown >= totalCount
          ? totalCount === 1
            ? "1 result"
            : `All ${totalCount} shown`
          : `Showing ${shown} of ${totalCount}`}
      </span>
      {canLoadMore &&
        (autoLoad ? (
          <div ref={sentinelRef} className="flex h-10 items-center gap-2">
            {loading && <LoaderIcon size={16} className="animate-spin" />}
            {loading ? "Loading…" : ""}
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            className="h-11 w-full text-sm font-medium"
          >
            {loading ? (
              <>
                <LoaderIcon size={16} className="mr-2 animate-spin" />
                Loading…
              </>
            ) : (
              `Load ${Math.min(step, totalCount - shown)} more`
            )}
          </Button>
        ))}
      {atCap && shown < totalCount && (
        <span className="text-center">Search or filter to find the rest.</span>
      )}
    </div>
  );
}

export default function Pagination(props: PaginationProps) {
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
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 py-4 text-sm text-muted-foreground sm:flex-row sm:justify-between",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-start">
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
          <SelectTrigger className="w-[4.5rem]">
            <SelectValue />
          </SelectTrigger>
          {/* Pinned to the trigger's own width (not just min-width, which is
              all the base component guarantees) via Radix's own
              --radix-select-trigger-width — so "10"/"20"/"50"/"100" don't
              force the popover wider than the 4.5rem trigger it opens from. */}
          <SelectContent
            className="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]"
            viewportClassName="px-0 py-0.5 [&>*+*]:mt-0.5"
          >
            {pageSizeOptions.map((size) => (
              <SelectItem
                key={size}
                value={String(size)}
                className="mx-0.5 !w-[calc(100%-6px)] !rounded-[calc(var(--input-radius)-2px)]"
                hideIndicator
              >
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full items-center justify-center gap-1 sm:w-auto">
        <Button
          variant="ghost"
          className="flex h-10 w-10 sm:h-8 sm:w-8 p-0 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={16} />
        </Button>

        {/* Phones: "Page 3 of 12" between the arrows instead of a row of
            numbered buttons too small to tap reliably. */}
        <span className="min-w-[7.5rem] text-center font-medium text-foreground sm:hidden">
          Page {page} of {totalPages}
        </span>

        {getPageNumbers().map((pageNum, idx) => {
          if (pageNum === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="hidden px-2 text-slate-400 cursor-pointer sm:inline"
              >
                ...
              </span>
            );
          }
          return (
            <Button
              variant="ghost"
              key={`page-${pageNum}`}
              className={cn(
                "hidden h-8 min-w-[32px] p-0 items-center justify-center rounded-md px-2 transition-colors text-sm cursor-pointer sm:flex",
                page === pageNum
                  ? "bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onPageChange(pageNum as number)}
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          variant="ghost"
          className="flex h-10 w-10 sm:h-8 sm:w-8 p-0 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon size={16} />
        </Button>
      </div>
    </div>
  );
}
