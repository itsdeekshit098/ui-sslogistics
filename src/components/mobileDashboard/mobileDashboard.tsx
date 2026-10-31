"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  LockIcon,
  MenuIcon,
} from "@/components/ui/icon";
import { NotificationBell } from "@/components/notificationBell";
import { useOpenMobileDrawer } from "@/components/layout/mobileDrawer";
import { cn } from "@/lib/utils";
import type { MobileDashboardModule, MobileDashboardProps } from "./mobileDashboard.types";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const glass =
  "border border-white/20 bg-white/15 backdrop-blur-md text-white";

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mb-3 flex items-center gap-2 px-1 text-[15px] font-bold text-foreground">
      <span aria-hidden="true" className="h-4 w-1 rounded-sm bg-primary" />
      {children}
    </h3>
  );
}

function ModuleTile({ item, index }: { item: MobileDashboardModule; index: number }) {
  const disabled = !item.enabled;
  const testId = `mobile-dashboard-module-${item.title.toLowerCase().replace(/\s+/g, "-")}`;
  // Same entrance as the Flutter tiles: every tile starts at once and later
  // ones simply take longer, rising 18px with an ease-out-cubic curve.
  const entrance = {
    animationDuration: `${380 + Math.min(index * 45, 400)}ms`,
    animationTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
    "--tw-enter-translate-y": "18px",
  } as React.CSSProperties;

  const body = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: disabled
            ? "var(--border)"
            : `linear-gradient(90deg, ${item.accent}, color-mix(in srgb, ${item.accent} 25%, transparent))`,
        }}
      />
      <span className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            disabled ? "bg-border" : item.bgColor,
          )}
        >
          <item.icon size={22} className={disabled ? "text-muted-foreground" : item.color} />
        </span>
        {disabled ? (
          <span className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-background px-[7px] py-[3px] text-[9px] font-semibold text-muted-foreground">
            <LockIcon size={9} className="shrink-0" />
            <span className="truncate">Coming Soon</span>
          </span>
        ) : (
          <span
            className={cn("flex h-[26px] w-[26px] items-center justify-center rounded-full", item.bgColor)}
          >
            <ArrowRightIcon size={13} className={item.color} />
          </span>
        )}
      </span>
      <span
        className={cn(
          "mt-3 block text-sm font-bold",
          disabled ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {item.title}
      </span>
      <span className="mt-1 line-clamp-2 text-[11px] leading-[1.3] text-muted-foreground">
        {item.description}
      </span>
    </>
  );

  const tileClass =
    "relative block aspect-square overflow-hidden rounded-[var(--m-radius-tile)] border border-border bg-card px-4 pt-[18px] pb-3.5 animate-in fade-in-0";

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        data-testid={testId}
        className={cn(tileClass, "opacity-55")}
        style={entrance}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      data-testid={testId}
      className={cn(tileClass, "transition-transform active:scale-[0.98]")}
      style={{
        ...entrance,
        boxShadow: `0 6px 16px color-mix(in srgb, ${item.accent} 10%, transparent), 0 1px 4px rgba(15, 23, 42, 0.04)`,
      }}
    >
      {body}
    </Link>
  );
}

/**
 * Phone-width home screen, matching the Flutter app's dashboard: a navy
 * gradient header (menu, notifications, avatar, greeting, role), what needs
 * attention today, then the modules as "Quick Access" tiles.
 */
export function MobileDashboard({
  name,
  role,
  loading,
  alertsLoading,
  alerts,
  modules,
}: MobileDashboardProps) {
  const openDrawer = useOpenMobileDrawer();
  const displayName = name?.trim();
  const initial = displayName?.charAt(0).toUpperCase() || "U";

  return (
    <div className="space-y-6 md:hidden" data-testid="mobile-dashboard">
      <header
        className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[28px] px-5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[22px] text-white"
        style={{ background: "var(--m-hero-gradient)" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-[60px] h-[180px] w-[180px] rounded-full bg-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[50px] -left-[30px] h-[140px] w-[140px] rounded-full bg-white/[0.08]"
        />

        <div className="relative flex items-center justify-between">
          <button
            type="button"
            onClick={openDrawer}
            aria-label="Open menu"
            aria-haspopup="dialog"
            data-testid="admin-mobile-avatar-btn"
            className={cn(
              glass,
              "flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            <MenuIcon size={19} />
          </button>
          <div className="flex items-center gap-2.5">
            <NotificationBell variant="glass" />
            <span
              aria-hidden="true"
              className={cn(glass, "flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold")}
            >
              {initial}
            </span>
          </div>
        </div>

        <p className="relative mt-[22px] text-[13px] font-medium text-white/75">
          {greeting(new Date().getHours())}
        </p>
        <h2 className="relative mt-1 truncate text-xl font-bold">{displayName || " "}</h2>
        {role && (
          <span
            className={cn(
              glass,
              "relative mt-2.5 inline-block rounded-full px-3 py-[5px] text-[10.5px] font-bold uppercase tracking-[0.06em]",
            )}
          >
            {role}
          </span>
        )}
      </header>

      <section aria-labelledby="mobile-dashboard-attention">
        <SectionTitle id="mobile-dashboard-attention">Needs attention</SectionTitle>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[var(--m-radius-card)] border border-border bg-card p-4 text-sm text-muted-foreground shadow-[var(--m-card-shadow)]">
            <CheckCircleIcon size={20} className="shrink-0 text-success-subtle-foreground" />
            {alertsLoading ? "Checking…" : "All clear — nothing overdue or expiring soon."}
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-[var(--m-radius-card)] border border-border bg-card shadow-[var(--m-card-shadow)]">
            {alerts.map((alert) => (
              <Link
                key={alert.key}
                href={alert.href}
                className="flex items-center gap-3 p-4 transition-colors active:bg-muted"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
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
        <SectionTitle id="mobile-dashboard-modules">Quick Access</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="aspect-square animate-pulse rounded-[var(--m-radius-tile)] border border-border bg-card"
                />
              ))
            : modules.map((item, i) => <ModuleTile key={item.href} item={item} index={i} />)}
        </div>
      </section>
    </div>
  );
}
