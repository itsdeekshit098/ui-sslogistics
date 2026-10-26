"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@wrksz/themes/client";
import { LockIcon, MoonIcon, SunIcon } from "@/components/ui/icon";
import { SignOutButton } from "@/components/signOutButton";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import { filterNavSections, matchNavItem } from "../navConfig";
import type { MobileDrawerProps } from "./mobileDrawer.types";

/**
 * Phone navigation: the Flutter app's navy glass drawer, sliding in from the
 * left. One flat list of the pages the role can open (same filtering as the
 * desktop Sidebar), pages not built yet under "More modules", and the
 * account card with theme and sign-out at the foot.
 */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, userRole } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !mounted) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => opener?.focus?.({ preventScroll: true });
  }, [open, mounted]);

  if (!open || !mounted) return null;

  const items = filterNavSections(userRole as UserRole | null).flatMap((s) => s.items);
  const enabled = items.filter((i) => i.enabled);
  const locked = items.filter((i) => !i.enabled);
  const activeHref = matchNavItem(pathname)?.item.href;
  const name = user?.displayName || user?.email || "User";

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0 duration-200"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        data-testid="admin-mobile-menu"
        className="fixed inset-y-0 left-0 z-[41] flex w-[272px] max-w-[85vw] flex-col overflow-hidden rounded-r-[var(--m-radius-sheet)] text-white shadow-2xl outline-none animate-in slide-in-from-left duration-300"
        style={{ background: "var(--m-drawer-gradient)" }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-[60px] -top-[50px] h-40 w-40 rounded-full bg-white/[0.08]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[120px] -left-[50px] h-[130px] w-[130px] rounded-full bg-white/[0.06]"
        />

        <div className="relative flex min-h-0 flex-1 flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-3 px-5 py-[18px]">
            <Image
              src="/favicon.png"
              alt=""
              width={38}
              height={38}
              className="h-[38px] w-[38px] shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight">SS Logistics</p>
              <p className="text-[11px] text-[var(--m-drawer-text)]">Operations Platform</p>
            </div>
          </div>
          <div className="h-px bg-white/[0.08]" />

          <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto py-2.5">
            {enabled.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mx-2 my-0.5 flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-white/20 bg-white/[0.14] font-semibold text-white backdrop-blur-sm"
                      : "border-transparent text-[var(--m-drawer-text)] active:bg-white/[0.08]",
                  )}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}

            {locked.length > 0 && (
              <>
                <p className="mt-3 mb-1 px-5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/40">
                  More modules
                </p>
                {locked.map((item) => (
                  <div
                    key={item.href}
                    aria-disabled="true"
                    className="mx-2 my-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-[var(--m-drawer-text-muted)]"
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="flex-1 truncate">{item.name}</span>
                    <LockIcon size={13} className="shrink-0" />
                  </div>
                ))}
              </>
            )}
          </nav>

          <div className="h-px bg-white/[0.08]" />
          <div className="p-4">
            <div className="rounded-[14px] border border-white/[0.14] bg-white/[0.08] p-3 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/20 bg-white/15 text-xs font-bold">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{name}</p>
                  {userRole && (
                    <p className="text-[10px] uppercase text-[var(--m-drawer-text)]">{userRole}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  data-testid="mobile-drawer-theme-toggle"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/20 bg-white/10 text-[var(--m-drawer-text)] transition-colors active:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <SunIcon size={17} className="dark:hidden" />
                  <MoonIcon size={17} className="hidden dark:block" />
                </button>
              </div>
              <div className="mt-1.5">
                <SignOutButton variant="drawer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
