"use client";

import { useId } from "react";
import { ErrorText, FieldLabel, Hint, Required, Root } from "./formField.styles";
import type { FormControlProps, FormFieldProps } from "./formField.types";

/**
 * One labelled form control with its hint and error. It replaces the
 * label + control + message markup every form repeated, and gets the wiring
 * right once: the label points at the control, and the hint and error are its
 * accessible description.
 */
export function FormField({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  const control: FormControlProps = {
    id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : undefined,
    "aria-required": required ? true : undefined,
  };

  return (
    <Root data-ui="form-field" {...props}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && (
          <>
            {" "}
            <Required aria-hidden="true">*</Required>
          </>
        )}
      </FieldLabel>
      {typeof children === "function" ? children(control) : children}
      {error ? (
        <ErrorText id={errorId} role="alert">
          {error}
        </ErrorText>
      ) : null}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
    </Root>
  );
}
