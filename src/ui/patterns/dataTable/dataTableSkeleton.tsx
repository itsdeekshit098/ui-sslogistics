"use client";

import {
  SkeletonCardBox,
  SkeletonCell,
  SkeletonGrid,
  SkeletonRow,
  SkeletonSplit,
} from "./dataTable.styles";
import { Skeleton } from "../../components/skeleton";
import { radius } from "../../tokens/tokens";

const SKELETON_ROWS = 10;

/** Placeholder rows for the desktop table's first load. */
export function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
        <SkeletonRow key={rowIdx}>
          {Array.from({ length: colCount }).map((_, colIdx) => (
            <SkeletonCell key={colIdx}>
              <Skeleton tone="muted" block width={colIdx === 0 ? "45%" : colIdx % 3 === 0 ? "70%" : "55%"} height="0.875rem" borderRadius={radius.base} />
            </SkeletonCell>
          ))}
        </SkeletonRow>
      ))}
    </>
  );
}

/** Placeholder cards for the phone list's first load. */
export function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCardBox key={i}>
          <SkeletonSplit>
            <Skeleton tone="muted" block width="40%" height="1rem" borderRadius="0.25rem" />
            <Skeleton tone="muted" block width="4rem" height="1rem" borderRadius="calc(var(--radius) - 2px)" />
          </SkeletonSplit>
          <SkeletonGrid>
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton tone="muted" block width="75%" height="0.75rem" borderRadius="0.25rem" key={j} />
            ))}
          </SkeletonGrid>
        </SkeletonCardBox>
      ))}
    </>
  );
}
