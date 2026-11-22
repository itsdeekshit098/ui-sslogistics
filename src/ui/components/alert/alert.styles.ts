import styled from "styled-components";
import { color, fontWeight, radius, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";
import { toneColors, type Tone } from "../../styles/tone";

export const Root = styled.div<{ $tone: Tone }>`
  @layer ui {
    display: flex;
    align-items: flex-start;
    gap: ${space[3]};
    border-radius: ${radius.input};
    border-width: 1px;
    border-style: solid;
    border-color: ${(p) => toneColors[p.$tone].border};
    background-color: ${(p) => toneColors[p.$tone].subtle};
    color: ${(p) => toneColors[p.$tone].onSubtle};
    padding-inline: ${space[4]};
    padding-block: ${space[3]};
    ${text("sm")}
  }
`;

export const IconSlot = styled.span`
  @layer ui {
    display: inline-flex;
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

export const Body = styled.div`
  @layer ui {
    min-width: 0;
    flex: 1;
  }
`;

export const Title = styled.div`
  @layer ui {
    font-weight: ${fontWeight.semibold};
  }
`;

export const Message = styled.div`
  @layer ui {
    overflow-wrap: anywhere;
  }
`;

export const Actions = styled.div`
  @layer ui {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: ${space[2]};
  }
`;

export const Dismiss = styled.button`
  @layer ui {
    display: inline-flex;
    height: ${space[6]};
    width: ${space[6]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.xs};
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
