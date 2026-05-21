/**
 * Structured logger for server-side API routes.
 *
 * Outputs structured JSON to stdout/stderr so logs can be parsed
 * by observability tools (Vercel Log Drains, Datadog, etc.).
 *
 * NEVER logs user PII (passwords, tokens, full emails) or stack traces.
 * Use `context` for safe, non-sensitive metadata only.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
  };

  const output = formatEntry(entry);

  if (level === "error") {
    // Use stderr for errors so they're captured separately by log aggregators
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) =>
    log("info", message, context),

  warn: (message: string, context?: Record<string, unknown>) =>
    log("warn", message, context),

  error: (message: string, context?: Record<string, unknown>) =>
    log("error", message, context),
};
