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
} from "lucide-react";
import { SignOutButton } from "@/components/signOutButton";

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
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn("border-r bg-muted/40 w-64 shrink-0", className)}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center justify-between border-b px-4 lg:h-[60px] lg:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold"
            onClick={onClose}
          >
            <Truck className="h-6 w-6" />
            <span className="text-lg font-bold tracking-tight">
              SRI SRINIVASA
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
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
                      "flex items-center gap-3 rounded-lg px-3 py-3 md:py-2 transition-all hover:text-primary active:bg-muted/80",
                      isActive
                        ? "bg-muted text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <item.icon className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="text-base md:text-sm">{item.name}</span>
                  </Link>
                );
              }

              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 md:py-2 text-muted-foreground/50 cursor-not-allowed"
                >
                  <item.icon className="h-5 w-5 md:h-4 md:w-4" />
                  <span className="text-base md:text-sm">{item.name}</span>
                  <span className="ml-auto text-xs bg-muted-foreground/10 px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                </div>
              );
            })}
            
            <div className="md:hidden mt-4 pt-4 border-t border-slate-200/60" />
            <div className="md:hidden">
              <SignOutButton variant="mobile" />
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
