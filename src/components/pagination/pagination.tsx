"use client";

import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaginationProps } from "./pagination.types";

export default function Pagination({
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
                className="mx-0.5 !w-[calc(100%-6px)] !rounded-[calc(var(--input-radius)+1px)]"
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
          className="flex h-8 w-8 p-0 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={16} />
        </Button>

        {getPageNumbers().map((pageNum, idx) => {
          if (pageNum === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-slate-400 cursor-pointer"
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
                "flex h-8 min-w-[32px] p-0 items-center justify-center rounded-md px-2 transition-colors text-sm cursor-pointer",
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
          className="flex h-8 w-8 p-0 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
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
