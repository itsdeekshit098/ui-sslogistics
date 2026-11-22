# Visual capture

Screenshots every admin page, and the shared overlays open on top of them, on the mocked dev server (same fixtures as `e2e/`). It is the safety net for layout and UI-library work: any pixel that moves fails. Not run by `npm run test:e2e` or the pre-commit hook.

```bash
npm run visual:baseline   # before a change: writes the reference images to visual-snapshots/baseline/<project>/
npm run visual:compare    # after: every project fails on any pixel difference
```

**Projects:** `mobile-light` and `mobile-dark` (390×844), `desktop` and `desktop-dark` (1440×900). Each has its own baseline folder, so light/dark and phone/desktop never share a file. The clock is fixed so dates and greetings match between runs. `visual-snapshots/` is gitignored.

**What is captured:** the admin list and detail pages, plus the overlays that come from the shared components: the new-loan modal, an open Select, an open Typeahead (combobox), the confirm-delete dialog, the phone filter drawer, the phone row-actions sheet, and the collapsed-sidebar tooltip. Add a shot to `SHOTS` in `capture.spec.ts` when a shared component gets a state that no shot shows yet.

**Phone shots are also copied** to `visual-snapshots/before/` and `visual-snapshots/after/` (set by `VISUAL_LABEL`) so a phone change can be reviewed side by side against the Flutter app. Those copies are for looking at; the pass/fail check is the comparison with the baseline.

Next's dev-mode badge is hidden in every shot (`hide-dev-overlay.css`) because it floats over the bottom-left corner and covers whatever is there.

## Baselining against another commit

`VISUAL_BASE_URL` points the run at an already-running mocked server instead of starting one on port 3100. To baseline the committed code while the working tree has changes: export `HEAD` with `git archive HEAD | tar -x -C <dir>`, copy `node_modules` into it (`cp -Rc` is a cheap clone on macOS — Turbopack refuses a symlinked `node_modules`), link `.env.local`, start its mocked server with `E2E_MOCK_AUTH=true NEXT_DIST_DIR=.next-mock-e2e npm run dev -- --port 3101`, then run `VISUAL_BASE_URL=http://localhost:3101 npm run visual:baseline` from the working tree.

## Keeping shots stable

A shot that differs between two runs of the same code is worse than no shot, so check a new one by running it several times against the same server. If a page reflows by a sub-pixel (a right-aligned button after the sidebar collapses did), crop the comparison to the component with `clip` instead of widening a tolerance.
