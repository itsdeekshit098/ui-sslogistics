# 0008 — Driver-role visibility on `/api/drivers`, and Flutter's missing similar-name flow

- **Status:** Accepted (driver-role visibility) / Open (Flutter similar-name flow)
- **Date:** 2026-10-31
- **Area:** drivers (`src/app/api/drivers/route.ts`, `../mobile_sslogistics/lib/features/drivers/`, `lib/features/diesel/`)

## Situation

A live test of the Drivers module (admin role) found two gaps:

1. `GET /api/drivers` is open to every signed-in role (`requireUserAuth()`), and returns every field — including `phone` and `dl_number` — to all of them. The initial assumption was that the driver role's screens only need a driver's id and name, so both fields looked like unnecessary exposure.
2. The web Add Driver modal handles a near-duplicate name by returning `409 SIMILAR_DRIVER_EXISTS` with the matches, so the person can confirm "yes, different person" and resend with `confirm_similar: true`. The Flutter app's `DriverRepository.createDriver` just calls `unwrapResponse`, which throws a generic error on any non-success response — there is no code path that reads `code: "SIMILAR_DRIVER_EXISTS"` or resends with `confirm_similar`. A mobile user trying to add a driver whose name is close to an existing one (e.g. two brothers, "Ramesh" and "Rameshu") gets stuck with an unexplained failure and no way past it from the app.

## Options considered

1. **Strip both `phone` and `dl_number` for the driver role** — the first instinct. **Rejected after checking the mobile code**: `lib/features/diesel/widgets/driver_picker_sheet.dart` displays `driver.phone` as a subtitle under each driver's name and uses it in the picker's own local search — stripping it would have silently broken that screen for the one role it exists for.
2. **Strip only `dl_number`** — grepped every driver-picker screen (diesel, external trips, trip bookings) in both apps; nothing reads `dl_number` anywhere outside the Drivers management screen itself, which the driver role can't open. **Chosen.**
3. **Leave both as is** — simplest, but keeps handing a licence number to a role that has no screen that shows one.
4. **Build the Flutter confirm-similar flow** — add a `SimilarDriverException` (or similar) that `DriverRepository.createDriver` throws instead of letting `unwrapResponse` throw generically, so the screen can show the same "is this the same person?" prompt the web modal shows and resend with `confirm_similar: true`. A real feature addition on the mobile side, done as a separate pass in that repo rather than folded in here.

## Decision

`GET /api/drivers` now returns `dl_number: null` (not the real value) when the caller's role is `driver`; `phone` is unchanged for every role, since it's genuinely used by the diesel driver picker. Every other field, and every other role, is unaffected. The Flutter similar-name flow is explicitly deferred to its own pass in `../mobile_sslogistics` — not decided against, just not bundled into this web-side pass.

## Consequences

- A driver account can no longer read a colleague's licence number via `GET /api/drivers`, closing the one piece of exposure nothing actually used.
- `phone` stays visible to every role on purpose — removing it would have been a regression in the diesel picker, caught by reading the Flutter code before acting on the first instinct rather than after.
- The Flutter similar-name gap remains: a mobile user with a genuine near-duplicate name still can't add that driver from the app. Tracked, not fixed yet.

## Where it shows up

- `src/app/api/drivers/route.ts` (`GET`) — the `dl_number: null` masking for the driver role
- `test/app/api/drivers/route.test.ts` — "withholds dl_number from the driver role but keeps phone", "keeps dl_number for admin, staff and superadmin"
- `test/support/fixtures.ts` — `DRIVER_USER`, added for this test
- `../mobile_sslogistics/lib/features/diesel/widgets/driver_picker_sheet.dart` — the reason `phone` was kept
- `../mobile_sslogistics/lib/features/drivers/data/driver_repository.dart` (`createDriver`) — still needs the confirm-similar flow
- `docs/features/drivers.md` — §7 and §8
- `docs/known-issues.md`
