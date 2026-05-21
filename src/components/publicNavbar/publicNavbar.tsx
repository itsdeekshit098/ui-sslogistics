"use client";

import { motion } from "framer-motion";
import { LayoutDashboardIcon } from "@/components/ui/icon";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/loadingSpinner";
import { ThemeToggle } from "@/components/themeToggle";
import { useIsDarkMode } from "@/hooks/useResolvedTheme";

import * as styles from "./publicNavbar.style";
import { PublicNavItem, PublicNavbarProps } from "./publicNavbar.types";

const publicNavItems: PublicNavItem[] = [
  { href: "#services", label: "Services" },
  { href: "#partners", label: "Partners" },
  { href: "#operations", label: "Operations" },
  { href: "#contact", label: "Contact" },
];

function useCompactHeader() {
  const [isCompactHeader, setIsCompactHeader] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const updateHeader = () => setIsCompactHeader(mediaQuery.matches);

    updateHeader();
    mediaQuery.addEventListener("change", updateHeader);

    return () => mediaQuery.removeEventListener("change", updateHeader);
  }, []);

  return isCompactHeader;
}

export function PublicNavbar({ portalHref = "/admin" }: PublicNavbarProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const isCompactHeader = useCompactHeader();
  const isDarkMode = useIsDarkMode();

  return (
    <header
      style={{ ...styles.header, ...styles.publicNavbarThemeVars(isDarkMode) }}
    >
      <div style={styles.container}>
        <Link href="/" style={styles.brandLink} aria-label="Sri Srinivasa home">
          <span style={styles.brandTextGroup}>
            <span style={styles.brandTitle}>SRI SRINIVASA</span>
            {/* <span style={styles.brandSubtitleStyle(isCompactHeader)}>
              Secure Logistics
            </span> */}
          </span>
        </Link>

        <nav
          aria-label="Homepage sections"
          style={styles.desktopOnly(isCompactHeader)}
        >
          {publicNavItems.map((item) => (
            <motion.a
              key={item.href}
              href={item.href}
              style={styles.navLink}
              whileHover={{
                background: "var(--public-nav-link-hover-bg)",
                color: "var(--public-nav-link-hover)",
              }}
            >
              {item.label}
            </motion.a>
          ))}
        </nav>

        <div style={styles.actions}>
          {!isCompactHeader && <ThemeToggle />}
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link
              href={portalHref}
              style={styles.portalLinkStyle(isCompactHeader)}
              onClick={() => setIsNavigating(true)}
            >
              {isNavigating ? (
                <LoadingSpinner size="sm" />
              ) : (
                <LayoutDashboardIcon size={17} />
              )}
              <span style={styles.portalTextStyle(isCompactHeader)}>
                {isNavigating ? "Loading..." : "Operations Portal"}
              </span>
            </Link>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
