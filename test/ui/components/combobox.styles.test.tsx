// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Combobox, ComboboxFooterAction } from "@ui/components/combobox";
import { styleOf, isInUiLayer } from "@test/uiStyles";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Option = { id: number; name: string; note?: string };
const options: Option[] = [
  { id: 1, name: "Alpha", note: "first" },
  { id: 2, name: "Beta" },
];

function box(extra: Partial<React.ComponentProps<typeof Combobox<Option>>> = {}) {
  return (
    <Combobox<Option>
      id="c"
      options={options}
      value="2"
      onValueChange={() => {}}
      getOptionLabel={(o) => o.name}
      getOptionValue={(o) => String(o.id)}
      getOptionDescription={(o) => o.note}
      placeholder="Search"
      emptyMessage="Nothing"
      {...extra}
    />
  );
}

describe("Combobox styles", () => {
  it("puts the field's text clear of the icons on both sides", () => {
    render(box());
    const input = screen.getByRole("combobox");
    expect(isInUiLayer(input)).toBe(true);
    const css = styleOf(input);
    expect(css["padding-left"]).toBe("var(--space-9)");
    expect(css["padding-right"]).toBe("var(--space-16)");
  });

  it("marks an invalid field in the destructive colour", () => {
    render(box({ invalid: true }));
    const input = screen.getByRole("combobox");
    expect(styleOf(input)["border-color"]).toBe("var(--destructive)");
    expect(styleOf(input, { state: ":focus-visible" })["box-shadow"]).toContain("var(--destructive)");
  });

  it("opens a fixed listbox placed with custom properties", async () => {
    render(box({ value: "" }));
    fireEvent.focus(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    expect(styleOf(listbox).position).toBe("fixed");
    expect(styleOf(listbox)["z-index"]).toBe("var(--z-popover)");
    expect(styleOf(listbox)["border-color"]).toBe("var(--popup-border)");
    expect(listbox.getAttribute("style")).toMatch(/--cb-left/);
    expect(listbox.getAttribute("style")).not.toMatch(/(^|;)\s*(top|left|width)\s*:/);
  });

  it("highlights the active option and bolds the selected one", async () => {
    render(box({ value: "" }));
    fireEvent.focus(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    const [first, second] = screen.getAllByRole("option");
    expect(styleOf(first)["background-color"]).toBe("var(--secondary)"); // highlighted
    expect(styleOf(second)["background-color"]).toBeUndefined();
    cleanup();
    render(box({ value: "2" }));
    fireEvent.focus(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    expect(styleOf(screen.getByRole("option"))["font-weight"]).toBe("600");
  });

  it("shows the option description in small muted text", async () => {
    render(box({ value: "" }));
    fireEvent.focus(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    expect(styleOf(screen.getByText("first")).color).toBe("var(--muted-foreground)");
  });

  it("renders a footer action with a top border that does not close the list on pointer-down", async () => {
    const onClick = vi.fn();
    render(box({ value: "", footer: <ComboboxFooterAction onClick={onClick}>Add new</ComboboxFooterAction> }));
    fireEvent.focus(screen.getByRole("combobox"));
    const action = await screen.findByRole("button", { name: "Add new" });
    const css = styleOf(action);
    expect(css["border-top-width"]).toBe("1px");
    expect(css.color).toBe("var(--primary)");
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
  });
});
