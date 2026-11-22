import styled, { css } from "styled-components";
import { color, mix, palette, space } from "../../tokens/tokens";
import { onPhone, text } from "../../styles/mixins";
import { segment, segmentTrack } from "../../styles/segment";

export const Track = styled.div`
  ${segmentTrack}
`;

export const Segment = styled.button<{ $active: boolean }>`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[1.5]};

    &:disabled {
      cursor: not-allowed;
      opacity: 60%;
    }

    /* Hover only brightens an enabled segment. */
    ${(p) =>
      !p.$active &&
      css`
        @media (hover: hover) {
          &:hover:disabled {
            color: ${color.mutedForeground};
          }
        }
      `}
  }

  ${segment}
`;

export const Count = styled.span<{ $active: boolean }>`
  @layer ui {
    ${text("xs")}
    font-variant-numeric: tabular-nums;
    color: ${(p) => (p.$active ? color.mutedForeground : mix(color.mutedForeground, 70))};
  }

  ${(p) =>
    p.$active &&
    onPhone(css`
      color: ${mix(palette.white, 80)};
    `)}
`;
