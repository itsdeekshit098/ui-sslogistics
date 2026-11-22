"use client";

import type { ComponentProps } from "react";
import { FooterAction } from "./combobox.styles";

/**
 * An action rendered in a Combobox's `footer` slot — typically "+ Add new …",
 * creating the missing option inline. It sits inside the portalled listbox, so
 * it matches the option rows' padding and has a top border setting it apart.
 *
 * It stops the pointer-down from bubbling, which would otherwise reach the
 * listbox's outside-click handler and close it before the click registered.
 */
export function ComboboxFooterAction({ onPointerDown, ...props }: ComponentProps<typeof FooterAction>) {
  return (
    <FooterAction
      variant="ghost"
      {...props}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
    />
  );
}
