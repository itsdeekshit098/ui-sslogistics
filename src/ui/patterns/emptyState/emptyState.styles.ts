import styled, { css } from "styled-components";
import { color, fontWeight, radius, space } from "../../tokens/tokens";
import { onPhone, text } from "../../styles/mixins";
import { Button } from "../../components/button";

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

  ${onPhone(css`
    padding: ${space[8]};
  `)}
`;

export const IconBox = styled.div`
  @layer ui {
    border-radius: ${radius.base};
    background-color: ${color.muted};
    padding: ${space[4]};
    margin-bottom: ${space[4]};

    & svg {
      color: ${color.mutedForeground};
      opacity: 0.5;
    }
  }

  /* On phones the icon sits in a larger rounded tile, like the Flutter app. */
  ${onPhone(css`
    display: flex;
    height: ${space[16]};
    width: ${space[16]};
    align-items: center;
    justify-content: center;
    border-radius: ${radius.phoneCard};
    background-color: ${color.border};
    padding: 0;

    & svg {
      height: ${space[7]};
      width: ${space[7]};
    }
  `)}
`;

export const Title = styled.h3`
  @layer ui {
    ${text("lg")}
    font-weight: ${fontWeight.semibold};
    margin-bottom: ${space[1]};
  }

  ${onPhone(css`
    margin-bottom: ${space[1.5]};
    ${text("base")}
  `)}
`;

export const Description = styled.p`
  @layer ui {
    ${text("sm")}
    color: ${color.mutedForeground};
    max-width: 24rem;
  }
`;

/** The call-to-action: a full-width, taller button on phones. */
export const Action = styled(Button)`
  @layer ui {
    margin-top: ${space[4]};
  }

  ${onPhone(css`
    margin-top: ${space[5]};
    height: ${space[12]};
    width: 100%;
    font-size: 15px;
    font-weight: ${fontWeight.semibold};
  `)}
`;
