"use client";

import { useEffect, useCallback, useRef } from "react";

/** Activity events that reset the idle timer */
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

/** Minimum ms between activity timestamp updates (performance throttle) */
const THROTTLE_MS = 30_000; // 30 seconds

interface UseIdleTimeoutOptions {
  /** Total idle time (ms) before auto-logout fires */
  idleMs: number;
  /** Called when the idle period expires — user should be logged out */
  onTimeout: () => void;
}

/**
 * Tracks user activity and silently logs out after `idleMs` of inactivity.
 *
 * Activity events are throttled so we reset the timer at most once
 * every THROTTLE_MS to avoid unnecessary work.
 */
export function useIdleTimeout({
  idleMs,
  onTimeout,
}: UseIdleTimeoutOptions): void {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const onTimeoutRef = useRef(onTimeout);

  // Initialise impure values inside an effect (React purity rules)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Keep callback ref fresh
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleTimer = useCallback(() => {
    clearTimer();
    idleTimerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, idleMs);
  }, [idleMs, clearTimer]);

  useEffect(() => {
    // Kick off the first idle timer
    scheduleIdleTimer();

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;

      lastActivityRef.current = now;
      scheduleIdleTimer(); // reset
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, handleActivity, { passive: true }),
    );

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((evt) =>
        document.removeEventListener(evt, handleActivity),
      );
    };
  }, [scheduleIdleTimer, clearTimer]);
}
