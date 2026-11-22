"use client";

import { Skeleton } from "../../components/skeleton";
import { Feed, FeedLines, FeedRow } from "./feedSkeleton.styles";
import type { FeedSkeletonProps } from "./feedSkeleton.types";

const WIDTHS = ["70%", "55%", "80%", "60%"];

export function FeedSkeleton({ count = 8, className }: FeedSkeletonProps) {
  return (
    <Feed data-ui="feed-skeleton" $default={className === undefined} className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <FeedRow key={i}>
          <Skeleton width="40px" height="40px" borderRadius="12px" />
          <FeedLines>
            <Skeleton width={WIDTHS[i % WIDTHS.length]} height="16px" />
            <Skeleton width={WIDTHS[i % WIDTHS.length]} height="16px" />
          </FeedLines>
        </FeedRow>
      ))}
    </Feed>
  );
}
