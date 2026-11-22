# The UI library (`src/ui`)

The shared components of the portal, as one in-house library. Why it exists and what was rejected: [decision 0009](../decisions/0009-in-house-ui-library.md). This page is how to use it and how to add to it.

## Where things are

```
src/ui/
  components/<name>/      one folder per component: name.tsx, name.styles.ts, name.types.ts,
                          optional name.utils.ts, index.ts (the only importable file)
  patterns/<name>/        compositions of components: DataTable, PageHeader, StatCard, EmptyState,
                          ErrorState, FilterDrawer, ConfirmModal, PageSkeleton,
                          CardListSkeleton, FeedSkeleton (each its own folder)
  icons/                  87 icons from one factory (createIcon)
  hooks/                  useControllableState, useOutsideClick, useEscapeKey, usePopoverPosition,
                          useIsMobile, useScrollFade
  styles/                 mixins.ts (text, onPhone, onSm, onDesktop, locked…), tone.ts, segment.ts,
                          registry.tsx (styled-components SSR)
  tokens/                 tokens.css (the CSS variables), tokens.ts, media.ts, keyframes.ts
  utils/                  composeRefs, formatCurrency
test/ui/                  mirrors src/ui
```

Import a component from its folder, never a file inside it (lint enforces this outside `src/ui`):

```ts
import { Button } from "@ui/components/button";
import { DataTable, type ColumnDef } from "@ui/patterns/dataTable";
import { PlusIcon } from "@ui/icons";
```

`src/ui` may not import app code (`@/…`); a value the library needs from the app is passed in as a prop (the date pickers take `today`, so the library never reads the clock for a business day).

## What is in it

| Need | Use |
|---|---|
| Buttons, badges, cards, text fields, labels | `Button`, `Badge`, `Card…`, `Input`, `Textarea`, `Label` |
| A labelled field with hint and error (replaces `fieldGroup`/`fieldLabel`) | `FormField` (+ `FormGrid` for columns) |
| A number / an amount in rupees | `NumberInput`, `MoneyInput` (no `1e20`, ≤ 2 decimals, never silently altered) |
| A date / a month | `DatePicker`, `MonthPicker` (`YYYY-MM-DD` / `YYYY-MM` strings, no time zones; pass `today`) |
| One of a list | `Select` (Radix), `Combobox` (searchable), `SegmentedControl`, `Tabs` |
| Yes/no | `Checkbox`, `Switch` |
| A menu of actions ("⋯") | `Menu` (a bottom sheet on phones) · anchored panels: `Popover` |
| Overlays | `Modal…`, `ConfirmModal`, `BottomSheet`, `FilterDrawer`, `Tooltip` |
| Messages | `Alert` (inline; `scrollIntoView` for an error under a tall form), `ToastProvider` + `useToast()` (transient) |
| Status | `Chip` (filter/tag, removable), `Badge`, `Avatar` |
| Lists and tables | `DataTable` (cards on phones), `Table…`, `Pagination` |
| Loading / empty / error | `Spinner`, `Skeleton` (the one loading block; every placeholder is built from it), `PageSkeleton`, `LoadingOverlay`, `EmptyState`, `ErrorState` |
| Page chrome | `PageHeader`, `StatCard`, `FloatingActionButton` |

## How a component is styled

