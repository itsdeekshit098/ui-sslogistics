import styled, { css } from "styled-components";
import { color, fontWeight, radius, space } from "../../tokens/tokens";
import { locked } from "../../styles/mixins";
import { Button } from "../../components/button";
import { ModalContent } from "../../components/modal";
import { Spinner } from "../../components/spinner";
import { Trash2Icon } from "../../icons";

// The red of the destructive icon and error banner in this dialog. It differs
// slightly from the theme's --destructive; kept as is so the dialog doesn't
// change appearance.
const DANGER = "#dc2626";
const DANGER_TINT = "rgba(239, 68, 68, 0.1)";

/** A narrower modal with even padding all round. */
export const Content = styled(ModalContent)`
  ${locked(css`
    max-width: 448px;
    padding: 24px;
  `)}
`;

export const Column = styled.div`
  @layer ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${space[4]};
    text-align: center;
  }
`;

export const IconWrapper = styled.div`
  @layer ui {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${space[3]};
    border-radius: ${radius.base};
    background-color: ${DANGER_TINT};
  }
`;

export const DefaultIcon = styled(Trash2Icon)`
  @layer ui {
    color: ${DANGER};
  }
`;

export const Title = styled.h3`
  @layer ui {
    font-size: 18px;
    font-weight: ${fontWeight.semibold};
    color: ${color.foreground};
    margin: 0;
  }
`;

export const Description = styled.p`
  @layer ui {
    font-size: 14px;
    color: ${color.mutedForeground};
    margin-top: ${space[1]};
  }
`;

export const ErrorBanner = styled.div`
  @layer ui {
    width: 100%;
    background-color: ${DANGER_TINT};
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: ${DANGER};
    font-size: 12px;
    padding: 10px 12px;
    border-radius: 6px;
  }
`;

export const Actions = styled.div`
  @layer ui {
    display: flex;
    gap: ${space[3]};
    width: 100%;
  }
`;

export const ActionButton = styled(Button)`
  @layer ui {
    flex: 1;
  }
`;

export const ButtonSpinner = styled(Spinner)`
  @layer ui {
    margin-right: ${space[2]};
  }
`;
