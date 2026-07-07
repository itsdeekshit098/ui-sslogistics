"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next.js renders this boundary for errors thrown during render in
    // this route segment. It doesn't go through handleApiError (that's
    // API-route only), so it needs its own explicit capture here.
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1.5rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "4rem",
          height: "4rem",
          borderRadius: "50%",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
        }}
      >
        ⚠
      </div>
      <div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "0.5rem",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "var(--muted-foreground, #6b7280)",
            fontSize: "0.9375rem",
            maxWidth: "28rem",
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. Please try again or contact support if
          the issue persists.
        </p>
      </div>
      <Button
        onClick={reset}
        style={{
          padding: "0.625rem 1.5rem",
          borderRadius: "9999px",
        }}
      >
        Try Again
      </Button>
    </div>
  );
}
