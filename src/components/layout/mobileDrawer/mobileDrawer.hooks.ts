"use client";

import { createContext, useContext } from "react";

/** Lets phone chrome outside the admin layout (the dashboard's own header)
 * open the drawer the layout owns. */
export const MobileDrawerContext = createContext<() => void>(() => {});

export function useOpenMobileDrawer() {
  return useContext(MobileDrawerContext);
}
