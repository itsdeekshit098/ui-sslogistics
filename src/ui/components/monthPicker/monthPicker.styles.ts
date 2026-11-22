import styled, { css } from "styled-components";
import { color, fontWeight, palette, radius, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";

export const Panel = styled.div`
  @layer ui {
    width: 17.5rem;
    padding: ${space[2]};
  }
`;

export const MonthGrid = styled.div`
  @layer ui {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${space[1]};
  }
`;

export const MonthButton = styled.button<{ $selected: boolean; $current: boolean }>`
  @layer ui {
    height: ${space[10]};
    border-radius: ${radius.xs};
    ${text("sm")}
    color: ${color.foreground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background-color: ${color.accent};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }

    ${(p) =>
      p.$current &&
      css`
        font-weight: ${fontWeight.bold};
        box-shadow: inset 0 0 0 1px ${color.border};
      `}

    ${(p) =>
      p.$selected &&
      css`
        background-color: ${color.primary};
        color: ${palette.white};
        font-weight: ${fontWeight.semibold};

        @media (hover: hover) {
          &:hover:not(:disabled) {
            background-color: ${color.primary};
          }
        }
      `}

    &:disabled {
      opacity: 30%;
      cursor: not-allowed;
    }
  }
`;
