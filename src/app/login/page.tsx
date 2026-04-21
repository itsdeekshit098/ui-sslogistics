"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setIsLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4 relative">
      <Link
        href="/"
        className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </Link>

      <div className="w-full max-w-md bg-card rounded-[var(--modal-radius)] shadow-[var(--card-shadow)] border border-border p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-destructive mb-2">
            Sri Srinivasa
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-input bg-background rounded-[var(--input-radius)] focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors"
              placeholder="••••••••"
            />
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
