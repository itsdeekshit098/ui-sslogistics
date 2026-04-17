"use client";

import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
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
        <div className="flex min-h-screen w-full flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:block" />

            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-30">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <span className="text-lg font-bold tracking-tight">SRI SRINIVASA</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu className="h-5 w-5" />
                </Button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
                    <div className="fixed inset-y-0 left-0 w-64 bg-background border-r shadow-lg z-50">
                        <div className="absolute right-2 top-2">
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <Sidebar className="border-none" onClose={() => setIsMobileMenuOpen(false)} />
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0" onClick={() => setIsMobileMenuOpen(false)} />
                </div>
            )}

            <div className="flex flex-col w-full">
                <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
            </div>
        </div>
    );
}
