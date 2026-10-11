"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon } from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import { getMobileTabs, matchNavItem } from "../navConfig";
import type { BottomNavProps } from "./bottomNav.types";

const tabClass =
  "group relative flex flex-1 flex-col items-center justify-center gap-1 pb-1.5 text-[10.5px] font-medium leading-none tracking-wide transition-[color,transform] duration-300 active:scale-90 active:duration-100 motion-reduce:transition-none focus-visible:outline-none";

// One "settle" curve for everything that moves: quick off the mark, soft landing.
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * The active tab's icon turns the accent colour, is drawn a little heavier,
 * and gets a backdrop that fades in behind it: a soft glow on the dark theme,
 * a crisp tinted tile on the light one — a glow on a white bar only reads as
 * a smudge. The stroke width is set from here because the icons keep theirs on the
 * <svg> element.
 */
function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute h-[1.875rem] w-10 rounded-lg bg-primary/10 transition-[opacity,transform] duration-500 motion-reduce:transition-none dark:h-11 dark:w-11 dark:rounded-full dark:bg-transparent dark:bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_36%,transparent),transparent_68%)]",
          EASE,
          active ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <span
        className={cn(
          "relative flex [&_svg]:transition-[stroke-width] [&_svg]:duration-200",
          active ? "[&_svg]:stroke-2" : "[&_svg]:stroke-[1.5]",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** The small dot under the active tab's name. */
function TabDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-[3px] h-1 w-1 rounded-full bg-primary transition-[opacity,transform] duration-300 motion-reduce:transition-none",
        EASE,
        active ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
      )}
    />
  );
}

/**
 * Phone-width primary navigation, as a dock floating over the page: inset
 * from the screen edges, translucent, with the content scrolling on beneath
 * it (the page's bottom padding comes from --mobile-dock-clearance in
 * globals.css). Same groups for every role — each tab is
 * filtered by the route permissions, so it only appears when the role can
 * open something inside it. Pages outside the four groups (Activity Log,
 * Sessions, Settings) are reached through "More".
 */
export function BottomNav({ onOpenMenu, menuOpen, className }: BottomNavProps) {
  const pathname = usePathname();
  const { userRole, loading } = useAuth();
  const tabs = getMobileTabs(loading ? null : (userRole as UserRole | null));
  const activeHref = matchNavItem(pathname)?.item.href;
  const activeTabKey = tabs.find((t) => t.items.some((i) => i.href === activeHref))?.key;
  const moreActive = menuOpen || (!activeTabKey && !loading);

  return (
    <>
      {/* Fades the page out towards the bottom edge, so rows passing under
          the dock don't fight with its icons and labels. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-background via-background/70 to-transparent",
          className,
        )}
      />
      <nav
        aria-label="Primary"
        data-testid="admin-bottom-nav"
        className={cn(
          // Fallbacks on both variables: if the stylesheet that defines them
          // is ever stale, an unanchored absolute box lands at the top of
          // the screen, over the title bar.
          "absolute inset-x-3 bottom-[calc(var(--mobile-dock-gap,0.75rem)+env(safe-area-inset-bottom,0px))] z-30 flex h-[var(--mobile-dock-height,3.75rem)] items-stretch rounded-[calc(var(--radius)+4px)] border border-border bg-card/80 px-1 shadow-lg backdrop-blur-xl backdrop-saturate-150",
          className,
        )}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={tabClass}>
                <span className="h-6 w-6 animate-pulse rounded-md bg-muted" />
                <span className="h-2 w-8 animate-pulse rounded bg-muted" />
              </div>
            ))
          : (
            <>
              {tabs.map((tab) => {
                const active = !menuOpen && tab.key === activeTabKey;
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    data-testid={`bottom-nav-${tab.key}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      tabClass,
                      EASE,
                      active ? "-translate-y-0.5 text-primary" : "text-muted-foreground",
                    )}
                  >
                    <TabIcon active={active}>
                      <tab.icon size={24} />
                    </TabIcon>
                    {tab.label}
                    <TabDot active={active} />
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={onOpenMenu}
                data-testid="bottom-nav-more"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className={cn(
                  tabClass,
                  EASE,
                  moreActive ? "-translate-y-0.5 text-primary" : "text-muted-foreground",
                )}
              >
                <TabIcon active={moreActive}>
                  <GridIcon size={24} />
                </TabIcon>
                More
                <TabDot active={moreActive} />
              </button>
            </>
          )}
      </nav>
    </>
  );
}
