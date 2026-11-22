import styled, { css } from "styled-components";
import { color, fontWeight, radius, space } from "../../tokens/tokens";
import { colorTransition, onPhone, text } from "../../styles/mixins";

export const List = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    min-width: 12rem;
    padding-block: ${space[0.5]};
  }
`;

export const Item = styled.button<{ $danger: boolean }>`
  @layer ui {
    display: flex;
    width: 100%;
    min-height: ${space[9]};
    align-items: center;
    gap: ${space[3]};
    border-radius: ${radius.xs};
    padding-inline: ${space[3]};
    padding-block: ${space[2]};
    text-align: left;
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    color: ${(p) => (p.$danger ? color.destructive : color.foreground)};
    ${colorTransition}

    &:focus,
    &:focus-visible {
      outline-style: none;
      background-color: ${color.secondary};
    }

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background-color: ${color.secondary};
      }
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 50%;
    }
  }

  /* In the phone sheet the rows are thumb-sized. */
  ${onPhone(css`
    min-height: ${space[12]};
    border-radius: ${radius.base};
    font-size: 15px;
  `)}
`;

export const IconSlot = styled.span`
  @layer ui {
    display: inline-flex;
    height: ${space[5]};
    width: ${space[5]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }
`;

export const Label = styled.span`
  @layer ui {
    min-width: 0;
    flex: 1;
  }
`;

export const Reason = styled.span`
  @layer ui {
    display: block;
    ${text("xs")}
    font-weight: ${fontWeight.normal};
    color: ${color.mutedForeground};
  }
`;

export const Divider = styled.div`
  @layer ui {
    margin-block: ${space[1]};
    height: 1px;
    background-color: ${color.border};
  }
`;
