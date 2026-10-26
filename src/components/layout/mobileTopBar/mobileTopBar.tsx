"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, MenuIcon } from "@/components/ui/icon";
import { NotificationBell } from "@/components/notificationBell";
import { cn } from "@/lib/utils";
import { matchNavItem } from "../navConfig";
import type { MobileTopBarProps } from "./mobileTopBar.types";

const iconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Phone-width app bar, matching the Flutter app's: back arrow, page title,
 * then notifications and the menu that opens the drawer. A list page's back
 * arrow goes to the dashboard; a detail page's (/admin/loans/123) goes back
 * to where the user came from. The dashboard has its own header instead.
 */
export function MobileTopBar({ onOpenMenu, className }: MobileTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const match = matchNavItem(pathname);
  const title = match?.item.name ?? "Dashboard";

  const handleBack = () => {
    if (!match?.isDetail) {
      router.push("/admin");
      return;
    }
    // A deep link opened fresh has no in-app history to go back to.
    if (window.history.length > 1) router.back();
    else router.push(match.item.href);
  };

  return (
    <header
      className={cn(
        // Solid, no backdrop-blur: page content scrolls inside <main>, never
        // under the bar, and a backdrop-filter would turn the bar into the
        // containing block for `fixed` children — the notification panel's
        // tap-outside-to-close layer then covered only the bar itself.
        "z-[35] shrink-0 bg-[var(--m-appbar)] pt-[env(safe-area-inset-top)]",
        className,
      )}
      data-testid="admin-mobile-topbar"
    >
      <div className="flex h-14 items-center gap-1 px-1">
        <button
          type="button"
          onClick={handleBack}
          className={iconButton}
          aria-label={match?.isDetail ? `Back to ${title}` : "Back to dashboard"}
        >
          <ArrowLeftIcon size={22} />
        </button>
        <h1 className="min-w-0 flex-1 truncate pl-1 text-lg font-bold text-foreground">{title}</h1>
        <NotificationBell variant="ghost" />
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          aria-haspopup="dialog"
          data-testid="admin-mobile-avatar-btn"
          className={cn(iconButton, "mr-1")}
        >
          <MenuIcon size={22} />
        </button>
      </div>
    </header>
  );
}
