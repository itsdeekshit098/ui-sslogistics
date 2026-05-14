"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
        <Select
          data-testid="components-pagination-pagination-select-1"
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className="h-10 w-[160px] rounded-md border-border bg-background px-4 text-sm text-foreground shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] hover:border-border/80 focus:border-border data-[state=open]:border-border cursor-pointer">
            <SelectValue placeholder={`${pageSize} / Page`} />
          </SelectTrigger>
          <SelectContent className="rounded-[1.5rem] border border-border bg-background text-foreground shadow-[0_24px_80px_-48px_rgba(15,23,42,0.32)]">
            {pageSizeOptions.map((size) => (
              <SelectItem
                key={size}
                value={String(size)}
                className="rounded-xl py-2.5 pl-9 pr-4 cursor-pointer"
              >
                {size} / Page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full items-center justify-center gap-1 sm:w-auto">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 cursor-pointer" />
        </button>

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
            <button
              key={`page-${pageNum}`}
              className={cn(
                "flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 transition-colors text-sm cursor-pointer",
                page === pageNum
                  ? "bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onPageChange(pageNum as number)}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:hover:bg-primary/10 transition-colors"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4 cursor-pointer" />
        </button>
      </div>
    </div>
  );
}
