// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@ui/components/table";

import { styleOf, isInUiLayer } from "@test/uiStyles";
afterEach(cleanup);

describe("Table primitives", () => {
  it("renders a full table structure with the right semantic elements", () => {
    render(
      <Table>
        <TableCaption>A caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("A caption").tagName).toBe("CAPTION");
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument();
  });
});

describe("Table styles", () => {
  function render_() {
    return render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-state="selected">
            <TableCell>Ravi</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
  }

  it("scrolls horizontally inside a full-width box and sets the table at 14px", () => {
    const { container } = render_();
    const table = container.querySelector("table") as HTMLElement;
    expect(isInUiLayer(table)).toBe(true);
    expect(styleOf(table).width).toBe("100%");
    expect(styleOf(table)["font-size"]).toBe("0.875rem");
    expect(styleOf(table.parentElement!).overflow).toBe("auto");
  });

  it("sets header cells at 48px in muted text and body cells with 16px padding", () => {
    render_();
    const head = styleOf(screen.getByText("Name"));
    expect(head.height).toBe("var(--space-12)");
    expect(head.color).toBe("var(--muted-foreground)");
    expect(styleOf(screen.getByText("Ravi")).padding).toBe("var(--space-4)");
  });

  it("highlights a selected row and tints the footer", () => {
    render_();
    const selected = screen.getByText("Ravi").closest("tr")!;
    expect(styleOf(selected, { state: '[data-state="selected"]' })["background-color"]).toBe("var(--muted)");
    expect(styleOf(screen.getByText("Total").closest("tfoot")!)["font-weight"]).toBe("500");
  });
});