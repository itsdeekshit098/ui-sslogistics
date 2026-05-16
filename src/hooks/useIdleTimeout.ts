"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  /** Total idle time (ms) before the warning modal appears */
  idleMs: number;
  /** Duration (ms) the warning modal is shown before auto-logout */
  warningMs: number;
  /** Called when the countdown expires and the user should be logged out */
  onTimeout: () => void;
}

interface UseIdleTimeoutReturn {
  /** Whether the warning modal should be displayed */
  showWarning: boolean;
  /** Seconds remaining on the countdown (only meaningful when showWarning = true) */
  secondsLeft: number;
  /** Call this to dismiss the warning and reset the idle timer */
  stayLoggedIn: () => void;
}

/**
 * Tracks user activity and triggers a two-stage idle timeout:
 *   1. After `idleMs` of inactivity → `showWarning` becomes true.
 *   2. After an additional `warningMs` → `onTimeout()` fires.
 *
 * Activity events are throttled so we update state at most once
 * every THROTTLE_MS to avoid unnecessary re-renders.
 */
export function useIdleTimeout({
  idleMs,
  warningMs,
  onTimeout,
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(warningMs / 1000),
  );

  // Refs to avoid stale closures inside timers/listeners
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const warningActiveRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  // Initialise impure values inside an effect (React purity rules)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Keep callback ref fresh
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // ── Helpers ──────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  /**
   * Schedule the idle → warning → timeout cascade.
   * Only schedules timers (no synchronous setState) so it can safely
   * be called from inside a useEffect body.
   */
  const scheduleIdleTimer = useCallback(() => {
    clearTimers();
    warningActiveRef.current = false;

    idleTimerRef.current = setTimeout(() => {
      // Idle period elapsed → show warning + start countdown
      warningActiveRef.current = true;
      setShowWarning(true);

      let remaining = Math.ceil(warningMs / 1000);
      setSecondsLeft(remaining);

      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) {
          clearTimers();
          onTimeoutRef.current();
        }
      }, 1000);
    }, idleMs);
  }, [idleMs, warningMs, clearTimers]);

  /** User chose to stay — reset everything */
  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsLeft(Math.ceil(warningMs / 1000));
    scheduleIdleTimer();
  }, [warningMs, scheduleIdleTimer]);

  // ── Activity Listener ───────────────────────────────────

  useEffect(() => {
    // Kick off the first idle timer (no synchronous setState here)
    scheduleIdleTimer();

    const handleActivity = () => {
      // Ignore activity while the warning countdown is visible
      if (warningActiveRef.current) return;

      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;

      lastActivityRef.current = now;
      scheduleIdleTimer(); // reset
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, handleActivity, { passive: true }),
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) =>
        document.removeEventListener(evt, handleActivity),
      );
    };
  }, [scheduleIdleTimer, clearTimers]);

  return { showWarning, secondsLeft, stayLoggedIn };
}

