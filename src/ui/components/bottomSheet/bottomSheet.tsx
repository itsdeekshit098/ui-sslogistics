"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../../icons";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { Backdrop, Body, CloseButton, Handle, HandleRow, Header, Panel, Title } from "./bottomSheet.styles";
import type { BottomSheetProps } from "./bottomSheet.types";

/**
 * Panel that slides up from the bottom edge — the phone-native replacement
 * for a centered dialog. Sits below --z-modal-overlay (50) so a confirm
 * Modal opened from inside it (e.g. sign-out) stacks on top.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEscapeKey(onClose, open);

  // Move focus into the sheet while it's open (so keyboard and screen-reader
  // users land in it rather than on the page behind), and hand it back to
  // whatever opened it — the "⋯" or "More" button — on close.
  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <Backdrop data-ui="bottom-sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <Panel
        data-ui="bottom-sheet"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={className}
      >
        <HandleRow aria-hidden="true">
          <Handle />
        </HandleRow>
        <Header>
          <Title id={titleId}>{title}</Title>
          <CloseButton type="button" onClick={onClose} aria-label="Close">
            <XIcon size={20} />
          </CloseButton>
        </Header>
        <Body>{children}</Body>
      </Panel>
    </>,
    document.body,
  );
}
