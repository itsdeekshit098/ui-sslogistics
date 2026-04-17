"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { SignOutButton } from "@/components/signOutButton";
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

            {/* Mobile Floating Menu Button */}
            <div className="md:hidden fixed top-4 right-4 z-40">
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="rounded-full shadow-md bg-white/80 backdrop-blur border-slate-200 text-slate-700 hover:bg-white" 
                    onClick={() => setIsMobileMenuOpen(true)}
                >
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

            <div className="flex flex-col w-full min-w-0">
                {/* Desktop Header */}
                <header className="hidden md:flex h-14 items-center justify-end border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
                    <SignOutButton variant="desktop" />
                </header>

                <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
            </div>
        </div>
    );
}
