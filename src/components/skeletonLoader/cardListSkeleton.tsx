import React from "react";
import { Skeleton } from "./skeleton";

interface CardListSkeletonProps {
  count?: number;
  lines?: number;
  className?: string;
}

export const CardListSkeleton: React.FC<CardListSkeletonProps> = ({
  count = 4,
  lines = 2,
  className,
}) => {
  return (
    <div className={className ?? "space-y-4"}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-2">
              <Skeleton width="140px" height="18px" />
              <Skeleton width="100px" height="14px" />
            </div>
            <Skeleton width="60px" height="20px" borderRadius="9999px" />
          </div>
          <div className="space-y-2 mb-3">
            {Array.from({ length: lines }).map((_, j) => (
              <Skeleton
                key={j}
                width={j % 2 === 0 ? "80%" : "55%"}
                height="14px"
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Skeleton width="70px" height="32px" borderRadius="6px" />
            <Skeleton width="70px" height="32px" borderRadius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardListSkeleton;
