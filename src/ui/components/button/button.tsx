"use client";

import { forwardRef } from "react";
import { StyledButton, StyledSlot } from "./button.styles";
import type { ButtonProps } from "./button.types";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", asChild = false, ...props },
  ref,
) {
  const styleProps = { $variant: variant, $size: size, "data-ui": "button" };

  if (asChild) {
    // `ref` is typed for a button; the slot hands it to whichever element it renders.
    return <StyledSlot {...styleProps} {...props} ref={ref as never} />;
  }
  return <StyledButton {...styleProps} {...props} ref={ref} />;
});
