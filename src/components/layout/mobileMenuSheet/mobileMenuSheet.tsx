"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon } from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { SignOutButton } from "@/components/signOutButton";
import { ThemeToggle } from "@/components/themeToggle";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import { filterNavSections, matchNavItem } from "../navConfig";
import type { MobileMenuSheetProps } from "./mobileMenuSheet.types";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  driver: "Driver",
};

/**
 * The "More" sheet: account, theme and sign-out on top, then every page the
 * role can open as a tile grid — the same filtered sections the desktop
 * Sidebar lists, so nothing is reachable on one form factor but not the other.
 */
export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const pathname = usePathname();
  const { user, userRole } = useAuth();
  const sections = filterNavSections(userRole as UserRole | null);
  const activeHref = matchNavItem(pathname)?.item.href;
  const name = user?.displayName || user?.email || "User";

  return (
    <BottomSheet open={open} onClose={onClose} title="Menu">
      <div className="space-y-5" data-testid="admin-mobile-menu">
        {/* Account */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-base font-semibold text-primary ring-1 ring-primary/20 dark:bg-primary/20">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {userRole && (
              <p className="text-xs text-muted-foreground">
                {ROLE_LABEL[userRole] ?? userRole}
              </p>
            )}
          </div>
          <ThemeToggle />
        </div>

        {/* Pages */}
        {sections.map((section) => (
          <section key={section.label}>
            <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {section.items.map((item) => {
                const active = item.href === activeHref;
                const tile = (
                  <>
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <item.icon size={20} />
                    </span>
                    <span className="line-clamp-2 text-center text-xs font-medium leading-tight">
                      {item.name}
                    </span>
                  </>
                );

                if (!item.enabled) {
                  return (
                    <div
                      key={item.href}
                      aria-disabled="true"
                      className="relative flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border p-3 text-muted-foreground opacity-60"
                    >
                      <LockIcon size={11} className="absolute right-2 top-2" />
                      {tile}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-foreground transition-transform active:scale-[0.97]",
                      active ? "border-primary/40 bg-primary/5" : "border-border bg-card",
                    )}
                  >
                    {tile}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <div className="border-t border-border pt-2">
          <SignOutButton variant="mobile" />
        </div>
      </div>
    </BottomSheet>
  );
}
