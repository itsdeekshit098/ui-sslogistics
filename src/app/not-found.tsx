import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        gap: "1.5rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "5rem",
          fontWeight: 900,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: "var(--muted-foreground, #94a3b8)",
          opacity: 0.25,
        }}
      >
        404
      </div>
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "0.5rem",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            color: "var(--muted-foreground, #6b7280)",
            fontSize: "0.9375rem",
            maxWidth: "28rem",
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        style={{
          padding: "0.625rem 1.5rem",
          borderRadius: "9999px",
          border: "none",
          backgroundColor: "var(--primary, #0f172a)",
          color: "var(--primary-foreground, #fff)",
          fontWeight: 600,
          fontSize: "0.875rem",
          textDecoration: "none",
          transition: "opacity 0.15s ease",
        }}
      >
        Go to Home
      </Link>
    </div>
  );
}
