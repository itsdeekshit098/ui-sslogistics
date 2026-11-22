import styled from "styled-components";
import { color } from "../../tokens/tokens";
import type { MoneyTone } from "./money.types";

const toneColor: Record<MoneyTone, string | undefined> = {
  neutral: undefined,
  positive: color.successSubtleForeground,
  negative: color.destructive,
};

export const StyledMoney = styled.span<{ $tone: MoneyTone }>`
  @layer ui {
    /* Digits are the same width, so a column of amounts lines up. */
    font-variant-numeric: tabular-nums;
    ${(p) => (toneColor[p.$tone] ? `color: ${toneColor[p.$tone]};` : "")}
  }
`;
