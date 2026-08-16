"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loadingSpinner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const reason = searchParams.get("reason");
    if (reason === "idle_timeout") {
      return "You were signed out due to inactivity. Please sign in again.";
    }
    if (reason === "session_expired") {
      return "Your session ended because this account was signed in on another device. Please sign in again.";
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || "Invalid email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      await refreshSession();
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 relative">
      <Link
        data-testid="app-login-link-1"
        href="/"
        className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
      >
        <ArrowLeftIcon size={16} className="mr-2" />
        Back to Home
      </Link>

      <div className="w-full max-w-md bg-card rounded-[var(--modal-radius)] shadow-[var(--card-shadow)] border border-border p-8">
        <div className="text-center mb-8">
          <Image
            src="/logo/sslogo.png"
            alt="Sri Srinivasa Logo"
            width={280}
            height={50}
            style={{ margin: "0 auto 1rem", objectFit: "contain" }}
            priority
          />
          <p className="text-muted-foreground text-sm">Operations Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm text-destructive bg-destructive/10 rounded-[var(--input-radius)] border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="••••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                disabled={isLoading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground rounded-sm"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={showPassword ? "hide" : "show"}
                    initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={16} />
                    ) : (
                      <EyeIcon size={16} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full py-2.5 h-auto"
          >
            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
            {isLoading ? "Signing in..." : "Sign in to Operations Portal"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the app router
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
