import React from "react";
import { cn } from "@/lib/utils";
import type { SkeletonProps } from "./skeleton.types";

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  className,
}) => {
  const normalize = (value: string | number) =>
    typeof value === "number" ? `${value}px` : value;

  return (
    <span
      className={cn(
        "inline-block animate-pulse rounded-md bg-slate-300/60 dark:bg-white/10",
        className,
      )}
      style={{
        width: normalize(width),
        height: normalize(height),
        borderRadius: normalize(borderRadius),
      }}
    />
  );
};

export default Skeleton;
