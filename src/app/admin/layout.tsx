"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SignOutButton } from "@/components/signOutButton";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    const t = setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        className="hidden md:block h-[100dvh] border-r border-border/50"
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Mobile Floating Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-40">
        <Button
          data-testid="admin-mobile-menu-btn"
          variant="outline"
          size="icon"
          className="rounded-[var(--input-radius)] shadow-md bg-background/80 backdrop-blur border-border text-foreground hover:bg-background"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            data-testid="admin-mobile-overlay"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-72 shadow-xl z-50 animate-in slide-in-from-left duration-200">
            <Sidebar
              className="w-full h-full border-r border-border/50"
              onClose={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <div
        className="flex flex-1 flex-col min-w-0 overflow-hidden"
        data-testid="admin-layout"
      >
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 shrink-0 items-center justify-end bg-white dark:bg-background px-4 lg:h-15 lg:px-6 z-30 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <SignOutButton variant="desktop" />
        </header>

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f3f3f3] dark:bg-[#0c1521] transition-colors duration-300 scrollbar-custom"
          data-testid="admin-main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
