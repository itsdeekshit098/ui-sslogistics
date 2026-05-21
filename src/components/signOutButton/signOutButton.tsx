"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";

import type { SignOutButtonProps } from "./signOutButton.types";
import * as styles from "./signOutButton.style";

const SignOutButton: React.FC<SignOutButtonProps> = ({
  variant = "desktop",
}) => {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when modal closes
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

      await refreshSession();
      router.push("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to sign out. Please try again.";
      setError(message);
      setIsSigningOut(false);
      // Keep the modal open so the user can see the error
    }
  };

  const isDesktop = variant === "desktop";
  const isIcon = variant === "icon";

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
        <LogOutIcon
          size={isIcon ? 18 : 16}
          className="shrink-0"
        />
        {!isIcon && (
          <span className={cn("ml-2", isDesktop && "hidden sm:inline-block")}>
            Sign Out
          </span>
        )}
      </button>

      <Modal open={isOpen} onOpenChange={setIsOpen} nested disableBackdropClose disableEscapeClose>
        <ModalContent style={{ maxWidth: "28rem" }}>
          <ModalHeader>
            <ModalTitle>Sign Out</ModalTitle>
            <ModalDescription>
              Are you sure you want to sign out? You will need to log back in to
              access the Operations Portal.
            </ModalDescription>
          </ModalHeader>

          {error && <div style={styles.errorBanner}>{error}</div>}

          <ModalFooter>
            <button
              data-testid="sign-out-cancel-btn"
              onClick={() => setIsOpen(false)}
              disabled={isSigningOut}
              style={{
                ...styles.cancelBtn,
                opacity: isSigningOut ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              data-testid="sign-out-confirm-btn"
              onClick={handleSignOut}
              disabled={isSigningOut}
              style={{
                ...styles.confirmBtn,
                opacity: isSigningOut ? 0.7 : 1,
              }}
            >
              {isSigningOut ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Signing out</span>
                </>
              ) : (
                "Sign Out"
              )}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SignOutButton;
