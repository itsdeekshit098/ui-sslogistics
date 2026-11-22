"use client";

import { forwardRef, type WheelEventHandler } from "react";
import { StyledInput } from "./input.styles";
import type { InputProps } from "./input.types";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { type, onWheel, ...props },
  ref,
) {
  // Stop a scroll over a focused number field from silently changing its value.
  const handleWheel: WheelEventHandler<HTMLInputElement> = (event) => {
    if (type === "number") event.currentTarget.blur();
    onWheel?.(event);
  };

  return <StyledInput ref={ref} data-ui="input" type={type} onWheel={handleWheel} {...props} />;
});
