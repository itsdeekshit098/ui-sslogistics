import styled from "styled-components";
import type { CSSProperties } from "react";
import { color, radius, space, zIndex } from "../../tokens/tokens";
import type { PopoverPosition } from "../../hooks/usePopoverPosition";

interface Props {
  $position: PopoverPosition;
  $matchWidth: boolean;
  $width?: number;
}

/*
 * The popup's position follows the page as it scrolls and resizes, so it is
 * passed as CSS custom properties rather than a new class per pixel value.
 */
export const Surface = styled.div.attrs<Props>((p) => ({
  style: {
    "--pop-left": `${p.$position.left}px`,
    "--pop-top": p.$position.top != null ? `${p.$position.top}px` : "auto",
    "--pop-bottom": p.$position.bottom != null ? `${p.$position.bottom}px` : "auto",
    "--pop-max-height": `${p.$position.maxHeight}px`,
    "--pop-width": p.$matchWidth ? `${p.$position.anchorWidth}px` : p.$width ? `${p.$width}px` : "auto",
  } as CSSProperties,
}))<Props>`
  @layer ui {
    position: fixed;
    left: var(--pop-left);
    top: var(--pop-top);
    bottom: var(--pop-bottom);
    width: var(--pop-width);
    max-height: var(--pop-max-height);
    z-index: ${zIndex.popover};
    overflow: auto;
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.popupBorder};
    background-color: ${color.popover};
    color: ${color.popoverForeground};
    padding: ${space[1]};
    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
    outline-style: none;
  }
`;
