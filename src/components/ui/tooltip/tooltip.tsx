"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TooltipProps } from "./tooltip.types";
import * as styles from "./tooltip.style";

export function Tooltip({
  children,
  content,
  position = "top",
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualPosition: "top" | "bottom" | "left" | "right";
  }>({ top: 0, left: 0, actualPosition: position });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (!content) return;
    timerRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: position === "top" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      actualPosition: position,
    });
  };

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tipRect = tooltipRef.current.getBoundingClientRect();

      let top = 0;
      let left = rect.left + rect.width / 2 - tipRect.width / 2;
      let actualPos = position;

      // Keep within viewport bounds
      if (left < 8) left = 8;
      if (left + tipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tipRect.width - 8;
      }

      if (position === "top") {
        top = rect.top - tipRect.height - 8;
        if (top < 8) {
          top = rect.bottom + 8; // fallback bottom
          actualPos = "bottom";
        }
      } else if (position === "bottom") {
        top = rect.bottom + 8;
        if (top + tipRect.height > window.innerHeight - 8) {
          top = rect.top - tipRect.height - 8; // fallback top
          actualPos = "top";
        }
      } else if (position === "right") {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + 8;
        if (left + tipRect.width > window.innerWidth - 8) {
          left = rect.left - tipRect.width - 8; // fallback left
          actualPos = "left";
        }
      } else if (position === "left") {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - 8;
        if (left < 8) {
          left = rect.right + 8; // fallback right
          actualPos = "right";
        }
      }

      requestAnimationFrame(() => {
        setCoords({ top, left, actualPosition: actualPos });
      });
    }
  }, [isVisible, position]);

  // Clean up
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getBeakStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      width: "8px",
      height: "8px",
      backgroundColor: "var(--foreground)",
      transform: "rotate(45deg)",
      pointerEvents: "none",
    };

    switch (coords.actualPosition) {
      case "top":
        return {
          ...baseStyle,
          bottom: "-4px",
          left: "50%",
          marginLeft: "-4px",
        };
      case "bottom":
        return {
          ...baseStyle,
          top: "-4px",
          left: "50%",
          marginLeft: "-4px",
        };
      case "left":
        return {
          ...baseStyle,
          right: "-4px",
          top: "50%",
          marginTop: "-4px",
        };
      case "right":
        return {
          ...baseStyle,
          left: "-4px",
          top: "50%",
          marginTop: "-4px",
        };
      default:
        return baseStyle;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onPointerDown={showTooltip}
        onPointerUp={hideTooltip}
        onPointerCancel={hideTooltip}
        style={styles.tooltipWrapper}
      >
        {children}
      </div>
      {isVisible &&
        content &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{
              ...styles.tooltipPortal,
              top: coords.top,
              left: coords.left,
              opacity: 1,
              transform: "translateY(0)",
            }}
          >
            {content}
            <div style={getBeakStyle()} />
          </div>,
          document.body,
        )}
    </>
  );
}
