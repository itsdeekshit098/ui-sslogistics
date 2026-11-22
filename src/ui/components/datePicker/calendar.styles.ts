import styled, { css } from "styled-components";
import { color, fontWeight, palette, radius, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";

export const Root = styled.div`
  @layer ui {
    width: 17.5rem;
    padding: ${space[2]};
  }
`;

export const Header = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${space[2]};
  }
`;

export const Title = styled.div`
  @layer ui {
    ${text("sm")}
    font-weight: ${fontWeight.semibold};
    color: ${color.foreground};
  }
`;

export const NavButton = styled.button`
  @layer ui {
    display: inline-flex;
    height: ${space[8]};
    width: ${space[8]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.xs};
    color: ${color.mutedForeground};
    ${colorTransition}

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background-color: ${color.accent};
        color: ${color.foreground};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }

    &:disabled {
      opacity: 40%;
      cursor: not-allowed;
    }
  }
`;

export const Grid = styled.div`
  @layer ui {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
`;

export const Weekday = styled.div`
  @layer ui {
    padding-block: ${space[1]};
    text-align: center;
    ${text("xs")}
    font-weight: ${fontWeight.medium};
    color: ${color.mutedForeground};
  }
`;

export const DayCell = styled.div`
  @layer ui {
    display: flex;
    justify-content: center;
  }
`;

export const Day = styled.button<{ $selected: boolean; $today: boolean; $outside: boolean }>`
  @layer ui {
    display: inline-flex;
    height: ${space[9]};
    width: ${space[9]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.xs};
    ${text("sm")}
    font-variant-numeric: tabular-nums;
    color: ${(p) => (p.$outside ? color.mutedForeground : color.foreground)};
    opacity: ${(p) => (p.$outside ? "60%" : "100%")};
    ${colorTransition}

    @media (hover: hover) {
      &:hover:not(:disabled) {
        background-color: ${color.accent};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }

    ${(p) =>
      p.$today &&
      css`
        font-weight: ${fontWeight.bold};
        box-shadow: inset 0 0 0 1px ${color.border};
      `}

    ${(p) =>
      p.$selected &&
      css`
        background-color: ${color.primary};
        color: ${palette.white};
        opacity: 100%;
        font-weight: ${fontWeight.semibold};

        @media (hover: hover) {
          &:hover:not(:disabled) {
            background-color: ${color.primary};
          }
        }
      `}

    &:disabled {
      opacity: 30%;
      cursor: not-allowed;
    }
  }
`;

export const Footer = styled.div`
  @layer ui {
    display: flex;
    justify-content: space-between;
    margin-top: ${space[2]};
    padding-top: ${space[2]};
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: ${color.border};
  }
`;

export const FooterButton = styled.button`
  @layer ui {
    border-radius: ${radius.xs};
    padding-inline: ${space[2]};
    padding-block: ${space[1]};
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    color: ${color.primary};

    @media (hover: hover) {
      &:hover {
        background-color: ${color.accent};
      }
    }

    &:focus-visible {
      outline-style: none;
      box-shadow: 0 0 0 2px ${color.ring};
    }

    &:disabled {
      opacity: 40%;
      cursor: not-allowed;
    }
  }
`;
