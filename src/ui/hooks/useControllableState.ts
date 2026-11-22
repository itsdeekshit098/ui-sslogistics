import { useCallback, useEffect, useRef, useState } from "react";

interface Options<T> {
  /** The controlled value. `undefined` means uncontrolled. */
  value: T | undefined;
  /** The starting value when uncontrolled. */
  defaultValue: T;
  /** Called whenever the value changes, controlled or not. */
  onChange?: (value: T) => void;
}

/**
 * Lets a component work both ways: controlled (the parent owns `value` and
 * updates it from `onChange`) or uncontrolled (the component keeps its own
 * state, seeded by `defaultValue`). Every input in the library uses it, so
 * `value` / `defaultValue` / `onValueChange` behave the same everywhere.
 */
export function useControllableState<T>({ value, defaultValue, onChange }: Options<T>) {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;

  // Switching between controlled and uncontrolled leaves the field showing one
  // value while the owner holds another (React warns about it for <input>).
  // Pass `null`, "" or 0 for "empty" in controlled mode, never `undefined`.
  const wasControlled = useRef(controlled);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && wasControlled.current !== controlled) {
      console.warn(
        `A field changed from ${wasControlled.current ? "controlled to uncontrolled" : "uncontrolled to controlled"}. ` +
          "Keep passing a value (use null or an empty string for empty), or never pass one.",
      );
    }
    wasControlled.current = controlled;
  }, [controlled]);
  const current = controlled ? (value as T) : inner;

  // The latest value and onChange, read by `set` so it keeps a stable identity.
  // Synced after each render (not during it).
  const onChangeRef = useRef(onChange);
  const currentRef = useRef(current);
  useEffect(() => {
    onChangeRef.current = onChange;
    currentRef.current = current;
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(currentRef.current) : next;
      if (Object.is(resolved, currentRef.current)) return;
      if (!controlled) {
        // Uncontrolled: remember it now, so a second update in the same event
        // builds on this one instead of the pre-render value.
        currentRef.current = resolved;
        setInner(resolved);
      }
      onChangeRef.current?.(resolved);
    },
    [controlled],
  );

  return [current, set] as const;
}
