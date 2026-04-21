import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/navigationProgress";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sri Srinivasa Secure Logistics (SSLogistics)",
  description:
    "Premium transport and operations management by Sri Srinivasa Secure Logistics (SSL). Reliable and secure enterprise logistics solutions.",
  icons: {
    icon: "/favicon.png",
  },
  keywords: [
    "srisrinivasasecurelogistics",
    "sri srinivasa secure logistics",
    "secure logistics",
    "sslogistics",
    "sri srinivasa",
    "ssl",
    "sstc",
    "sstcl",
    "sst",
    "transport",
    "transportation",
    "fleet management",
    "KIA Motors operations",
    "KIA logistics partner",
    "supply chain",
    "freight transport",
    "trucking",
    "commercial vehicles",
    "logistics management",
    "logistics company India"
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
