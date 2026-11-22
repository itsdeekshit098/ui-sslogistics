import styled from "styled-components";
import { color, palette, radius, space } from "../../tokens/tokens";
import { colorTransition, text } from "../../styles/mixins";

export const Wrapper = styled.label<{ $disabled: boolean }>`
  @layer ui {
    display: inline-flex;
    align-items: center;
    gap: ${space[2]};
    ${text("sm")}
    color: ${color.foreground};
    cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
    opacity: ${(p) => (p.$disabled ? "50%" : "100%")};
  }
`;

const BOX: Record<"sm" | "md", string> = { sm: "1rem", md: "1.25rem" };

/** The real <input>, drawn as a box: focus, keyboard and forms all keep working natively. */
export const Box = styled.input<{ $size: "sm" | "md" }>`
  @layer ui {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    width: ${(p) => BOX[p.$size]};
    height: ${(p) => BOX[p.$size]};
    margin: 0;
    border-radius: ${radius.xs};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.input};
    background-color: ${color.background};
    cursor: inherit;
    ${colorTransition}

    &:focus-visible {
      outline-style: none;
      box-shadow:
        0 0 0 2px ${color.background},
        0 0 0 4px ${color.ring};
    }

    &:checked,
    &:indeterminate {
      border-color: ${color.primary};
      background-color: ${color.primary};
    }

    /* The tick, drawn with borders. */
    &:checked::after {
      content: "";
      position: absolute;
      left: 34%;
      top: 14%;
      width: 28%;
      height: 54%;
      border: solid ${palette.white};
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    /* The dash for "some selected". */
    &:indeterminate::after {
      content: "";
      position: absolute;
      left: 22%;
      right: 22%;
      top: calc(50% - 1px);
      height: 2px;
      background-color: ${palette.white};
    }
  }
`;

