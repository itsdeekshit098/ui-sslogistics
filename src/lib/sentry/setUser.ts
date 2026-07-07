import * as Sentry from "@sentry/nextjs";

/**
 * Attaches user context to whatever Sentry event fires next on this
 * request/session — id + role ONLY. Never pass email or other PII here;
 * that's the whole reason this wrapper exists instead of calling
 * Sentry.setUser() directly at call sites (harder to get wrong).
 *
 * Called from src/lib/auth.ts's getAuthUser(), so any error captured
 * after an authenticated request is automatically tagged with who hit it.
 */
export function setSentryUser(user: { id: string; role: string | null }) {
  Sentry.setUser({ id: user.id, role: user.role ?? undefined });
}
