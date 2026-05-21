"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icon";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
          <h1 className="text-3xl font-black tracking-tighter text-[#091324] dark:text-[#F8FAFC] mb-2">
            SRI SRINIVASA
          </h1>
          <p className="text-muted-foreground text-sm">Operations Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm text-destructive bg-destructive/10 rounded-[var(--input-radius)] border border-destructive/20">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-input bg-background rounded-[var(--input-radius)] focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-input bg-background rounded-[var(--input-radius)] focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 rounded-sm"
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
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-medium transition-colors disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Sign in to Operations Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
