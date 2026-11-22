import React from "react";
import type { ColumnDef } from "./dataTable.types";

export type Slot = "title" | "subtitle" | "trailing" | "field" | "footer";

/** Which part of a phone card a column belongs in. */
export function slotOf<TData>(col: ColumnDef<TData>, index: number): Slot | "hidden" {
  if (col.mobile) return col.mobile;
  if (col.key === "action" || col.key === "actions") return "footer";
  return index === 0 ? "title" : "field";
}

/** Placeholder glyphs a cell renders for "no value". */
const BLANK_TEXT = new Set(["", "—", "-", "–"]);

/**
 * True when a rendered cell carries no information — nothing at all, or
 * just a dash placeholder, possibly wrapped in a plain element such as
 * `<span className="text-muted-foreground">—</span>`. Only host elements are
 * unwrapped; a component (Badge, Money…) always counts as content.
 */
export function isBlankCell(node: React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string") return BLANK_TEXT.has(node.trim());
  if (Array.isArray(node)) return node.every(isBlankCell);
  if (React.isValidElement(node) && typeof node.type === "string") {
    return isBlankCell((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

export type CellEntry = { key: string; header: string; node: React.ReactNode };

/** The non-blank cells of one slot, for one row. */
export function renderSlot<TData>(
  cols: ColumnDef<TData>[],
  row: TData,
  index: number,
): CellEntry[] {
  return cols
    .map((col) => ({
      key: col.key,
      header: col.header,
      node: col.cell(row, index),
    }))
    .filter((entry) => !isBlankCell(entry.node));
}
