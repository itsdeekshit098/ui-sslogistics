"use client";

import { StyledSkeleton } from "./skeleton.styles";
import { toCssLength } from "../../utils/cssLength";
import type { SkeletonProps } from "./skeleton.types";

export function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  tone = "default",
  block = false,
  center = false,
  className,
}: SkeletonProps) {
  return (
    <StyledSkeleton
      data-ui="skeleton"
      $width={toCssLength(width)}
      $height={toCssLength(height)}
      $radius={toCssLength(borderRadius)}
      $tone={tone}
      $block={block}
      $center={center}
      className={className}
    />
  );
}
