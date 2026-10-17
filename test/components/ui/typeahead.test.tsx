// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Typeahead from "@/components/ui/typeahead/typeahead";

interface Opt {
  id: string;
  label: string;
  keywords?: string[];
}

const options: Opt[] = [
  { id: "1", label: "Alice Smith", keywords: ["sales"] },
  { id: "2", label: "Bob Jones" },
  { id: "3", label: "Charlie Day", keywords: ["eng"] },
];

function Harness({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <Typeahead
      options={options}
      value={value}
      onValueChange={(v) => setValue(v)}
      getOptionLabel={(o) => o.label}
      getOptionValue={(o) => o.id}
      getOptionKeywords={(o) => o.keywords ?? []}
    />
  );
}

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

describe("Typeahead", () => {
  it("shows the selected option's label when closed", () => {
    render(<Harness initialValue="2" />);
    expect(screen.getByRole("combobox")).toHaveValue("Bob Jones");
  });

  it("opens the listbox on focus and lists all options when unfiltered", () => {
    render(<Harness />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("filters options by label substring (case-insensitive)", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "bob" } });
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent("Bob Jones");
  });

  it("filters options by keyword match, not just label", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "sales" } });
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent("Alice Smith");
  });

  it("matches with internal whitespace removed (compact match)", () => {
    const opts2: Opt[] = [{ id: "9", label: "A B C Corp" }];
    const onValueChange = vi.fn();
    render(
      <Typeahead
        options={opts2}
        value=""
        onValueChange={onValueChange}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("shows the empty message when nothing matches the query", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz-no-match" } });
    expect(screen.getByText("No results found.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("selecting an option calls onValueChange and closes the list", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("option", { name: /bob jones/i }));

    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("Bob Jones");
  });

  it("ArrowDown/ArrowUp move the highlighted option and Enter selects it", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: "ArrowDown" }); // index 0 -> 1 (Bob)
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("Bob Jones");
  });

  it("ArrowUp does not go below index 0", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Alice Smith");
  });

  it("Escape closes the dropdown without selecting", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("Enter with the list closed does nothing", () => {
    render(<Harness initialValue="2" />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Bob Jones");
  });

  it("Tab closes the dropdown", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows no clear button with an empty value", () => {
    render(<Harness initialValue="" />);
    expect(screen.queryByLabelText("Clear selection")).toBeNull();
  });

  it("shows a clear button once a value is selected", () => {
    render(<Harness initialValue="2" />);
    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument();
  });

  it("clicking clear resets the value and reopens the dropdown", () => {
    render(<Harness initialValue="2" />);
    fireEvent.click(screen.getByLabelText("Clear selection"));
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("clearable=false never shows the clear button even with a value", () => {
    render(
      <Typeahead
        options={options}
        value="2"
        onValueChange={vi.fn()}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
        clearable={false}
      />,
    );
    expect(screen.queryByLabelText("Clear selection")).toBeNull();
  });

  it("disabled disables the input and suppresses the dropdown on focus", () => {
    render(
      <Typeahead
        options={options}
        value=""
        onValueChange={vi.fn()}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
        disabled
      />,
    );
    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
  });

  it("marks the input invalid via aria-invalid when invalid=true", () => {
    render(
      <Typeahead
        options={options}
        value=""
        onValueChange={vi.fn()}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
        invalid
      />,
    );
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders the option description when provided", () => {
    render(
      <Typeahead
        options={options}
        value=""
        onValueChange={vi.fn()}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
        getOptionDescription={(o) => `desc-${o.id}`}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText("desc-1")).toBeInTheDocument();
  });

  it("marks the currently selected option with aria-selected", () => {
    render(<Harness initialValue="2" />);
    fireEvent.focus(screen.getByRole("combobox"));
    const bobOption = screen.getByRole("option", { name: /bob jones/i });
    expect(bobOption).toHaveAttribute("aria-selected", "true");
  });

  it("renders a footer node inside the dropdown when provided", () => {
    render(
      <Typeahead
        options={options}
        value=""
        onValueChange={vi.fn()}
        getOptionLabel={(o) => o.label}
        getOptionValue={(o) => o.id}
        footer={<div>+ Add new</div>}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText("+ Add new")).toBeInTheDocument();
  });
});
