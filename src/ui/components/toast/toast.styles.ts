import styled, { css } from "styled-components";
import { enterFrom } from "../../tokens/keyframes";
import { color, fontWeight, radius, shadow, space, zIndex } from "../../tokens/tokens";
import { colorTransition, onDesktop, playOnce, text } from "../../styles/mixins";
import { toneColors, type Tone } from "../../styles/tone";

const slideUp = enterFrom({ opacity: 0, y: "0.5rem" });

/** Fixed to the bottom of the screen, above modals so a message from a dialog stays visible. */
export const Viewport = styled.div`
  @layer ui {
    pointer-events: none;
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: calc(${zIndex.modalNestedOverlay} + 1);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: ${space[2]};
    padding: ${space[4]};
    padding-bottom: calc(${space[4]} + env(safe-area-inset-bottom));
  }

  /* On larger screens the stack sits in the bottom-right corner. */
  ${onDesktop(css`
    left: auto;
    width: 24rem;
    align-items: stretch;
  `)}
`;

export const Item = styled.div<{ $tone: Tone }>`
  @layer ui {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: ${space[3]};
    border-radius: ${radius.input};
    border-width: 1px;
    border-style: solid;
    border-color: ${(p) => toneColors[p.$tone].border};
    background-color: ${color.popover};
    color: ${color.popoverForeground};
    padding: ${space[3]} ${space[4]};
    box-shadow: ${shadow.lg};
    ${text("sm")}
    ${playOnce(slideUp)}

    /* A coloured edge carries the meaning at a glance. */
    border-left-width: 4px;
    border-left-color: ${(p) => toneColors[p.$tone].accent};
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

export const Description = styled.div`
  @layer ui {
    color: ${color.mutedForeground};
    overflow-wrap: anywhere;
  }
`;

export const ActionButton = styled.button`
  @layer ui {
    flex-shrink: 0;
    border-radius: ${radius.xs};
    padding-inline: ${space[2]};
    padding-block: ${space[1]};
    font-weight: ${fontWeight.semibold};
    color: ${color.primary};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${color.accent};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }
  }
`;

export const Close = styled.button`
  @layer ui {
    display: inline-flex;
    height: ${space[6]};
    width: ${space[6]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.xs};
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        color: ${color.foreground};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }
  }
`;
