import type { Locator } from "@playwright/test";

/**
 * `.fill()` writes a field's value in one instant DOM write — no keydown
 * events, so even with slowMo pacing the clicks around it, every text field
 * still snaps to its full value at once. That reads as robotic no matter how
 * slow the surrounding actions are.
 *
 * Real per-character typing only matters when a human is actually watching
 * (`npm run test:e2e:watch`, which sets SLOWMO) — everywhere else (the fast
 * default run, CI-style local runs) `.fill()` is strictly better: faster and
 * exercises the same onChange path. Gated on SLOWMO instead of a separate
 * flag so one env var controls both "slow down" and "look human".
 */
export async function humanFill(locator: Locator, text: string): Promise<void> {
  if (!process.env.SLOWMO) {
    await locator.fill(text);
    return;
  }
  // Both fill() and pressSequentially() focus the element themselves —
  // no separate click() needed here.
  await locator.pressSequentially(text, { delay: 90 });
}
