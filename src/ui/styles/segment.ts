import { css } from "styled-components";
import { color, fontWeight, palette, radius, shadow, space } from "../tokens/tokens";
import { colorTransition, onHover, onPhone, text } from "./mixins";

/*
 * The "pick one" look shared by Tabs and SegmentedControl: a grey track with a
 * raised card for the active segment. On phones the track disappears and each
 * segment becomes a selectable chip (the Flutter app's filter chips).
 */

export const segmentTrack = css`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[1]};
    border-radius: ${radius.base};
    background-color: ${color.muted};
    padding: ${space[1]};
  }

  ${onPhone(css`
    gap: ${space[2]};
    border-radius: 0;
    background-color: transparent;
    padding: 0;
  `)}
`;

export const segment = css<{ $active: boolean }>`
  @layer ui {
    border-radius: ${radius.xs};
    padding-inline: ${space[3]};
    padding-block: ${space[1.5]};
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    ${colorTransition}

    &:focus-visible {
      outline-style: none;
      box-shadow:
        0 0 0 2px ${color.muted},
        0 0 0 4px ${color.ring};
    }

    ${(p) =>
      p.$active
        ? css`
            background-color: ${color.card};
            color: ${color.foreground};
            box-shadow: ${shadow.xs};
          `
        : css`
            color: ${color.mutedForeground};
            ${onHover(css`
              color: ${color.foreground};
            `)}
          `}
  }

  ${onPhone(css<{ $active: boolean }>`
    border-radius: 10px;
    border-width: 1px;
    border-style: solid;
    padding-inline: 0.875rem;
    padding-block: 9px;

    ${(p) =>
      p.$active
        ? css`
            border-color: ${color.primary};
            background-color: ${color.primary};
            font-weight: ${fontWeight.bold};
            color: ${palette.white};
            box-shadow: none;
          `
        : css`
            border-color: ${color.border};
            font-weight: ${fontWeight.semibold};
          `}
  `)}
`;
