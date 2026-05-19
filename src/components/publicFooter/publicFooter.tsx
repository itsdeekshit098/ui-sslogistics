"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { useIsDarkMode } from "@/hooks/useResolvedTheme";

import * as styles from "./publicFooter.style";
import {
  PublicFooterContactItem,
  PublicFooterLinkGroup,
} from "./publicFooter.types";

const footerGroups: PublicFooterLinkGroup[] = [
  {
    title: "Services",
    links: [
      "Employee Transport",
      "Corporate Cars",
      "Tempo Travellers",
      "Truck Logistics",
    ],
  },
  {
    title: "Company",
    links: ["About", "Operations", "Careers", "Privacy"],
  },
];

const contactItems: PublicFooterContactItem[] = [
  { label: "WhatsApp", value: "+91 93989 21370" },
  { label: "Coverage", value: "Penukonda Industrial Area" },
  { label: "Focus", value: "KIA automotive corridor & vendor parks" },
];

function useCompactFooter() {
  const [isCompactFooter, setIsCompactFooter] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 920px)");
    const updateFooter = () => setIsCompactFooter(mediaQuery.matches);

    updateFooter();
    mediaQuery.addEventListener("change", updateFooter);

    return () => mediaQuery.removeEventListener("change", updateFooter);
  }, []);

  return isCompactFooter;
}

export function PublicFooter() {
  const isCompactFooter = useCompactFooter();
  const isDarkMode = useIsDarkMode();

  return (
    <footer
      style={{ ...styles.footer, ...styles.publicFooterThemeVars(isDarkMode) }}
    >
      <div style={styles.gridOverlay} />
      <div style={styles.container}>
        <div style={styles.responsiveTopGrid(isCompactFooter)}>
          <div style={styles.brandPanel}>
            <div style={styles.brandRow}>
              <span style={styles.brandTitle}>SRI SRINIVASA</span>
            </div>
            <p style={styles.brandText}>
              Premium enterprise transport, employee mobility, and auto-parts
              logistics support built for Penukonda Industrial Area.
            </p>
            <a
              href="https://wa.me/919398921370"
              rel="noopener noreferrer"
              style={styles.contactButton}
              target="_blank"
            >
              <MessageCircle size={18} strokeWidth={2.4} />
              WhatsApp Operations
            </a>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title} style={styles.group}>
              <h3 style={styles.groupTitle}>{group.title}</h3>
              <ul style={styles.linkList}>
                {group.links.map((link) => (
                  <li key={link} style={styles.linkText}>
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div style={styles.group}>
            <h3 style={styles.groupTitle}>Contact</h3>
            <ul style={styles.linkList}>
              {contactItems.map((item) => (
                <li key={item.label}>
                  <span style={styles.contactLabel}>{item.label}</span>
                  <span style={styles.contactValue}>{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={styles.bottomBar}>
          <p style={styles.copyright}>
            © {new Date().getFullYear()} Sri Srinivasa Secure Logistics. All
            rights reserved.
          </p>
          <span style={styles.statusPill}>
            <span style={styles.statusDot} />
            Operations-ready transport partner
          </span>
        </div>
      </div>
    </footer>
  );
}
