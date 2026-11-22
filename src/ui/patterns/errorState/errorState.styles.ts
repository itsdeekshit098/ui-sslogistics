import styled, { css } from "styled-components";
import { animation, spin } from "../../tokens/keyframes";
import { color, fontWeight, mix, radius, space } from "../../tokens/tokens";
import { text } from "../../styles/mixins";
import { Button } from "../../components/button";
import { RefreshCwIcon } from "../../icons";

export const Root = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding-block: ${space[12]};
    padding-inline: ${space[4]};
  }
`;

export const IconBox = styled.div`
  @layer ui {
    border-radius: ${radius.base};
    background-color: ${mix(color.destructive, 10)};
    padding: ${space[4]};
    margin-bottom: ${space[4]};

    & svg {
      color: ${color.destructive};
    }
  }
`;

export const Title = styled.h3`
  @layer ui {
    ${text("lg")}
    font-weight: ${fontWeight.semibold};
    margin-bottom: ${space[1]};
  }
`;

export const Description = styled.p`
  @layer ui {
    ${text("sm")}
    color: ${color.mutedForeground};
    max-width: 24rem;
  }
`;

export const RetryButton = styled(Button)`
  @layer ui {
    margin-top: ${space[4]};
  }
`;

export const RetryIcon = styled(RefreshCwIcon)<{ $spinning: boolean }>`
  @layer ui {
    margin-right: ${space[2]};
    ${(p) =>
      p.$spinning &&
      css`
        animation: ${spin} ${animation.spin};
      `}
  }
`;
