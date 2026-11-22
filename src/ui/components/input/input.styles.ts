import styled, { css } from "styled-components";
import { color, control, fontWeight, radius, space } from "../../tokens/tokens";
import { focusRing, onDesktop, onPhone, text } from "../../styles/mixins";

/** Shared by Input and Textarea: the look of a single text field. */
export const fieldStyles = css`
  display: flex;
  width: 100%;
  border-radius: ${radius.input};
  border-width: 1px;
  border-style: solid;
  border-color: ${color.input};
  background-color: ${color.background};
  padding-inline: ${space[3]};
  padding-block: ${space[2]};
  ${text("base")}

  &::placeholder {
    color: ${color.placeholderForeground};
  }

  &:focus-visible {
    ${focusRing}
  }

  /* A FormField marks a control with an error aria-invalid. */
  &[aria-invalid="true"] {
    border-color: ${color.destructive};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 50%;
  }
`;

export const StyledInput = styled.input`
  @layer ui {
    ${fieldStyles}
    height: ${control.heightLg};

    &::file-selector-button {
      border-style: solid;
      border-width: 0;
      background-color: transparent;
      ${text("sm")}
      font-weight: ${fontWeight.medium};
    }
  }

  /* Phones fill the field with the card colour, like the Flutter app. */
  ${onPhone(css`
    background-color: ${color.card};
  `)}

  /* Desktop fields are a little shorter and set in 14px. */
  ${onDesktop(css`
    height: ${control.height};
    ${text("sm")}
  `)}
`;

