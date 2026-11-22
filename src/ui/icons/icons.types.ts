import type { FC, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height" | "ref"> {
  /** Width and height in px. */
  size?: number;
}

/** Any component that draws an icon from `IconProps`. */
export type ComponentIcon = FC<IconProps>;
