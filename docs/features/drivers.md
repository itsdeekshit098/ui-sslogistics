# Drivers

_Checked against the code on 2026-10-31._

## 1. Purpose

The single list of drivers everything else depends on: Attendance, Salaries, Diesel and Trips all pick a driver from this list, and deleting one is checked against every module that references them. This page is only identity and status (name, phone, place, licence, active/inactive) — pay rates, shift counts and attendance live on their own pages.

## 2. Who can do what

| | Admin / superadmin | Staff | Driver |
|---|---|---|---|
| Open `/admin/drivers`, see the list | Yes | Yes | No (page not in their nav) |
| Add a driver | Yes | Yes | — |
| Edit, deactivate/activate, delete | Yes | **No** — a deliberate choice; see below | — |
| `GET /api/drivers` (read any role is signed in, used by other modules' pickers) | Yes | Yes | Yes — currently sees `phone` and `dl_number` too; see §8 |

Staff can add a driver but cannot fix a typo in one they just added, nor deactivate or delete — only admin/superadmin can. This was confirmed as intended during live testing, not assumed.

## 3. The screen

Title "Drivers — Manage your fleet drivers and their details." One list, no detail page — everything happens from the list and its modal.

### Desktop (768px and wider)

A single panel: a search box ("Search by name, phone, place or DL...") and an **Add Driver** button (hidden from anyone who can't add), then a table — Name, Phone, Place, DL Number, Status (Active/Inactive badge) — with, for admin/superadmin only, row actions: **Deactivate**/**Activate**, **Edit**, **Delete**. Inactive drivers are hidden by default; a toggle shows them (the API's `include_inactive` flag). Pagination below the table.

### Phone (below 768px)

The table becomes a card list (the shared `DataTable` mobile mode); **Add Driver** moves to a floating button in the corner. Each card's actions live behind an "⋯" (Actions) button that opens a bottom sheet listing Deactivate/Activate, Edit, Delete by label, rather than a strip of icon buttons on every row — confirmed live by opening the sheet, not assumed from the component's doc comment.

### Add / Edit modal

Fields: Full Name (required), Phone (10 digits, must start 6–9), City or area, Driving licence number, a photo link (now must be an `http://` or `https://` URL — see §7). Save shows inline errors from the server rather than a generic failure.

## 4. Flows

**Add a driver**
1. Add Driver → fill in the fields → Save.
2. If the name normalizes to one already in the list (case/spacing ignored) or the licence number matches an existing one, the save is refused with a message naming that driver.
3. If the name is only *similar* to an existing one (e.g. "Mehaboob" vs "Mahaboob"), the save is paused with "…already exists — is this the same person?" and the matching driver(s) shown; confirming resends the same request with `confirm_similar: true` and the driver is created. This never overrides the exact-name or licence check above.

**Edit a driver:** Edit → change fields → Save. The same exact-name/licence checks run again (excluding the driver being edited, so saving your own unchanged name works); a similar-name warning is not shown on edit — the row already exists, so the real risk (splitting one person across two rows) is already covered by the exact/licence checks.

**Deactivate / Activate:** one click, no confirmation. A deactivated driver disappears from the default list and from every other module's "active driver" picker (attendance, diesel, trip bookings) immediately, but their past attendance and salary records are untouched — those are separate tables keyed by driver id, not filtered by `is_active`.

**Delete a driver:** only works for a driver with no history anywhere (no attendance, salary rate, salary entry, settlement, shift-count record, pay-type record, trip-count record, external trip or trip booking). In practice this means a driver added by mistake and never touched — see `.claude/rules/record-deletion.md`. Attempting to delete one with history is refused with a message naming what's attached and how many rows ("linked to 1 shift-count record(s). Deactivate them instead."); nothing is deleted.

**Search:** matches name, phone, place or licence number, case-insensitively, against the currently-visible scope (active only, or active+inactive). A search term made entirely of characters that have special meaning to the database (e.g. `%`, `_`, `(`) returns no results rather than silently showing everyone — confirmed live, this was a real bug until this pass (see §7).

## 5. Rules the user can notice

- **A driver can't be deleted once they've been used anywhere.** Deactivate is the real "remove" action for a driver who's left; delete only clears out a mistaken add.
- **Deactivating is instant and silent everywhere else.** A driver dropped from attendance mid-month simply stops appearing for new days; their earlier marks for that month are unaffected.
- **The exact-name and licence-number checks can't be waived**, even by confirming a similar-name warning — those two always block the save.
- **A renamed driver's new name shows up everywhere else immediately** (attendance, salaries, diesel, trip pickers) — there's one `drivers` table, nothing else caches the name.

## 6. Where it lives

| What | Where |
|---|---|
| Page | `/admin/drivers` (`admin`, `staff`, `superadmin` in `src/lib/routePermissions.ts`; the `driver` role has no nav entry for it) |
| Components | `src/components/driversPage/` (`driversPage.tsx`, types), `src/components/addDriverModal/` (`addDriverModal.tsx`, styles, types) |
| API | `GET/POST/PUT/DELETE /api/drivers` (`src/app/api/drivers/route.ts`) — GET is `requireUserAuth()` (every role), POST is `requireAdminAuth()` (admin/staff/superadmin), PUT/DELETE are `requireStrictAdminAuth()` (admin/superadmin only) |
| SQL | `sql/49_drivers_normalized_name_unique.sql` (DB-level exact-normalized-name and licence uniqueness, a hard backstop behind the API's own checks) |
| Rule file | `.claude/rules/record-deletion.md` ("Deleting a driver") |
| Tests | `test/app/api/drivers/route.test.ts`, `test/app/api/drivers/duplicates.test.ts` |
| Flutter | `../mobile_sslogistics/lib/features/drivers/` (`screens/drivers_screen.dart`, `data/driver_repository.dart`, `driver_models.dart`) — does **not** yet handle the similar-name confirm flow; see §8 |

## 7. Why it works this way

This drivers live-test pass (2026-10-31) found and fixed several bugs rather than deliberate design, recorded here so they aren't mistaken for intended behaviour if seen again:

- `PUT /api/drivers` used to crash with a 500 on any problem with the id — malformed, or simply one that no longer exists (a stale id from a double-click after a delete would trigger this on real use, not just an adversarial request). Fixed: a missing/invalid id is now a clean 400, a well-formed but nonexistent one is a clean 404.
- `is_active: "false"` (a string, as some clients send booleans) used to be accepted and silently left the driver **active** — `Boolean("false")` is `true` in JavaScript. Fixed: only an actual boolean is accepted now; anything else is a 400.
- Malformed JSON on add or edit used to 500. Fixed with `readJsonObject()`, matching the convention used elsewhere in the codebase.
- A non-string `name` (e.g. a JSON number) used to crash on `.trim()`. Fixed with an explicit type check.
- There was no length cap on name/place/licence number; a 5000-character name saved without complaint. Fixed with sane caps (200/200/50 characters).
- The photo-link field accepted any scheme, including `javascript:`. Fixed: only `http://`/`https://` is accepted now.
- `/admin/drivers/new` was a second, unrelated "Add Driver" page with a non-functional Save button (no handler was ever wired up) — a dead end that looked completely real to a user who found it. Removed; the only way to add a driver is the modal.
- Searching with only punctuation-like characters (`%`, `_`, `(` …) used to silently return every driver instead of none, because the characters are stripped before building the database filter and an empty filter matches everything. Fixed to return no results when nothing searchable is left after stripping.
- **The driver role can no longer read a colleague's licence number.** `GET /api/drivers` now returns `dl_number: null` for that role; every other field, and every other role, is unchanged. `phone` was deliberately **kept** for the driver role after checking the mobile code — the diesel driver picker (`driver_picker_sheet.dart`) shows it as a subtitle and uses it in its own search, so removing it would have broken that screen. See [0008](../decisions/0008-driver-visibility-and-mobile-similar-name.md).

## 8. Not built / open questions

- **The Flutter app has no handling for the similar-name confirmation flow.** A mobile user trying to add a driver with a name close to an existing one gets a generic error with no way to confirm and proceed — they'd need the web app. See [0008](../decisions/0008-driver-visibility-and-mobile-similar-name.md).
- **Role checks (staff, driver) were tested for this page's visibility and add-only permission**, but the full staff/driver sweep (every control disabled, every write 403'd from a hand-made request) was deferred to a later pass — see the coverage table in `.claude/rules/live-testing.md`.
- **The phone layout, duplicate-name/licence checks, search, delete gate and effects on attendance/salaries/diesel pickers were all driven live** and passed without changes needed.
