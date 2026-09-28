"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import { revealHorizontally, useScrollFade } from "@/hooks/useScrollFade";
import { getMobileTabs, matchNavItem } from "../navConfig";

/**
 * Horizontal switcher between the pages of the current bottom-nav group
 * (e.g. Loans · Clients · Firms · Bank). Only on list pages of a group with
 * more than one page — detail pages get the top bar's back button instead.
 */
export function SectionChips() {
  const pathname = usePathname();
  const { userRole, loading } = useAuth();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const { ref: stripRef, el: stripEl, style: fadeStyle, refresh: refreshFade } = useScrollFade();

  const match = matchNavItem(pathname);
  const tab = getMobileTabs(loading ? null : (userRole as UserRole | null)).find((t) =>
    t.items.some((i) => i.href === match?.item.href),
  );
  const visible = !!tab && !match?.isDetail && tab.items.length > 1;

  // Keyed on the strip element too: the chips first render only once auth
  // resolves, after the pathname effect has already run with nothing to scroll.
  useEffect(() => {
    revealHorizontally(stripEl, activeRef.current);
    refreshFade();
  }, [pathname, stripEl, refreshFade]);

  if (!visible) return null;

  return (
    <div
      ref={stripRef}
      style={fadeStyle}
      className="-mx-4 -mt-1 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label={`${tab.label} sections`}
    >
      {tab.items.map((item) => {
        const active = item.href === match?.item.href;
        return (
          <Link
            key={item.href}
            ref={active ? activeRef : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card text-muted-foreground active:bg-muted",
            )}
          >
            <item.icon size={14} />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
}
