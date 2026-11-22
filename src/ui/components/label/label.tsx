"use client";

import { forwardRef, type MouseEvent } from "react";
import { StyledLabel } from "./label.styles";
import type { LabelProps } from "./label.types";

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { onMouseDown, ...props },
  ref,
) {
  return (
    <StyledLabel
      ref={ref}
      data-ui="label"
      {...props}
      onMouseDown={(event: MouseEvent<HTMLLabelElement>) => {
        onMouseDown?.(event);
        // A double-click on a label would select its text; keep that from
        // happening without blocking a click on a control inside it.
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
      }}
    />
  );
});
