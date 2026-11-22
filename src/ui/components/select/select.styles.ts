import styled, { css } from "styled-components";
import * as SelectPrimitive from "@radix-ui/react-select";
import { enterFrom, exitTo } from "../../tokens/keyframes";
import {
  color,
  control,
  fontWeight,
  radius,
  shadow,
  space,
  zIndex,
} from "../../tokens/tokens";
import { onDesktop, playOnce, text } from "../../styles/mixins";
import { ChevronDownIcon } from "../../icons";

// ─── Trigger ─────────────────────────────────────────────────────────────────

export const Trigger = styled(SelectPrimitive.Trigger)`
  @layer ui {
    display: flex;
    height: ${control.height};
    width: 100%;
    align-items: center;
    justify-content: space-between;
    border-radius: ${radius.input};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.input};
    background-color: ${color.background};
    padding-inline: ${space[4]};
    padding-block: ${space[2]};
    ${text("base")}
    color: ${color.foreground};
    box-shadow: ${shadow.sm};
    transition-property: border-color, box-shadow;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;

    &[data-placeholder] {
      color: ${color.placeholderForeground};
    }

    &:focus {
      outline-style: none;
      border-color: ${color.border};
    }

    &[data-state="open"] {
      border-color: ${color.border};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 50%;
    }

    /* The selected value is one line, ellipsised. */
    & > span {
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
    }
  }

  ${onDesktop(css`
    ${text("sm")}
  `)}
`;

export const TriggerChevron = styled(ChevronDownIcon)`
  @layer ui {
    opacity: 0.5;
  }
`;

// ─── Scroll buttons ──────────────────────────────────────────────────────────

const scrollButton = css`
  display: flex;
  cursor: default;
  align-items: center;
  justify-content: center;
  padding-block: ${space[1]};
`;

export const ScrollUp = styled(SelectPrimitive.ScrollUpButton)`
  @layer ui {
    ${scrollButton}
  }
`;

export const ScrollDown = styled(SelectPrimitive.ScrollDownButton)`
  @layer ui {
    ${scrollButton}
  }
`;

// ─── Popover ─────────────────────────────────────────────────────────────────

const SCALE = 0.95;
// The popover grows from the side it opened toward, and fades/zooms out on close.
const enter = {
  bottom: enterFrom({ opacity: 0, scale: SCALE, y: "-0.5rem" }),
  top: enterFrom({ opacity: 0, scale: SCALE, y: "0.5rem" }),
  left: enterFrom({ opacity: 0, scale: SCALE, x: "0.5rem" }),
  right: enterFrom({ opacity: 0, scale: SCALE, x: "-0.5rem" }),
};
const exit = exitTo({ opacity: 0, scale: SCALE });

export const Content = styled(SelectPrimitive.Content)<{
  $position: "popper" | "item-aligned";
  $matchTriggerWidth: boolean;
}>`
  @layer ui {
    position: relative;
    z-index: ${zIndex.popover};
    max-height: 24rem;
    min-width: 8rem;
    overflow: hidden;
    border-radius: ${radius.input};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.border};
    background-color: ${color.background};
    color: ${color.foreground};
    box-shadow: 0 24px 80px -48px rgba(15, 23, 42, 0.32);

    &[data-state="open"][data-side="bottom"] {
      ${playOnce(enter.bottom)}
    }
    &[data-state="open"][data-side="top"] {
      ${playOnce(enter.top)}
    }
    &[data-state="open"][data-side="left"] {
      ${playOnce(enter.left)}
    }
    &[data-state="open"][data-side="right"] {
      ${playOnce(enter.right)}
    }
    &[data-state="closed"] {
      ${playOnce(exit)}
    }

    ${(p) =>
      p.$position === "popper" &&
      css`
        /* A small gap between the trigger and the popover. */
        &[data-side="bottom"] {
          translate: 0 0.375rem;
        }
        &[data-side="left"] {
          translate: -0.375rem 0;
        }
        &[data-side="right"] {
          translate: 0.375rem 0;
        }
        &[data-side="top"] {
          translate: 0 -0.375rem;
        }
      `}

    ${(p) =>
      p.$matchTriggerWidth &&
      css`
        width: var(--radix-select-trigger-width);
        min-width: var(--radix-select-trigger-width);
      `}
  }
`;

export const Viewport = styled(SelectPrimitive.Viewport)<{
  $position: "popper" | "item-aligned";
  $compact: boolean;
}>`
  @layer ui {
    ${(p) =>
      p.$compact
        ? css`
            padding-inline: 0;
            padding-block: ${space[0.5]};
            & > * + * {
              margin-top: ${space[0.5]};
            }
          `
        : css`
            padding: ${space[1]};
            & > * + * {
              margin-top: ${space[1]};
            }
          `}

    ${(p) =>
      p.$position === "popper" &&
      css`
        height: var(--radix-select-trigger-height);
        width: 100%;
        min-width: var(--radix-select-trigger-width);
      `}
  }
`;

// ─── Items ───────────────────────────────────────────────────────────────────

export const Label = styled(SelectPrimitive.Label)`
  @layer ui {
    padding-block: ${space[1.5]};
    padding-left: ${space[8]};
    padding-right: ${space[2]};
    ${text("sm")}
    font-weight: ${fontWeight.semibold};
  }
`;

export const Item = styled(SelectPrimitive.Item)<{ $hideIndicator: boolean; $compact: boolean }>`
  @layer ui {
    position: relative;
    display: flex;
    min-height: ${space[11]};
    width: 100%;
    cursor: default;
    user-select: none;
    align-items: center;
    border-radius: calc(${radius.input} - 1px);
    padding-block: ${space[2]};
    padding-left: ${space[3]};
    padding-right: ${(p) => (p.$hideIndicator ? space[3] : space[9])};
    ${text("sm")}
    color: ${color.foreground};
    outline-style: none;
    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;

    &:focus,
    &[data-highlighted] {
      background-color: ${color.secondary};
      color: ${color.foreground};
    }

    &[data-state="checked"] {
      background-color: ${color.secondary};
      font-weight: ${fontWeight.semibold};
      color: ${color.foreground};
    }

    &[data-disabled] {
      pointer-events: none;
      opacity: 50%;
    }

    ${(p) =>
      p.$compact &&
      css`
        margin-inline: ${space[0.5]};
        width: calc(100% - 6px) !important;
        border-radius: calc(${radius.input} - 2px) !important;
      `}
  }
`;

export const IndicatorSlot = styled.span`
  @layer ui {
    position: absolute;
    right: ${space[3]};
    display: flex;
    height: ${space[4]};
    width: ${space[4]};
    align-items: center;
    justify-content: center;
    color: ${color.primary};
  }
`;

export const Separator = styled(SelectPrimitive.Separator)`
  @layer ui {
    margin-inline: calc(${space[1]} * -1);
    margin-block: ${space[1]};
    height: 1px;
    background-color: ${color.muted};
  }
`;

