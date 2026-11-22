"use client";

import type { HTMLAttributes } from "react";
import { Grid } from "./formGrid.styles";

export interface FormGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns from the sm breakpoint up. Always one on a phone. Default 2. */
  columns?: 1 | 2 | 3;
}

/** Lays form fields out in a responsive grid: a single column on phones, `columns` wider up. */
export function FormGrid({ columns = 2, ...props }: FormGridProps) {
  return <Grid data-ui="form-grid" $columns={columns} {...props} />;
}
