"use client";

import Link from "next/link";
import { AlertTriangleIcon, CheckCircleIcon, ChevronRightIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { MobileDashboardProps } from "./mobileDashboard.types";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Phone-width home screen: a greeting, what needs attention today, then the
 * modules as an app-launcher grid — rather than the desktop's large link
 * cards, which fit only six to a phone screen.
 */
export function MobileDashboard({
  name,
  loading,
  alertsLoading,
  alerts,
  modules,
}: MobileDashboardProps) {
  const now = new Date();
  // The full display name — these are free-form, so "first word" can be
  // something like "its" rather than a first name.
  const displayName = name?.trim();
  const enabledModules = modules.filter((m) => m.enabled);

  return (
    <div className="space-y-6 md:hidden" data-testid="mobile-dashboard">
      <header>
        <p className="text-[13px] text-muted-foreground">
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h2 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
          {greeting(now.getHours())}
          {displayName ? `, ${displayName}` : ""}
        </h2>
      </header>

      <section aria-labelledby="mobile-dashboard-attention">
        <h3
          id="mobile-dashboard-attention"
          className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Needs attention
        </h3>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <CheckCircleIcon size={20} className="shrink-0 text-success-subtle-foreground" />
            {alertsLoading ? "Checking…" : "All clear — nothing overdue or expiring soon."}
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {alerts.map((alert) => (
              <Link
                key={alert.key}
                href={alert.href}
                className="flex items-center gap-3 p-4 transition-colors active:bg-muted"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    alert.tone === "critical"
                      ? "bg-destructive-subtle text-destructive"
                      : "bg-warning-subtle text-warning-subtle-foreground",
                  )}
                >
                  <AlertTriangleIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{alert.title}</span>
                  {alert.detail && (
                    <span className="block text-xs text-muted-foreground">{alert.detail}</span>
                  )}
                </span>
                <ChevronRightIcon size={18} className="shrink-0 text-muted-foreground/60" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="mobile-dashboard-modules">
        <h3
          id="mobile-dashboard-modules"
          className="mb-3 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Modules
        </h3>
        <div className="grid grid-cols-4 gap-x-2 gap-y-5">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="h-14 w-14 animate-pulse rounded-2xl bg-muted" />
                  <span className="h-2.5 w-12 animate-pulse rounded bg-muted" />
                </div>
              ))
            : enabledModules.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`mobile-dashboard-module-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95"
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm",
                      item.bgColor,
                    )}
                  >
                    <item.icon size={24} className={item.color} />
                  </span>
                  <span className="line-clamp-2 text-[0.6875rem] font-medium leading-tight text-foreground">
                    {item.title}
                  </span>
                </Link>
              ))}
        </div>
      </section>
    </div>
  );
}
