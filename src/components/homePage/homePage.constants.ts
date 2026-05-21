import {
  BadgeCheckIcon,
  BusIcon,
  CarIcon,
  ClockIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  PhoneIcon,
  RadarIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
} from "@/components/ui/icon";

import {
  ContactOption,
  HomePageFeature,
  HomePageMetric,
  HomePageService,
  RouteStop,
} from "./homePage.types";

export const contactPhoneNumber = "9398921370";
export const whatsappUrl = `https://wa.me/91${contactPhoneNumber}`;

export const services: HomePageService[] = [
  {
    title: "Employee Transport",
    description:
      "Shift-wise bus and cab movement for factory employees across KIA, Mobis, Faurecia, and other plants in the Penukonda industrial corridor.",
    icon: BusIcon,
    accent: "#2563eb",
  },
  {
    title: "Corporate Cars",
    description:
      "Executive travel support for client visits, plant reviews, and urgent business movement across the industrial zone.",
    icon: CarIcon,
    accent: "#dc2626",
  },
  {
    title: "Tempo Travellers",
    description:
      "Mid-sized crew mobility with route planning, driver readiness, and dispatch support for vendor park operations.",
    icon: TruckIcon,
    accent: "#7c3aed",
  },
  {
    title: "Truck Logistics",
    description:
      "Dependable auto-parts and material movement between plants, vendor parks, and industrial hubs around Penukonda.",
    icon: PackageIcon,
    accent: "#0891b2",
  },
];

export const features: HomePageFeature[] = [
  {
    label: "01",
    title: "Penukonda Industrial Hub",
    description:
      "Dedicated coverage across the KIA automotive corridor — connecting plants, vendor parks at Ammavaripalli and Gudipalli, and nearby industrial zones.",
    icon: MapPinIcon,
  },
  {
    label: "02",
    title: "Compliance & Safety",
    description:
      "Verified vehicle readiness, disciplined driver coordination, and safety-first operational routines for every trip.",
    icon: ShieldCheckIcon,
  },
  {
    label: "03",
    title: "Always-On Reliability",
    description:
      "Round-the-clock mobility support that keeps employees, materials, and plant production timelines moving.",
    icon: ClockIcon,
  },
];

export const heroMetrics: HomePageMetric[] = [
  { value: "24/7", label: "dispatch readiness" },
  { value: "4", label: "fleet categories" },
  { value: "Penukonda", label: "industrial hub" },
];

export const commandStats: HomePageMetric[] = [
  { value: "Live", label: "route status" },
  { value: "99%", label: "schedule discipline" },
  { value: "Safe", label: "fleet protocol" },
];

export const routeStops: RouteStop[] = [
  { label: "Vendor Parks", status: "Parts movement", left: "16%", top: "62%" },
  { label: "KIA Plant", status: "Employee arrival", left: "48%", top: "36%" },
  { label: "Penukonda", status: "Control hub", left: "69%", top: "68%" },
];

export const partnerNames = [
  "SLAP",
  "BOGOOK",
  "ACT",
  "SWIFT SUPPORT SERVICE",
  "SUPREME",
  "WOOYOUNG",
];

export const contactOptions: ContactOption[] = [
  {
    href: `tel:${contactPhoneNumber}`,
    label: "Call Now",
    icon: PhoneIcon,
    tone: "primary",
  },
  {
    href: whatsappUrl,
    label: "WhatsApp",
    icon: MessageCircleIcon,
    tone: "whatsapp",
  },
];

export const flowCards = [
  { icon: RadarIcon, title: "Monitor", text: "Routes, ETAs, and readiness" },
  { icon: RouteIcon, title: "Coordinate", text: "Drivers, shifts, and dispatch" },
  { icon: BadgeCheckIcon, title: "Deliver", text: "Safe, verified movement" },
];

export const proofPoints = [
  "Penukonda automotive corridor specialist",
  "Employee mobility and material movement",
  "Fast WhatsApp-first operations contact",
  "Built around safety, speed, and consistency",
];

export const ctaHighlights = [
  { icon: SparklesIcon, text: "Modern operations experience" },
  { icon: ShieldCheckIcon, text: "Safety-led execution" },
  { icon: ClockIcon, text: "Rapid response coordination" },
];
