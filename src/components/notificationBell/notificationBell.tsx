"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BellIcon } from "@/components/ui/icon";
import { useNotifications, type NotificationItem } from "@/hooks/useNotifications";
import type { NotificationBellProps } from "./notificationBell.types";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();

  const handleClick = (n: NotificationItem) => {
    setIsOpen(false);
    if (!n.read_at) markRead(n.id);
    if (n.link_path) router.push(n.link_path);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Button
        variant="outline"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Notifications"
        className="relative flex h-9 w-9 p-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 pt-2 z-[9999] animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="absolute top-[3px] right-[13px] w-2.5 h-2.5 bg-card border-l border-t border-border rotate-45 z-30" />

            <div className="p-2 bg-card border border-border rounded-md shadow-2xl drop-shadow-sm flex flex-col gap-1 w-[340px] max-h-[420px] text-card-foreground relative z-20">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="h-px w-full bg-border my-0.5" />

              <div className="overflow-y-auto flex flex-col gap-1">
                {notifications.length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`text-left px-2 py-2 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                      !n.read_at ? "bg-slate-50 dark:bg-slate-900/50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={`flex-1 min-w-0 ${n.read_at ? "pl-3.5" : ""}`}>
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
