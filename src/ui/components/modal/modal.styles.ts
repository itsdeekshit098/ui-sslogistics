import styled, { css } from "styled-components";
import { keyframes } from "styled-components";
import { color, fontWeight, radius, shadow, space, zIndex } from "../../tokens/tokens";
import { media } from "../../tokens/media";
import { locked } from "../../styles/mixins";

/*
 * Everything here is `locked`: the modal's look used to be inline style, which
 * a caller's class could never override (callers adjust a modal with the
 * `style` prop, which still wins over all of this). The phone bottom-sheet
 * rules carry `!important` for the same reason: a caller's `style={{ maxWidth }}`
 * must not stop the sheet filling the screen.
 */

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const sheetUp = keyframes`
  from { transform: translate3d(0, 100%, 0); }
`;

export const Overlay = styled.div<{ $nested: boolean }>`
  ${(p) => locked(css`
    position: fixed;
    inset: 0;
    z-index: ${p.$nested ? zIndex.modalNestedOverlay : zIndex.modalOverlay};
    display: flex;
    align-items: center;
    justify-content: center;
    /* Dark mode uses a darker overlay (0.75 vs 0.6) — dimming an already-dark
       page by the light-mode amount barely reads as "this is now background." */
    background-color: ${color.overlay};
    backdrop-filter: blur(4px);
    /* Keeps the modal off the screen edges on small screens. */
    padding: ${space[4]};

    /* Phone widths turn the dialog into a bottom sheet. */
    ${media.narrow} {
      align-items: flex-end !important;
      padding: 0 !important;
    }
  `)}
`;

export const Content = styled.div`
  ${locked(css`
    position: relative;
    z-index: 50;
    width: 100%;
    max-width: var(--modal-max-width, 512px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border-radius: var(--modal-radius, 12px);
    border: 1px solid ${color.border};
    background-color: ${color.card};
    color: ${color.cardForeground};
    box-shadow: ${shadow.modal};
    overflow: hidden;
    animation: ${fadeIn} 0.2s ease-out;

    ${media.narrow} {
      max-width: 100% !important;
      max-height: 92dvh !important;
      border-radius: ${radius.phoneSheet} ${radius.phoneSheet} 0 0 !important;
      border-bottom: 0 !important;
      padding-bottom: env(safe-area-inset-bottom);
      animation: ${sheetUp} 0.28s cubic-bezier(0.32, 0.72, 0, 1) !important;

      /* Drag handle */
      &::before {
        content: "";
        display: block;
        flex-shrink: 0;
        width: 2.5rem;
        height: 0.25rem;
        margin: 0.625rem auto 0;
        border-radius: 9999px;
        background: ${color.border};
      }

      /* Header: the Flutter sheet's 17px heavy title over a divider. */
      & [data-ui="modal-title"] {
        font-size: 17px !important;
        font-weight: 800 !important;
        line-height: 1.3 !important;
      }
      & > div:has(> [data-ui="modal-title"]) {
        padding: 0.5rem 3.5rem 0.75rem 1.25rem !important;
        border-bottom: 1px solid ${color.border};
        margin-bottom: 0.75rem;
      }
      /* A dialog with no body (e.g. sign-out) would show the header's divider
         and the footer's divider stacked; keep just the footer's. */
      & > div:has(> [data-ui="modal-title"]):has(+ [data-ui="modal-footer"]) {
        border-bottom-width: 0;
        margin-bottom: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
    }
  `)}
`;

export const CloseButton = styled.button`
  ${locked(css`
    position: absolute;
    right: ${space[4]};
    top: ${space[4]};
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.7;
    padding: ${space[1]};
    border-radius: ${radius.xs};
    color: ${color.foreground};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
    z-index: 10;

    &:hover {
      opacity: 1;
    }

    /* 40px close target (24px on desktop is fine for a mouse) */
    ${media.narrow} {
      top: 0.75rem;
      right: 0.5rem;
      width: 2.5rem;
      height: 2.5rem;
    }
  `)}
`;

export const Header = styled.div`
  ${locked(css`
    display: flex;
    flex-direction: column;
    gap: ${space[1.5]};
    /* balanced bottom padding */
    padding: ${space[6]} ${space[6]} ${space[2]};
    text-align: left;
    flex-shrink: 0;
  `)}
`;

export const Title = styled.h2`
  ${locked(css`
    font-size: 18px;
    font-weight: ${fontWeight.semibold};
    letter-spacing: -0.01em;
    line-height: 1;
    color: ${color.foreground};
    margin: 0;
  `)}
`;

export const Description = styled.p`
  ${locked(css`
    font-size: 14px;
    color: ${color.mutedForeground};
    margin: 0;
  `)}
`;

export const Body = styled.div`
  ${locked(css`
    flex: 1;
    overflow-y: auto;
    /* Required for a flex child to shrink below its content size. */
    min-height: 0;
    padding: ${space[2]} ${space[6]} ${space[6]};
  `)}
`;

export const Footer = styled.div`
  ${locked(css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: ${space[3]};
    padding: ${space[4]} ${space[3]} ${space[3]};
    flex-shrink: 0;

    /* Full-width, thumb-sized footer buttons */
    ${media.narrow} {
      padding: 0.75rem 1rem !important;
      border-top: 1px solid ${color.border};

      & > button,
      & > a {
        flex: 1 1 0;
        min-height: 3rem;
        font-size: 15px;
        font-weight: ${fontWeight.semibold};
      }
    }
  `)}
`;

