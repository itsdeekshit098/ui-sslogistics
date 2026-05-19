"use client";

import { useEffect, useState } from "react";

export type ResolvedTheme = "dark" | "light";

export function useResolvedTheme(): ResolvedTheme {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const root = document.documentElement;

    const updateTheme = () => {
      setResolvedTheme(root.classList.contains("dark") ? "dark" : "light");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return resolvedTheme;
}

export function useIsDarkMode() {
  return useResolvedTheme() === "dark";
}
