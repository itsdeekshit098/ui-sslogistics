// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Menu } from "@ui/components/menu";
import { styleOf, isInUiLayer } from "@test/uiStyles";

const isMobileMock = vi.fn();
vi.mock("@ui/hooks/useIsMobile", () => ({ useIsMobile: () => isMobileMock() }));

beforeEach(() => isMobileMock.mockReturnValue(false));
afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof Menu>> = {}) {
  const actions = { edit: vi.fn(), remove: vi.fn(), locked: vi.fn() };
  render(
    <Menu
      label="Row actions"
      trigger={(props) => (
        <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)} ref={props.ref as React.Ref<HTMLButtonElement>}>
          ⋯
        </button>
      )}
      items={[
        { key: "edit", label: "Edit", onSelect: actions.edit },
        { key: "locked", label: "Archive", onSelect: actions.locked, disabled: true, disabledReason: "Settled loans can't be archived" },
        { key: "remove", label: "Delete", onSelect: actions.remove, tone: "danger", separatorBefore: true },
      ]}
      {...overrides}
    />,
  );
  return actions;
}
const open = () => fireEvent.click(screen.getByRole("button", { name: "⋯" }));

describe("Menu (desktop)", () => {
  it("is closed until the trigger is clicked, and tells assistive tech it has a popup", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "⋯" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
    open();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Row actions" })).toBeInTheDocument();
  });

  it("lists the items as menu items, with a separator", () => {
    setup();
    open();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Edit",
      "ArchiveSettled loans can't be archived",
      "Delete",
    ]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("focuses the first item when it opens", () => {
    setup();
    open();
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Edit" }));
  });

  it("moves focus with the arrow keys, skipping disabled items and wrapping", () => {
    setup();
    open();
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" })); // Archive is disabled
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Edit" })); // wrapped
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  });

  it("jumps to the ends with Home and End", () => {
    setup();
    open();
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Edit" }));
  });

  it("chooses an item: runs it, closes the menu and returns focus to the trigger", () => {
    const actions = setup();
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(actions.remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "⋯" }));
  });

  it("does not run a disabled item", () => {
    const actions = setup();
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive/ }));
    expect(actions.locked).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: /Archive/ })).toBeDisabled();
  });

  it("closes on Escape and on Tab", () => {
    setup();
    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    open();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens from the keyboard with ArrowDown on the trigger", () => {
    setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "⋯" }), { key: "ArrowDown" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("styles a danger item red and a disabled one dim", () => {
    setup();
    open();
    expect(isInUiLayer(screen.getByRole("menuitem", { name: "Delete" }))).toBe(true);
    expect(styleOf(screen.getByRole("menuitem", { name: "Delete" })).color).toBe("var(--destructive)");
    expect(styleOf(screen.getByRole("menuitem", { name: "Edit" })).color).toBe("var(--foreground)");
    expect(styleOf(screen.getByRole("menuitem", { name: /Archive/ }), { state: ":disabled" }).opacity).toBe("50%");
  });

  it("makes the rows thumb-sized on phones", () => {
    setup();
    open();
    expect(styleOf(screen.getByRole("menuitem", { name: "Edit" }), { media: "(max-width: 767.98px)" })["min-height"]).toBe("var(--space-12)");
  });
});

describe("Menu (phone)", () => {
  it("opens as a bottom sheet titled with the label", () => {
    isMobileMock.mockReturnValue(true);
    setup();
    open();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Row actions")).toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("runs an item and closes the sheet", () => {
    isMobileMock.mockReturnValue(true);
    const actions = setup();
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(actions.edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
