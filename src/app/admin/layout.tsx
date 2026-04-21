"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SignOutButton } from "@/components/signOutButton";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    const t = setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:block h-screen border-r border-border/50" />

      {/* Mobile Floating Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-40">
        <Button
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

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 shrink-0 items-center justify-end border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:h-15 lg:px-6 z-30">
          <SignOutButton variant="desktop" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
