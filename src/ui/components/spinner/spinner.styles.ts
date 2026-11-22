import styled, { css } from "styled-components";
import { animation, bounceDot, spin } from "../../tokens/keyframes";
import { color, fontSize, fontWeight, space } from "../../tokens/tokens";
import { locked } from "../../styles/mixins";
import type { SpinnerSize } from "./spinner.types";

// Dot and arc sizes in px. These are exact artwork sizes, not spacing steps.
const DOT_SIZE: Record<SpinnerSize, number> = { xs: 4, sm: 6, md: 8, lg: 10, xl: 12 };
const DOT_GAP: Record<SpinnerSize, number> = { xs: 4, sm: 4, md: 6, lg: 8, xl: 8 };
const ARC_SIZE: Record<SpinnerSize, number> = { xs: 12, sm: 16, md: 24, lg: 32, xl: 48 };

/*
 * Everything here is `locked`: it used to be inline style, which a caller's
 * class could never override (many callers pass `h-4 w-4` meaning "inline
 * spinner", and the size preset always won). Keep that.
 */

export const Arc = styled.svg<{ $size: SpinnerSize }>`
  ${(p) => locked(css`
    width: ${ARC_SIZE[p.$size]}px;
    height: ${ARC_SIZE[p.$size]}px;
    flex-shrink: 0;
    animation: ${spin} ${animation.spin};
  `)}
`;

export const Centered = styled.div`
  ${locked(css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${space[8]} 0;
  `)}
`;

export const DotRow = styled.div<{ $size: SpinnerSize }>`
  ${(p) => locked(css`
    display: flex;
    align-items: center;
    gap: ${DOT_GAP[p.$size]}px;
  `)}
`;

export const Dot = styled.span<{ $size: SpinnerSize }>`
  ${(p) => locked(css`
    width: ${DOT_SIZE[p.$size]}px;
    height: ${DOT_SIZE[p.$size]}px;
    border-radius: 50%;
    background-color: ${color.primary};
    opacity: 0.6;
    animation: ${bounceDot} ${animation.bounceDot};

    &:nth-child(2) {
      animation-delay: 0.16s;
    }
    &:nth-child(3) {
      animation-delay: 0.32s;
    }
  `)}
`;

export const Label = styled.span`
  ${locked(css`
    margin-top: ${space[3]};
    font-size: ${fontSize.xs};
    font-weight: ${fontWeight.medium};
    letter-spacing: 0.025em;
    color: ${color.mutedForeground};
  `)}
`;
