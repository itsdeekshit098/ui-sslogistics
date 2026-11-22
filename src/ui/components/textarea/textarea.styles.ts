import styled, { css } from "styled-components";
import { onDesktop, text } from "../../styles/mixins";
import { fieldStyles } from "../input/input.styles";

export const StyledTextarea = styled.textarea`
  @layer ui {
    ${fieldStyles}
    min-height: 80px;
  }

  ${onDesktop(css`
    ${text("sm")}
  `)}
`;
