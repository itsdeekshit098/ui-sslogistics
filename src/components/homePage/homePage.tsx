"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, TruckIcon, XIcon } from "@/components/ui/icon";
import { useEffect, useState } from "react";

import { PartnerLogo } from "@/components/ui/partnerLogo";
import { useIsDarkMode } from "@/hooks/useResolvedTheme";

import {
  commandStats,
  contactOptions,
  ctaHighlights,
  features,
  flowCards,
  heroMetrics,
  partnerNames,
  proofPoints,
  routeStops,
  services,
  whatsappUrl,
} from "./homePage.constants";
import * as styles from "./homePage.style";

const revealViewport = { once: true, amount: 0.22 };

function useCompactViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const updateViewport = () => setIsCompactViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return isCompactViewport;
}

export function HomePage() {
  const [showContactOptions, setShowContactOptions] = useState(false);
  const shouldReduceMotion = Boolean(useReducedMotion());
  const isDarkMode = useIsDarkMode();
  const isCompactViewport = useCompactViewport();
  const partnerLoop = [...partnerNames, ...partnerNames, ...partnerNames];

  const handleContactClick = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setShowContactOptions(true);
  };

  const revealInitial = shouldReduceMotion ? false : { opacity: 0, y: 28 };
  const revealAnimate = { opacity: 1, y: 0 };
  const floatAnimation = shouldReduceMotion
    ? undefined
    : { y: [0, -12, 0], rotate: [0, 1.2, 0] };

  return (
    <div style={{ ...styles.shell, ...styles.homeThemeVars(isDarkMode) }}>
      <div style={styles.backgroundGrid} />
      <div style={styles.auroraOne} />
      <div style={styles.auroraTwo} />

      <section style={styles.heroSection}>
        <div style={styles.container}>
          <div style={styles.heroGrid}>
            <motion.div
              initial={false}
              animate={revealAnimate}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={
                isCompactViewport ? styles.heroCopyCompact : styles.heroCopy
              }
            >
              <h1 style={styles.heroTitle}>
                Enterprise Transport{" "}
                <span style={styles.heroTitleAccent}>Reimagined for Speed</span>
              </h1>
              <p style={styles.heroDescription}>
                Reliable employee mobility, executive cars, tempo travellers,
                and truck logistics for automotive manufacturers in
                Penukonda&apos;s KIA industrial corridor.
              </p>

              <div style={styles.actions}>
                <motion.button
                  type="button"
                  style={styles.primaryButton}
                  onClick={handleContactClick}
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  Start Now
                  <ArrowRightIcon size={18} />
                </motion.button>
                <motion.button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={handleContactClick}
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                >
                  Contact Sales
                  <ArrowUpRightIcon size={18} />
                </motion.button>
              </div>

              <div style={styles.metricsRow} aria-label="Operations summary">
                {heroMetrics.map((metric) => (
                  <motion.div
                    key={metric.label}
                    style={styles.metricTile}
                    whileHover={
                      shouldReduceMotion ? undefined : { y: -4, scale: 1.015 }
                    }
                  >
                    <span
                      style={{
                        ...styles.metricValue,
                        fontSize:
                          metric.value.length > 6
                            ? "clamp(1.15rem, 2.4vw, 1.5rem)"
                            : styles.metricValue.fontSize,
                        letterSpacing:
                          metric.value.length > 6
                            ? "-0.03em"
                            : styles.metricValue.letterSpacing,
                      }}
                    >
                      {metric.value}
                    </span>
                    <span style={styles.metricLabel}>{metric.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              style={
                isCompactViewport ? styles.heroVisualCompact : styles.heroVisual
              }
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.85, delay: 0.1, ease: "easeOut" }}
            >
              <motion.div
                style={
                  isCompactViewport ? styles.commandCenterCompact : styles.commandCenter
                }
                animate={floatAnimation}
                transition={{
                  duration: 8,
                  ease: "easeInOut",
                  repeat: Infinity,
                }}
              >
                <div style={styles.commandGlow} />
                <div style={styles.commandHeader}>
                  <div style={styles.windowDots} aria-hidden="true">
                    <span style={styles.windowDotRed} />
                    <span style={styles.windowDotAmber} />
                    <span style={styles.windowDotGreen} />
                  </div>
                  <p style={styles.commandTitle}>Operations Control</p>
                  <span style={styles.commandStatus}>
                    <span style={styles.statusPulse} />
                    Active
                  </span>
                </div>

                <div style={
                  isCompactViewport ? styles.mapCanvasCompact : styles.mapCanvas
                }>
                  <div style={styles.mapGrid} />
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    preserveAspectRatio="none"
                    style={styles.routeSvg}
                    viewBox="0 0 600 420"
                  >
                    <path
                      d="M72 268 C148 134 222 316 306 180 C374 70 456 142 526 72"
                      fill="none"
                      stroke="rgba(148, 163, 184, 0.22)"
                      strokeLinecap="round"
                      strokeWidth="16"
                    />
                    <motion.path
                      d="M72 268 C148 134 222 316 306 180 C374 70 456 142 526 72"
                      fill="none"
                      initial={shouldReduceMotion ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      stroke="url(#routeGlow)"
                      strokeDasharray="10 16"
                      strokeLinecap="round"
                      strokeWidth="6"
                      transition={{
                        duration: shouldReduceMotion ? 0 : 2.4,
                        ease: "easeInOut",
                        repeat: shouldReduceMotion ? 0 : Infinity,
                        repeatType: "reverse",
                      }}
                    />
                    <defs>
                      <linearGradient
                        id="routeGlow"
                        x1="0"
                        x2="1"
                        y1="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="48%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#f87171" />
                      </linearGradient>
                    </defs>
                  </svg>

                  <motion.div
                    style={
                      isCompactViewport ? styles.vehiclePillCompact : styles.vehiclePill
                    }
                    animate={shouldReduceMotion ? undefined : { x: [0, 12, 0] }}
                    transition={{
                      duration: 4.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <TruckIcon size={18} />
                    Fleet on schedule
                  </motion.div>

                  {routeStops.map((stop, index) => (
                    <motion.div
                      key={stop.label}
                      style={
                        isCompactViewport ? styles.routeStopStyleCompact(stop) : styles.routeStopStyle(stop)
                      }
                      initial={false}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.35 + index * 0.16, duration: 0.5 }}
                    >
                      <span style={styles.stopPin} />
                      <span style={
                        isCompactViewport ? styles.stopLabelCompact : styles.stopLabel
                      }>{stop.label}</span>
                      <span style={
                        isCompactViewport ? styles.stopStatusCompact : styles.stopStatus
                      }>{stop.status}</span>
                    </motion.div>
                  ))}
                </div>

                <div style={
                  isCompactViewport ? styles.commandFooterCompact : styles.commandFooter
                }>
                  {commandStats.map((stat) => (
                    <div key={stat.label} style={
                      isCompactViewport ? styles.commandStatCompact : styles.commandStat
                    }>
                      <span style={
                        isCompactViewport ? styles.commandStatValueCompact : styles.commandStatValue
                      }>{stat.value}</span>
                      <span style={
                        isCompactViewport ? styles.commandStatLabelCompact : styles.commandStatLabel
                      }>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="services" style={styles.section}>
        <div style={styles.container}>
          <motion.div
            style={styles.sectionHeader}
            initial={revealInitial}
            whileInView={revealAnimate}
            viewport={revealViewport}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 style={styles.sectionTitle}>Our Services</h2>
            <p style={styles.sectionText}>
              A tighter, safer transport layer for the automotive industry:
              workforce movement, executive mobility, crew vans, and parts
              logistics working as one Penukonda industrial system.
            </p>
          </motion.div>

          <div style={styles.serviceGrid}>
            {services.map((service, index) => {
              const ServiceIcon = service.icon;

              return (
                <motion.article
                  key={service.title}
                  style={styles.serviceCardStyle(service.accent)}
                  initial={revealInitial}
                  whileInView={revealAnimate}
                  viewport={revealViewport}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.55,
                    ease: "easeOut",
                  }}
                  whileHover={
                    shouldReduceMotion ? undefined : { y: -8, scale: 1.012 }
                  }
                >
                  <div>
                    <div style={styles.iconFrameStyle(service.accent)}>
                      <ServiceIcon size={26} />
                    </div>
                    <h3 style={styles.serviceTitle}>{service.title}</h3>
                    <p style={styles.serviceDescription}>
                      {service.description}
                    </p>
                  </div>
                  <div style={styles.cardArrow} aria-hidden="true">
                    <ArrowUpRightIcon size={18} />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="partners" style={styles.partnerBand}>
        <div style={styles.container}>
          <p style={styles.partnerHeader}>Trusted by Industry Leaders</p>
        </div>
        <div style={styles.marqueeOuter}>
          <div style={styles.marqueeFadeLeft} />
          <div style={styles.marqueeFadeRight} />
          <motion.div
            style={styles.marqueeTrack}
            animate={shouldReduceMotion ? undefined : { x: ["0%", "-33.333%"] }}
            transition={{
              duration: partnerLoop.length * 2.5,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {partnerLoop.map((partner, index) => (
              <motion.div
                key={`${partner}-${index}`}
                style={styles.partnerCard}
                whileHover={
                  shouldReduceMotion ? undefined : { opacity: 1, scale: 1.06 }
                }
              >
                <PartnerLogo name={partner} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="operations" style={styles.section}>
        <div style={styles.container}>
          <div style={styles.operationsGrid}>
            <motion.div
              initial={revealInitial}
              whileInView={revealAnimate}
              viewport={revealViewport}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h2 style={styles.sectionTitle}>
                Precision Logistics. Zero Downtime.
              </h2>
              <p style={styles.sectionTextOffset}>
                We combine route discipline, driver coordination, vehicle
                readiness, and responsive communication so every shift and every
                load moves with confidence.
              </p>

              <div style={styles.featureList}>
                {features.map((feature, index) => {
                  const FeatureIcon = feature.icon;

                  return (
                    <motion.article
                      key={feature.title}
                      style={styles.featureItem}
                      initial={revealInitial}
                      whileInView={revealAnimate}
                      viewport={revealViewport}
                      transition={{
                        delay: index * 0.08,
                        duration: 0.55,
                        ease: "easeOut",
                      }}
                    >
                      <div style={styles.featureIcon}>
                        <FeatureIcon size={22} />
                      </div>
                      <div>
                        <span style={styles.featureLabel}>{feature.label}</span>
                        <h3 style={styles.featureTitle}>{feature.title}</h3>
                        <p style={styles.featureDescription}>
                          {feature.description}
                        </p>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              style={
                isCompactViewport ? styles.operationsPanelCompact : styles.operationsPanel
              }
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={revealAnimate}
              viewport={revealViewport}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <div style={
                isCompactViewport ? styles.operationsMapCompact : styles.operationsMap
              }>
                <div style={styles.operationsMapGrid} />
                <motion.div
                  style={styles.operationsRoad}
                  animate={
                    shouldReduceMotion ? undefined : { rotate: [-16, -14, -16] }
                  }
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  style={
                    isCompactViewport ? styles.operationsHubCompact : styles.operationsHub
                  }
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : {
                          boxShadow: [
                            "0 24px 60px rgba(37, 99, 235, 0.34)",
                            "0 24px 80px rgba(37, 99, 235, 0.52)",
                            "0 24px 60px rgba(37, 99, 235, 0.34)",
                          ],
                        }
                  }
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <span style={
                    isCompactViewport ? styles.operationsHubTextCompact : styles.operationsHubText
                  }>
                    Live
                    <br />
                    Operations
                  </span>
                </motion.div>

                <div style={
                  isCompactViewport ? styles.flowStackCompact : styles.flowStack
                }>
                  {flowCards.map((card) => {
                    const FlowIcon = card.icon;

                    return (
                      <article key={card.title} style={
                        isCompactViewport ? styles.flowCardCompact : styles.flowCard
                      }>
                        <span style={styles.flowIcon}>
                          <FlowIcon size={19} />
                        </span>
                        <h3 style={
                          isCompactViewport ? styles.flowTitleCompact : styles.flowTitle
                        }>{card.title}</h3>
                        <p style={
                          isCompactViewport ? styles.flowTextCompact : styles.flowText
                        }>{card.text}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          <div style={styles.proofGrid}>
            {proofPoints.map((point) => (
              <motion.div
                key={point}
                style={styles.proofItem}
                initial={revealInitial}
                whileInView={revealAnimate}
                viewport={revealViewport}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <span style={styles.proofDot} />
                {point}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" style={styles.ctaSection}>
        <div style={styles.container}>
          <motion.div
            style={styles.ctaPanel}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={revealAnimate}
            viewport={revealViewport}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            <h2 style={styles.ctaTitle}>Ready to Optimize Your Logistics?</h2>
            <p style={styles.ctaDescription}>
              Talk to the operations team and turn daily movement into a
              reliable, modern transport experience.
            </p>

            <div style={styles.ctaBottom}>
              <div style={styles.ctaHighlightList}>
                {ctaHighlights.map((highlight) => {
                  const HighlightIcon = highlight.icon;

                  return (
                    <span key={highlight.text} style={styles.ctaHighlight}>
                      <HighlightIcon size={16} />
                      {highlight.text}
                    </span>
                  );
                })}
              </div>

              <motion.button
                type="button"
                style={styles.primaryButton}
                onClick={handleContactClick}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Contact Us Today
                <ArrowRightIcon size={18} />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {showContactOptions && (
          <motion.div
            style={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="homepage-contact-title"
          >
            <motion.div
              style={styles.modalPanel}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                shouldReduceMotion ? undefined : { opacity: 0, scale: 0.94 }
              }
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div style={styles.modalHeader}>
                <h3 id="homepage-contact-title" style={styles.modalTitle}>
                  Contact Us
                </h3>
                <button
                  type="button"
                  aria-label="Close contact options"
                  style={styles.modalClose}
                  onClick={() => setShowContactOptions(false)}
                >
                  <XIcon size={19} />
                </button>
              </div>
              <div style={styles.modalBody}>
                <p style={styles.modalText}>
                  Choose how you want to connect with the Sri Srinivasa
                  operations team.
                </p>
                {contactOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const isExternal = option.href.startsWith("https://");

                  return (
                    <motion.a
                      key={option.label}
                      href={option.href}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      style={styles.contactOptionStyle(option.tone)}
                      target={isExternal ? "_blank" : undefined}
                      whileTap={
                        shouldReduceMotion ? undefined : { scale: 0.98 }
                      }
                    >
                      <OptionIcon size={20} />
                      {option.label}
                    </motion.a>
                  );
                })}
                <span style={styles.proofItem}>
                  <CheckIcon size={16} />
                  Quick response during operating hours
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
