import styled, { css } from "styled-components";
import { color, radius, shadow, space } from "../../tokens/tokens";
import { onDesktop, stack } from "../../styles/mixins";

export const AdminPage = styled.div`
  @layer ui {
    flex: 1;
    ${stack(space[6])}
  }
`;

export const AdminStatGrid = styled.div`
  @layer ui {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${space[4]};
  }

  ${onDesktop(css`
    grid-template-columns: repeat(4, minmax(0, 1fr));
  `)}
`;

export const LoginPage = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: color-mix(in oklab, ${color.muted} 50%, transparent);
    padding: ${space[4]};
  }
`;

export const LoginCard = styled.div`
  @layer ui {
    width: 100%;
    max-width: 28rem;
    border-radius: ${radius.modal};
    border-width: 1px;
    border-style: solid;
    border-color: ${color.border};
    background-color: ${color.card};
    padding: ${space[8]};
    box-shadow: ${shadow.card};
    ${stack(space[6])}
  }
`;

export const LoginHeading = styled.div`
  @layer ui {
    text-align: center;
    ${stack(space[2])}
  }
`;

export const LoginForm = styled.div`
  @layer ui {
    ${stack(space[4])}
  }
`;

export const LoginField = styled.div`
  @layer ui {
    ${stack(space[2])}
  }
`;
