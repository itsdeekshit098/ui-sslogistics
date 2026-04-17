"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-red-600">
              Sri Srinivasa
            </span>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button variant="default" className="gap-2 px-3 md:px-4" asChild>
            <Link href="/admin">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Operations Portal</span>
              <span className="sm:hidden">Portal</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
