import styled, { css } from "styled-components";
import { space } from "../../tokens/tokens";
import { onSm } from "../../styles/mixins";

/** One column on a phone; `columns` from the sm breakpoint up. */
export const Grid = styled.div<{ $columns: 1 | 2 | 3 }>`
  @layer ui {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: ${space[4]};
  }

  ${(p) =>
    p.$columns > 1 &&
    onSm(css`
      grid-template-columns: repeat(${p.$columns}, minmax(0, 1fr));
    `)}
`;
