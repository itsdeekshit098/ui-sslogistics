"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/ui/icon";
import { NotificationBell } from "@/components/notificationBell";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { matchNavItem } from "../navConfig";
import type { MobileTopBarProps } from "./mobileTopBar.types";

/**
 * Phone-width app bar. On a list page it shows the page name; on a detail
 * page (/admin/loans/123) it becomes a back button labelled with the parent
 * list, so there's always a one-tap way out without the hardware back key.
 */
export function MobileTopBar({ onOpenMenu, className }: MobileTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const match = matchNavItem(pathname);
  const title = match?.item.name ?? "Dashboard";
  const initial = (user?.displayName || user?.email)?.charAt(0).toUpperCase() || "U";

  const handleBack = () => {
    // A deep link opened fresh has no in-app history to go back to.
    if (window.history.length > 1) router.back();
    else router.push(match?.item.href ?? "/admin");
  };

  return (
    <header
      className={cn(
        // Solid, no backdrop-blur: page content scrolls inside <main>, never
        // under the bar, and a backdrop-filter would turn the bar into the
        // containing block for `fixed` children — the notification panel's
        // tap-outside-to-close layer then covered only the bar itself.
        "z-30 shrink-0 border-b border-border bg-card pt-[env(safe-area-inset-top)]",
        className,
      )}
      data-testid="admin-mobile-topbar"
    >
      <div className="flex h-14 items-center gap-2 px-2">
        {match?.isDetail ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 min-w-0 items-center gap-0.5 rounded-full pl-1 pr-3 text-foreground transition-colors active:bg-muted"
            aria-label={`Back to ${title}`}
          >
            <ChevronLeftIcon size={22} className="shrink-0" />
            <span className="truncate text-[17px] font-semibold">{title}</span>
          </button>
        ) : (
          <div className="flex min-w-0 items-center pl-2">
            <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1 pr-1">
          <NotificationBell variant="ghost" />
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Account and menu"
            data-testid="admin-mobile-avatar-btn"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-[13px] font-semibold text-primary ring-1 ring-primary/20 dark:bg-primary/20">
              {initial}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
