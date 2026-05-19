import { LucideIcon } from "lucide-react";

export interface HomePageService {
  accent: string;
  description: string;
  icon: LucideIcon;
  title: string;
}

export interface HomePageFeature {
  description: string;
  icon: LucideIcon;
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
  icon: LucideIcon;
  label: string;
  tone: "primary" | "whatsapp";
}
