import styled, { css } from "styled-components";
import { animation, spin } from "../../tokens/keyframes";
import { color, fontWeight, mix, radius, space } from "../../tokens/tokens";
import { colorTransition, onSm, text } from "../../styles/mixins";
import { Button } from "../button";
import { LoaderIcon } from "../../icons";
import { SelectTrigger } from "../select";

// Tailwind's slate-400, the ellipsis grey. Same in light and dark.
const ELLIPSIS = "oklch(70.4% 0.04 256.788)";

const SHADOW = "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)";

// ─── Phone footer ("Load more") ──────────────────────────────────────────────

export const MoreRoot = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${space[3]};
    padding-top: ${space[4]};
    font-size: 13px;
    color: ${color.mutedForeground};
  }
`;

export const Sentinel = styled.div`
  @layer ui {
    display: flex;
    height: ${space[10]};
    align-items: center;
    gap: ${space[2]};
  }
`;

export const MoreButton = styled(Button)`
  @layer ui {
    height: ${space[12]};
    width: 100%;
    border-radius: ${radius.phoneControl};
    background-color: ${color.card};
    ${text("sm")}
    font-weight: ${fontWeight.semibold};
  }
`;

export const SpinningLoader = styled(LoaderIcon)<{ $gap?: boolean }>`
  @layer ui {
    animation: ${spin} ${animation.spin};
    ${(p) => p.$gap && `margin-right: ${space[2]};`}
  }
`;

export const CapNote = styled.span`
  @layer ui {
    text-align: center;
  }
`;

// ─── Numbered pagination (desktop and tablet) ────────────────────────────────

export const NumberedRoot = styled.div`
  @layer ui {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${space[4]};
    padding-block: ${space[4]};
    ${text("sm")}
    color: ${color.mutedForeground};
  }

  ${onSm(css`
    flex-direction: row;
    justify-content: space-between;
  `)}
`;

export const Summary = styled.div`
  @layer ui {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: ${space[4]};
  }

  ${onSm(css`
    width: auto;
    justify-content: flex-start;
  `)}
`;

export const SizeTrigger = styled(SelectTrigger)`
  @layer ui {
    width: 4.5rem;
  }
`;

export const Controls = styled.div`
  @layer ui {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: ${space[1]};
  }

  ${onSm(css`
    width: auto;
  `)}
`;

/** Previous / next: a tinted square, 40px on phones and 32px from sm up. */
export const Arrow = styled(Button)`
  @layer ui {
    display: flex;
    height: ${space[10]};
    width: ${space[10]};
    padding: 0;
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    background-color: ${mix(color.primary, 10)};
    color: ${color.primary};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${mix(color.primary, 20)};
      }
    }

    &:disabled {
      opacity: 50%;
    }

    @media (hover: hover) {
      &:disabled:hover {
        background-color: ${mix(color.primary, 10)};
      }
    }
  }

  ${onSm(css`
    height: ${space[8]};
    width: ${space[8]};
  `)}
`;

/** "Page 3 of 12" between the arrows on phones, in place of the row of numbers. */
export const PhonePosition = styled.span`
  @layer ui {
    min-width: 7.5rem;
    text-align: center;
    font-weight: ${fontWeight.medium};
    color: ${color.foreground};
  }

  ${onSm(css`
    display: none;
  `)}
`;

export const Ellipsis = styled.span`
  @layer ui {
    display: none;
    padding-inline: ${space[2]};
    color: ${ELLIPSIS};
    cursor: pointer;
  }

  ${onSm(css`
    display: inline;
  `)}
`;

export const PageButton = styled(Button)<{ $active: boolean }>`
  @layer ui {
    display: none;
    height: ${space[8]};
    min-width: 32px;
    padding: 0;
    padding-inline: ${space[2]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    ${colorTransition}
    ${text("sm")}
    cursor: pointer;

    ${(p) =>
      p.$active
        ? css`
            background-color: ${color.primary};
            color: ${color.primaryForeground};
            font-weight: ${fontWeight.medium};
            box-shadow: ${SHADOW};

            @media (hover: hover) {
              &:hover {
                background-color: ${mix(color.primary, 90)};
              }
            }
          `
        : css`
            color: ${color.mutedForeground};

            @media (hover: hover) {
              &:hover {
                background-color: ${color.muted};
                color: ${color.foreground};
              }
            }
          `}
  }

  ${onSm(css`
    display: flex;
  `)}
`;
