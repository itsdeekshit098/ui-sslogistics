"use client";

import {
  Chip,
  Heading,
  Root,
  Subtext,
  Title,
  Value,
  toneFor,
} from "./statCard.styles";
import type { StatCardProps } from "./statCard.types";

export function StatCard({
  title,
  value,
  icon,
  subtext,
  tone,
  onClick,
  className,
  id,
  iconBgColor,
  iconColor,
  highlightColor,
}: StatCardProps) {
  const resolved = toneFor(tone);
  const interactive = Boolean(onClick);
  // Legacy fallback: a caller still on the deprecated colour props (not yet
  // migrated to `tone`) keeps its old look rather than silently losing it.
  // The stripe is sm+ only: on a two-up phone grid it read as a different
  // kind of tile from every other stat card.
  const legacy = !tone;

  return (
    <Root
      data-ui="stat-card"
      id={id}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={className}
      $tone={resolved}
      $interactive={interactive}
      $accent={legacy ? highlightColor : undefined}
    >
      <Heading>
        <Chip
          $tone={resolved}
          $background={legacy ? iconBgColor : undefined}
          $color={legacy ? iconColor : undefined}
        >
          {icon}
        </Chip>
        <Title>{title}</Title>
      </Heading>

      <Value $tone={resolved}>{value}</Value>

      {subtext && <Subtext>{subtext}</Subtext>}
    </Root>
  );
}
