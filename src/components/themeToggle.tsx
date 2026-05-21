"use client"

import * as React from "react"
import { MoonIcon, SunIcon } from "@/components/ui/icon"
import { useTheme } from "@wrksz/themes/client"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button data-testid="components-themeToggle-button-1"
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="text-muted-foreground hover:text-foreground shrink-0"
    >
      <SunIcon size={20} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon size={20} className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
