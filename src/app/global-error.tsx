"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches errors thrown in the root layout (src/app/layout.tsx) itself —
 * the one place src/app/error.tsx and src/app/admin/error.tsx can't
 * reach, since a segment-level error.tsx assumes the layout above it
 * rendered successfully. Must render its own <html>/<body> because it
 * replaces the root layout entirely when it fires.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "1.5rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Something went wrong
            </h2>
            <p style={{ color: "#6b7280", fontSize: "0.9375rem", maxWidth: "28rem", lineHeight: 1.6 }}>
              An unexpected error occurred. Please try again or contact support if
              the issue persists.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "9999px",
              border: "1px solid #d1d5db",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
