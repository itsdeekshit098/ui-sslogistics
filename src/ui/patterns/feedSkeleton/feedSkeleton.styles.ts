import styled from "styled-components";
import { space } from "../../tokens/tokens";
import { stack } from "../../styles/mixins";

export const Feed = styled.div<{ $default: boolean }>`
  @layer ui {
    ${(p) => (p.$default ? stack(space[1]) : "")}
  }
`;

export const FeedRow = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    gap: ${space[3]};
    padding: ${space[3]};
  }
`;

export const FeedLines = styled.div`
  @layer ui {
    flex: 1;
    min-width: 0;
    ${stack(space[1.5])}
  }
`;
