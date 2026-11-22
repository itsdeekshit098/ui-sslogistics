"use client";

import { XIcon } from "../../icons";
import { RemoveButton, Root } from "./chip.styles";
import type { ChipProps } from "./chip.types";

/**
 * A compact pill for a status, a filter or a tag. Pass `onClick` to make it a
 * button (a filter that toggles, with `selected`), and `onRemove` for a chip
 * that can be dismissed. Without either it is plain text in a pill.
 */
export function Chip({
  children,
  tone = "neutral",
  variant = "subtle",
  size = "md",
  selected = false,
  onRemove,
  removeLabel = "Remove",
  onClick,
  disabled,
  className,
  ...props
}: ChipProps) {
  const interactive = !!onClick;
  const common = {
    "data-ui": "chip",
    $tone: tone,
    $variant: variant,
    $size: size,
    $selected: selected,
    $interactive: interactive,
    className,
  } as const;

  const content = (
    <>
      {children}
      {onRemove && (
        <RemoveButton type="button" aria-label={removeLabel} onClick={onRemove} disabled={disabled}>
          <XIcon size={12} />
        </RemoveButton>
      )}
    </>
  );

  if (interactive) {
    return (
      <Root
        {...common}
        {...props}
        as="button"
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </Root>
    );
  }
  return <Root {...common}>{content}</Root>;
}
