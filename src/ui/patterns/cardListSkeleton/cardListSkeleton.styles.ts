import styled from "styled-components";
import { color, radius, shadow, space } from "../../tokens/tokens";
import { stack } from "../../styles/mixins";

/** Default spacing between cards; a caller passing its own className replaces it. */
export const CardList = styled.div<{ $default: boolean }>`
  @layer ui {
    ${(p) => (p.$default ? stack(space[4]) : "")}
  }
`;

export const SkeletonCard = styled.div`
  @layer ui {
    border-radius: ${radius.base};
    border-width: 1px;
    border-style: solid;
    background-color: ${color.card};
    padding: ${space[4]};
    box-shadow: ${shadow.sm};
  }
`;

export const CardHeaderRow = styled.div`
  @layer ui {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: ${space[3]};
  }
`;

export const Stack2 = styled.div<{ $spaceBelow?: boolean }>`
  @layer ui {
    ${stack(space[2])}
    ${(p) => (p.$spaceBelow ? `margin-bottom: ${space[3]};` : "")}
  }
`;

export const CardActions = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${space[2]};
    border-top-width: 1px;
    border-top-style: solid;
    padding-top: ${space[3]};
  }
`;
