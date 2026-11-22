import styled, { css } from "styled-components";
import { color, fontSize, fontWeight, radius, shadow, space } from "../../tokens/tokens";
import { onPhone, onSm, text } from "../../styles/mixins";

export const StyledCard = styled.div`
  @layer ui {
    border-radius: ${radius.card};
    border-width: 1px;
    border-style: solid;
    background-color: ${color.card};
    color: ${color.cardForeground};
    box-shadow: ${shadow.card};
  }

  /* On phones a card takes the Flutter app's larger corner and softer shadow. */
  ${onPhone(css`
    border-radius: ${radius.phoneCard};
    box-shadow: ${shadow.phoneCard};
  `)}
`;

/** Padding shared by the header, content and footer: tighter on phones. */
const sectionPadding = (topPadding: string) => css`
  padding: ${space[4]};
  padding-top: ${topPadding};
`;

export const StyledCardHeader = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    padding: ${space[4]};

    /* A little air between the title and description stacked inside. */
    & > :not(:last-child) {
      margin-block-end: ${space[1.5]};
    }
  }

  ${onSm(css`
    padding: ${space[6]};
  `)}
`;

export const StyledCardTitle = styled.h3`
  @layer ui {
    font-size: ${fontSize["2xl"]};
    line-height: 1;
    font-weight: ${fontWeight.semibold};
    letter-spacing: -0.025em;
  }
`;

export const StyledCardDescription = styled.p`
  @layer ui {
    ${text("sm")}
    color: ${color.mutedForeground};
  }
`;

export const StyledCardContent = styled.div`
  @layer ui {
    ${sectionPadding("0")}
  }

  ${onSm(css`
    padding: ${space[6]};
    padding-top: 0;
  `)}
`;

export const StyledCardFooter = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    ${sectionPadding("0")}
  }

  ${onSm(css`
    padding: ${space[6]};
    padding-top: 0;
  `)}
`;
