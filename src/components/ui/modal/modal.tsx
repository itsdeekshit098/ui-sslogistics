"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/ui/icon";
import * as styles from "./modal.style";
import type {
  ModalProps,
  ModalContentProps,
  ModalBodyProps,
  ModalHeaderProps,
  ModalFooterProps,
  ModalTitleProps,
  ModalDescriptionProps,
} from "./modal.types";

const ModalContext = createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

export const Modal: React.FC<ModalProps> = ({
  children,
  open,
  onOpenChange,
  nested = false,
  disableBackdropClose = false,
  disableEscapeClose = false,
}) => {
  useEffect(() => {
    if (!open || disableEscapeClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation(); // Prevent parent modals from also closing
        onOpenChange(false);
      }
    };
    // Use capture: false (default) so that the most recently mounted modal
    // (the topmost/nested one) gets its handler registered last.
    // stopImmediatePropagation ensures only the topmost handler fires.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange, disableEscapeClose]);

  if (!open) return null;

  // Add global keyframes for simple animation without requiring external CSS files or Tailwind
  const animationStyles = `
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `;

  const handleOverlayClick = () => {
    if (!disableBackdropClose) {
      onOpenChange(false);
    }
  };

  const modalNode = (
    <ModalContext.Provider value={{ open, onOpenChange }}>
      <style>{animationStyles}</style>
      <div
        style={{
          ...styles.overlay,
          zIndex: nested ? 10000 : styles.overlay.zIndex,
        }}
        onClick={handleOverlayClick}
      >
        {children}
      </div>
    </ModalContext.Provider>
  );

  if (nested && typeof document !== "undefined") {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};

export const ModalContent: React.FC<ModalContentProps> = ({
  children,
  style,
  className,
}) => {
  const { onOpenChange } = useContext(ModalContext);
  const contentRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on mount so screen readers and keyboard users
  // are immediately placed inside the modal.
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  return (
    <div
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1} // Makes the container programmatically focusable
      style={{ ...styles.modalContainer, ...style }}
      className={className}
      onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
    >
      <button
        style={styles.closeButton}
        onClick={() => onOpenChange(false)}
        aria-label="Close"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
        }}
      >
        <XIcon size={16} />
      </button>
      {children}
    </div>
  );
};

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  style,
  className,
}) => (
  <div style={{ ...styles.body, ...style }} className={className}>
    {children}
  </div>
);

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  style,
  className,
}) => (
  <div style={{ ...styles.header, ...style }} className={className}>
    {children}
  </div>
);

export const ModalTitle: React.FC<ModalTitleProps> = ({
  children,
  style,
  className,
}) => (
  <h2
    id="modal-title"
    style={{ ...styles.title, ...style }}
    className={className}
  >
    {children}
  </h2>
);

export const ModalDescription: React.FC<ModalDescriptionProps> = ({
  children,
  style,
  className,
}) => (
  <p style={{ ...styles.description, ...style }} className={className}>
    {children}
  </p>
);

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  style,
  className,
}) => (
  <div style={{ ...styles.footer, ...style }} className={className}>
    {children}
  </div>
);
