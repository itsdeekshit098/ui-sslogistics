"use client";

import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import { composeRefs } from "../../utils/composeRefs";
import type { SlotProps } from "./slot.types";

type AnyProps = Record<string, unknown>;

const isHandler = (key: string, value: unknown): value is (...args: unknown[]) => void =>
  /^on[A-Z]/.test(key) && typeof value === "function";

/**
 * Merges the slot's props onto the child's, child winning, with three
 * exceptions that must combine instead: event handlers both run (child first),
 * `style` objects merge, and `className`s are joined.
 */
function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps, ...childProps };

  for (const key of Object.keys(childProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (isHandler(key, slotValue) && isHandler(key, childValue)) {
      merged[key] = (...args: unknown[]) => {
        childValue(...args);
        slotValue(...args);
      };
    }
  }

  if (slotProps.style || childProps.style) {
    merged.style = {
      ...(slotProps.style as object | undefined),
      ...(childProps.style as object | undefined),
    };
  }
  const classes = [slotProps.className, childProps.className].filter(Boolean);
  if (classes.length) merged.className = classes.join(" ");

  return merged;
}

/**
 * Renders its single child element in its own place, handing it every prop
 * it was given. It is what makes `asChild` work: a Button that wraps a link
 * becomes the link, with the button's look and behaviour, instead of a
 * `<button>` nested inside an `<a>`.
 */
export function Slot({ children, ref, ...slotProps }: SlotProps) {
  // Several children is a mistake worth failing loudly on; a lone text or
  // empty child simply has nothing to receive the props.
  if (Children.count(children) > 1) Children.only(children);
  if (!isValidElement(children)) return null;

  const element = children as ReactElement<AnyProps & { ref?: React.Ref<HTMLElement> }>;
  return cloneElement(element, {
    ...mergeProps(slotProps as AnyProps, element.props),
    ref: composeRefs(ref, element.props.ref),
  });
}
