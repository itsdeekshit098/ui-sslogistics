// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { styleOf, hasLockedRule } from "@test/uiStyles";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "@ui/components/modal";

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
    fireEvent.click(document.querySelector('[data-ui="modal-overlay"]')!);
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
    fireEvent.click(document.querySelector('[data-ui="modal-overlay"]')!);
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

  it("Escape closes only the topmost modal, the one opened last", () => {
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    function Both({ inner }: { inner: boolean }) {
      return (
        <>
          <Modal open onOpenChange={onOuterChange}>
            <ModalContent>
              <ModalTitle>Outer</ModalTitle>
            </ModalContent>
          </Modal>
          <Modal open={inner} onOpenChange={onInnerChange} nested>
            <ModalContent>
              <ModalTitle>Inner</ModalTitle>
            </ModalContent>
          </Modal>
        </>
      );
    }
    const { rerender } = render(<Both inner={false} />);
    rerender(<Both inner />);
    // A parent re-render with a fresh callback must not move the outer modal in front.
    rerender(<Both inner />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onInnerChange).toHaveBeenCalledWith(false);
    expect(onOuterChange).not.toHaveBeenCalled();
  });

  it("gives each open modal its own title id, so stacked dialogs are named correctly", () => {
    render(
      <>
        <Modal open onOpenChange={vi.fn()}>
          <ModalContent>
            <ModalTitle>Edit</ModalTitle>
          </ModalContent>
        </Modal>
        <Modal open onOpenChange={vi.fn()} nested>
          <ModalContent>
            <ModalTitle>Confirm</ModalTitle>
          </ModalContent>
        </Modal>
      </>,
    );
    const [edit, confirm] = screen.getAllByRole("dialog");
    expect(edit).toHaveAccessibleName("Edit");
    expect(confirm).toHaveAccessibleName("Confirm");
    expect(document.querySelectorAll("#modal-title")).toHaveLength(0);
  });

  it("a drag that starts inside the dialog and ends on the backdrop does not close it", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalTitle>T</ModalTitle>
        </ModalContent>
      </Modal>,
    );
    const overlay = document.querySelector('[data-ui="modal-overlay"]')!;
    fireEvent.mouseDown(screen.getByRole("dialog"));
    fireEvent.click(overlay); // the browser's click lands on the common ancestor
    expect(onOpenChange).not.toHaveBeenCalled();
    // The next, genuine click on the backdrop still closes it.
    fireEvent.click(overlay);
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

describe("Modal styles", () => {
  const narrow = "(max-width: 639.98px)";

  function open(nested = false) {
    render(
      <Modal open onOpenChange={() => {}} nested={nested}>
        <ModalContent style={{ maxWidth: "700px" }}>
          <ModalHeader>
            <ModalTitle>Title</ModalTitle>
          </ModalHeader>
          <ModalBody>Body</ModalBody>
          <ModalFooter>Foot</ModalFooter>
        </ModalContent>
      </Modal>,
    );
    return {
      overlay: document.querySelector('[data-ui="modal-overlay"]') as HTMLElement,
      content: screen.getByRole("dialog"),
    };
  }

  it("dims the page with a blurred overlay and centres the dialog", () => {
    const { overlay } = open();
    const css = styleOf(overlay);
    expect(css.position).toBe("fixed");
    expect(css["background-color"]).toBe("var(--overlay-background)");
    expect(css["align-items"]).toBe("center");
    expect(css["z-index"]).toBe("var(--z-modal-overlay)");
    expect(overlay.getAttribute("style")).toBeNull();
  });

  it("raises a nested modal above its parent", () => {
    const { overlay } = open(true);
    expect(styleOf(overlay)["z-index"]).toBe("var(--z-modal-nested-overlay)");
  });

  it("locks its styles against a caller's classes, as the old inline styles were", () => {
    const { overlay, content } = open();
    expect(hasLockedRule(overlay)).toBe(true);
    expect(hasLockedRule(content)).toBe(true);
    // A caller's own `style` prop is still the thing that adjusts it.
    expect(content.style.maxWidth).toBe("700px");
  });

  it("is a bordered card capped at 85% of the viewport height", () => {
    const { content } = open();
    const css = styleOf(content);
    expect(css["max-width"]).toBe("var(--modal-max-width, 512px)");
    expect(css["max-height"]).toBe("85vh");
    expect(css["background-color"]).toBe("var(--card)");
    expect(css["box-shadow"]).toBe("var(--modal-shadow)");
  });

  it("becomes a bottom sheet below 640px, beating a caller's maxWidth", () => {
    const { overlay, content } = open();
    expect(styleOf(overlay, { media: narrow })["align-items"]).toContain("flex-end");
    const sheet = styleOf(content, { media: narrow });
    expect(sheet["max-width"]).toBe("100%!important");
    expect(sheet["border-radius"]).toContain("var(--m-radius-sheet)");
    expect(styleOf(content, { media: narrow, state: "::before" }).width).toBe("2.5rem");
  });

  it("sizes the header, title, body and footer", () => {
    open();
    expect(styleOf(screen.getByText("Title"))["font-size"]).toBe("18px");
    expect(styleOf(screen.getByText("Body"))["overflow-y"]).toBe("auto");
    expect(styleOf(screen.getByText("Foot"))["justify-content"]).toBe("flex-end");
    expect(screen.getByText("Foot")).toHaveAttribute("data-ui", "modal-footer");
  });

  it("makes the close target 40px on phones", () => {
    open();
    const close = screen.getByRole("button", { name: "Close" });
    expect(styleOf(close, { media: narrow }).width).toBe("2.5rem");
    expect(styleOf(close, { state: ":hover" }).opacity).toBe("1");
  });
});