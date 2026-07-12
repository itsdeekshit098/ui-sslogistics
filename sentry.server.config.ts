/**
 * Sentry init for the Node.js server runtime (API routes, RSC, Server
 * Actions). Loaded by instrumentation.ts's register() — not imported
 * directly anywhere else.
 */
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/sentry/options";

Sentry.init(baseSentryOptions);
