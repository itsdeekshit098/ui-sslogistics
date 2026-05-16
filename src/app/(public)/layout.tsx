import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden scrollbar-custom">
            <Navbar />
            <main className="flex-1 shrink-0">{children}</main>
            <Footer />
        </div>
    );
}