- Styles live **only** in `name.styles.ts`, as styled-components wrapped in `@layer ui { … }`. Colours, radii and spacing come from `tokens.ts` (`color.primary` is `var(--primary)`), so light/dark and the phone overrides work with no JavaScript theme. Raw hex values and magic pixel numbers are a review comment.
- **Phone rules** use `onPhone(css\`…\`)` (below 768px, Tailwind's `max-md:`), `onSm`, `onDesktop`. Desktop pixels never change for a phone-only edit.
- **No inline styles.** A value that changes continuously (a tooltip's position, a progress width) is set as CSS custom properties with `.attrs` in the styles file; nothing else.
- **`locked(css…)`** is for a rule a caller's class must not change (the old inline styles). Use it sparingly; it is for keeping an existing behaviour, not for new components.
- **`data-ui="name"`** on a component's root is its stable hook for global rules and tests. Existing `data-testid`s never change.
- ESLint (`eslint.config.mjs`) rejects `style=`, class-name strings and app imports anywhere in `src/ui`.

### A caller's `className` wins

The library's rules are in the `ui` layer, below Tailwind's `utilities`, so `<Button className="w-full">` still works and a caller's class beats the component's own. Two consequences worth knowing:

1. Tailwind used to sort a component's `sm:`/`max-md:` classes after a caller's *plain* class, so the component's media rule won. It now loses. Where an existing call site depended on that, it carries the class explicitly (81 sites, found by simulating the old `tailwind-merge`).
2. A caller's `text-lg` on a component that sets a fixed line height: `text-*` sizes read `--tw-leading`, which `leading-tight/snug/normal/relaxed` set but `leading-none` does not. Use `text()` and `setLeading()` from `styles/mixins.ts`; they follow the same rule.

## API conventions

- **New components** use `tone` (what it means: `neutral | primary | info | success | warning | danger`, from `styles/tone.ts`), `variant` (how it is drawn) and `size` (`sm | md | lg`). Button and Badge keep their original variant names for now.
- **Controlled and uncontrolled:** `value` / `defaultValue` / `onValueChange` (and `checked` / `onCheckedChange`) through `useControllableState`.
- Refs are forwarded; rest props go to the root; `className` is for outer layout only.
- Accessibility follows the WAI-ARIA pattern for the component (focus return on overlays, roving focus in menus and the calendar, `aria-describedby` from `FormField`). Danger and warning messages use `role="alert"`.

## Testing a component

- Behaviour and ARIA with Testing Library; **CSS with `styleOf(el, { state, media })`** from `@test/uiStyles`, which reads the generated rules inside `@layer ui` (jest-styled-components cannot). `isInUiLayer` and `hasLockedRule` check the layering.
- **Screenshots:** `npm run visual:baseline` before a change, `npm run visual:compare` after. It compares four projects (phone and desktop, light and dark) pixel for pixel, including open overlays. It runs against the dev server with mock auth; production disables mock auth, so a production comparison covers only the public pages (`/`, `/login`, `/privacy`, `/unauthorized`). See `e2e-visual/README.md` for baselining against another commit.
- When a screenshot differs by a pixel or two, dump the computed styles of the element in both builds and diff them; the cause was a line height, a dropped negative margin or a missing `text()` every time.

## Adding a component

1. A folder in `components/` (primitive) or `patterns/` (composition), with the five files above.
2. Style it in `@layer ui` from tokens; phone rules through `onPhone`; give the root a `data-ui`.
3. Export it, named, from `index.ts` (and from nowhere else).
4. A test in `test/ui/` for behaviour, keyboard, ARIA and CSS. Add a screenshot shot to `e2e-visual/capture.spec.ts` if it has an open state no shot shows.
5. Add it to the table above and a line to `src/ui/CHANGELOG.md`.

## Status

| Done | Left |
|---|---|
| All 31 existing components moved and restyled; 14 new components; tokens, hooks, tone vocabulary; lint boundary; 120-shot visual suite; 2,262 unit tests | **Feature screens still use native `type="date"`/`"month"`/`"number"` inputs (the money modules are done; the rest of the 46, 7 and 53), hand-built menus and message blocks, `fieldGroup`/`fieldLabel` (17 files) and 68 icon `style=` props.** Moving each module onto the new components is its own change, with a live pass on the money modules. |
| Loans (New/Edit Loan, Record Payment, EMI calendar month) moved onto `FormField`, `MoneyInput`, `NumberInput`, `DatePicker`, `MonthPicker`, `Alert`; driven in a real browser | Fundings, clients and salaries (every money form) moved the same way. The phone salaries header still uses a native month input behind its title, to keep the Flutter-style header. | The other modules (attendance, trips, diesel, repairs, warranty, vehicles, diesel pages) are next. |
| Select restyled | `Select` still wraps Radix (`@radix-ui/react-select`) for its listbox behaviour; replacing it needs the Combobox listbox engine. |
| Button/Badge restyled, `tone` on new components | Re-express Button/Badge variants as `variant` + `tone` (about 100 call sites, codemod-able). |
| `.ss-modal-*`, `.ss-fab`, `.ss-filter-panel` moved into their components | `.ss-panel` (16 files) and `.ss-stat-strip` are still page-level classes in `globals.css`; `RadioGroup`, `FileInput`, `Panel` and `StatStrip` are not built. |
