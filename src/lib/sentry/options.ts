import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Runs on every event right before Sentry sends it (wired up via
 * `beforeSend` below). Strips anything that could carry PII or secrets:
 * cookies, auth headers, and request bodies. Mirrors the no-PII contract
 * that src/lib/logger.ts already enforces for stdout/stderr logs — we
 * don't want Sentry to be a backdoor around that guarantee.
 */
function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data; // request body — may contain form/API payloads

    if (event.request.headers) {
      // Copy first: `event.request.headers` may be the same object Sentry
      // reuses internally, so mutating it in place could leak into other
      // events processed around the same time.
      const headers = { ...event.request.headers };
      delete headers.authorization;
      delete headers.Authorization;
      delete headers.cookie;
      delete headers.Cookie;
      event.request.headers = headers;
    }
  }

  return event;
}

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Shared Sentry.init() options used by all three runtimes (server, edge,
 * client — see sentry.server.config.ts, sentry.edge.config.ts,
 * instrumentation-client.ts). Keeping them in one place means the PII
 * scrubbing and sampling rules can't silently drift between runtimes.
 */
export const baseSentryOptions = {
  dsn,
  // No DSN (e.g. a teammate's machine without .env.local secrets) → Sentry
  // becomes a silent no-op instead of erroring or spamming a dead DSN.
  enabled: Boolean(dsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV,
  // Tags events with the deployed commit so you can tell which release
  // introduced a regression. Vercel sets this automatically; it's
  // undefined locally, which Sentry treats as "no release" — fine for dev.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Percentage of requests that get full performance tracing (not just
  // errors). 100% locally since dev traffic is low; 10% in prod to keep
  // Sentry's quota/cost in check on a live app.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Don't let Sentry auto-attach IP/user data itself — we opt in
  // explicitly and minimally via src/lib/sentry/setUser.ts instead.
  sendDefaultPii: false,
  beforeSend(event: ErrorEvent) {
    return scrubEvent(event);
  },
};
