"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Truck,
  FileText,
  Fuel,
  Users,
  BarChart3,
  LayoutDashboard,
  Building2,
  Wrench,
  Activity,
  Lock,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { SignOutButton } from "@/components/signOutButton";
import { ThemeToggle } from "@/components/themeToggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";

const sidebarItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    enabled: true,
  },
  { name: "Vehicles", href: "/admin/vehicles", icon: Truck, enabled: true },
  {
    name: "Trip Sheets",
    href: "/admin/trip-sheets",
    icon: FileText,
    enabled: false,
  },
  {
    name: "Diesel Records",
    href: "/admin/diesel-records",
    icon: Fuel,
    enabled: true,
  },
  {
    name: "Repair Records",
    href: "/admin/repair-records",
    icon: Wrench,
    enabled: false,
  },
  { name: "Drivers", href: "/admin/drivers", icon: Users, enabled: false },
  { name: "Clients", href: "/admin/clients", icon: Building2, enabled: false },
  { name: "Reports", href: "/admin/reports", icon: BarChart3, enabled: false },
  {
    name: "Activity Log",
    href: "/admin/activity-log",
    icon: Activity,
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
  const { userRole } = useAuth();

  const filteredItems = sidebarItems.filter((item) => {
    if (userRole === "driver") {
      if (item.name === "Vehicles" || item.name === "Activity Log") {
        return false;
      }
    }
    return true;
  });

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "bg-[#12203d] text-slate-300 shrink-0 transition-all duration-300 relative border-r border-[#263762]/50",
          collapsed && !isMobile ? "w-[68px]" : "w-72 md:w-64",
          className,
        )}
      >
        <div className="flex w-full h-full max-h-screen flex-col">
          {/* Brand Header */}
          <div
            className={cn(
              "flex h-16 items-center",
              collapsed && !isMobile ? "px-3 justify-center" : "px-5",
            )}
          >
            <Link
              data-testid="sidebar-logo-link"
              href="/"
              className="flex items-center gap-3 group"
              onClick={onClose}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shrink-0">
                <Truck className="h-5 w-5 text-[#12203d]" />
              </div>
              {(!collapsed || isMobile) && (
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold tracking-tight text-white leading-none">
                    SRI SRINIVASA
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase mt-0.5">
                    Secure Logistics
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto pb-3 pt-6 w-full">
            <nav
              className={cn(
                "flex flex-col gap-0.5 w-full",
                collapsed && !isMobile ? "px-2" : "px-3",
              )}
            >
              {filteredItems.map((item) => {
                const isActive = pathname === item.href;
                const isEnabled = item.enabled;

                const iconEl = (
                  <item.icon
                    className={cn("h-[18px] w-[18px] shrink-0 text-white")}
                  />
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
                          ? "justify-center px-2 py-2.5"
                          : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-[#2563EB] shadow-md"
                          : "hover:bg-[#263762]",
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
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                        </TooltipContent>
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
                        ? "justify-center px-2 py-2.5"
                        : "gap-3 px-3 py-2.5",
                    )}
                  >
                    {iconEl}
                    {(!collapsed || isMobile) && (
                      <>
                        <span className="truncate">{item.name}</span>
                        <Lock className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                      </>
                    )}
                  </div>
                );

                if (collapsed && !isMobile) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{disabledItem}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        <span className="text-muted-foreground">
                          {item.name} (coming soon)
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return disabledItem;
              })}
            </nav>
          </div>

          {/* Footer — Pinned to bottom */}
          <div
            className={cn(
              "border-t border-[#263762]/50 space-y-2",
              collapsed && !isMobile ? "p-2" : "p-3",
            )}
          >
            {collapsed && !isMobile ? (
              <>
                <div className="flex justify-center py-1">
                  <ThemeToggle />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <SignOutButton variant="icon" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Sign Out
                  </TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[#263762]/50">
                  <span className="text-xs font-medium text-slate-400">
                    Appearance
                  </span>
                  <ThemeToggle />
                </div>
                <SignOutButton variant="mobile" />
              </>
            )}
          </div>

          {/* Collapse Toggle — desktop only */}
          {!isMobile && onToggleCollapse && (
            <button
              data-testid="sidebar-toggle-btn"
              onClick={onToggleCollapse}
              className="absolute -right-3.5 top-[76px] -translate-y-1/2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full ring-2 ring-background border border-[#263762] bg-[#12203d] shadow-sm hover:bg-[#263762] transition-all z-50 text-slate-400 hover:text-white"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
