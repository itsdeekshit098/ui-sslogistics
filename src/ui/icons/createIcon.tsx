import type { ReactNode } from "react";
import type { ComponentIcon, IconProps } from "./icons.types";

interface IconDefaults {
  /** The size, in px, when the caller passes none. Default 16. */
  size?: number;
}

/**
 * Builds an icon component from its drawing. Every icon is a 24×24 stroke
 * drawing in `currentColor`, so it takes its colour from the surrounding text;
 * the stroke width lives on the `<svg>` itself so a parent can restyle it from
 * CSS (e.g. to draw an active state heavier). Icons are decorative
 * (`aria-hidden`); a caller that needs a labelled icon passes its own `aria-*`.
 */
export function createIcon(
  displayName: string,
  drawing: ReactNode,
  { size: defaultSize = 16 }: IconDefaults = {},
): ComponentIcon {
  function Icon({ size = defaultSize, ...svgProps }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...svgProps}
      >
        {drawing}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}
