import styled, { css } from "styled-components";
import { color, control, space } from "../../tokens/tokens";
import { onDesktop, text } from "../../styles/mixins";
import { fieldStyles } from "../input/input.styles";
import { CalendarIcon } from "../../icons";

export const Wrapper = styled.div`
  @layer ui {
    position: relative;
    width: 100%;
  }
`;

/** Looks like an Input; opens the calendar. */
export const Trigger = styled.button<{ $empty: boolean; $invalid: boolean }>`
  @layer ui {
    ${fieldStyles}
    height: ${control.heightLg};
    align-items: center;
    justify-content: space-between;
    gap: ${space[2]};
    text-align: left;
    color: ${(p) => (p.$empty ? color.placeholderForeground : color.foreground)};
    cursor: pointer;

    ${(p) =>
      p.$invalid &&
      css`
        border-color: ${color.destructive};

        &:focus-visible {
          box-shadow:
            0 0 0 2px ${color.background},
            0 0 0 4px ${color.destructive};
        }
      `}

    &:disabled {
      cursor: not-allowed;
    }
  }

  ${onDesktop(css`
    height: ${control.height};
    ${text("sm")}
  `)}
`;

export const Value = styled.span`
  @layer ui {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const TrailingIcon = styled(CalendarIcon)`
  @layer ui {
    flex-shrink: 0;
    color: ${color.mutedForeground};
  }
`;
