---
name: screenshots
description: Capture desktop and 390px phone screenshots of one SS Logistics module from the running dev server into a git-ignored folder, so a person can look at the screen without anything being committed. Use when the user wants to see a module's screens, compare before/after a layout change, or refresh their memory of a page.
argument-hint: <module name, e.g. loans>
disable-model-invocation: true
---

# Screenshots: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — a procedure Claude follows in the same conversation.
WHY IT EXISTS: screenshots are deliberately NOT committed (they bloat git history forever, go stale
  silently, and the dev database holds real names, phone numbers and loan amounts). So a screen is
  re-photographed on demand into a folder git ignores.
HOW TO RUN IT: `/screenshots loans`. Only you can start it (it drives your browser).
TWO ROUTES: for ONE module, drive Chrome (steps below). For EVERY admin page at once, run
  `npm run visual:baseline` instead — it already writes to the git-ignored visual-snapshots/.
-->

## Rules

- Output goes to `visual-snapshots/screens/<module>/` — it is already git-ignored (`/visual-snapshots/` in `.gitignore`). Check with `git check-ignore visual-snapshots/screens/x.png` before saving anything; if it is not ignored, stop and say so.
- Never commit these. They can show real people's names, phone numbers and amounts.
- Never type a password. The user signs in in Chrome; if the page shows the login screen, ask them.

## Steps

1. Find the dev server (`lsof -nP -iTCP -sTCP:LISTEN | grep node`) and the module's page route from `src/lib/routePermissions.ts` / `navConfig.ts`.
2. Close extra app tabs (each holds SSE streams; Chrome allows six connections per host), then open one tab with `tabs_create_mcp`.
3. **Desktop:** navigate to the page, wait for it to finish loading, take a screenshot. Repeat for each distinct state worth seeing (list, an open dialog, an empty state, a detail page).
4. **Phone (390px):** Chrome can't make a window that narrow. Use the same-origin iframe method in `docs/mobile-parity-handoff.md` (host it on `/privacy` or `/login`, never `/admin`) so the real `max-md:` styles apply; screenshot the same states.
5. Save each image under `visual-snapshots/screens/<module>/` with a descriptive name (`list-desktop.png`, `list-phone.png`, `payment-dialog-phone.png`).
6. Reply with the file paths (full absolute paths) and one line per image on what it shows. If a state could not be reached (no data, wrong role), say so.
