import styled from "styled-components";
import { color, motion, palette, space } from "../../tokens/tokens";

const SIZE = {
  sm: { width: "2rem", height: "1.125rem", thumb: "0.875rem" },
  md: { width: "2.5rem", height: "1.5rem", thumb: "1.125rem" },
} as const;

export const Track = styled.button<{ $on: boolean; $size: "sm" | "md" }>`
  @layer ui {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    width: ${(p) => SIZE[p.$size].width};
    height: ${(p) => SIZE[p.$size].height};
    padding: 0;
    border-radius: 9999px;
    border-width: 1px;
    border-style: solid;
    border-color: transparent;
    background-color: ${(p) => (p.$on ? color.primary : color.input)};
    cursor: pointer;
    transition-property: background-color;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};

    &:focus-visible {
      outline-style: none;
      box-shadow:
        0 0 0 2px ${color.background},
        0 0 0 4px ${color.ring};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 50%;
    }
  }
`;

export const Thumb = styled.span<{ $on: boolean; $size: "sm" | "md" }>`
  @layer ui {
    display: block;
    width: ${(p) => SIZE[p.$size].thumb};
    height: ${(p) => SIZE[p.$size].thumb};
    margin-left: ${space[0.5]};
    border-radius: 9999px;
    background-color: ${palette.white};
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    transition-property: translate;
    transition-timing-function: ${motion.easing};
    transition-duration: ${motion.duration};
    translate: ${(p) =>
      p.$on
        ? `calc(${SIZE[p.$size].width} - ${SIZE[p.$size].thumb} - 0.25rem - 2px) 0`
        : "0 0"};
  }
`;
