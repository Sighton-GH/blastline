# BLASTLINE validation

Validation evidence was regenerated from the running repository on 2026-08-15.

## Automated logic and syntax

- `npm test`: passed with 0 failures and 0 skipped tests.
- `node --check src/game.js`: passed.
- `node --check src/core.mjs`: passed.
- `node --check tools/final-browser-validation.mjs`: passed.

## Real Chromium validation

`node tools/final-browser-validation.mjs` passed at both required DPR 1 viewports:

- mobile: 390 × 844;
- desktop: 1365 × 768.

The regression exercises automatic travel/fire, touch, pointer, A/D, arrow keys, positive/harmful/neutral gates, gate single-trigger behavior, ordinary and elite contact, ordinary enemy ranged fire, kill rewards, boss attacks and damage, three unique upgrades, upgrade persistence, Game Over, clean Retry, final Victory, local persistence, and an accelerated natural six-wave progression with five upgrade stops.

The improvement-specific assertions also passed:

- Space and P pause the game; Space resumes it; simulation time and projectiles remain frozen while paused.
- Every visible soldier contributes a unique shooter ID and muzzle origin to a normal volley; projectile saturation produces a complete volley or waits, never a partial squad volley.
- Fired projectiles preserve their fixed line after the squad moves; no homing state exists.
- A generated horde contains at least 12 slow enemies, preserves each enemy's formation X coordinate, and advances through the four-frame march cycle.
- A base-power projectile defeats a grunt.
- Both projected bridge-deck edges stay within 0.05 CSS pixels of their endpoint lines.
- The live horde HUD is visible and reports the active enemy count.

Browser result: all 43 Boolean assertions passed, with no console errors, failed assets, or source-master runtime requests. Average measured Canvas draw cost was approximately 7.33 ms at mobile and 18.39 ms at desktop in the validation environment.

The machine-readable report and genuine screenshots are under `docs/visual-audit/final-2026-08-15/`.
