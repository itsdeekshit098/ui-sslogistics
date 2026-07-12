"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  LockIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  UserCogIcon,
  RouteIcon,
  ShieldIcon,
  PackageIcon,
  UserIcon,
  SettingsIcon,
  ClockIcon,
} from "@/components/ui/icon";
import { SignOutButton } from "@/components/signOutButton";
import { ThemeToggle } from "@/components/themeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";

const sidebarItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboardIcon,
    enabled: true,
  },
  { name: "Vehicles", href: "/admin/vehicles", icon: TruckIcon, enabled: true },
  {
    name: "Trip Sheets",
    href: "/admin/trip-sheets",
    icon: FileTextIcon,
    enabled: false,
  },
  {
    name: "Diesel Records",
    href: "/admin/diesel-records",
    icon: FuelIcon,
    enabled: true,
  },
  {
    name: "Repair Records",
    href: "/admin/repair-records",
    icon: WrenchIcon,
    enabled: true,
  },
  {
    name: "Warranty",
    href: "/admin/warranty",
    icon: PackageIcon,
    enabled: true,
  },
  {
    name: "Technicians",
    href: "/admin/technicians",
    icon: UserCogIcon,
    enabled: true,
  },
  { name: "Drivers", href: "/admin/drivers", icon: UsersIcon, enabled: true },
  {
    name: "Vehicle Owners",
    href: "/admin/vehicle-owners",
    icon: UserIcon,
    enabled: true,
  },
  {
    name: "External Trips",
    href: "/admin/external-trips",
    icon: RouteIcon,
    enabled: true,
  },
  {
    name: "Trip Bookings",
    href: "/admin/trip-bookings",
    icon: ClockIcon,
    enabled: true,
  },
  {
    name: "Clients",
    href: "/admin/clients",
    icon: Building2Icon,
    enabled: false,
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: BarChart3Icon,
    enabled: false,
  },
  {
    name: "Activity Log",
    href: "/admin/activity-log",
    icon: ActivityIcon,
    enabled: true,
  },
  {
    name: "Sessions",
    href: "/admin/sessions",
    icon: ShieldIcon,
    enabled: true,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    enabled: true,
  },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  className,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const isMobile = !!onClose;
  const { user, userRole, loading: authLoading } = useAuth();

  const filteredItems = sidebarItems
    .filter((item) => {
      if (authLoading || !userRole) return false;
      return canRoleAccessPage(item.href, userRole as UserRole);
    })
    // Keep "coming soon" items out of the way at the end, without disturbing
    // relative order within the enabled/disabled groups (stable sort).
    .sort((a, b) => Number(b.enabled) - Number(a.enabled));

  return (
    <div
      className={cn(
        "bg-[var(--sidebar-background)] text-slate-300 shrink-0 relative border-r border-[var(--sidebar-border)]/50",
        collapsed && !isMobile ? "w-[68px]" : "w-72 md:w-64",
        className,
      )}
      style={{
        transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="flex w-full h-full max-h-screen flex-col">
        {/* Brand Header */}
        <div
          className={cn(
            "flex py-3 items-center",
            collapsed && !isMobile ? "px-0 justify-center" : "px-5",
          )}
        >
          <Link
            data-testid="sidebar-logo-link"
            href="/"
            className="flex items-center justify-center gap-3 group w-full"
            onClick={onClose}
          >
            <Image
              src={collapsed && !isMobile ? "/favicon.png" : "/logo/sslogo.png"}
              alt="Sri Srinivasa Logo"
              width={collapsed && !isMobile ? 44 : 180}
              height={collapsed && !isMobile ? 44 : 33}
              style={{
                display: "block",
                width: collapsed && !isMobile ? "44px" : "180px",
                height: collapsed && !isMobile ? "44px" : "33px",
                objectFit: "contain",
                flexShrink: 0,
              }}
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto pb-3 pt-2 w-full scrollbar-custom">
          <nav
            className={cn(
              "flex flex-col gap-1 w-full",
              collapsed && !isMobile ? "px-2" : "px-3",
            )}
          >
            {authLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg animate-pulse bg-white/10",
                      collapsed && !isMobile ? "h-9 w-9 mx-auto" : "h-9 w-full",
                    )}
                  />
                ))
              : filteredItems.map((item) => {
                  const isActive = pathname === item.href;
                  const isEnabled = item.enabled;

                  const iconEl = (
                    <item.icon size={18} className="shrink-0 text-white" />
                  );

                  if (isEnabled) {
                    const link = (
                      <Link
                        data-testid={`sidebar-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center rounded-lg text-sm font-semibold text-white transition-all w-full",
                          collapsed && !isMobile
                            ? "justify-center px-2 py-2"
                            : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-[var(--sidebar-active)] shadow-md"
                            : "hover:bg-[var(--sidebar-border)]",
                        )}
                      >
                        {iconEl}
                        {(!collapsed || isMobile) && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </Link>
                    );

                    if (collapsed && !isMobile) {
                      return (
                        <Tooltip
                          key={item.href}
                          content={item.name}
                          position="right"
                        >
                          {link}
                        </Tooltip>
                      );
                    }

                    return link;
                  }

                  const disabledItem = (
                    <div
                      key={item.href}
                      className={cn(
                        "flex items-center rounded-lg text-sm font-semibold text-white/40 cursor-not-allowed w-full",
                        collapsed && !isMobile
                          ? "justify-center px-2 py-2"
                          : "gap-3 px-3 py-2",
                      )}
                    >
                      {iconEl}
                      {(!collapsed || isMobile) && (
                        <>
                          <span className="truncate">{item.name}</span>
                          <LockIcon
                            size={12}
                            className="ml-auto shrink-0 opacity-50"
                          />
                        </>
                      )}
                    </div>
                  );

                  if (collapsed && !isMobile) {
                    return (
                      <Tooltip
                        key={item.href}
                        content={
                          <span className="text-muted-foreground">
                            {item.name} (coming soon)
                          </span>
                        }
                        position="right"
                      >
                        {disabledItem}
                      </Tooltip>
                    );
                  }

                  return disabledItem;
                })}
          </nav>
        </div>

        {/* Footer — Pinned to bottom (Mobile only) */}
        {isMobile && (
          <div className="border-t border-[var(--sidebar-border)]/50 p-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--sidebar-border)]/50 mb-2">
              <span className="text-xs font-medium text-slate-400">
                Appearance
              </span>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-3 rounded-lg p-2 bg-[var(--sidebar-border)]/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-400">
                {(user?.displayName || user?.email)?.charAt(0).toUpperCase() ||
                  "U"}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-[13px] font-medium text-slate-200">
                  {user?.displayName || user?.email || "User"}
                </span>
              </div>
              <SignOutButton variant="icon" />
            </div>
          </div>
        )}

        {/* Collapse Toggle — desktop only */}
        {!isMobile && onToggleCollapse && (
          <Button
            variant="ghost"
            data-testid="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            className="absolute right-0 translate-x-1/2 top-14 -translate-y-1/2 flex h-7 w-7 p-0 cursor-pointer items-center justify-center rounded-full ring-2 ring-background border border-[var(--sidebar-border)] bg-[var(--sidebar-background)] shadow-sm hover:bg-[var(--sidebar-border)] transition-all z-50 text-slate-400 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRightIcon size={16} />
            ) : (
              <ChevronsLeftIcon size={16} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
