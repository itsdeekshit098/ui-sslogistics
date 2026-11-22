"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TooltipProps } from "./tooltip.types";
import { Beak, Bubble, Trigger } from "./tooltip.styles";

export function Tooltip({
  children,
  content,
  position = "top",
  delay = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    actualPosition: "top" | "bottom" | "left" | "right";
    beakX: number;
    beakY: number;
  }>({ top: 0, left: 0, actualPosition: position, beakX: 0, beakY: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (!content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setIsPositioned(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    const updateCoords = () => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const tipRect = tooltipRef.current.getBoundingClientRect();

      if (tipRect.width === 0 || tipRect.height === 0) return;

      let top = 0;
      let left = 0;
      let actualPos = position;
      let beakX = 0;
      let beakY = 0;

      if (position === "top" || position === "bottom") {
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        const originalLeft = left;

        if (left < 8) left = 8;
        if (left + tipRect.width > window.innerWidth - 8) {
          left = window.innerWidth - tipRect.width - 8;
        }
        beakX = originalLeft - left;

        if (position === "top") {
          top = rect.top - tipRect.height - 8;
          if (top < 8) {
            top = rect.bottom + 8;
            actualPos = "bottom";
          }
        } else {
          top = rect.bottom + 8;
          if (top + tipRect.height > window.innerHeight - 8) {
            top = rect.top - tipRect.height - 8;
            actualPos = "top";
          }
        }
      } else {
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        const originalTop = top;

        if (top < 8) top = 8;
        if (top + tipRect.height > window.innerHeight - 8) {
          top = window.innerHeight - tipRect.height - 8;
        }
        beakY = originalTop - top;

        if (position === "right") {
          left = rect.right + 8;
          if (left + tipRect.width > window.innerWidth - 8) {
            left = rect.left - tipRect.width - 8;
            actualPos = "left";
          }
        } else {
          left = rect.left - tipRect.width - 8;
          if (left < 8) {
            left = rect.right + 8;
            actualPos = "right";
          }
        }
      }

      setCoords({ top, left, actualPosition: actualPos, beakX, beakY });
      setIsPositioned(true);
    };

    // Calculate immediately
    updateCoords();

    const resizeObserver = new ResizeObserver(() => {
      updateCoords();
    });

    if (tooltipRef.current) {
      resizeObserver.observe(tooltipRef.current);
    }
    if (triggerRef.current) {
      resizeObserver.observe(triggerRef.current);
    }

    window.addEventListener("scroll", updateCoords, { passive: true });
    window.addEventListener("resize", updateCoords, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateCoords);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isVisible, position, content]);

  // Clean up
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <Trigger
        data-ui="tooltip-trigger"
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onPointerDown={showTooltip}
        onPointerUp={hideTooltip}
        onPointerCancel={hideTooltip}
      >
        {children}
      </Trigger>
      {isVisible &&
        content &&
        createPortal(
          <Bubble
            data-ui="tooltip"
            ref={tooltipRef}
            $top={coords.top}
            $left={coords.left}
            $beakX={coords.beakX}
            $beakY={coords.beakY}
            $positioned={isPositioned}
          >
            {content}
            <Beak $side={coords.actualPosition} />
          </Bubble>,
          document.body,
        )}
    </>
  );
}
