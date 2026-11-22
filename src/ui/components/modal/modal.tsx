"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../../icons";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  Body,
  CloseButton,
  Content,
  Description,
  Footer,
  Header,
  Overlay,
  Title,
} from "./modal.styles";
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
  /** Unique per modal, so stacked dialogs never share a title id. */
  titleId: string;
  /** A mouse press began inside the dialog (it may end outside: a text selection drag). */
  pressStartedInside: () => void;
  /** Reads and clears that flag. */
  takePressStartedInside: () => boolean;
}>({
  open: false,
  onOpenChange: () => {},
  titleId: "",
  pressStartedInside: () => {},
  takePressStartedInside: () => false,
});

export const Modal: FC<ModalProps> = ({
  children,
  open,
  onOpenChange,
  nested = false,
  disableBackdropClose = false,
  disableEscapeClose = false,
}) => {
  const titleId = useId();
  const pressRef = useRef(false);
  const pressStartedInside = () => {
    pressRef.current = true;
  };
  const takePressStartedInside = () => {
    const was = pressRef.current;
    pressRef.current = false;
    return was;
  };

  // The topmost open layer takes Escape: a nested modal, or a popover inside
  // this one, closes before this modal does (see useEscapeKey).
  useEscapeKey(() => onOpenChange(false), open && !disableEscapeClose);

  if (!open) return null;

  const handleOverlayClick = () => {
    // A drag that starts inside the dialog (selecting text in a field) and ends
    // on the backdrop is not a click on the backdrop.
    if (takePressStartedInside()) return;
    if (!disableBackdropClose) {
      onOpenChange(false);
    }
  };

  const modalNode = (
    <ModalContext.Provider value={{ open, onOpenChange, titleId, pressStartedInside, takePressStartedInside }}>
      <Overlay data-ui="modal-overlay" $nested={nested} onClick={handleOverlayClick}>
        {children}
      </Overlay>
    </ModalContext.Provider>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};

export const ModalContent: FC<ModalContentProps> = ({ children, ...rest }) => {
  const { onOpenChange, titleId, pressStartedInside, takePressStartedInside } =
    useContext(ModalContext);
  const contentRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on mount so screen readers and keyboard users
  // are immediately placed inside the modal.
  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  // Trap Tab/Shift+Tab focus within the dialog so keyboard focus can't
  // escape into the page behind the overlay while it's open.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !contentRef.current) return;

    const focusable = contentRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || active === contentRef.current) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <Content
      {...rest}
      data-ui="modal-content"
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1} // Makes the container programmatically focusable
      onMouseDown={pressStartedInside}
      onClick={(e) => {
        // Prevent clicks inside the modal from closing it.
        e.stopPropagation();
        takePressStartedInside();
      }}
      onKeyDown={handleKeyDown}
    >
      <CloseButton data-ui="modal-close" onClick={() => onOpenChange(false)} aria-label="Close">
        <XIcon size={16} />
      </CloseButton>
      {children}
    </Content>
  );
};

export const ModalBody: FC<ModalBodyProps> = (props) => <Body {...props} />;

export const ModalHeader: FC<ModalHeaderProps> = (props) => <Header {...props} />;

export const ModalTitle: FC<ModalTitleProps> = (props) => {
  const { titleId } = useContext(ModalContext);
  return <Title data-ui="modal-title" id={titleId || undefined} {...props} />;
};

export const ModalDescription: FC<ModalDescriptionProps> = (props) => <Description {...props} />;

export const ModalFooter: FC<ModalFooterProps> = (props) => <Footer data-ui="modal-footer" {...props} />;
