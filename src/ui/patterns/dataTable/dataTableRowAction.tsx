"use client";

import { Tooltip } from "../../components/tooltip";
import { ActionBtn, DisabledInner, DisabledWrap } from "./dataTable.styles";
import type { RowAction } from "./dataTable.types";

/** One icon button in a row's action strip (desktop). */
export function RowActionButton<TData>({ action, row }: { action: RowAction<TData>; row: TData }) {
  const isDisabled = action.disabled?.(row) ?? false;
  const label = typeof action.label === "function" ? action.label(row) : action.label;
  const icon = typeof action.icon === "function" ? action.icon(row) : action.icon;
  const disabledTooltip =
    typeof action.disabledTooltip === "function"
      ? action.disabledTooltip(row)
      : action.disabledTooltip;
  const testId = typeof action.testId === "function" ? action.testId(row) : action.testId;

  const buttonNode = (
    <ActionBtn
      type="button"
      title={label}
      aria-label={label}
      data-testid={testId}
      disabled={isDisabled}
      $danger={action.variant === "danger"}
      $disabled={isDisabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDisabled) action.onClick(row);
      }}
    >
      {icon}
    </ActionBtn>
  );

  if (isDisabled && disabledTooltip) {
    return (
      <Tooltip content={disabledTooltip} position="left">
        <DisabledWrap>
          <DisabledInner>{buttonNode}</DisabledInner>
        </DisabledWrap>
      </Tooltip>
    );
  }

  return buttonNode;
}
