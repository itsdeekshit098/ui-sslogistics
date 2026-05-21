"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log to an error reporting service (e.g. Sentry)
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        gap: "1.5rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "3.5rem",
          height: "3.5rem",
          borderRadius: "50%",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.25rem",
        }}
      >
        ⚠
      </div>
      <div>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "0.375rem",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            color: "var(--muted-foreground, #6b7280)",
            fontSize: "0.875rem",
            maxWidth: "24rem",
            lineHeight: 1.6,
          }}
        >
          An error occurred while loading this page. Please try again.
        </p>
      </div>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "9999px",
          border: "none",
          backgroundColor: "var(--primary, #0f172a)",
          color: "var(--primary-foreground, #fff)",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: "pointer",
          transition: "opacity 0.15s ease",
        }}
      >
        Try Again
      </button>
    </div>
  );
}
