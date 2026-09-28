import type { LayoutDashboardIcon } from "@/components/ui/icon";

export interface MobileDashboardModule {
  title: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  color: string;
  bgColor: string;
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
  /** Auth still resolving — module grid shows placeholders */
  loading: boolean;
  /** Alert sources still fetching — avoids a premature "All clear" */
  alertsLoading: boolean;
  alerts: MobileDashboardAlert[];
  modules: MobileDashboardModule[];
}
