# BLASTLINE validation

Validation evidence was regenerated from the running repository on 2026-08-15.

## Automated logic and syntax

- `npm test`: 13 tests passed, 0 failed, 0 skipped.
- `node --check src/game.js`: passed.
- `node --check src/core.mjs`: passed.
- `node --check tools/final-browser-validation.mjs`: passed.

## Real Chromium validation

`node tools/final-browser-validation.mjs` passed at both required DPR 1 viewports:

- mobile: 390 × 844;
- desktop: 1365 × 768.

The regression exercises automatic travel/fire, touch, pointer, A/D, arrow keys, positive/harmful/neutral gates, gate single-trigger behavior, ordinary and elite contact, ordinary enemy ranged fire, kill rewards, pause/resume, boss attacks and damage, three unique upgrades, upgrade persistence, Game Over, clean Retry, final Victory, local persistence, and an accelerated natural six-wave progression with five upgrade stops.

Browser result: no console errors, page errors, failed assets, or source-master runtime requests. Average measured Canvas draw cost was approximately 3.73 ms at mobile and 7.80 ms at desktop in the validation environment.

The machine-readable report and genuine screenshots are under `docs/visual-audit/final-2026-08-15/`.
