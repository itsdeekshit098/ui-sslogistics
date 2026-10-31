import {
  TruckIcon,
  FileTextIcon,
  FuelIcon,
  UsersIcon,
  BarChart3Icon,
  LayoutDashboardIcon,
  Building2Icon,
  WrenchIcon,
  ActivityIcon,
  UserCogIcon,
  ShieldIcon,
  PackageIcon,
  UserIcon,
  SettingsIcon,
  ClockIcon,
  LandmarkIcon,
  WalletIcon,
  CalendarIcon,
  HandCoinsIcon,
} from "@/components/ui/icon";
import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";

export type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  enabled: boolean;
  /** Phone "+" button colour — the Flutter app's module colour. */
  accent?: string;
  /** Other route roots that belong to this item (e.g. funding detail pages
   * are reached from Loans, so they light up Loans in the nav). */
  alsoMatches?: string[];
};

export type NavSection = { label: string; items: NavItem[] };

// Single source for both the desktop Sidebar and the phone drawer, so a
// new page only has to be added once and role filtering can't drift between
// the two.
// Grouped rather than one flat 17-item list — now that Loans/Clients/Firms
// & Owners sit alongside fleet operations, giving them their own labeled
// section makes that distinction visible instead of just another row.
export const navSections: NavSection[] = [
  {
    label: "Operations",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboardIcon, enabled: true },
      { name: "Vehicles", href: "/admin/vehicles", accent: "#2563eb", icon: TruckIcon, enabled: true },
      { name: "Trip Sheets", href: "/admin/trip-sheets", accent: "#4f46e5", icon: FileTextIcon, enabled: false },
      { name: "Diesel Records", href: "/admin/diesel-records", accent: "#ea580c", icon: FuelIcon, enabled: true },
      { name: "Repair Records", href: "/admin/repair-records", accent: "#dc2626", icon: WrenchIcon, enabled: true },
      { name: "Warranty", href: "/admin/warranty", accent: "#e11d48", icon: PackageIcon, enabled: true },
      { name: "Technicians", href: "/admin/technicians", accent: "#059669", icon: UserCogIcon, enabled: true },
      { name: "Drivers", href: "/admin/drivers", accent: "#16a34a", icon: UsersIcon, enabled: true },
      { name: "Attendance", href: "/admin/attendance", accent: "#0d9488", icon: CalendarIcon, enabled: true },
      { name: "Trips", href: "/admin/trip-bookings", accent: "#d97706", icon: ClockIcon, enabled: true },
    ],
  },
  {
    label: "Money",
    items: [
      {
        name: "Loans",
        href: "/admin/loans",
        icon: LandmarkIcon,
        enabled: true,
        accent: "#1e40af",
        alsoMatches: ["/admin/fundings"],
      },
      { name: "Clients", href: "/admin/clients", accent: "#9333ea", icon: Building2Icon, enabled: true },
      { name: "Firms & Owners", href: "/admin/entities", accent: "#7c3aed", icon: UserIcon, enabled: true },
      { name: "Bank Accounts", href: "/admin/bank-accounts", accent: "#0f766e", icon: WalletIcon, enabled: true },
      { name: "Salaries", href: "/admin/salaries", accent: "#059669", icon: HandCoinsIcon, enabled: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Reports", href: "/admin/reports", accent: "#0891b2", icon: BarChart3Icon, enabled: false },
      { name: "Activity Log", href: "/admin/activity-log", accent: "#0d9488", icon: ActivityIcon, enabled: true },
      { name: "Sessions", href: "/admin/sessions", accent: "#0d9488", icon: ShieldIcon, enabled: true },
      { name: "Settings", href: "/admin/settings", accent: "#64748b", icon: SettingsIcon, enabled: true },
    ],
  },
];

/** Sections with only the items this role may open; empty sections dropped.
 * "Coming soon" items sink to the end of their own section. */
export function filterNavSections(role: UserRole | null): NavSection[] {
  if (!role) return [];
  return navSections
    .map((section) => ({
      label: section.label,
      items: section.items
        .filter((item) => canRoleAccessPage(item.href, role))
        .sort((a, b) => Number(b.enabled) - Number(a.enabled)),
    }))
    .filter((section) => section.items.length > 0);
}

const allItems = navSections.flatMap((s) => s.items);

function itemRoots(item: NavItem): string[] {
  return [item.href, ...(item.alsoMatches ?? [])];
}

/** The nav item a pathname belongs to (longest matching root wins), and
 * whether the path is deeper than that item's own list page. */
export function matchNavItem(
  pathname: string,
): { item: NavItem; isDetail: boolean } | null {
  let best: { item: NavItem; root: string } | null = null;
  for (const item of allItems) {
    for (const root of itemRoots(item)) {
      const hit = pathname === root || pathname.startsWith(root + "/");
      if (hit && (!best || root.length > best.root.length)) best = { item, root };
    }
  }
  if (!best) return null;
  return { item: best.item, isDetail: pathname !== best.item.href };
}
