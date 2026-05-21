import type { ReactNode } from "react";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  highlightColor?: string;
  className?: string;
  id?: string;
}
