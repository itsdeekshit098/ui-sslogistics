import React from "react";
import { cn } from "@/lib/utils";
import type { SkeletonProps } from "./skeleton.types";

export const Skeleton: React.FC<SkeletonProps> = ({
    width = "100%",
    height = "16px",
    borderRadius = "4px",
    className,
}) => {
    const normalize = (value: string | number) =>
        typeof value === "number" ? `${value}px` : value;

    return (
        <span
            className={cn("inline-block animate-pulse bg-muted", className)}
            style={{
                width: normalize(width),
                height: normalize(height),
                borderRadius: normalize(borderRadius),
            }}
        />
    );
};

export default Skeleton;
