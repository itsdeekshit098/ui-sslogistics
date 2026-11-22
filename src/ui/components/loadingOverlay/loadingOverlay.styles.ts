import styled, { css } from "styled-components";
import { color, fontWeight, radius, shadow, space } from "../../tokens/tokens";
import { text } from "../../styles/mixins";

export const Root = styled.div`
  @layer ui {
    position: relative;
  }
`;

export const Content = styled.div<{ $busy: boolean }>`
  @layer ui {
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;

    ${(p) =>
      p.$busy &&
      css`
        pointer-events: none;
        user-select: none;
        opacity: 40%;
      `}
  }
`;

export const StatusLayer = styled.div`
  @layer ui {
    pointer-events: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: ${space[12]};
  }
`;

export const Pill = styled.span`
  @layer ui {
    position: sticky;
    top: 50%;
    display: flex;
    align-items: center;
    gap: ${space[2]};
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    background-color: ${color.card};
    padding-inline: ${space[3]};
    padding-block: ${space[1.5]};
    ${text("xs")}
    font-weight: ${fontWeight.medium};
    color: ${color.mutedForeground};
    box-shadow: ${shadow.sm};
  }
`;
