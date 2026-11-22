import styled, { css } from "styled-components";
import { color, fontWeight, mix, radius, space } from "../../tokens/tokens";
import { colorTransition, focusRing, onHover, onPhone, text } from "../../styles/mixins";
import type { BadgeVariant } from "./badge.types";

interface StyleProps {
  $variant: BadgeVariant;
}

const solid = (background: string, foreground: string, hoverOpacity: number) => css`
  border-color: transparent;
  background-color: ${background};
  color: ${foreground};
  ${onHover(css`
    background-color: ${mix(background, hoverOpacity)};
  `)}
`;

const subtle = (tone: string, background: string, foreground: string, borderOpacity: number) => css`
  border-color: ${mix(tone, borderOpacity)};
  background-color: ${background};
  color: ${foreground};
`;

const variants: Record<BadgeVariant, ReturnType<typeof css>> = {
  default: solid(color.primary, color.primaryForeground, 80),
  secondary: solid(color.secondary, color.secondaryForeground, 80),
  destructive: solid(color.destructive, color.destructiveForeground, 80),
  success: solid(color.success, color.successForeground, 80),
  warning: solid(color.warning, color.warningForeground, 80),
  info: solid(color.info, color.infoForeground, 80),
  outline: css`
    color: ${color.foreground};
  `,
  "success-subtle": subtle(color.success, color.successSubtle, color.successSubtleForeground, 20),
  "warning-subtle": subtle(color.warning, color.warningSubtle, color.warningSubtleForeground, 25),
  "destructive-subtle": subtle(
    color.destructive,
    color.destructiveSubtle,
    color.destructiveSubtleForeground,
    20,
  ),
  "info-subtle": subtle(color.info, color.infoSubtle, color.infoSubtleForeground, 20),
};

export const StyledBadge = styled.div<StyleProps>`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[1.5]};
    border-radius: ${radius.badge};
    border-width: 1px;
    border-style: solid;
    padding-inline: ${space[2.5]};
    padding-block: ${space[0.5]};
    ${text("xs")}
    font-weight: ${fontWeight.semibold};
    ${colorTransition}

    &:focus {
      ${focusRing}
    }

    ${(p) => variants[p.$variant]}

  }

  /* On phones a badge is a pill, like the Flutter app's chips. */
  ${onPhone(css`
    border-radius: 9999px;
    padding-inline: 9px;
    padding-block: ${space[1]};
    font-size: 11px;
  `)}
`;

export const Dot = styled.span`
  @layer ui {
    flex-shrink: 0;
    width: ${space[1.5]};
    height: ${space[1.5]};
    border-radius: 9999px;
    background-color: currentColor;
  }
`;
