"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  link_path: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  success: boolean;
  data?: {
    data: NotificationItem[];
    total: number;
    unreadCount: number;
  };
}

/**
 * Fetches the caller's notifications and keeps them live via an SSE stream
 * (/api/notifications/stream). Not a client-side Supabase Realtime
 * subscription — this app's browser client never holds Supabase
 * credentials (see ui-sslogistics/CLAUDE.md) — so live delivery goes
 * through our own authenticated API instead, mirroring the existing
 * maintenance-mode SSE stream.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?pageSize=20");
      const json: NotificationsResponse = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.data);
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // Best-effort — the SSE stream will keep trying regardless
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();

    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.addEventListener("notification", (event) => {
      const row: NotificationItem = JSON.parse((event as MessageEvent).data);
      setNotifications((prev) => [row, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    // EventSource auto-reconnects on drop; re-fetch on each successful
    // (re)connection to catch up on anything missed while disconnected.
    es.onopen = () => {
      refresh();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/notifications/mark-read", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Best-effort — next refresh will reconcile
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/mark-all-read", { method: "PUT" });
    } catch {
      // Best-effort — next refresh will reconcile
    }
  }, []);

  return { notifications, unreadCount, markRead, markAllRead };
}
