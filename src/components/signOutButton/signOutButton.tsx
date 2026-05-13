"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LoadingSpinner } from "@/components/loadingSpinner";
import { createClient } from "@/utils/supabase/client";
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

const SignOutButton: React.FC<SignOutButtonProps> = ({
  variant = "desktop",
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      // We flush the router state and push instead of refresh so auth boundary catches cleanly.
      router.push("/");
      router.refresh();
    } catch {
      setIsSigningOut(false);
      setIsOpen(false);
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
        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <button
            data-testid="sign-out-cancel-btn"
            onClick={() => setIsOpen(false)}
            disabled={isSigningOut}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            data-testid="sign-out-confirm-btn"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-70 min-w-[100px]"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <button
        data-testid="sign-out-trigger-btn"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isIcon
            ? "justify-center rounded-lg p-2.5 text-muted-foreground hover:bg-red-50 cursor-pointer"
            : isDesktop
              ? "gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm cursor-pointer"
              : "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground transition-all duration-200 justify-start cursor-pointer",
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
          <span className={cn(isDesktop && "hidden sm:inline-block")}>
            Sign Out
          </span>
        )}
      </button>

      {mounted && createPortal(dialogHtml, document.body)}
    </>
  );
};

export default SignOutButton;
