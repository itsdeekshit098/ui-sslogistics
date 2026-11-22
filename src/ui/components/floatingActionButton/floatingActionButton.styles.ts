import styled, { css } from "styled-components";
import { enterFrom } from "../../tokens/keyframes";
import { color, motion, palette, radius, shadow, space } from "../../tokens/tokens";
import { onDesktop, playOnce, text } from "../../styles/mixins";

/** Fixed to the bottom-right corner, above the page. Phone widths only. */
export const Corner = styled.div`
  @layer ui {
    position: fixed;
    right: ${space[4]};
    bottom: calc(var(--mobile-bottom-clearance, 0px) + 1rem);
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: ${space[2]};
  }

  ${onDesktop(css`
    display: none;
  `)}
`;

const appear = enterFrom({ opacity: 0, y: "0.5rem" });

/** The "why is this disabled" bubble that appears on tap. */
export const Reason = styled.div`
  @layer ui {
    max-width: 16rem;
    border-radius: ${radius.base};
    background-color: ${color.foreground};
    padding-inline: ${space[3]};
    padding-block: ${space[2]};
    ${text("xs")}
    color: ${color.background};
    box-shadow: ${shadow.lg};
    ${playOnce(appear)}
  }
`;

const DEFAULT_SHADOW = "0 6px 16px -4px rgba(37, 99, 235, 0.5), 0 2px 4px rgba(0, 0, 0, 0.12)";

export const Fab = styled.button<{ $accent?: string; $disabled: boolean }>`
  @layer ui {
    display: flex;
    height: ${space[14]};
    width: ${space[14]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.phoneCard};
    background-color: ${color.primary};
    color: ${palette.white};
    box-shadow: ${DEFAULT_SHADOW};
    transition-property: transform, translate, scale, rotate;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};

    &:active {
      scale: 95% 95%;
    }

    ${(p) =>
      p.$accent &&
      !p.$disabled &&
      css`
        background: ${p.$accent};
        box-shadow:
          0 6px 16px -4px color-mix(in srgb, ${p.$accent} 50%, transparent),
          0 2px 4px rgba(0, 0, 0, 0.12);
      `}

    ${(p) =>
      p.$disabled &&
      css`
        opacity: 60%;
        box-shadow: none;
      `}
  }
`;
