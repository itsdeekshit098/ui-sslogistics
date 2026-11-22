import styled from "styled-components";
import { enterFrom } from "../../tokens/keyframes";
import { color, fontWeight, layer, radius, space } from "../../tokens/tokens";
import { colorTransition, customScrollbar, playOnce } from "../../styles/mixins";

const fadeIn = enterFrom({ opacity: 0 });
const slideUp = enterFrom({ y: "100%" });

export const Backdrop = styled.div`
  @layer ui {
    position: fixed;
    inset: 0;
    z-index: ${layer.sheetBackdrop};
    background-color: ${color.overlay};
    backdrop-filter: blur(2px);
    ${playOnce(fadeIn)}
  }
`;

export const Panel = styled.div`
  @layer ui {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: ${layer.sheet};
    display: flex;
    max-height: 92dvh;
    flex-direction: column;
    outline-style: none;
    border-top-left-radius: ${radius.phoneSheet};
    border-top-right-radius: ${radius.phoneSheet};
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: ${color.border};
    background-color: ${color.card};
    color: ${color.cardForeground};
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.18);
    padding-bottom: env(safe-area-inset-bottom);
    ${playOnce(slideUp)}
  }
`;

export const HandleRow = styled.div`
  @layer ui {
    display: flex;
    justify-content: center;
    padding-block: ${space[2.5]};
  }
`;

export const Handle = styled.span`
  @layer ui {
    height: ${space[1]};
    width: ${space[10]};
    border-radius: 9999px;
    background-color: ${color.border};
  }
`;

export const Header = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${space[3]};
    border-bottom-width: 1px;
    border-bottom-style: solid;
    border-bottom-color: ${color.border};
    padding-left: ${space[5]};
    padding-right: ${space[3]};
    padding-bottom: ${space[2]};
  }
`;

export const Title = styled.div`
  @layer ui {
    min-width: 0;
    font-size: 17px;
    font-weight: ${fontWeight.extrabold};
  }
`;

export const CloseButton = styled.button`
  @layer ui {
    margin-right: calc(${space[1]} * -1);
    display: flex;
    height: ${space[10]};
    width: ${space[10]};
    flex-shrink: 0;
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

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }
  }
`;

export const Body = styled.div`
  @layer ui {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-inline: ${space[4]};
    padding-top: ${space[2]};
    padding-bottom: ${space[4]};
    ${customScrollbar}
  }
`;

