// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmModal } from "@ui/patterns/confirmModal";
import { styleOf, hasLockedRule } from "@test/uiStyles";

afterEach(cleanup);

const base = { isOpen: true, onClose: vi.fn(), onConfirm: vi.fn(), title: "Delete loan", description: "Cannot be undone." };

describe("ConfirmModal", () => {
  it("shows the title and description and fires the right callbacks", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmModal {...base} onClose={onClose} onConfirm={onConfirm} confirmText="Delete" />);
    expect(screen.getByText("Delete loan")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("components-confirmModal-confirmModal-button-2"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("components-confirmModal-confirmModal-button-1"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while loading and shows a spinner in the confirm button", () => {
    render(<ConfirmModal {...base} isLoading />);
    expect(screen.getByTestId("components-confirmModal-confirmModal-button-1")).toBeDisabled();
    const confirm = screen.getByTestId("components-confirmModal-confirmModal-button-2");
    expect(confirm).toBeDisabled();
    expect(confirm.querySelector("svg")).not.toBeNull();
  });

  it("shows an error as an alert", () => {
    render(<ConfirmModal {...base} error="Network down" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
  });

  it("is a narrow 448px dialog with even padding, locked against caller classes", () => {
    render(<ConfirmModal {...base} />);
    const dialog = screen.getByRole("dialog");
    expect(hasLockedRule(dialog)).toBe(true);
    expect(dialog.getAttribute("style")).toBeNull();
  });

  it("gives the two buttons equal width and fills the destructive one with red", () => {
    render(<ConfirmModal {...base} />);
    expect(styleOf(screen.getByTestId("components-confirmModal-confirmModal-button-1")).flex).toBe("1");
    expect(styleOf(screen.getByTestId("components-confirmModal-confirmModal-button-2"))["background-color"]).toBe("var(--destructive)");
  });
});
