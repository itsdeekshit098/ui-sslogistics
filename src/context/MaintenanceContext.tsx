"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface MaintenanceState {
  maintenanceMode: boolean;
  message: string | null;
}

const MaintenanceContext = createContext<MaintenanceState>({
  maintenanceMode: false,
  message: null,
});

/**
 * Holds a live Server-Sent Events connection to /api/system/maintenance-stream
 * so an already-open tab finds out maintenance mode was toggled within
 * ~1s, instead of only on its next page load / API call (which the
 * middleware also blocks, but that doesn't help a tab sitting idle).
 *
 * EventSource reconnects automatically on its own after a network error or
 * a server-side connection drop (e.g. a serverless timeout) — no manual
 * retry logic needed here.
 */
export const MaintenanceProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<MaintenanceState>({
    maintenanceMode: false,
    message: null,
  });

  useEffect(() => {
    const source = new EventSource("/api/system/maintenance-stream");

    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (typeof parsed.maintenanceMode === "boolean") {
          setState({
            maintenanceMode: parsed.maintenanceMode,
            message: parsed.message ?? null,
          });
        }
      } catch {
        // Ignore malformed events (e.g. heartbeat comments never reach here).
      }
    };

    return () => {
      source.close();
    };
  }, []);

  return (
    <MaintenanceContext.Provider value={state}>{children}</MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => useContext(MaintenanceContext);
