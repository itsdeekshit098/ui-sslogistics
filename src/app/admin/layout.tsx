"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SignOutButton } from "@/components/signOutButton";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icon";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/components/themeToggle";
import { NotificationBell } from "@/components/notificationBell";

/** 15 minutes idle → silent auto-logout */
const IDLE_MS = 15 * 60 * 1000;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, refreshSession } = useAuth();
  const idleTimeoutTriggeredRef = useRef(false);

  // If the session disappears while inside the admin area (revoked by a
  // login on another device, expired, etc.), route to /login immediately
  // instead of leaving an empty dashboard shell until the next hard reload.
  // Skip this when the idle timer already initiated its own redirect below,
  // otherwise this generic effect wins the race and mislabels idle logouts
  // as "signed in on another device".
  useEffect(() => {
    if (!loading && !user && !idleTimeoutTriggeredRef.current) {
      router.replace("/login?reason=session_expired");
    }
  }, [loading, user, router]);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserMenuEnter = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
    }
    setIsUserMenuOpen(true);
  };

  const handleUserMenuLeave = () => {
    userMenuTimeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 150);
  };

  // Close user menu on Escape key press
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isUserMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    const t = setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // ── Idle Timeout — silent logout after 15 min ─────────
  const handleIdleTimeout = useCallback(async () => {
    idleTimeoutTriggeredRef.current = true;
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Best-effort sign out
    } finally {
      await refreshSession();
      router.push("/login?reason=idle_timeout");
      router.refresh();
    }
  }, [router, refreshSession]);

  useIdleTimeout({
    idleMs: IDLE_MS,
    onTimeout: handleIdleTimeout,
  });

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <Sidebar
          className="hidden md:block h-[100dvh] border-r border-border/50"
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Mobile Floating Menu Button */}
        <div className="md:hidden fixed top-4 right-4 z-40">
          <Button
            data-testid="admin-mobile-menu-btn"
            variant="outline"
            size="icon"
            className="rounded-[var(--input-radius)] shadow-md bg-background/80 backdrop-blur border-border text-foreground hover:bg-background"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <MenuIcon size={20} />
          </Button>
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              data-testid="admin-mobile-overlay"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="fixed inset-y-0 left-0 w-72 shadow-xl z-50 animate-in slide-in-from-left duration-200">
              <Sidebar
                className="w-full h-full border-r border-border/50"
                onClose={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        <div
          className="flex flex-1 flex-col min-w-0 overflow-hidden"
          data-testid="admin-layout"
        >
          {/* Desktop Header */}
          <header className="hidden md:flex h-14 shrink-0 items-center justify-end gap-3 bg-card px-6 z-30 border-b border-border shadow-sm">
            <NotificationBell />
            <ThemeToggle />
            <div className="h-6 w-px bg-border" />
            <div
              className="relative"
              onMouseEnter={handleUserMenuEnter}
              onMouseLeave={handleUserMenuLeave}
            >
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
                aria-label="User Account Menu"
                className="flex h-9 w-9 p-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
              >
                {(user?.displayName || user?.email)?.charAt(0).toUpperCase() || "U"}
              </Button>

              {isUserMenuOpen && (
                <div className="absolute top-full right-0 pt-2 z-[9999] animate-in fade-in-0 zoom-in-95 duration-100">
                  {/* Custom Beak Arrow pointing to user icon */}
                  <div className="absolute top-[3px] right-[13px] w-2.5 h-2.5 bg-card border-l border-t border-border rotate-45 z-30" />

                  <div className="p-2 bg-card border border-border rounded-md shadow-2xl drop-shadow-sm flex flex-col gap-1 min-w-[200px] text-card-foreground relative z-20">
                    <div className="px-2 py-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground block mb-0.5 uppercase tracking-wider">
                        Account
                      </span>
                      <span className="text-sm font-semibold truncate block">
                        {user?.displayName || user?.email || "User"}
                      </span>
                    </div>
                    <div className="h-px w-full bg-border my-0.5"></div>
                    <SignOutButton variant="mobile" />
                  </div>
                </div>
              )}
            </div>
          </header>

          <main
            className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted transition-colors duration-300 scrollbar-custom"
            data-testid="admin-main"
          >
            {children}
          </main>
        </div>
    </div>
  );
}
