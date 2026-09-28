"use client";

import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LockIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "@/components/ui/icon";
import { SignOutButton } from "@/components/signOutButton";
import { ThemeToggle } from "@/components/themeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/routePermissions";
import { filterNavSections, matchNavItem } from "./navConfig";

interface SidebarProps {
  className?: string;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  className,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const isMobile = !!onClose;
  const { user, userRole, loading: authLoading } = useAuth();

  const filteredSections = authLoading
    ? []
    : filterNavSections(userRole as UserRole | null);
  const activeHref = matchNavItem(pathname)?.item.href;

  return (
    <div
      className={cn(
        "bg-[var(--sidebar-background)] text-slate-300 shrink-0 relative border-r border-[var(--sidebar-border)]/50",
        collapsed && !isMobile ? "w-[68px]" : "w-72 md:w-64",
        className,
      )}
      style={{
        transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="flex w-full h-full max-h-screen flex-col">
        {/* Brand Header */}
        <div
          className={cn(
            "flex py-3 items-center",
            collapsed && !isMobile ? "px-0 justify-center" : "px-5",
          )}
        >
          <Link
            data-testid="sidebar-logo-link"
            href="/"
            className="flex items-center justify-center gap-3 group w-full"
            onClick={onClose}
          >
            <Image
              src={collapsed && !isMobile ? "/favicon.png" : "/logo/sslogo.png"}
              alt="Sri Srinivasa Logo"
              width={collapsed && !isMobile ? 44 : 180}
              height={collapsed && !isMobile ? 44 : 33}
              style={{
                display: "block",
                width: collapsed && !isMobile ? "44px" : "180px",
                height: collapsed && !isMobile ? "44px" : "33px",
                objectFit: "contain",
                flexShrink: 0,
              }}
              priority
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto pb-3 pt-2 w-full scrollbar-custom">
          <nav
            className={cn(
              "flex flex-col gap-1 w-full",
              collapsed && !isMobile ? "px-2" : "px-3",
            )}
          >
            {authLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg animate-pulse bg-white/10",
                      collapsed && !isMobile ? "h-9 w-9 mx-auto" : "h-9 w-full",
                    )}
                  />
                ))
              : filteredSections.map((section, sectionIndex) => (
                  <Fragment key={section.label}>
                    {collapsed && !isMobile ? (
                      sectionIndex > 0 && <div className="my-2 h-px bg-white/10" />
                    ) : (
                      <div
                        className={cn(
                          "px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-white/40",
                          sectionIndex > 0 && "mt-4",
                        )}
                      >
                        {section.label}
                      </div>
                    )}

                    {section.items.map((item) => {
                      const isActive = activeHref === item.href;
                      const isEnabled = item.enabled;

                      const iconEl = (
                        <item.icon size={18} className="shrink-0 text-white" />
                      );

                      if (isEnabled) {
                        const link = (
                          <Link
                            data-testid={`sidebar-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center rounded-lg text-sm text-white transition-all w-full",
                              collapsed && !isMobile
                                ? "justify-center px-2 py-2"
                                : "gap-3 px-3 py-2",
                              isActive
                                ? "bg-[var(--sidebar-active)] font-semibold shadow-md"
                                : "font-medium hover:bg-[var(--sidebar-border)]",
                            )}
                          >
                            {iconEl}
                            {(!collapsed || isMobile) && (
                              <span className="truncate">{item.name}</span>
                            )}
                          </Link>
                        );

                        if (collapsed && !isMobile) {
                          return (
                            <Tooltip
                              key={item.href}
                              content={item.name}
                              position="right"
                            >
                              {link}
                            </Tooltip>
                          );
                        }

                        return link;
                      }

                      const disabledItem = (
                        <div
                          key={item.href}
                          className={cn(
                            "flex items-center rounded-lg text-sm font-medium text-white/40 cursor-not-allowed w-full",
                            collapsed && !isMobile
                              ? "justify-center px-2 py-2"
                              : "gap-3 px-3 py-2",
                          )}
                        >
                          {iconEl}
                          {(!collapsed || isMobile) && (
                            <>
                              <span className="truncate">{item.name}</span>
                              <LockIcon
                                size={12}
                                className="ml-auto shrink-0 opacity-50"
                              />
                            </>
                          )}
                        </div>
                      );

                      if (collapsed && !isMobile) {
                        return (
                          <Tooltip
                            key={item.href}
                            content={
                              <span className="text-muted-foreground">
                                {item.name} (coming soon)
                              </span>
                            }
                            position="right"
                          >
                            {disabledItem}
                          </Tooltip>
                        );
                      }

                      return disabledItem;
                    })}
                  </Fragment>
                ))}
          </nav>
        </div>

        {/* Footer — Pinned to bottom (Mobile only) */}
        {isMobile && (
          <div className="border-t border-[var(--sidebar-border)]/50 p-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--sidebar-border)]/50 mb-2">
              <span className="text-xs font-medium text-slate-400">
                Appearance
              </span>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-3 rounded-lg p-2 bg-[var(--sidebar-border)]/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-400">
                {(user?.displayName || user?.email)?.charAt(0).toUpperCase() ||
                  "U"}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-[13px] font-medium text-slate-200">
                  {user?.displayName || user?.email || "User"}
                </span>
              </div>
              <SignOutButton variant="icon" />
            </div>
          </div>
        )}

        {/* Collapse Toggle — desktop only */}
        {!isMobile && onToggleCollapse && (
          <Button
            variant="ghost"
            data-testid="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            className="absolute right-0 translate-x-1/2 top-14 -translate-y-1/2 flex h-7 w-7 p-0 cursor-pointer items-center justify-center rounded-full ring-2 ring-background border border-[var(--sidebar-border)] bg-[var(--sidebar-background)] shadow-sm hover:bg-[var(--sidebar-border)] transition-all z-50 text-slate-400 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRightIcon size={16} />
            ) : (
              <ChevronsLeftIcon size={16} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
