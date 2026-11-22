import styled, { css } from "styled-components";
import Link from "next/link";
import { color, fontWeight, leading, space, tracking } from "../../tokens/tokens";
import { media } from "../../tokens/media";
import { colorTransition, onDesktop, onPhone, onSm, text } from "../../styles/mixins";
import { Button } from "../../components/button";

/** The whole block. On phones the top bar already carries the page name, so a list page's header is hidden. */
export const Root = styled.div<{ $hideOnPhone: boolean }>`
  ${(p) =>
    p.$hideOnPhone &&
    onPhone(css`
      display: none;
    `)}
`;

export const BackLink = styled(Link)`
  @layer ui {
    display: none;
    align-items: center;
    gap: ${space[1]};
    margin-bottom: ${space[3]};
    ${text("sm")}
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        color: ${color.foreground};
      }
    }
  }

  ${onDesktop(css`
    display: inline-flex;
  `)}
`;

export const Row = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${space[3]};
  }

  ${onSm(css`
    flex-direction: row;
    align-items: center;
  `)}

  ${onDesktop(css`
    gap: ${space[4]};
  `)}
`;

export const Titles = styled.div<{ $hideOnPhone: boolean }>`
  @layer ui {
    min-width: 0;
  }

  ${(p) =>
    p.$hideOnPhone &&
    onPhone(css`
      display: none;
    `)}
`;

export const TitleRow = styled.div`
  @layer ui {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${space[2]};
  }
`;

export const Title = styled.h1`
  @layer ui {
    ${text("xl")}
    font-weight: ${fontWeight.bold};
    letter-spacing: ${tracking.tight};
    color: ${color.foreground};
  }

  ${onDesktop(css`
    ${text("3xl")}
  `)}
`;

export const Description = styled.p`
  @layer ui {
    margin-top: ${space[1]};
    ${text("sm")}
    color: ${color.mutedForeground};
  }

  ${onDesktop(css`
    ${text("base")}
  `)}
`;

/**
 * The action buttons. On a detail page at phone width they become equal-width
 * tiles with the icon over a short label, instead of buttons wrapping onto a
 * ragged second row; labels wrap inside the tile rather than clipping when four
 * share the width ("Recover Principal").
 */
export const Actions = styled.div<{ $tiles: boolean }>`
  @layer ui {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    gap: ${space[2]};
  }

  ${onSm(css`
    width: auto;
  `)}

  ${(p) =>
    p.$tiles &&
    css`
      /* Declared with a doubled class so the tiles outrank the buttons' own
         classes, as the old child-selector utilities did by specificity. */
      @layer utilities {
        ${media.narrow} {
          && {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: minmax(0, 1fr);
          }

          && > button {
            height: auto;
            flex-direction: column;
            gap: ${space[1]};
            padding-inline: ${space[1]};
            padding-block: ${space[2.5]};
            min-width: 0;
            white-space: normal;
            text-align: center;
            ${text("xs")}
            line-height: ${leading.tight};
          }

          && > button svg {
            margin-right: 0 !important;
          }
        }
      }
    `}
`;

export const PrimaryButton = styled(Button)`
  ${onPhone(css`
    display: none;
  `)}
`;

export const PrimaryIcon = styled.span`
  @layer ui {
    margin-right: ${space[2]};
    display: inline-flex;
  }
`;

/** Wraps a disabled primary button so a tooltip can explain why. */
export const DisabledWrap = styled.span`
  @layer ui {
    display: inline-block;
    cursor: not-allowed;
  }

  ${onPhone(css`
    display: none;
  `)}
`;

export const DisabledInner = styled.span`
  @layer ui {
    pointer-events: none;
    display: inline-flex;
  }
`;
