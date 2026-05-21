import type { ComponentIcon } from "@/components/ui/icon";

export interface PublicNavbarProps {
  portalHref?: string;
}

export interface PublicNavItem {
  href: string;
  label: string;
  icon: ComponentIcon;
}
