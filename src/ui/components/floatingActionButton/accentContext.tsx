"use client";

import { createContext, useContext, type ReactNode } from "react";

const AccentContext = createContext<string | undefined>(undefined);

/**
 * Supplies the colour the floating action button should take (a module's
 * accent, e.g. loans blue, vehicles teal). The library knows nothing about
 * routes or modules, so the app decides the value and provides it once near
 * the top of the page tree; every FloatingActionButton below picks it up,
 * including the one a PageHeader renders on its own.
 */
export function AccentProvider({
  value,
  children,
}: {
  value: string | undefined;
  children: ReactNode;
}) {
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

/** The accent from the nearest AccentProvider, or undefined for the default. */
export function useAccent(): string | undefined {
  return useContext(AccentContext);
}
