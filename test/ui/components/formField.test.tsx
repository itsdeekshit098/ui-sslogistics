// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FormField } from "@ui/components/formField";
import { Input } from "@ui/components/input";
import { styleOf, isInUiLayer } from "@test/uiStyles";

afterEach(cleanup);

describe("FormField", () => {
  it("wires the label to a control rendered with the provided props", () => {
    render(<FormField label="Name">{(control) => <Input {...control} />}</FormField>);
    const input = screen.getByLabelText("Name");
    expect(input.tagName).toBe("INPUT");
  });

  it("uses htmlFor when the control is passed as an element with its own id", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
  });

  it("marks a required field on the label and the control", () => {
    render(
      <FormField label="Name" required>
        {(control) => <Input {...control} />}
      </FormField>,
    );
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("describes the control with its hint", () => {
    render(
      <FormField label="Loan number" hint="As printed on the statement">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Loan number");
    const hint = screen.getByText("As printed on the statement");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("shows an error as an alert, marks the control invalid and describes it with the error", () => {
    render(
      <FormField label="Amount" hint="In rupees" error="Enter an amount">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Amount");
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter an amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByText("In rupees").id);
  });

  it("is valid and undescribed when there is no hint or error", () => {
    render(<FormField label="Name">{(control) => <Input {...control} />}</FormField>);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("stacks label, control and messages with a gap, and colours the error", () => {
    const { container } = render(
      <FormField label="A" error="Bad">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const root = container.querySelector('[data-ui="form-field"]') as HTMLElement;
    expect(isInUiLayer(root)).toBe(true);
    expect(styleOf(root)["flex-direction"]).toBe("column");
    expect(styleOf(root).gap).toBe("var(--space-2)");
    expect(styleOf(screen.getByRole("alert")).color).toBe("var(--destructive)");
  });
});
