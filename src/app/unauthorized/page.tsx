"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/utils/supabase/client";

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(searchParams.get("email"));
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // If no email in URL, fetch it from session
    if (!email) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) setEmail(data.user.email);
      });
    }
  }, [email]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleGoHome = () => {
    router.push("/");
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#DC2626]">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-slate-600 mb-6">
        The account <span className="font-medium text-slate-900">{email || "you're using"}</span> does not have administration privileges to access the Operations Portal.
      </p>

      <div className="space-y-3">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full py-2.5 px-4 bg-[#DC2626] hover:bg-red-700 text-white rounded-full font-medium transition-colors disabled:opacity-70"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
        
        <button
          onClick={handleGoHome}
          className="w-full py-2.5 px-4 bg-transparent border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full font-medium transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4FF] p-4">
      <Suspense fallback={<div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center text-slate-500">Checking authorization...</div>}>
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
