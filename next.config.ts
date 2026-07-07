import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// withSentryConfig wraps the Next.js build (not the runtime) to upload
// source maps to Sentry after `next build`, so production stack traces
// show real file/line numbers instead of minified code. It also injects
// the /monitoring rewrite (see tunnelRoute below).
export default withSentryConfig(nextConfig, {
  // Identify which Sentry org/project to upload to, and authenticate the
  // upload. All three live in .env.local; see SENTRY_ORG etc. there.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // If org/project/authToken are missing (e.g. a teammate's machine, or
  // CI without the secret), upload is skipped gracefully — the build
  // still succeeds, it just won't have readable stack traces in Sentry.
  widenClientFileUpload: true,
  sourcemaps: {
    // Source maps are uploaded straight to Sentry; delete the on-disk
    // copies afterward so they don't ship to the browser (they'd expose
    // original source, which we don't want public).
    deleteSourcemapsAfterUpload: true,
  },

  // Browser extensions/ad-blockers commonly block requests to
  // ingest.sentry.io. tunnelRoute makes the browser send error reports to
  // our own domain (/monitoring) instead, which withSentryConfig then
  // proxies to Sentry server-side. Because /monitoring isn't under /api
  // or /admin, it's already outside the auth gate in
  // src/utils/supabase/middleware.ts — it's also explicitly added to
  // that file's MAINTENANCE_EXEMPT_PATHS so it stays reachable even when
  // maintenance mode is on.
  tunnelRoute: "/monitoring",

  // Sentry's own build-time console logging / telemetry — noise we don't
  // need in our build output.
  disableLogger: true,
  telemetry: false,
});
