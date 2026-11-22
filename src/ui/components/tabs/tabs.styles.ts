import styled, { css } from "styled-components";
import { color, fontWeight, mix, palette, radius, space } from "../../tokens/tokens";
import { onPhone, text } from "../../styles/mixins";
import { segment, segmentTrack } from "../../styles/segment";

const FADE = "24px";

/** Fades whichever edge of the strip still has tabs scrolled out of view. */
const edgeFade = ({ $fadeLeft, $fadeRight }: { $fadeLeft: boolean; $fadeRight: boolean }) =>
  ($fadeLeft || $fadeRight) &&
  css`
    mask-image: linear-gradient(
      to right,
      ${$fadeLeft ? "transparent" : "#000"},
      #000 ${FADE},
      #000 calc(100% - ${FADE}),
      ${$fadeRight ? "transparent" : "#000"}
    );
  `;

export const Track = styled.div<{ $fadeLeft: boolean; $fadeRight: boolean }>`
  @layer ui {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    ${edgeFade}
  }

  ${segmentTrack}
`;

export const Tab = styled.button<{ $active: boolean; $disabled: boolean }>`
  @layer ui {
    position: relative;
    display: flex;
    /* Keeps short labels ("All") an easy target on phones. */
    min-width: ${space[11]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: ${space[2]};
    white-space: nowrap;

    ${(p) =>
      p.$disabled &&
      css`
        cursor: not-allowed;
        opacity: 50%;

        @media (hover: hover) {
          &:hover {
            color: ${color.mutedForeground};
          }
        }
      `}
  }

  ${segment}
`;

export const Badge = styled.span<{ $active: boolean }>`
  @layer ui {
    border-radius: ${radius.sm};
    padding-inline: ${space[1.5]};
    padding-block: ${space[0.5]};
    ${text("xs")}
    font-weight: ${fontWeight.normal};
    color: ${color.mutedForeground};
    background-color: ${(p) => (p.$active ? color.muted : mix(color.card, 60))};
  }

  ${(p) =>
    onPhone(css`
      ${p.$active
        ? css`
            background-color: ${mix(palette.white, 20)};
            color: ${palette.white};
          `
        : css`
            background-color: ${color.muted};
          `}
    `)}
`;
