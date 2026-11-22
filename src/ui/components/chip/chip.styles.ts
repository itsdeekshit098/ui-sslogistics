import styled, { css } from "styled-components";
import { color, fontWeight, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";
import { toneColors, type Tone } from "../../styles/tone";

interface RootProps {
  $tone: Tone;
  $variant: "subtle" | "outline" | "solid";
  $size: "sm" | "md";
  $interactive: boolean;
  $selected: boolean;
}

export const Root = styled.span<RootProps>`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[1.5]};
    border-radius: 9999px;
    border-width: 1px;
    border-style: solid;
    font-weight: ${fontWeight.medium};
    ${(p) => (p.$size === "sm" ? text("xs") : text("sm"))}
    padding-inline: ${(p) => (p.$size === "sm" ? space[2] : space[3])};
    padding-block: ${(p) => (p.$size === "sm" ? space[0.5] : space[1])};
    ${colorTransition}

    ${(p) => {
      const t = toneColors[p.$tone];
      if (p.$variant === "solid" || p.$selected) {
        return css`
          border-color: ${t.solid};
          background-color: ${t.solid};
          color: ${t.onSolid};
        `;
      }
      if (p.$variant === "outline") {
        return css`
          border-color: ${p.$tone === "neutral" ? color.border : t.border};
          background-color: transparent;
          color: ${p.$tone === "neutral" ? color.foreground : t.onSubtle};
        `;
      }
      return css`
        border-color: ${t.border};
        background-color: ${t.subtle};
        color: ${t.onSubtle};
      `;
    }}

    ${(p) =>
      p.$interactive &&
      css`
        cursor: pointer;

        &:focus-visible {
          outline-style: none;
          box-shadow:
            0 0 0 2px ${color.background},
            0 0 0 4px ${color.ring};
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 50%;
        }
      `}
  }
`;

export const RemoveButton = styled.button`
  @layer ui {
    display: inline-flex;
    margin-right: calc(${space[1]} * -1);
    height: ${space[4]};
    width: ${space[4]};
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    opacity: 0.7;
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        opacity: 1;
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }
  }
`;

