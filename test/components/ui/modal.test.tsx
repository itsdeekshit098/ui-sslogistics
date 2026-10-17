// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal/modal";

afterEach(cleanup);

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onOpenChange={vi.fn()}>
        <ModalContent>
          <ModalTitle>Title</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog when open", () => {
    render(
      <Modal open onOpenChange={vi.fn()}>
        <ModalContent>
          <ModalTitle>My Modal</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("My Modal")).toBeInTheDocument();
  });

  it("clicking the overlay closes the modal by default", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.click(document.querySelector(".ss-modal-overlay")!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disableBackdropClose prevents the overlay click from closing", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} disableBackdropClose>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.click(document.querySelector(".ss-modal-overlay")!);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("clicking inside the modal content does not close it (stopPropagation)", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("the close (X) button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pressing Escape closes the modal", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disableEscapeClose prevents Escape from closing", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} disableEscapeClose>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("only the first-registered modal's Escape handler fires (stopImmediatePropagation)", () => {
    // Both modals attach a window "keydown" listener in a mount effect, in
    // mount order. The real app relies on the *outer* modal having mounted
    // (and so attached its listener) before a nested one opens on top of
    // it, so the nested modal's handler runs first and stops the rest via
    // stopImmediatePropagation — see the comment in modal.tsx. Rendering
    // them already-both-open reverses that: whichever attaches its
    // listener first wins, which is the outer one here.
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <>
        <Modal open onOpenChange={onOuterChange}>
          <ModalContent>
            <ModalTitle>Outer</ModalTitle>
          </ModalContent>
        </Modal>
        <Modal open onOpenChange={onInnerChange} nested>
          <ModalContent>
            <ModalTitle>Inner</ModalTitle>
          </ModalContent>
        </Modal>
      </>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOuterChange).toHaveBeenCalledWith(false);
    expect(onInnerChange).not.toHaveBeenCalled();
  });

  it("renders header/body/footer slots", () => {
    render(
      <Modal open onOpenChange={vi.fn()}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Head</ModalTitle>
          </ModalHeader>
          <ModalBody>Body text</ModalBody>
          <ModalFooter>Footer text</ModalFooter>
        </ModalContent>
      </Modal>,
    );
    expect(screen.getByText("Head")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    expect(screen.getByText("Footer text")).toBeInTheDocument();
  });
});
