import type { CSSProperties } from "react";

export interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Replaces LucideIcon — any functional component that accepts IconProps */
export type ComponentIcon = React.FC<IconProps>;
