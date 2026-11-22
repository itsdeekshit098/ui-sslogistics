import styled, { css } from "styled-components";
import {
  color,
  fontWeight,
  leading,
  mix,
  motion,
  radius,
  shadow,
  space,
  tracking,
} from "../../tokens/tokens";
import { onPhone, onSm, setLeading, text } from "../../styles/mixins";
import { media } from "../../tokens/media";
import type { StatCardTone } from "./statCard.types";

interface Tone {
  chipBackground: string;
  chipColor: string;
  border: string;
  value: string;
  /** The headline value on phones, where the summary strip colours it. */
  phoneValue?: string;
}

const NEUTRAL: Tone = {
  chipBackground: color.muted,
  chipColor: color.mutedForeground,
  border: color.border,
  value: color.foreground,
  phoneValue: color.primary,
};

const TONES: Record<StatCardTone, Tone> = {
  neutral: NEUTRAL,
  positive: {
    chipBackground: color.successSubtle,
    chipColor: color.successSubtleForeground,
    border: color.border,
    value: color.foreground,
    phoneValue: color.success,
  },
  warning: {
    chipBackground: color.warningSubtle,
    chipColor: color.warningSubtleForeground,
    border: mix(color.warning, 40),
    value: color.foreground,
    phoneValue: color.warningSubtleForeground,
  },
  // The only tone that colours the headline value itself — restraint means
  // colour is spent on the one thing that's actually urgent.
  critical: {
    chipBackground: color.destructiveSubtle,
    chipColor: color.destructiveSubtleForeground,
    border: mix(color.destructive, 40),
    value: color.destructive,
  },
};

export const toneFor = (tone: StatCardTone | undefined): Tone => (tone ? TONES[tone] : NEUTRAL);

interface RootProps {
  $tone: Tone;
  $interactive: boolean;
  /** Legacy `highlightColor`: a left stripe on sm+ for callers not yet on `tone`. */
  $accent?: string;
}

export const Root = styled.div<RootProps>`
  @layer ui {
    /* The card's resting shadow, kept in a variable so the focus ring can sit beside it. */
    --stat-shadow: ${shadow.card};
    position: relative;
    display: flex;
    /* min-width:0 lets this shrink below its content's natural width — flex
       items default to min-width:auto, which is what let a long, unbroken
       number push past the card's border instead of wrapping. */
    min-width: 0;
    flex-direction: column;
    gap: ${space[2]};
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    border-color: ${(p) => p.$tone.border};
    background-color: ${color.card};
    padding: ${space[3.5]};
    box-shadow: var(--stat-shadow);
    transition-property: transform, box-shadow, border-color;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};

    ${(p) =>
      p.$interactive &&
      css`
        cursor: pointer;

        @media (hover: hover) {
          &:hover {
            translate: 0 -0.125rem;
            box-shadow: ${shadow.md};
          }
        }

        &:focus-visible {
          outline-style: none;
          box-shadow:
            0 0 0 2px ${color.card},
            0 0 0 4px ${color.ring},
            var(--stat-shadow);
        }
      `}
  }

  ${onSm(css<RootProps>`
    gap: ${space[3]};
    padding: ${space[5]};
    ${(p) =>
      p.$accent &&
      css`
        border-left-style: solid;
        border-left-width: 3px;
        border-left-color: ${p.$accent};
      `}
  `)}

  /* Phones: the Flutter app's summary-strip tile — value over a small label,
     no icon (globals.css lays the cards out in one row). */
  ${onPhone(css`
    --stat-shadow: 0 0 #0000;
    align-items: center;
    gap: ${space[0.5]};
    border-radius: ${radius.phoneControl};
    padding-inline: ${space[2]};
    padding-block: ${space[2.5]};
    text-align: center;
  `)}
`;

export const Heading = styled.div`
  @layer ui {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: ${space[2]};
  }

  ${onSm(css`
    gap: ${space[2.5]};
  `)}

  ${onPhone(css`
    order: 2;
    max-width: 100%;
  `)}
`;

export const Chip = styled.span<{ $tone: Tone; $background?: string; $color?: string }>`
  @layer ui {
    display: inline-flex;
    height: ${space[7]};
    width: ${space[7]};
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    background-color: ${(p) => p.$background ?? p.$tone.chipBackground};
    color: ${(p) => p.$color ?? p.$tone.chipColor};

    ${media.narrow} {
      & svg {
        height: ${space[4]};
        width: ${space[4]};
      }
    }
  }

  ${onSm(css`
    height: ${space[8]};
    width: ${space[8]};
  `)}

  /* No icon on the phone tile. */
  ${onPhone(css`
    display: none;
  `)}
`;

const clamp2 = css`
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
`;

export const Title = styled.span`
  @layer ui {
    ${clamp2}
    min-width: 0;
    font-size: 0.6875rem;
    font-weight: ${fontWeight.semibold};
    text-transform: uppercase;
    ${setLeading(leading.tight)}
    letter-spacing: ${tracking.wide};
    color: ${color.mutedForeground};
  }

  ${onSm(css`
    letter-spacing: ${tracking.wider};
  `)}

  ${onPhone(css`
    ${clamp2}
    font-size: 10.5px;
    ${setLeading(leading.tight)}
    font-weight: ${fontWeight.normal};
    text-transform: none;
    letter-spacing: ${tracking.normal};
  `)}
`;

export const Value = styled.span<{ $tone: Tone }>`
  @layer ui {
    overflow-wrap: break-word;
    ${text("lg")}
    font-weight: ${fontWeight.bold};
    ${setLeading(leading.tight)}
    letter-spacing: ${tracking.tight};
    font-variant-numeric: tabular-nums;
    color: ${(p) => p.$tone.value};
  }

  ${onSm(css`
    font-size: 1.625rem;
  `)}

  ${onPhone(css<{ $tone: Tone }>`
    order: 1;
    white-space: nowrap;
    ${text("sm")}
    font-weight: ${fontWeight.extrabold};
    ${(p) => (p.$tone.phoneValue ? `color: ${p.$tone.phoneValue};` : "")}
  `)}
`;

export const Subtext = styled.span`
  @layer ui {
    ${text("xs")}
    color: ${color.mutedForeground};
  }

  ${onPhone(css`
    order: 3;
    font-size: 10px;
    ${setLeading(leading.tight)}
  `)}
`;

