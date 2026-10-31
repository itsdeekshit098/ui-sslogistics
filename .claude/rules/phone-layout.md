---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/globals.css"
  - "e2e-visual/**"
---

# Phone layout (mirrors the Flutter app)

<!--
WHAT THIS FILE IS: a rule — project knowledge that Claude reads, not a program.
WHEN IT LOADS: automatically, the first time Claude reads a file matching the `paths:` list above
  (any component, page, globals.css or visual test). Example: opening src/components/loansPage/loansPage.tsx.
WHY: the phone layout copies the Flutter app and must never change desktop pixels. Without this,
  a "small tweak" to a shared component can silently alter the desktop screens.
KEEP IN SYNC: update it in the same commit as a layout change (new --m-* token, new primitive behaviour).
-->

Below `md` (768px) the admin area is styled to match `../mobile_sslogistics`; desktop is untouched by any of it. Navigation is the Flutter-style navy drawer (`src/components/layout/mobileDrawer/`), opened from the app bar's menu button (`mobileTopBar`) or, on `/admin`, from the dashboard's own gradient header (`mobileDashboard`, via `useOpenMobileDrawer`). There is no bottom nav. Page lists come from `navConfig.ts`, the same source as the desktop Sidebar.

Phone-only shape and colour tokens live in `globals.css` as `--m-*` (card 16px, tile 18px, sheet 20px, control 12px, hero/drawer gradients), plus phone dark surfaces on the Flutter slate scale. Shared primitives carry their phone look as `max-md:` classes: `StatCard` becomes the summary-strip tile (any parent of `.ss-stat-card` lays out as a scrolling strip), `Tabs`/`SegmentedControl` become selectable chips, `Badge` a pill, `DataTable` cards the Flutter list card, modals and `BottomSheet` the Flutter form sheet, `PageFab` takes the module colour from `navConfig` (`accent`). `DataTable`'s `mobileCard` prop replaces a phone card's body when a list needs its own layout (Loans uses it). Restyle a phone screen by comparing it with the matching Flutter screen, and keep every change phone-scoped.

Work in progress on this (branch `feat/mobile-web-parity`): state, what's unchecked, and how to preview phone widths in Chrome are in `docs/mobile-parity-handoff.md` — open it only when continuing that work.

`npm run visual:baseline` / `npm run visual:compare` (`e2e-visual/`) screenshot every admin page at 390px (light and dark) and fail on any desktop pixel change. Run baseline before layout work and compare after.
