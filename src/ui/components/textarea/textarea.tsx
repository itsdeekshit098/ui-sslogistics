"use client";

import { forwardRef } from "react";
import { StyledTextarea } from "./textarea.styles";
import type { TextareaProps } from "./textarea.types";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  props,
  ref,
) {
  return <StyledTextarea ref={ref} data-ui="textarea" {...props} />;
});
