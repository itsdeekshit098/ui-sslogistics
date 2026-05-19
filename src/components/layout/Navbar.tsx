"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { ThemeToggle } from "@/components/themeToggle";

export function Navbar() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  const handlePortalClick = () => {
    // Don't show loading if we're already on an admin page
    if (!pathname.startsWith("/admin")) {
      setIsNavigating(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            data-testid="navbar-logo-link"
            className="flex items-center gap-2"
          >
            <span className="text-lg sm:text-xl md:text-2xl font-black tracking-tighter text-[#091324] dark:text-[#F8FAFC]">
              SRI SRINIVASA
            </span>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
          <ThemeToggle />
          <Button
            data-testid="navbar-portal-btn"
            variant="default"
            className="gap-2 px-3 sm:px-4 sm:min-w-[110px]"
            asChild
            onClick={handlePortalClick}
          >
            <Link data-testid="components-layout-Navbar-link-1" href="/admin">
              {isNavigating ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LayoutDashboard className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isNavigating ? "Loading..." : "Operations Portal"}
              </span>
              <span className="sm:hidden">
                {isNavigating ? "..." : "Portal"}
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
