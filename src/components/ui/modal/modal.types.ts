import { ReactNode, CSSProperties } from "react";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** 
   * Useful when rendering a modal inside another overlay component.
   * If true, renders the modal using a React Portal on document.body and increases z-index to 10000.
   */
  nested?: boolean;
  /**
   * If true, clicking the backdrop overlay will NOT close the modal.
   * User must use explicit close actions (buttons, X icon).
   */
  disableBackdropClose?: boolean;
  /**
   * If true, pressing the Escape key will NOT close the modal.
   */
  disableEscapeClose?: boolean;
}

export interface ModalContentProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export interface ModalBodyProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export interface ModalHeaderProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export interface ModalFooterProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export interface ModalTitleProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export interface ModalDescriptionProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}
