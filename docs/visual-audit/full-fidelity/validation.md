# BLASTLINE Batch 12 validation

Validation run: GitHub Actions `31730769507` on `batch-12-full-fidelity`.

## Automated project checks

The workflow actually ran and passed:

- `npm test`
- `node --check src/game.js`
- `node --check src/core.mjs`
- `node --check src/enemy-render.mjs`
- `node --check src/production-render.mjs`

The GitHub Actions job completed successfully, including source transform, validation, Chromium installation, real-browser capture, evidence commit and artifact upload.

## Real-browser controls validation

`docs/visual-audit/section-04/controls-validation.json` reports PASS for:

- keyboard steering;
- mouse/pointer steering;
- squad growth;
- automatic shooting/projectile ownership;
- left gate application;
- right gate application;
- pause state.

## Real-browser progression validation

`docs/visual-audit/section-04/progression-validation.json` reports PASS for:

- boss receiving damage;
- boss defeat;
- wave progression after upgrade selection;
- representative render benchmark gate.

Measured synchronous Canvas draw benchmark from the genuine run:

- 390×844 DPR1: **8.183 ms/draw**;
- 1365×768 DPR1: **14.483 ms/draw**;
- configured validation threshold: < 16.7 ms/draw;
- result: PASS.

The richer renderers cost more than the baseline (approximately 4.32 ms mobile / 10.81 ms desktop in the earlier baseline evidence), so desktop is now relatively close to the 16.7 ms threshold. Further sprite/gradient integration should avoid uncontrolled per-frame gradient/filter work.

## Console/browser errors

`docs/visual-audit/full-fidelity/final/runtime.json` records `errors: []` for the captured mobile, desktop, contact/death and boss sessions.

## Real visual evidence captured

- `final/home-mobile.png`
- `final/lane-choice-mobile.png`
- `final/gameplay-mobile.png`
- `final/elite-mobile.png`
- `final/dense-mobile.png`
- `final/boss-mobile.png`
- `final/upgrade-mobile.png`
- `final/victory-mobile.png`
- `final/game-over-mobile.png`
- `final/gameplay-desktop.png`

All are direct Chromium screenshots of the served production code. No generated/redrawn image is used as current-site evidence.

## Not validated in this run

Do not infer passes for items that were not exercised by the committed browser harness. This run did **not** separately prove:

- touch steering on a touch-enabled browser context;
- a live responsive resize event after page load;
- explicit retry-button restart behavior after game over;
- explicit run-again behavior after Victory;
- settings control (there is no separate settings control in this build);
- deployment through the actual Cloudflare edge, as opposed to the same static files served by the GitHub Actions local HTTP server.

These remain validation follow-ups rather than claimed passes.
