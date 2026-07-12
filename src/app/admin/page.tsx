"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TruckIcon,
  UsersIcon,
  Building2Icon,
  FuelIcon,
  WrenchIcon,
  FileTextIcon,
  BarChart3Icon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ActivityIcon,
  RouteIcon,
  ShieldIcon,
  ShieldCheckIcon,
  UserCogIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { canRoleAccessPage, type UserRole } from "@/lib/routePermissions";

const menuItems = [
  {
    title: "Vehicles",
    description: "Manage fleet vehicles",
    href: "/admin/vehicles",
    icon: TruckIcon,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    enabled: true,
  },
  {
    title: "Drivers",
    description: "Manage driver profiles",
    href: "/admin/drivers",
    icon: UsersIcon,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    enabled: true,
  },
  {
    title: "Clients",
    description: "Manage clients & vendors",
    href: "/admin/clients",
    icon: Building2Icon,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-500/10",
    enabled: false,
  },
  {
    title: "Diesel Records",
    description: "Track fuel consumption",
    href: "/admin/diesel-records",
    icon: FuelIcon,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-500/10",
    enabled: true,
  },
  {
    title: "Repair Records",
    description: "Maintenance logs",
    href: "/admin/repair-records",
    icon: WrenchIcon,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    enabled: true,
  },
  {
    title: "Technicians",
    description: "Manage technician profiles",
    href: "/admin/technicians",
    icon: UserCogIcon,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-500/10",
    enabled: true,
  },
  {
    title: "External Trips",
    description: "Track vehicle trips & costs",
    href: "/admin/external-trips",
    icon: RouteIcon,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-50 dark:bg-sky-500/10",
    enabled: true,
  },
  {
    title: "Trip Bookings",
    description: "Advance bookings for external trips",
    href: "/admin/trip-bookings",
    icon: ClockIcon,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-500/10",
    enabled: true,
  },
  {
    title: "Trip Sheets",
    description: "Daily trip entries",
    href: "/admin/trip-sheets",
    icon: FileTextIcon,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-500/10",
    enabled: false,
  },
  {
    title: "Reports",
    description: "View analytics",
    href: "/admin/reports",
    icon: BarChart3Icon,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-500/10",
    enabled: false,
  },
  {
    title: "Activity Log",
    description: "Track all actions",
    href: "/admin/activity-log",
    icon: ActivityIcon,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-500/10",
    enabled: true,
  },
  {
    title: "Warranty Tracking",
    description: "Manage parts & warranties",
    href: "/admin/warranty",
    icon: ShieldCheckIcon,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-500/10",
    enabled: true,
  },
  {
    title: "Sessions",
    description: "Track all users sessions",
    href: "/admin/sessions",
    icon: ShieldIcon,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-500/10",
    enabled: true,
  },
];

export default function DashboardPage() {
  const { userRole, loading: authLoading } = useAuth();

  const visibleMenuItems = menuItems
    .filter((item) => {
      if (authLoading || !userRole) return false;
      return canRoleAccessPage(item.href, userRole as UserRole);
    })
    // Keep "Coming Soon" tiles out of the way at the end, without disturbing
    // relative order within the enabled/disabled groups (stable sort).
    .sort((a, b) => Number(b.enabled) - Number(a.enabled));

  const canSeeVehicles =
    !authLoading && !!userRole && canRoleAccessPage("/admin/vehicles", userRole as UserRole);

  const [expiringCounts, setExpiringCounts] = useState<{ fc: number; insurance: number } | null>(
    null,
  );

  useEffect(() => {
    if (!canSeeVehicles) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/vehicles?fcStatus=expiring_soon&pageSize=1").then((r) => r.json()),
      fetch("/api/vehicles?insuranceStatus=expiring_soon&pageSize=1").then((r) => r.json()),
    ])
      .then(([fcRes, insuranceRes]) => {
        if (cancelled) return;
        setExpiringCounts({
          fc: fcRes?.data?.total ?? 0,
          insurance: insuranceRes?.data?.total ?? 0,
        });
      })
      .catch(() => {
        // Non-critical widget — fail silently, dashboard tiles still work
      });

    return () => {
      cancelled = true;
    };
  }, [canSeeVehicles]);

  return (
    <div className="container mx-auto space-y-6 md:space-y-8">
      <div className="mb-2">
        <Button
          data-testid="app-admin-button-1"
          variant="ghost"
          className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/" data-testid="admin-dashboard-back-link">
            <ArrowLeftIcon size={16} style={{ marginRight: "0.5rem" }} />
            Back to Home
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 md:mt-2 text-base md:text-lg">
          Select a module to manage operations.
        </p>
      </div>

      {expiringCounts && (expiringCounts.fc > 0 || expiringCounts.insurance > 0) && (
        <Card className="border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/10 w-fit">
              <AlertTriangleIcon size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 text-sm text-foreground">
              {expiringCounts.fc > 0 && (
                <Link
                  href="/admin/vehicles?fcStatus=expiring_soon"
                  className="font-medium hover:underline"
                >
                  {expiringCounts.fc} vehicle{expiringCounts.fc === 1 ? "" : "s"} with FC expiring within 30 days
                </Link>
              )}
              {expiringCounts.fc > 0 && expiringCounts.insurance > 0 && (
                <span className="text-muted-foreground"> · </span>
              )}
              {expiringCounts.insurance > 0 && (
                <Link
                  href="/admin/vehicles?insuranceStatus=expiring_soon"
                  className="font-medium hover:underline"
                >
                  {expiringCounts.insurance} vehicle{expiringCounts.insurance === 1 ? "" : "s"} with insurance expiring within 30 days
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {authLoading ? (
        /* ── Skeleton grid shown while auth resolves ── */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 md:h-36 rounded-xl bg-slate-200/70 dark:bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : (
        /* ── Real module card grid ── */
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {visibleMenuItems.map((item) => {
            const isEnabled = item.enabled;

            if (isEnabled) {
              return (
                <Link
                  data-testid={`admin-dashboard-card-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  key={item.href}
                  href={item.href}
                  className="group block h-full"
                >
                  <Card
                    data-testid="app-admin-card-1"
                    className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-border/50 hover:border-primary/50 dark:hover:border-primary/50 active:scale-[0.98]"
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                      <div
                        className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${item.bgColor}`}
                      >
                        <item.icon size={24} className={item.color} />
                      </div>
                      <ArrowRightIcon
                        size={20}
                        className="text-muted-foreground/50 group-hover:text-foreground transition-colors"
                      />
                    </CardHeader>
                    <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                      <CardTitle className="text-base md:text-xl font-bold text-foreground mb-1 md:mb-2 group-hover:text-primary transition-colors">
                        {item.title}
                      </CardTitle>
                      <p className="text-xs md:text-sm text-muted-foreground font-medium hidden sm:block">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            }

            return (
              <Card
                data-testid="app-admin-card-2"
                key={item.href}
                className="h-full opacity-50 cursor-not-allowed border-dashed border-border/40"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-muted">
                    <item.icon size={24} className="text-muted-foreground/50" />
                  </div>
                  <div className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground font-medium">
                    Coming Soon
                  </div>
                </CardHeader>
                <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                  <CardTitle className="text-base md:text-xl font-bold text-muted-foreground/70 mb-1 md:mb-2">
                    {item.title}
                  </CardTitle>
                  <p className="text-xs md:text-sm text-muted-foreground/50 font-medium hidden sm:block">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
