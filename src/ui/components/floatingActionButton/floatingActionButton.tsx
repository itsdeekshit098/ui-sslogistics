"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "../../icons";
import { useAccent } from "./accentContext";
import { Corner, Fab, Reason } from "./floatingActionButton.styles";
import type { FloatingActionButtonProps } from "./floatingActionButton.types";

/**
 * The page's main "create" action as a floating "+" in the bottom-right
 * corner, phone widths only. Always on screen — it used to slide away on
 * scroll-down, which read as the button disappearing just when needed.
 * Icon-only to keep content visible beneath it; the label stays as the
 * accessible name (and title) for screen readers. Hidden (via globals.css)
 * while an empty state with its own call to action is on screen.
 */
export function FloatingActionButton({
  label,
  onClick,
  icon,
  disabled,
  disabledReason,
  testId,
  accent: accentProp,
}: FloatingActionButtonProps) {
  const [showReason, setShowReason] = useState(false);
  // An explicit `accent` wins; otherwise the module colour the app provided.
  const providedAccent = useAccent();
  const accent = accentProp ?? providedAccent;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showReason) return;
    const t = setTimeout(() => setShowReason(false), 3500);
    return () => clearTimeout(t);
  }, [showReason]);

  // With a reason to explain, the button stays tappable (aria-disabled) so
  // the tap can reveal it; without one it is simply disabled.
  const explainable = disabled && !!disabledReason;

  // Portalled to <body>: pages wrap their content in an enter animation, and a
  // transformed ancestor turns `position: fixed` into "fixed to that
  // container" — the button then drifted with the page instead of staying
  // in the corner.
  if (!mounted) return null;

  return createPortal(
    <Corner data-ui="floating-action-button">
      {showReason && disabledReason && <Reason role="status">{disabledReason}</Reason>}
      <Fab
        type="button"
        data-testid={testId}
        onClick={() => (disabled ? explainable && setShowReason(true) : onClick())}
        disabled={disabled && !explainable}
        aria-disabled={disabled || undefined}
        aria-label={label}
        title={label}
        $accent={accent}
        $disabled={!!disabled}
      >
        {icon ?? <PlusIcon size={24} />}
      </Fab>
    </Corner>,
    document.body,
  );
}
