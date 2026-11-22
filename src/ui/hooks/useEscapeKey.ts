import { useEffect, useRef } from "react";

type Entry = { current: () => void };

/**
 * Everything that currently wants Escape, in the order it opened. Only the last
 * one, the topmost layer, acts on a key press. Registering on `window` listener
 * by listener would run the outermost first (listeners fire in the order they
 * were added), so a popover inside a modal, or a modal inside a modal, would
 * close its parent instead of itself.
 */
const stack: Entry[] = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.stopImmediatePropagation();
  top.current();
}

/**
 * Calls `onEscape` when Escape is pressed while `enabled` and no layer opened
 * after this one is also listening. A new `onEscape` function each render is
 * fine: it never changes this layer's place in the order.
 */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    if (stack.length === 0) window.addEventListener("keydown", onKeyDown);
    stack.push(handler);
    return () => {
      stack.splice(stack.indexOf(handler), 1);
      if (stack.length === 0) window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}
