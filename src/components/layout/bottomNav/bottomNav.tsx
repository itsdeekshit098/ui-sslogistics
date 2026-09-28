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
  "flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none";

function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Phone-width primary navigation. Same groups for every role — each tab is
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
    <nav
      aria-label="Primary"
      data-testid="admin-bottom-nav"
      className={cn(
        "z-30 shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="flex h-16 items-stretch">
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
                    className={cn(tabClass, active ? "text-foreground" : "text-muted-foreground")}
                  >
                    <TabIcon active={active}>
                      <tab.icon size={20} />
                    </TabIcon>
                    {tab.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={onOpenMenu}
                data-testid="bottom-nav-more"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className={cn(tabClass, moreActive ? "text-foreground" : "text-muted-foreground")}
              >
                <TabIcon active={moreActive}>
                  <GridIcon size={20} />
                </TabIcon>
                More
              </button>
            </>
          )}
      </div>
    </nav>
  );
}
