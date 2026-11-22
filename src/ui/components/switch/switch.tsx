"use client";

import { forwardRef } from "react";
import { useControllableState } from "../../hooks/useControllableState";
import { Thumb, Track } from "./switch.styles";
import type { SwitchProps } from "./switch.types";

/**
 * An on/off setting that takes effect immediately (unlike a checkbox, which
 * waits for a form to be submitted). `role="switch"` so assistive technology
 * says "on" / "off". Controlled with `checked` + `onCheckedChange`, or
 * uncontrolled with `defaultChecked`. Give it an `aria-label` or point
 * `aria-labelledby` at its visible label.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, defaultChecked = false, onCheckedChange, size = "md", onClick, ...props },
  ref,
) {
  const [on, setOn] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });

  return (
    <Track
      data-ui="switch"
      {...props}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={on}
      $on={on}
      $size={size}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOn(!on);
      }}
    >
      <Thumb $on={on} $size={size} />
    </Track>
  );
});
