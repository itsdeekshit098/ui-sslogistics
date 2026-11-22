"use client";

import { forwardRef, useEffect, useRef } from "react";
import { composeRefs } from "../../utils/composeRefs";
import { useControllableState } from "../../hooks/useControllableState";
import { Box, Wrapper } from "./checkbox.styles";
import type { CheckboxProps } from "./checkbox.types";

/**
 * A native checkbox, so forms, focus and keyboard behave as expected, drawn in
 * the library's look. Works controlled (`checked` + `onCheckedChange`) or
 * uncontrolled (`defaultChecked`). `indeterminate` shows the dash for a
 * partly-selected group; it is visual only and clears on the next click.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    indeterminate = false,
    disabled,
    size = "md",
    children,
    className,
    ...props
  },
  ref,
) {
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const inner = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property, not an HTML attribute.
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <Wrapper data-ui="checkbox" $disabled={!!disabled} className={className}>
      <Box
        {...props}
        ref={composeRefs(ref, inner)}
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        $size={size}
        onChange={(event) => {
          if (!disabled) setChecked(event.target.checked);
        }}
      />
      {children}
    </Wrapper>
  );
});
