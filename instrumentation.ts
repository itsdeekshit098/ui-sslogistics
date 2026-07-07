import * as Sentry from "@sentry/nextjs";

/**
 * Next.js calls `register()` once per server runtime on boot. It's the
 * entry point for anything that needs to run before request handling
 * starts — here, initializing Sentry for whichever runtime is active.
 *
 * NEXT_RUNTIME is set by Next.js itself (not something we configure):
 * "nodejs" for normal server code (API routes, RSC), "edge" for code
 * running in src/proxy.ts / edge middleware. Each runtime gets its own
 * Sentry.init() because they need different transports under the hood.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Auto-captures errors thrown inside Server Components, Route Handlers,
// and Server Actions that Next.js's own error handling intercepts —
// these wouldn't otherwise reach our try/catch blocks in handleApiError.
export const onRequestError = Sentry.captureRequestError;
