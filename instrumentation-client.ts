/**
 * Runs in the browser only. Next.js loads this automatically for any
 * client bundle — no explicit import needed anywhere else in the app.
 * This is the browser counterpart to sentry.server.config.ts /
 * sentry.edge.config.ts (see instrumentation.ts for those).
 */
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/options";

Sentry.init({
  ...baseSentryOptions,
  // Records page-load/navigation performance spans so slow pages show up
  // in Sentry alongside errors, not just crashes.
  integrations: [Sentry.browserTracingIntegration()],
});

// Next.js calls this on every client-side route change so navigation
// shows up as breadcrumbs/spans in Sentry (useful for "what did the user
// click right before this error" context).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
