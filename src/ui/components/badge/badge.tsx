"use client";

import { Dot, StyledBadge } from "./badge.styles";
import type { BadgeProps } from "./badge.types";

export function Badge({ variant = "default", dot, children, ...props }: BadgeProps) {
  return (
    <StyledBadge data-ui="badge" $variant={variant} {...props}>
      {dot && <Dot aria-hidden="true" />}
      {children}
    </StyledBadge>
  );
}
