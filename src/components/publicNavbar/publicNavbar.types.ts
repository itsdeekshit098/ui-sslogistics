import type { ComponentIcon } from "@ui/icons";

export interface PublicNavbarProps {
  portalHref?: string;
}

export interface PublicNavItem {
  href: string;
  label: string;
  icon: ComponentIcon;
}
