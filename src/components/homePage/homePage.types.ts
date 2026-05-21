import type { ComponentIcon } from "@/components/ui/icon";

export interface HomePageService {
  accent: string;
  description: string;
  icon: ComponentIcon;
  title: string;
}

export interface HomePageFeature {
  description: string;
  icon: ComponentIcon;
  label: string;
  title: string;
}

export interface HomePageMetric {
  label: string;
  value: string;
}

export interface RouteStop {
  label: string;
  left: string;
  status: string;
  top: string;
}

export interface ContactOption {
  href: string;
  icon: ComponentIcon;
  label: string;
  tone: "primary" | "whatsapp";
}
