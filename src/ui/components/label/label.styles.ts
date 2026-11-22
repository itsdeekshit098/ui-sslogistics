import styled from "styled-components";
import { fontWeight } from "../../tokens/tokens";
import { text } from "../../styles/mixins";

export const StyledLabel = styled.label`
  @layer ui {
    ${text("sm")}
    font-weight: ${fontWeight.medium};
    line-height: 1;

    /* A field marked class="peer" that comes before the label and is disabled. */
    .peer:disabled ~ & {
      cursor: not-allowed;
      opacity: 70%;
    }
  }
`;
