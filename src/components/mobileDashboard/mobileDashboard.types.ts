import type { LayoutDashboardIcon } from "@/components/ui/icon";

export interface MobileDashboardModule {
  title: string;
  description: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  /** Tailwind text colour for the icon */
  color: string;
  /** Tailwind background for the icon tile */
  bgColor: string;
  /** Hex module colour for the tile's accent strip and shadow */
  accent: string;
  enabled: boolean;
}

export interface MobileDashboardAlert {
  key: string;
  href: string;
  title: string;
  detail?: React.ReactNode;
  tone: "critical" | "warning";
}

export interface MobileDashboardProps {
  name: string | null;
  role: string | null;
  /** Auth still resolving — module grid shows placeholders */
  loading: boolean;
  /** Alert sources still fetching — avoids a premature "All clear" */
  alertsLoading: boolean;
  alerts: MobileDashboardAlert[];
  modules: MobileDashboardModule[];
}
