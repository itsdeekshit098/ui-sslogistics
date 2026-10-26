# Visual capture

Screenshots every admin page on the mocked dev server (same fixtures as `e2e/`), for layout work. Not run by `npm run test:e2e` or the pre-commit hook.

```bash
npm run visual:baseline   # before a change: phone shots -> visual-snapshots/before/, desktop reference -> visual-snapshots/desktop-baseline/
npm run visual:compare    # after: phone shots -> visual-snapshots/after/, desktop fails on any pixel difference
```

Projects: `mobile-light` and `mobile-dark` (390×844), `desktop` (1440×900). The clock is fixed so dates and greetings match between runs. `visual-snapshots/` is gitignored.
