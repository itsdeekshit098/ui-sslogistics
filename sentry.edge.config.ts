/**
 * Sentry init for the Edge runtime — this covers src/proxy.ts (our
 * middleware), which runs on the edge, not Node.js. Loaded by
 * instrumentation.ts's register() — not imported directly anywhere else.
 */
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/options";

Sentry.init(baseSentryOptions);
