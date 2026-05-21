export default function RootLoading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "2rem",
            height: "2rem",
            border: "3px solid var(--border, #e2e8f0)",
            borderTopColor: "var(--primary, #0f172a)",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
        <span
          style={{
            fontSize: "0.875rem",
            color: "var(--muted-foreground, #6b7280)",
            fontWeight: 500,
          }}
        >
          Loading...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}
