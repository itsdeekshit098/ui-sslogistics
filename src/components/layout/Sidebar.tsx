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
} from "lucide-react";
import { SignOutButton } from "@/components/signOutButton";
import { ThemeToggle } from "@/components/themeToggle";

const sidebarItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    enabled: true,
  },
  { name: "Vehicles", href: "/admin/vehicles", icon: Truck, enabled: true },
  { name: "Trip Sheets", href: "/admin/trip-sheets", icon: FileText, enabled: false },
  {
    name: "Diesel Records",
    href: "/admin/diesel-records",
    icon: Fuel,
    enabled: false,
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
  { name: "Activity Log", href: "/admin/activity-log", icon: Activity, enabled: true },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("bg-card w-72 md:w-64 shrink-0", className)}>
      <div className="flex w-full h-full max-h-screen flex-col">
        {/* Brand Header */}
        <div className="flex h-16 items-center border-b border-border/50 px-5">
          <Link
            href="/"
            className="flex items-center gap-3 group"
            onClick={onClose}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
              <Truck className="h-5 w-5 text-brand" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight text-brand leading-none">
                SRI SRINIVASA
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-0.5">
                Secure Logistics
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3 w-full">
          <nav className="flex flex-col gap-0.5 px-3 w-full">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              const isEnabled = item.enabled;

              if (isEnabled) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all w-full",
                      isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <item.icon className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      isActive && "text-primary"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              }

              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/40 cursor-not-allowed w-full"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.name}</span>
                  <Lock className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer — Pinned to bottom */}
        <div className="border-t border-border/50 p-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
          <SignOutButton variant="mobile" />
        </div>
      </div>
    </div>
  );
}
