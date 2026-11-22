import styled, { css } from "styled-components";
import type { CSSProperties } from "react";
import { color, fontSize, fontWeight, zIndex } from "../../tokens/tokens";

type Side = "top" | "bottom" | "left" | "right";

export const Trigger = styled.div`
  @layer ui {
    position: relative;
    display: inline-flex;
    max-width: 100%;
  }
`;

interface BubbleProps {
  $top: number;
  $left: number;
  $beakX: number;
  $beakY: number;
  $positioned: boolean;
}

/*
 * The bubble's position changes on every scroll and resize, so it is passed as
 * CSS custom properties (the one place the library sets an inline style)
 * rather than as a new class for every pixel value.
 */
export const Bubble = styled.div.attrs<BubbleProps>((p) => ({
  style: {
    "--tip-top": `${p.$top}px`,
    "--tip-left": `${p.$left}px`,
    "--beak-x": `${p.$beakX}px`,
    "--beak-y": `${p.$beakY}px`,
  } as CSSProperties,
}))<BubbleProps>`
  @layer ui {
    position: fixed;
    z-index: ${zIndex.popover};
    top: var(--tip-top);
    left: var(--tip-left);
    background-color: ${color.foreground};
    color: ${color.background};
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: ${fontSize.xs};
    font-weight: ${fontWeight.medium};
    max-width: 250px;
    white-space: normal;
    word-wrap: break-word;
    pointer-events: none;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    transition:
      opacity 0.2s ease-in-out,
      transform 0.2s ease-in-out;
    opacity: ${(p) => (p.$positioned ? 1 : 0)};
    visibility: ${(p) => (p.$positioned ? "visible" : "hidden")};
    transform: translateY(${(p) => (p.$positioned ? "0" : "4px")});
  }
`;

/** The small rotated square pointing at the trigger. */
export const Beak = styled.div<{ $side: Side }>`
  @layer ui {
    position: absolute;
    width: 8px;
    height: 8px;
    background-color: ${color.foreground};
    transform: rotate(45deg);
    pointer-events: none;

    ${(p) => {
      switch (p.$side) {
        case "top":
          return css`
            bottom: -4px;
            left: calc(50% + var(--beak-x));
            margin-left: -4px;
          `;
        case "bottom":
          return css`
            top: -4px;
            left: calc(50% + var(--beak-x));
            margin-left: -4px;
          `;
        case "left":
          return css`
            right: -4px;
            top: calc(50% + var(--beak-y));
            margin-top: -4px;
          `;
        case "right":
          return css`
            left: -4px;
            top: calc(50% + var(--beak-y));
            margin-top: -4px;
          `;
      }
    }}
  }
`;
