"use client";

import { motion } from "framer-motion";
import {
  HomeIcon,
  Building2Icon,
  BarChart3Icon,
  MailIcon,
  GridIcon,
} from "@/components/ui/icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import { LoadingSpinner } from "@/components/loadingSpinner";
import { ThemeToggle } from "@/components/themeToggle";
import { useIsDarkMode } from "@/hooks/useResolvedTheme";

import * as styles from "./publicNavbar.style";
import type { PublicNavItem } from "./publicNavbar.types";
import type { PublicNavbarProps } from "./publicNavbar.types";

const publicNavItems: PublicNavItem[] = [
  { href: "/#services", label: "Services", icon: HomeIcon },
  { href: "/#partners", label: "Partners", icon: Building2Icon },
  { href: "/#operations", label: "Operations", icon: BarChart3Icon },
  { href: "/#contact", label: "Contact", icon: MailIcon },
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

function useActiveHash() {
  const [activeHash, setActiveHash] = useState("#services");
  const isLockedRef = useRef(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setActiveHashWithLock = (hash: string) => {
    isLockedRef.current = true;
    setActiveHash(hash);

    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = setTimeout(() => {
      isLockedRef.current = false;
    }, 1000); // 1s lock covers the smooth scrolling duration
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || "#services";
      if (!isLockedRef.current) {
        setActiveHash(hash);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    };
  }, []);

  return [activeHash, setActiveHash, setActiveHashWithLock, isLockedRef] as const;
}

export function PublicNavbar({ portalHref = "/admin" }: PublicNavbarProps) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const isCompactHeader = useCompactHeader();
  const isDarkMode = useIsDarkMode();
  const [activeHash, setActiveHash, setActiveHashWithLock, isLockedRef] = useActiveHash();

  useEffect(() => {
    if (typeof window === "undefined" || !window.IntersectionObserver) return;

    const sections = ["services", "partners", "operations", "contact"];
    const elements = sections
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -55% 0px", // Trigger when section occupies the top-middle viewport
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      if (isLockedRef.current) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          setActiveHash(`#${id}`);
        }
      });
    }, observerOptions);

    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, [setActiveHash, isLockedRef]);

  // Handle scrolling to elements on page entry, pathname changes, hashchanges, or browser back navigation
  useEffect(() => {
    let activeTimeout: NodeJS.Timeout | null = null;
    let retries = 0;
    const maxRetries = 25; // Retry for up to 2.5s (25 * 100ms)

    const attemptScroll = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      } else if (retries < maxRetries) {
        retries++;
        activeTimeout = setTimeout(() => attemptScroll(id), 100);
      }
    };

    const handleScrollToHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace("#", "");
        if (activeTimeout) clearTimeout(activeTimeout);
        retries = 0;
        attemptScroll(id);
      }
    };

    // Run on mount or pathname change (covers transitions from admin back to public pages)
    handleScrollToHash();

    // Listen to hashchange events (covers clicking links on the same page)
    window.addEventListener("hashchange", handleScrollToHash);
    
    return () => {
      if (activeTimeout) clearTimeout(activeTimeout);
      window.removeEventListener("hashchange", handleScrollToHash);
    };
  }, [pathname]);

  return (
    <header
      style={{ ...styles.header, ...styles.publicNavbarThemeVars(isDarkMode) }}
    >
      <div style={styles.container}>
        {/* Brand */}
        <Link href="/" style={styles.brandLink} aria-label="Sri Srinivasa home">
          <span style={styles.brandMark}>S</span>
          <span style={styles.brandTitle}>SRI SRINIVASA</span>
        </Link>

        {/* Divider */}
        <div style={styles.dividerStyle(isCompactHeader)} />

        {/* Nav links */}
        <nav
          aria-label="Homepage sections"
          style={styles.desktopOnly(isCompactHeader)}
        >
          {publicNavItems.map((item) => {
            const hashOnly = item.href.startsWith("/") ? item.href.slice(1) : item.href;
            const isActive = activeHash === hashOnly;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} passHref legacyBehavior>
                <motion.a
                  style={isActive ? styles.navLinkActive : styles.navLink}
                  whileHover={{
                    background: "var(--public-nav-link-hover-bg)",
                    color: isActive
                      ? "var(--public-nav-active-accent)"
                      : "var(--public-nav-link-hover)",
                  }}
                  onClick={() => setActiveHashWithLock(hashOnly)}
                >
                  <Icon size={16} />
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="activeUnderline"
                      style={styles.activeUnderline}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.a>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div style={styles.actions}>
          <ThemeToggle />
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link
              href={portalHref}
              style={styles.portalLinkStyle(isCompactHeader)}
              onClick={() => setIsNavigating(true)}
            >
              {isNavigating ? (
                <LoadingSpinner size="sm" />
              ) : (
                <GridIcon size={16} />
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
