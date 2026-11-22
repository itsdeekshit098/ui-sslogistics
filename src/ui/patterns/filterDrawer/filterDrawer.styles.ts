import styled, { css } from "styled-components";
import { enterFrom } from "../../tokens/keyframes";
import { color, fontWeight, layer, radius, space } from "../../tokens/tokens";
import { media } from "../../tokens/media";
import { colorTransition, customScrollbar, onDesktop, playOnce } from "../../styles/mixins";
import { Button } from "../../components/button";

const fadeIn = enterFrom({ opacity: 0 });
const fromRight = enterFrom({ x: "100%" });
const fromBottom = enterFrom({ y: "100%" });

export const Backdrop = styled.div`
  @layer ui {
    position: fixed;
    inset: 0;
    z-index: ${layer.sheetBackdrop};
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    ${playOnce(fadeIn)}
  }
`;

/**
 * A right-hand drawer on desktop, a bottom sheet on phones. Declared `locked`
 * because these were inline styles, which a class could never override.
 */
export const Panel = styled.div`
  @layer utilities {
    && {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: ${layer.sheet};
      width: 100%;
      max-width: 22rem;
      display: flex;
      flex-direction: column;
      background-color: ${color.card};
      border-left: 1px solid ${color.border};
      border-top-left-radius: 1rem;
      border-bottom-left-radius: 1rem;
      box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
      overflow: hidden;
      ${playOnce(fromRight)}

      ${media.phone} {
        ${playOnce(fromBottom)}
      }

      /* Phones: a bottom sheet instead of a side drawer. */
      ${media.phone} {
        top: auto !important;
        left: 0 !important;
        max-width: 100% !important;
        max-height: 85dvh;
        border-left: 0 !important;
        border-top: 1px solid ${color.border};
        border-radius: ${radius.phoneSheet} ${radius.phoneSheet} 0 0 !important;
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
  }
`;

export const Header = styled.div`
  @layer utilities {
    && {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid ${color.border};
    }
  }
`;

export const Title = styled.span`
  @layer utilities {
    && {
      font-size: 1.125rem;
      font-weight: ${fontWeight.bold};
      letter-spacing: -0.01em;
    }
  }
`;

export const CloseButton = styled.button`
  @layer ui {
    display: flex;
    height: ${space[10]};
    width: ${space[10]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.base};
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover {
        background-color: ${color.muted};
        color: ${color.foreground};
      }
    }
  }

  ${onDesktop(css`
    height: ${space[8]};
    width: ${space[8]};
  `)}
`;

export const Body = styled.div`
  @layer utilities {
    && {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      ${customScrollbar}
    }
  }
`;

export const Footer = styled.div`
  @layer utilities {
    && {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid ${color.border};
    }
  }
`;

export const FooterButton = styled(Button)`
  @layer ui {
    flex: 1;
  }
`;
