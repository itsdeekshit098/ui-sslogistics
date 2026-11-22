import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onOutside` when a pointer goes down anywhere outside every one of
 * `refs` (typically a popup and the control that opened it). Pointer-down, not
 * click, so it fires before the click that would act on whatever was hit.
 */
export function useOutsideClick(
  refs: Array<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  enabled = true,
) {
  const handler = useRef(onOutside);
  const targets = useRef(refs);
  useEffect(() => {
    handler.current = onOutside;
    targets.current = refs;
  });

  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (!node) return;
      if (targets.current.some((ref) => ref.current?.contains(node))) return;
      handler.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [enabled]);
}
