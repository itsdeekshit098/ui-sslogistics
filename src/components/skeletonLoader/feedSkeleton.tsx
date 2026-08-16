import React from "react";
import { Skeleton } from "./skeleton";

interface FeedSkeletonProps {
  count?: number;
  className?: string;
}

const WIDTHS = ["70%", "55%", "80%", "60%"];

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({
  count = 8,
  className,
}) => {
  return (
    <div className={className ?? "space-y-1"}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton width="40px" height="40px" borderRadius="12px" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton width={WIDTHS[i % WIDTHS.length]} height="16px" />
            <Skeleton width={WIDTHS[i % WIDTHS.length]} height="16px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default FeedSkeleton;
