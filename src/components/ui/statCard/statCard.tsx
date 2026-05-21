"use client";

import React from "react";
import type { StatCardProps } from "./statCard.types";
import * as styles from "./statCard.style";

export function StatCard({
  title,
  value,
  icon,
  iconBgColor = "rgba(100, 116, 139, 0.12)",
  iconColor = "var(--muted-foreground)",
  highlightColor,
  className,
  id,
}: StatCardProps) {
  return (
    <div
      id={id}
      className={className}
      style={styles.summaryCard(highlightColor)}
    >
      <div style={styles.summaryCardHeader}>
        <span style={styles.cardIconWrapper(iconBgColor, iconColor)}>
          {icon}
        </span>
        <span style={styles.summaryLabel}>{title}</span>
      </div>
      <span style={styles.summaryValue}>{value}</span>
    </div>
  );
}
