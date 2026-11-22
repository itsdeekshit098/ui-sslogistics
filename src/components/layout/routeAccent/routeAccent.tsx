"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccentProvider } from "@ui/components/floatingActionButton";
import { matchNavItem } from "../navConfig";

/**
 * Gives every floating action button below it the accent colour of the module
 * the current page belongs to (the same colour as that module's nav item),
 * so the UI library doesn't need to know about routes.
 */
export function RouteAccent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const accent = pathname ? matchNavItem(pathname)?.item.accent : undefined;
  return <AccentProvider value={accent}>{children}</AccentProvider>;
}
