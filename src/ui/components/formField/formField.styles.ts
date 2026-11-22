import styled from "styled-components";
import { color, space } from "../../tokens/tokens";
import { text } from "../../styles/mixins";
import { Label } from "../label";

/** A label, its control and the hint or error beneath, stacked. */
export const Root = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    gap: ${space[2]};
  }
`;

export const FieldLabel = styled(Label)`
  @layer ui {
    display: block;
  }
`;

export const Required = styled.span`
  @layer ui {
    color: ${color.destructive};
  }
`;

export const Hint = styled.p`
  @layer ui {
    ${text("xs")}
    color: ${color.mutedForeground};
  }
`;

export const ErrorText = styled.p`
  @layer ui {
    ${text("xs")}
    color: ${color.destructive};
  }
`;
