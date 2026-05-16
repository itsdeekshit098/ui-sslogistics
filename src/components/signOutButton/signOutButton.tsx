"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import type { SignOutButtonProps } from "./signOutButton.types";
import * as styles from "./signOutButton.style";

const SignOutButton: React.FC<SignOutButtonProps> = ({
  variant = "desktop",
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clear error when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || "Sign out failed");

      // We flush the router state and push instead of refresh so auth boundary catches cleanly.
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to sign out. Please try again.";
      setError(message);
      setIsSigningOut(false);
      // Keep the modal open so the user can see the error
    }
  };

  const isDesktop = variant === "desktop";
  const isIcon = variant === "icon";

  const dialogHtml = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Sign Out</DialogTitle>
          <DialogDescription>
            Are you sure you want to sign out? You will need to log back in to
            access the Operations Portal.
          </DialogDescription>
        </DialogHeader>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <button
            data-testid="sign-out-cancel-btn"
            onClick={() => setIsOpen(false)}
            disabled={isSigningOut}
            style={styles.cancelBtn}
            className="hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            data-testid="sign-out-confirm-btn"
            onClick={handleSignOut}
            disabled={isSigningOut}
            style={styles.confirmBtn}
            className="hover:bg-red-700 transition-colors disabled:opacity-70"
          >
            {isSigningOut ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Signing out</span>
              </>
            ) : (
              "Sign Out"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <button
        data-testid="sign-out-trigger-btn"
        onClick={() => setIsOpen(true)}
        style={{
          ...styles.triggerButton,
          ...(isIcon
            ? styles.iconTrigger
            : isDesktop
              ? styles.desktopTrigger
              : styles.mobileTrigger),
        }}
        className={cn(
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isIcon && "hover:bg-red-50",
        )}
      >
        <LogOut
          className={cn(
            "shrink-0",
            isIcon
              ? "h-[18px] w-[18px]"
              : isDesktop
                ? "w-4 h-4"
                : "h-5 w-5 md:h-4 md:w-4",
          )}
        />
        {!isIcon && (
          <span className={cn("ml-2", isDesktop && "hidden sm:inline-block")}>
            Sign Out
          </span>
        )}
      </button>

      {mounted && createPortal(dialogHtml, document.body)}
    </>
  );
};

export default SignOutButton;

