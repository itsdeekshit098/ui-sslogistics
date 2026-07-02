"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface AuthUser {
  id: string;
  email: string | null;
  role: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  userRole: string | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  refreshSession: async () => {},
});

/**
 * Only refetch on visibilitychange if at least this many ms have elapsed.
 * Kept short so a session revoked elsewhere (single-login enforcement) is
 * detected promptly when the user returns to the tab, while still avoiding
 * a request storm from rapid tab switching.
 */
const STALE_THRESHOLD_MS = 15 * 1000; // 15 seconds

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedAt = useRef(0);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const json = await res.json();

      if (res.ok && json.success && json.data) {
        setUser(json.data);
        setUserRole(json.data.role || null);
      } else {
        setUser(null);
        setUserRole(null);
      }
    } catch {
      setUser(null);
      setUserRole(null);
    } finally {
      setLoading(false);
      lastFetchedAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    // Fetch session on mount
    fetchSession();

    // Re-check session when user returns to the tab (throttled)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastFetchedAt.current;
        if (elapsed >= STALE_THRESHOLD_MS) {
          fetchSession();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchSession]);

  return (
    <AuthContext.Provider value={{ user, userRole, loading, refreshSession: fetchSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
