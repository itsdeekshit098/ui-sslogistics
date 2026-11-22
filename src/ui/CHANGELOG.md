# UI library changelog

Changes to `src/ui`, newest first. What a user sees is in [docs/CHANGELOG.md](../../docs/CHANGELOG.md); how to use the library is in [docs/ui/README.md](../../docs/ui/README.md).

## 2026-11-22 — Alert reveal, phone wrapping

- **Added:** `Alert` takes `scrollIntoView`: it brings the message into view when it appears or its text changes, for an error under a tall form that scrolls inside a dialog. Used by the funding, client and deployment forms and Record Payment.
- **Fixed:** long unbroken text (a reference number) in `DataTable`'s phone cards and timeline now wraps instead of widening the card past the screen: the card-cell rule uses `overflow-wrap: anywhere` (only that lowers a flex item's minimum width), the timeline label keeps its width and the value may shrink. No existing screenshot changed (120/120).

## 2026-11-21 — review fixes and the first screens

- **Fixed:** Escape now closes only the topmost layer (`useEscapeKey` keeps one stack; `Modal`, `Popover`, `BottomSheet`, `FilterDrawer` use it); each `Modal` has its own title id; a drag from inside a dialog onto the backdrop no longer closes it; `NavigationProgress` stops orphaned timers and ignores query-only links; `Calendar` stops at the last allowed day and follows a changed value; `Combobox`'s first ArrowDown opens on the first option and its scroll listener is throttled; `useControllableState` warns in development when a field switches mode.
- **Added:** `Input` and `Textarea` show a red border when `aria-invalid` is set (which `FormField` does for you).
- **Screens moved on:** all money modules (loans, fundings, clients, salaries). See `docs/features/loans.md` and `docs/features/salaries.md`.

## 2026-11-21 — the library

- **Moved** the shared components out of `src/components/ui/` into `src/ui/` (`components/`, `patterns/`, `icons/`), one folder each, named exports only.
- **Renamed:** `Typeahead` → `Combobox`, `LoadingSpinner` → `Spinner`, `BusyOverlay` → `LoadingOverlay`, `PageFab` → `FloatingActionButton`, `PageLoadingSkeleton` → `PageSkeleton`, `skeletonLoader` → `skeleton`; `typeaheadFooterActionClassName` is now the `ComboboxFooterAction` component.
- **Skeletons:** `Skeleton` is the only loading block (gained `tone`, `block`, `center`); `PageSkeleton`, `CardListSkeleton` and `FeedSkeleton` are one folder each, and DataTable's own placeholders use `Skeleton` too. The shared `stack` mixin and `toCssLength` replace two copies each.
- **Restyled** every component with styled-components in the `ui` cascade layer: no Tailwind classes, no inline styles, tokens from `tokens.css`.
- **Replaced:** Radix Slot and Label (own `Slot`, plain `<label>`); the app's `cn` no longer used inside the library; `class-variance-authority` removed.
- **Icons:** one `createIcon` factory instead of 87 copies; icons accept any SVG prop.
- **Added:** `Alert`, `FormField`, `FormGrid`, `Checkbox`, `Switch`, `Chip`, `Avatar`, `NumberInput`, `MoneyInput`, `Popover`, `Menu`, `ToastProvider`/`useToast`, `DatePicker`, `MonthPicker`; hooks `useControllableState`, `useOutsideClick`, `useEscapeKey`, `usePopoverPosition`; `tone`; `FloatingActionButton`'s `AccentProvider` (the app supplies the module colour through `RouteAccent`).
- **API changes** that callers saw: `Select` gained `compact` and `matchTriggerWidth` on its content and `compact` on its items, in place of `viewportClassName`; `useScrollFade` returns `edges` instead of a style object; DataTable's header/row/card pieces are split into files.
