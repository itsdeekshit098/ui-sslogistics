"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
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
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  const isDesktop = variant === "desktop";

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
            onClick={() => setIsOpen(false)}
            disabled={isSigningOut}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-70 min-w-[100px]"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
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
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isDesktop
            ? "gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-red-50 hover:text-red-700 hover:border-red-200"
            : "mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 transition-all duration-200 justify-start border border-slate-100",
        )}
      >
        <LogOut
          className={cn(
            "shrink-0",
            isDesktop ? "w-4 h-4" : "h-5 w-5 md:h-4 md:w-4",
          )}
        />
        <span className={cn(isDesktop && "hidden sm:inline-block")}>
          Sign Out
        </span>
      </button>

      {mounted && createPortal(dialogHtml, document.body)}
    </>
  );
};

export default SignOutButton;
