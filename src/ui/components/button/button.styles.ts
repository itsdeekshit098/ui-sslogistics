import styled, { css } from "styled-components";
import { color, control, fontWeight, mix, radius, space } from "../../tokens/tokens";
import { colorTransition, focusRing, onHover, text } from "../../styles/mixins";
import { Slot } from "../slot";
import type { ButtonSize, ButtonVariant } from "./button.types";

interface StyleProps {
  $variant: ButtonVariant;
  $size: ButtonSize;
}

const sizes: Record<ButtonSize, ReturnType<typeof css>> = {
  default: css`
    height: ${control.height};
    padding-inline: ${space[4]};
    padding-block: ${space[2]};
  `,
  sm: css`
    height: ${control.heightSm};
    padding-inline: ${space[3]};
  `,
  lg: css`
    height: ${control.heightLg};
    padding-inline: ${space[8]};
  `,
  icon: css`
    height: ${control.height};
    width: ${control.height};
  `,
};

const variants: Record<ButtonVariant, ReturnType<typeof css>> = {
  default: css`
    background-color: ${color.primary};
    color: ${color.primaryForeground};
    ${onHover(css`
      background-color: ${mix(color.primary, 90)};
    `)}
  `,
  destructive: css`
    background-color: ${color.destructive};
    color: ${color.destructiveForeground};
    ${onHover(css`
      background-color: ${mix(color.destructive, 90)};
    `)}
  `,
  outline: css`
    border-width: 1px;
    border-style: solid;
    border-color: ${color.input};
    background-color: ${color.background};
    ${onHover(css`
      background-color: ${color.accent};
      color: ${color.accentForeground};
    `)}
  `,
  secondary: css`
    background-color: ${color.secondary};
    color: ${color.secondaryForeground};
    ${onHover(css`
      background-color: ${mix(color.secondary, 80)};
    `)}
  `,
  ghost: css`
    ${onHover(css`
      background-color: ${color.accent};
      color: ${color.accentForeground};
    `)}
  `,
  link: css`
    color: ${color.primary};
    text-underline-offset: 4px;
    ${onHover(css`
      text-decoration-line: underline;
    `)}
  `,
};

const buttonStyles = css<StyleProps>`
  @layer ui {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    border-radius: ${radius.input};
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    ${colorTransition}
    cursor: pointer;

    &:focus-visible {
      ${focusRing}
    }

    &:disabled {
      opacity: 50%;
      cursor: not-allowed;
    }

    ${(p) => sizes[p.$size]}
    ${(p) => variants[p.$variant]}
  }
`;

export const StyledButton = styled.button<StyleProps>`
  ${buttonStyles}
`;

/** The same look on whatever element `asChild` hands us (a link, usually). */
export const StyledSlot = styled(Slot)<StyleProps>`
  ${buttonStyles}
`;
