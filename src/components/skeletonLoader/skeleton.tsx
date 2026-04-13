import React from "react";
import type { SkeletonProps } from "./skeleton.types";
import { SkeletonBase } from "./skeleton.style";

export const Skeleton: React.FC<SkeletonProps> = ({
    width = "100%",
    height = "16px",
    borderRadius = "4px",
}) => {
    const normalize = (value: string | number) =>
        typeof value === "number" ? `${value}px` : value;

    return (
        <SkeletonBase
            $width={normalize(width)}
            $height={normalize(height)}
            $borderRadius={normalize(borderRadius)}
        />
    );
};

export default Skeleton;