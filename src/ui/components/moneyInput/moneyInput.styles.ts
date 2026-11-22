import styled from "styled-components";
import { color, space } from "../../tokens/tokens";
import { NumberInput } from "../numberInput";

export const Wrapper = styled.div`
  @layer ui {
    position: relative;
    width: 100%;
  }
`;

export const CurrencySymbol = styled.span`
  @layer ui {
    pointer-events: none;
    position: absolute;
    left: ${space[3]};
    top: 50%;
    translate: 0 -50%;
    color: ${color.mutedForeground};
  }
`;

export const Field = styled(NumberInput)`
  @layer ui {
    padding-left: ${space[8]};
    font-variant-numeric: tabular-nums;
  }
`;
