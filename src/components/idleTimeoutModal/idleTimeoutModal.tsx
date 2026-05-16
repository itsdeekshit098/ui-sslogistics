"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdleTimeoutModalProps } from "./idleTimeoutModal.types";
import * as styles from "./idleTimeoutModal.style";

export function IdleTimeoutModal({
  open,
  secondsLeft,
  onStay,
  onLogout,
}: IdleTimeoutModalProps) {
  if (!open) return null;

  const modal = (
    <div style={styles.overlay}>
      <div 
        style={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-modal-title"
        aria-describedby="idle-modal-desc"
      >
        <div style={styles.iconCircle}>
          <Clock
            style={{ width: "1.5rem", height: "1.5rem", color: "#eab308" }}
          />
        </div>

        <h2 id="idle-modal-title" style={styles.title}>Session Expiring</h2>

        <p id="idle-modal-desc" style={styles.description}>
          You&apos;ve been inactive for a while. For security, you&apos;ll be
          automatically logged out.
        </p>

        <div style={styles.countdown}>{secondsLeft}s</div>

        <div style={styles.buttonRow}>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onLogout}
          >
            Log Out Now
          </Button>
          <Button className="flex-1" onClick={onStay} autoFocus>
            Stay Logged In
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
