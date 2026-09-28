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
  HomeIcon,
} from "@/components/ui/icon";
import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";

export type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboardIcon;
  enabled: boolean;
  /** Other route roots that belong to this item (e.g. funding detail pages
   * are reached from Loans, so they light up Loans in the nav). */
  alsoMatches?: string[];
};

export type NavSection = { label: string; items: NavItem[] };

// Single source for both the desktop Sidebar and the mobile bottom nav, so a
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
      { name: "Vehicles", href: "/admin/vehicles", icon: TruckIcon, enabled: true },
      { name: "Trip Sheets", href: "/admin/trip-sheets", icon: FileTextIcon, enabled: false },
      { name: "Diesel Records", href: "/admin/diesel-records", icon: FuelIcon, enabled: true },
      { name: "Repair Records", href: "/admin/repair-records", icon: WrenchIcon, enabled: true },
      { name: "Warranty", href: "/admin/warranty", icon: PackageIcon, enabled: true },
      { name: "Technicians", href: "/admin/technicians", icon: UserCogIcon, enabled: true },
      { name: "Drivers", href: "/admin/drivers", icon: UsersIcon, enabled: true },
      { name: "Trips", href: "/admin/trip-bookings", icon: ClockIcon, enabled: true },
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
        alsoMatches: ["/admin/fundings"],
      },
      { name: "Clients", href: "/admin/clients", icon: Building2Icon, enabled: true },
      { name: "Firms & Owners", href: "/admin/entities", icon: UserIcon, enabled: true },
      { name: "Bank Accounts", href: "/admin/bank-accounts", icon: WalletIcon, enabled: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Reports", href: "/admin/reports", icon: BarChart3Icon, enabled: false },
      { name: "Activity Log", href: "/admin/activity-log", icon: ActivityIcon, enabled: true },
      { name: "Sessions", href: "/admin/sessions", icon: ShieldIcon, enabled: true },
      { name: "Settings", href: "/admin/settings", icon: SettingsIcon, enabled: true },
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

// ─── Mobile bottom tabs ──────────────────────────────────────────────────────

export type MobileTab = {
  key: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  /** Nav item hrefs that live under this tab, in chip order. */
  hrefs: string[];
};

// Four destinations plus "More" (which opens the full menu sheet). Every role
// gets the same groups; a tab only appears when the role can open at least
// one enabled page in it — a driver sees Home, Fleet (Diesel) and More.
export const mobileTabs: MobileTab[] = [
  { key: "home", label: "Home", icon: HomeIcon, hrefs: ["/admin"] },
  {
    key: "fleet",
    label: "Fleet",
    icon: TruckIcon,
    hrefs: ["/admin/vehicles", "/admin/trip-bookings", "/admin/drivers", "/admin/diesel-records"],
  },
  {
    key: "repairs",
    label: "Repairs",
    icon: WrenchIcon,
    hrefs: ["/admin/repair-records", "/admin/warranty", "/admin/technicians"],
  },
  {
    key: "money",
    label: "Money",
    icon: WalletIcon,
    hrefs: ["/admin/loans", "/admin/clients", "/admin/entities", "/admin/bank-accounts"],
  },
];

export type ResolvedMobileTab = MobileTab & { items: NavItem[]; href: string };

/** Tabs this role can use, each with its enabled, accessible items and the
 * href the tab itself opens (its first item). */
export function getMobileTabs(role: UserRole | null): ResolvedMobileTab[] {
  if (!role) return [];
  return mobileTabs
    .map((tab) => {
      const items = tab.hrefs
        .map((href) => allItems.find((i) => i.href === href))
        .filter(
          (i): i is NavItem => !!i && i.enabled && canRoleAccessPage(i.href, role),
        );
      return { ...tab, items, href: items[0]?.href ?? "" };
    })
    .filter((tab) => tab.items.length > 0);
}
