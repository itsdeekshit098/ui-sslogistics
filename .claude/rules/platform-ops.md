---
paths:
  - "scripts/**"
  - ".github/**"
  - "src/app/api/activity-log/**"
  - "src/app/api/system/**"
  - "src/app/api/notifications/**"
  - "src/app/api/admin/**"
  - "src/lib/sentry/**"
  - "instrumentation*.ts"
  - "next.config.ts"
  - "src/utils/supabase/middleware.ts"
  - "src/app/api/loans/**"
---

# Activity log, scheduled jobs, maintenance, push and Sentry

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: automatically when Claude reads scripts/, .github/, the activity-log / system / notifications /
  admin API routes, Sentry config, next.config.ts, the auth middleware, or the loans routes.
WHY: these are the "invisible" parts — daily GitHub Actions scripts, the EMI auto-settle (a deliberate product
  decision, not a bug), maintenance mode, push tokens and error tracking. Nothing in the UI shows them, so
  they are easy to break without noticing.
EXAMPLE: before touching scripts/check-loan-emis.js, read why it inserts payment rows by itself.
-->

## Activity log retention

`activity_log` is append-only except for one path: `DELETE /api/activity-log?before=<iso>`, superadmin-only, driven by the "Clear Old Logs" button on `/admin/activity-log`. The server refuses any cutoff newer than `MIN_RETENTION_DAYS` (60), the UI runs a `?dryRun=true` count before the real delete, and the purge writes its own `PURGE_ACTIVITY_LOG` entry *after* deleting so the record of it survives. Deleting here does not break the money audit trail — `loan_payments`, `funding_entries` and `client_ledger_entries` each carry their own `created_by`, and reversals stay on the ledger permanently.

## Scheduled jobs

Daily GitHub Actions in `.github/workflows/`, each running a standalone CommonJS script from `scripts/` that talks to Supabase directly with the service-role key (they do not go through Next.js). `check-loan-emis.js` warns a day before each EMI, nags at 1/7/15/30 days overdue, and flags a loan reaching its final installment; it dedupes against the `notifications` table by `type` + metadata before sending, so a re-run can't double-notify.

Before any of that, the same script **auto-settles** every EMI whose due date has passed with nothing logged against it (`autoSettleOverdueEmis`): it inserts a real `loan_payments` row itself (`payment_method: 'AUTO'`, `paid_on` = the due date), on the assumption the mandate went through. This is a deliberate product decision, not a bug — it trades ledger accuracy for zero manual "mark paid" clicks, on the basis that a genuine miss gets caught externally (the lender chases it) rather than by the app. Consequences worth knowing before touching this code: `loan_balances.outstanding` and `loan_installment_state.status` will read as paid/settled for money that was only assumed, not confirmed; every auto-row is tagged and logged to `activity_log` (`CREATE_LOAN_PAYMENT`, `details.auto: true`) and shows its origin in the loan detail payment history (notes + `payment_method: "AUTO"`) precisely so a real miss can be found and reversed through the normal reversal endpoint — there is no automated un-settling. `BOUNCED` installments are deliberately excluded (that `manual_status` already means a mandate is *known* to have failed, so auto-paying over it would hide a confirmed problem). A `loan_emi_auto_settled` notification fires per auto-settled installment so admins still have visibility without needing to act.

## Maintenance mode and push notifications

`system_settings` (`sql/19`) is a singleton row (`maintenance_mode`, `maintenance_message`) with no dedicated write route in this codebase — it's flipped by hand in Supabase, and `GET /api/system/maintenance-stream` (no auth, must work pre-login) is an SSE stream polling it every second so clients react without reloading. `GET /api/system/app-version` is likewise unauthenticated, backing the minimum-app-version gate mentioned under auth architecture.

`device_push_tokens` (`sql/21`) stores one FCM token per `(user_id, token)` pair with a `platform`. `POST /api/notifications/register-device` (any logged-in role) reassigns a token away from any other user before upserting it for the caller, so a forced logout on shared/reused devices can't leave push notifications going to the wrong account; `DELETE ?token=` unregisters the caller's own token on sign-out.

## Error tracking (Sentry)

- `@sentry/nextjs` is initialized via `instrumentation.ts` (server/edge) and `instrumentation-client.ts` (browser), sharing options from `src/lib/sentry/options.ts`. `next.config.ts` is wrapped with `withSentryConfig` for source-map upload.
- **PII-safe by design**: `sendDefaultPii: false` plus a `beforeSend` scrubber strip cookies, auth headers, and request bodies before events leave the process — mirroring the no-PII contract in `src/lib/logger.ts`. User context attached via `src/lib/sentry/setUser.ts` is **id + role only**, never email.
- Capture happens at the app's existing error funnels rather than scattered call sites: the generic-500 branch of `handleApiError` (`src/lib/apiResponse.ts`, skips the expected `UNAUTHORIZED`/`FORBIDDEN`/`MAINTENANCE` cases) and the `error.tsx` / `admin/error.tsx` / `global-error.tsx` boundaries.
- Required env vars (see `.env.local`): `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT`. `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` are build-time only (source-map upload) — the build succeeds without them, just with unminified stack traces missing in Sentry.
- The Sentry tunnel route (`/monitoring`, set via `tunnelRoute` in `next.config.ts`) is listed in `MAINTENANCE_EXEMPT_PATHS` (`src/utils/supabase/middleware.ts`) so client error reports aren't blocked during maintenance mode.
